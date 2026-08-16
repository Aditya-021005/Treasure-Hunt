import { hasPreviewAccess, readSession } from "@/lib/session";
import { transact } from "@/lib/store";
import { ensureStarted, guard, toPublicLevel, toState } from "@/lib/hunt";

/**
 * GET /api/state — the team's progress plus the level they are on.
 *
 * Nothing decryptable leaves this route until the hunt is open: the guard
 * runs before any level is projected.
 */
export async function GET() {
  const userId = await readSession();
  if (!userId) return Response.json({ error: "Not signed in." }, { status: 401 });

  const now = Date.now();
  const preview = await hasPreviewAccess();

  // Reading state is also what starts a team's clock, so this is a write.
  const payload = await transact((db) => {
    const user = db.users[userId];
    const team = user?.teamId ? db.teams[user.teamId] : undefined;
    const denied = guard(user, team, now, preview);
    if (denied) return { denied };

    ensureStarted(team!, now);
    return {
      state: toState(team!, db.users, userId, now),
      level: toPublicLevel(team!, team!.level),
    };
  });

  if ("denied" in payload && payload.denied) {
    const { error, status, opensAt } = payload.denied;
    return Response.json({ error, opensAt }, { status });
  }

  return Response.json(payload);
}
