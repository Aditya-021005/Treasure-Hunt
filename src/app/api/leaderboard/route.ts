import { readSession } from "@/lib/session";
import { read } from "@/lib/store";
import { leaderboard } from "@/lib/hunt";
import { huntIsOpen, publicWindow } from "@/lib/event";

/**
 * GET /api/leaderboard — public standings once the hunt is open.
 *
 * Before the start there is nothing to rank and the board would only leak
 * who registered, so it stays empty.
 */
export async function GET() {
  const userId = await readSession();

  if (!huntIsOpen()) {
    return Response.json({ rows: [], event: publicWindow() });
  }

  const teamId = userId
    ? await read((db) => db.users[userId]?.teamId ?? null)
    : null;

  const rows = await leaderboard(teamId);
  return Response.json({ rows, event: publicWindow() });
}
