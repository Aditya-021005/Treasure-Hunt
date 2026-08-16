import { clearSession } from "@/lib/session";

/** POST /api/auth/signout — drop the session cookie. Team data is kept. */
export async function POST() {
  await clearSession();
  return Response.json({ ok: true });
}
