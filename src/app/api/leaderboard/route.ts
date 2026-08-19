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
  const now = Date.now();

  // The window can be set from the admin panel. Reading it from the
  // environment alone meant sealing the hunt there left the board wide
  // open, and opening it there left the board empty.
  const { override, teamId } = await read((db) => ({
    override: db.eventOverride ?? null,
    teamId: userId ? (db.users[userId]?.teamId ?? null) : null,
  }));

  if (!huntIsOpen(now, override)) {
    return Response.json({ rows: [], event: publicWindow(now, override) });
  }

  const rows = await leaderboard(teamId);
  return Response.json({ rows, event: publicWindow(now, override) });
}
