import { publicWindow } from "@/lib/event";
import { totalLevels } from "@/lib/levels";
import { formatCode, read, transact } from "@/lib/store";
import { hasAdminSession } from "@/lib/admin-auth";
import type { AdminOverview, AdminTeamRow } from "@/lib/types";

/**
 * One of the two ways into the panel: an explicit allow-list of email
 * addresses, checked against the signed-in Google account. The other is
 * the username and password in lib/admin-auth.ts. If neither matches,
 * /admin does not exist for you.
 *
 *   HUNT_ADMINS=aditya@pilani.bits-pilani.ac.in,someone@pilani.bits-pilani.ac.in
 */
export function adminEmails(): string[] {
  const raw = process.env.HUNT_ADMINS;
  if (!raw || !raw.trim()) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = adminEmails();
  return list.length > 0 && list.includes(email.trim().toLowerCase());
}

/**
 * Resolves the caller to an admin, or null.
 *
 * Two ways in: the signed-in Google account is on HUNT_ADMINS, or they
 * signed in with the admin username and password.
 */
export async function requireAdmin(
  userId: string | null,
): Promise<{ id: string; email: string; name: string } | null> {
  if (userId) {
    const viaEmail = await read((db) => {
      const u = db.users[userId];
      if (!u || !isAdminEmail(u.email)) return null;
      return { id: u.id, email: u.email, name: u.name };
    });
    if (viaEmail) return viaEmail;
  }

  if (await hasAdminSession())
    return {
      id: "admin-password",
      email: `${process.env.HUNT_ADMIN_USER} (password sign-in)`,
      name: "Admin",
    };

  return null;
}

/* ------------------------------- overview ------------------------- */

export async function overview(): Promise<AdminOverview> {
  const now = Date.now();

  return read((db) => {
    const total = totalLevels(db);
    const teams: AdminTeamRow[] = Object.values(db.teams).map((t) => {
      const solved = Math.min(t.level - 1, total);
      const solveTimes = Object.values(t.solvedAt);
      const lastSolve = solveTimes.length ? Math.max(...solveTimes) : null;
      const start = t.startedAt ?? t.createdAt;
      const end = t.finishedAt ?? lastSolve ?? start;
      return {
        id: t.id,
        name: t.name,
        code: formatCode(t.code),
        createdAt: t.createdAt,
        startedAt: t.startedAt,
        finishedAt: t.finishedAt,
        solved,
        totalLevels: total,
        timeMs: t.startedAt === null ? 0 : Math.max(0, end - start) + t.penaltyMs,
        penaltyMs: t.penaltyMs,
        hintsUsed: Object.values(t.hintsUsed).reduce((a, b) => a + b, 0),
        attempts: Object.values(t.attempts).reduce((a, b) => a + b, 0),
        members: t.memberIds
          .map((id) => db.users[id])
          .filter(Boolean)
          .map((u) => ({
            name: u.name,
            email: u.email,
            isCaptain: u.id === t.captainId,
          })),
      };
    });

    teams.sort((a, b) => b.createdAt - a.createdAt);

    const started = teams.filter((t) => t.startedAt !== null).length;

    return {
      event: publicWindow(now, db.eventOverride ?? null),
      /** True when the window comes from the panel rather than the env. */
      overridden: Boolean(db.eventOverride),
      totals: {
        teams: teams.length,
        users: Object.keys(db.users).length,
        started,
        finished: teams.filter((t) => t.finishedAt !== null).length,
        totalLevels: total,
      },
      teams,
      admins: adminEmails(),
      vaultNote: db.vaultNote ?? "",
    };
  });
}

/* -------------------------------- actions ------------------------- */

export async function setEventWindow(
  opensAt: number | null,
  closesAt: number | null,
): Promise<void> {
  await transact((db) => {
    db.eventOverride = { opensAt, closesAt };
  });
}

/** The last screen of the hunt. Empty string clears it. */
export async function setVaultNote(text: string): Promise<void> {
  const clean = text.trim().slice(0, 600);
  await transact((db) => {
    db.vaultNote = clean || null;
  });
}

/** Hands control back to HUNT_OPENS_AT / HUNT_CLOSES_AT. */
export async function clearEventWindow(): Promise<void> {
  await transact((db) => {
    db.eventOverride = null;
  });
}

export type TeamAction = "reset" | "delete";

export async function actOnTeam(
  teamId: string,
  action: TeamAction,
): Promise<{ ok: boolean; error?: string }> {
  return transact((db) => {
    const team = db.teams[teamId];
    if (!team) return { ok: false, error: "No such team." };

    if (action === "reset") {
      team.level = 1;
      team.startedAt = null;
      team.finishedAt = null;
      team.solvedAt = {};
      team.hintsUsed = {};
      team.attempts = {};
      team.gatesOpen = [];
      team.penaltyMs = 0;
      team.lastAttemptAt = 0;
      team.lockedUntil = 0;
      return { ok: true };
    }

    // delete: release the name and code, and free every member to re-team
    for (const id of team.memberIds) {
      const u = db.users[id];
      if (u) u.teamId = null;
    }
    delete db.teams[team.id];
    delete db.teamBySlug[team.slug];
    delete db.teamByCode[team.code];
    return { ok: true };
  });
}

/** Clears every team and user. The event window setting is preserved. */
export async function wipeEverything(): Promise<{ teams: number; users: number }> {
  return transact((db) => {
    const counts = {
      teams: Object.keys(db.teams).length,
      users: Object.keys(db.users).length,
    };
    db.teams = {};
    db.users = {};
    db.userBySub = {};
    db.teamBySlug = {};
    db.teamByCode = {};
    return counts;
  });
}

/* --------------------------------- export ------------------------- */

function csvCell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportCsv(): Promise<string> {
  const data = await overview();
  const head = [
    "rank",
    "team",
    "code",
    "locks_solved",
    "total_locks",
    "finished",
    "time_seconds",
    "hint_penalty_minutes",
    "hints_used",
    "wrong_attempts",
    "members",
    "emails",
    "registered_at",
  ];

  const ranked = [...data.teams].sort((a, b) => {
    if (b.solved !== a.solved) return b.solved - a.solved;
    if (a.solved === 0) return a.createdAt - b.createdAt;
    return a.timeMs - b.timeMs;
  });

  const rows = ranked.map((t, i) =>
    [
      i + 1,
      t.name,
      t.code,
      t.solved,
      t.totalLevels,
      t.finishedAt ? "yes" : "no",
      Math.round(t.timeMs / 1000),
      Math.round(t.penaltyMs / 60000),
      t.hintsUsed,
      t.attempts,
      t.members.map((m) => m.name).join("; "),
      t.members.map((m) => m.email).join("; "),
      new Date(t.createdAt).toISOString(),
    ]
      .map(csvCell)
      .join(","),
  );

  return [head.join(","), ...rows].join("\n");
}
