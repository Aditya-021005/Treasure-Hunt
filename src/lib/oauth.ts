import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Google sign-in, hand-rolled: authorization code flow with PKCE.
 *
 * The code is exchanged server-to-server with Google's token endpoint over
 * TLS, so the id_token arrives directly from the issuer and its signature
 * does not need separate JWKS verification — but we still check `iss`,
 * `aud`, `exp`, `nonce` and `email_verified` before trusting anything, and
 * the email domain is checked against the allow-list on top of that.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const VALID_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  hd: string | null;
};

/* --------------------------------- config ------------------------- */

export function clientId(): string {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}

function clientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

export function googleConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

/**
 * Dev-only shortcut that skips Google entirely. Refuses to switch on in a
 * production build, so it cannot be enabled by accident on the event box.
 */
export function mockAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" && process.env.HUNT_AUTH_MOCK === "1"
  );
}

const DEFAULT_DOMAINS = [
  "pilani.bits-pilani.ac.in",
  "goa.bits-pilani.ac.in",
  "hyderabad.bits-pilani.ac.in",
  "dubai.bits-pilani.ac.in",
];

export function allowedDomains(): string[] {
  const raw = process.env.HUNT_ALLOWED_DOMAINS;
  if (raw === "*") return [];
  if (!raw || !raw.trim()) return DEFAULT_DOMAINS;
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/** Server-side domain check. Never trust the `hd` hint on its own. */
export function domainAllowed(email: string): boolean {
  const domains = allowedDomains();
  if (domains.length === 0) return true; // explicitly opened with "*"
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const host = email.slice(at + 1).toLowerCase();
  return domains.some((d) => host === d);
}

export function redirectUri(origin: string): string {
  return process.env.HUNT_OAUTH_REDIRECT ?? `${origin}/api/auth/callback`;
}

/* ---------------------------------- PKCE -------------------------- */

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

/* -------------------------------- the flow ------------------------ */

export function buildAuthUrl(opts: {
  origin: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const domains = allowedDomains();
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", redirectUri(opts.origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("nonce", opts.nonce);
  url.searchParams.set("code_challenge", opts.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  // A hint only — the real check happens on the returned email.
  if (domains.length === 1) url.searchParams.set("hd", domains[0]);
  return url.toString();
}

type IdTokenClaims = {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  hd?: string;
};

function decodeJwtPayload(jwt: string): IdTokenClaims | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as IdTokenClaims;
  } catch {
    return null;
  }
}

export type ExchangeResult =
  | { ok: true; identity: GoogleIdentity }
  | { ok: false; reason: string };

export async function exchangeCode(opts: {
  code: string;
  verifier: string;
  nonce: string;
  origin: string;
}): Promise<ExchangeResult> {
  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: opts.code,
        client_id: clientId(),
        client_secret: clientSecret(),
        redirect_uri: redirectUri(opts.origin),
        grant_type: "authorization_code",
        code_verifier: opts.verifier,
      }),
    });
  } catch {
    return { ok: false, reason: "Could not reach Google." };
  }

  if (!res.ok) return { ok: false, reason: "Google rejected the sign-in." };

  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) return { ok: false, reason: "Google returned no identity." };

  const claims = decodeJwtPayload(body.id_token);
  if (!claims) return { ok: false, reason: "Malformed identity token." };

  if (!claims.iss || !VALID_ISSUERS.has(claims.iss))
    return { ok: false, reason: "Unexpected token issuer." };
  if (claims.aud !== clientId())
    return { ok: false, reason: "Token was issued for a different app." };
  if (!claims.exp || claims.exp * 1000 <= Date.now())
    return { ok: false, reason: "Sign-in expired. Try again." };
  if (!claims.nonce || !safeEqual(claims.nonce, opts.nonce))
    return { ok: false, reason: "Sign-in could not be verified. Try again." };

  const verified =
    claims.email_verified === true || claims.email_verified === "true";
  if (!claims.sub || !claims.email || !verified)
    return { ok: false, reason: "That Google account has no verified email." };

  return {
    ok: true,
    identity: {
      sub: claims.sub,
      email: claims.email.toLowerCase(),
      name: claims.name?.trim() || claims.email.split("@")[0],
      picture: claims.picture ?? null,
      hd: claims.hd ?? null,
    },
  };
}
