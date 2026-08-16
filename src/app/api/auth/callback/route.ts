import type { NextRequest } from "next/server";
import { domainAllowed, exchangeCode, safeEqual } from "@/lib/oauth";
import { clearHandshake, readHandshake, writeSession } from "@/lib/session";
import { upsertUser } from "@/lib/accounts";

const fail = (origin: string, code: string) =>
  Response.redirect(`${origin}/?authError=${encodeURIComponent(code)}`, 302);

/** GET /api/auth/callback — Google redirects back here with a code. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const params = req.nextUrl.searchParams;

  if (params.get("error")) {
    await clearHandshake();
    return fail(origin, "cancelled");
  }

  const code = params.get("code");
  const state = params.get("state");
  const handshake = await readHandshake();
  await clearHandshake();

  if (!code || !state || !handshake.state || !handshake.verifier || !handshake.nonce)
    return fail(origin, "handshake");
  if (!safeEqual(state, handshake.state)) return fail(origin, "state");

  const result = await exchangeCode({
    code,
    verifier: handshake.verifier,
    nonce: handshake.nonce,
    origin,
  });
  if (!result.ok) return fail(origin, "exchange");

  if (!domainAllowed(result.identity.email)) return fail(origin, "domain");

  const userId = await upsertUser(result.identity);
  await writeSession(userId);

  return Response.redirect(`${origin}/`, 302);
}
