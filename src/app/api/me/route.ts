import { readSession } from "@/lib/session";
import { getMe } from "@/lib/accounts";

/**
 * GET /api/me — session, team and event window.
 *
 * Carries no puzzle content whatsoever, so it is safe to call from the
 * public landing page before the hunt opens.
 */
export async function GET() {
  const userId = await readSession();
  return Response.json(await getMe(userId));
}
