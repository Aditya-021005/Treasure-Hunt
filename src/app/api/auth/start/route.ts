import type { NextRequest } from "next/server";
import { buildAuthUrl, challengeFor, googleConfigured, randomToken } from "@/lib/oauth";
import { writeHandshake } from "@/lib/session";

/** GET /api/auth/start — kick off the Google authorization code flow. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  if (!googleConfigured()) {
    return Response.redirect(`${origin}/?authError=unconfigured`, 302);
  }

  const state = randomToken();
  const verifier = randomToken(48);
  const nonce = randomToken();

  await writeHandshake({ state, verifier, nonce });

  const url = buildAuthUrl({
    origin,
    state,
    nonce,
    codeChallenge: challengeFor(verifier),
  });

  return Response.redirect(url, 302);
}
