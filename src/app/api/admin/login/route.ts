import type { NextRequest } from "next/server";
import {
  adminLoginConfigured,
  clearFailedLogins,
  credentialsMatch,
  grantAdminSession,
  loginBlockedFor,
  noteFailedLogin,
  revokeAdminSession,
} from "@/lib/admin-auth";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** POST /api/admin/login — { user, pass } */
export async function POST(req: NextRequest) {
  if (!adminLoginConfigured())
    return Response.json(
      { error: "Password sign-in is not set up on this server." },
      { status: 400 },
    );

  const ip = clientIp(req);
  const blocked = loginBlockedFor(ip);
  if (blocked > 0)
    return Response.json(
      { error: `Too many attempts. Try again in ${Math.ceil(blocked / 60000)} min.` },
      { status: 429 },
    );

  let body: { user?: unknown; pass?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const user = typeof body.user === "string" ? body.user.trim() : "";
  const pass = typeof body.pass === "string" ? body.pass : "";

  if (!credentialsMatch(user, pass)) {
    noteFailedLogin(ip);
    // Never say which half was wrong.
    return Response.json({ error: "Wrong username or password." }, { status: 401 });
  }

  clearFailedLogins(ip);
  await grantAdminSession();
  console.warn(`[bep-hunt] admin signed in with a password from ${ip}`);
  return Response.json({ ok: true });
}

/** DELETE — sign out of the admin panel. */
export async function DELETE() {
  await revokeAdminSession();
  return Response.json({ ok: true });
}
