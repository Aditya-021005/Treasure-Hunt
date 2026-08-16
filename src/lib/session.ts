import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "bep_hunt";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Short-lived cookies that carry the OAuth handshake across the redirect. */
export const OAUTH_STATE = "bep_oauth_state";
export const OAUTH_VERIFIER = "bep_oauth_verifier";
export const OAUTH_NONCE = "bep_oauth_nonce";
const OAUTH_MAX_AGE = 10 * 60;

let warned = false;

function secret(): string {
  const s = process.env.HUNT_SECRET;
  if (s && s.length >= 16) return s;
  if (!warned) {
    warned = true;
    console.warn(
      "[bep-hunt] HUNT_SECRET is unset or too short — falling back to a " +
        "development key. Set it in .env.local before running the real event.",
    );
  }
  return "dev-only-insecure-key-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export function newToken(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

/* ------------------------------ user session ---------------------- */

/** Reads and verifies the signed session cookie, returning the user id. */
export async function readSession(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  return safeEqual(sig, sign(userId)) ? userId : null;
}

export async function writeSession(userId: string): Promise<void> {
  (await cookies()).set(COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/* ---------------------------- oauth handshake --------------------- */

export async function writeHandshake(v: {
  state: string;
  verifier: string;
  nonce: string;
}): Promise<void> {
  const jar = await cookies();
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookies(),
    path: "/",
    maxAge: OAUTH_MAX_AGE,
  };
  jar.set(OAUTH_STATE, v.state, opts);
  jar.set(OAUTH_VERIFIER, v.verifier, opts);
  jar.set(OAUTH_NONCE, v.nonce, opts);
}

export async function readHandshake(): Promise<{
  state: string | null;
  verifier: string | null;
  nonce: string | null;
}> {
  const jar = await cookies();
  return {
    state: jar.get(OAUTH_STATE)?.value ?? null,
    verifier: jar.get(OAUTH_VERIFIER)?.value ?? null,
    nonce: jar.get(OAUTH_NONCE)?.value ?? null,
  };
}

export async function clearHandshake(): Promise<void> {
  const jar = await cookies();
  jar.delete(OAUTH_STATE);
  jar.delete(OAUTH_VERIFIER);
  jar.delete(OAUTH_NONCE);
}
