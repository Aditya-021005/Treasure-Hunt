import type { NextRequest } from "next/server";
import { domainAllowed, mockAuthEnabled } from "@/lib/oauth";
import { writeSession } from "@/lib/session";
import { upsertUser } from "@/lib/accounts";

/**
 * POST /api/auth/mock — development-only sign-in that skips Google, so the
 * whole flow can be exercised without OAuth credentials.
 *
 * `mockAuthEnabled()` is false in any production build, so this endpoint
 * cannot be turned on for the real event.
 */
export async function POST(req: NextRequest) {
  if (!mockAuthEnabled())
    return Response.json({ error: "Not found." }, { status: 404 });

  let body: { email?: unknown; name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : email;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return Response.json({ error: "Bad email." }, { status: 400 });
  if (!domainAllowed(email))
    return Response.json({ error: "Domain not allowed." }, { status: 403 });

  const userId = await upsertUser({
    sub: `mock:${email}`,
    email,
    name,
    picture: null,
    hd: null,
  });
  await writeSession(userId);
  return Response.json({ ok: true });
}
