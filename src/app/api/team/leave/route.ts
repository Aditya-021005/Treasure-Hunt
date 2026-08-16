import { readSession } from "@/lib/session";
import { leaveTeam } from "@/lib/accounts";

/** POST /api/team/leave */
export async function POST() {
  const userId = await readSession();
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });

  const result = await leaveTeam(userId);
  if (!result.ok)
    return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.me);
}
