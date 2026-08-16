import { HINT_PENALTY_MINUTES } from "@/content/levels";
import { levelFrom, levelsOf, totalLevels } from "@/lib/levels";
import type { DB } from "@/lib/store";
import { answerShape, matchesAnswer } from "@/lib/answers";
import { huntIsOpen, publicWindow, type EventOverride } from "@/lib/event";
import {
  formatCode,
  read,
  transact,
  type Team,
  type User,
} from "@/lib/store";
import type {
  LeaderboardRow,
  Member,
  PublicLevel,
  RailEntry,
  TeamState,
  TeamSummary,
} from "@/lib/types";

/* ----------------------------- rate limiting ---------------------- */

/** Minimum gap between two submissions from one team. */
const MIN_GAP_MS = 700;
/** Wrong answers allowed before a cooldown kicks in. */
const STRIKES = 5;
const COOLDOWN_STEP_MS = 15_000;
const COOLDOWN_MAX_MS = 90_000;

export function cooldownFor(attempts: number): number {
  if (attempts === 0 || attempts % STRIKES !== 0) return 0;
  return Math.min((attempts / STRIKES) * COOLDOWN_STEP_MS, COOLDOWN_MAX_MS);
}

/* ------------------------------- projection ----------------------- */

export function elapsedMs(team: Team, now: number): number {
  if (team.startedAt === null) return team.penaltyMs;
  const end = team.finishedAt ?? now;
  return Math.max(0, end - team.startedAt) + team.penaltyMs;
}

function rail(db: DB, team: Team): RailEntry[] {
  return levelsOf(db).map((l) => ({
    id: l.id,
    codename: l.codename,
    status:
      l.id < team.level ? "solved" : l.id === team.level ? "active" : "locked",
  }));
}

export function membersOf(
  team: Team,
  users: Record<string, User>,
  viewerId: string | null,
): Member[] {
  return team.memberIds
    .map((id) => users[id])
    .filter(Boolean)
    .map((u) => ({
      name: u.name,
      email: u.email,
      isCaptain: u.id === team.captainId,
      isYou: u.id === viewerId,
    }));
}

export function toTeamSummary(
  db: DB,
  team: Team,
  users: Record<string, User>,
  viewerId: string,
): TeamSummary {
  return {
    name: team.name,
    code: formatCode(team.code),
    isCaptain: team.captainId === viewerId,
    members: membersOf(team, users, viewerId),
    solved: Math.min(team.level - 1, totalLevels(db)),
    totalLevels: totalLevels(db),
    finished: team.level > totalLevels(db),
  };
}

export function toState(
  db: DB,
  team: Team,
  users: Record<string, User>,
  viewerId: string,
  now: number,
  override: EventOverride = null,
): TeamState {
  return {
    team: {
      name: team.name,
      code: formatCode(team.code),
      members: membersOf(team, users, viewerId),
      isCaptain: team.captainId === viewerId,
    },
    level: team.level,
    totalLevels: totalLevels(db),
    finished: team.level > totalLevels(db),
    startedAt: team.startedAt ?? now,
    finishedAt: team.finishedAt,
    penaltyMs: team.penaltyMs,
    elapsedMs: elapsedMs(team, now),
    rail: rail(db, team),
    lockedUntil: team.lockedUntil > now ? team.lockedUntil : null,
    hintPenaltyMinutes: HINT_PENALTY_MINUTES,
    event: publicWindow(now, override),
  };
}

/**
 * Builds the browser-facing view of a level. Answers, gate sequences and
 * un-unlocked hints are stripped here — this is the security boundary.
 */
export function toPublicLevel(db: DB, team: Team, id: number): PublicLevel | null {
  const level = levelFrom(db, id);
  if (!level) return null;

  const revealed = team.hintsUsed[String(id)] ?? 0;
  const gateOpen = team.gatesOpen.includes(id);

  return {
    id: level.id,
    codename: level.codename,
    title: level.title,
    brief: level.brief,
    blocks: level.blocks,
    gate: level.gate
      ? {
          prompt: level.gate.prompt,
          tiles: level.gate.tiles,
          length: level.gate.sequence.length,
          open: gateOpen,
          ...(gateOpen
            ? {
                rewardCaption: level.gate.rewardCaption,
                reward: level.gate.reward,
              }
            : {}),
        }
      : undefined,
    revealedHints: level.hints.slice(0, revealed),
    hintsRemaining: Math.max(0, level.hints.length - revealed),
    nextHintCosts: revealed >= level.freeHints,
    attempts: team.attempts[String(id)] ?? 0,
    // Only the count — the answer itself never crosses this boundary.
    answerShape:
      level.showLength === false ? null : answerShape(level.answers[0] ?? ""),
  };
}

/* ---------------------------- access checks ----------------------- */

export type Denial = { error: string; status: number; opensAt?: number };

/**
 * Every puzzle-bearing endpoint funnels through here. A caller must be
 * signed in, on a team, and the hunt must actually be open.
 */
export function guard(
  user: User | undefined,
  team: Team | undefined,
  now: number,
  /** Organiser preview pass; bypasses the time window only. */
  preview = false,
  override: EventOverride = null,
): Denial | null {
  if (!user) return { error: "Sign in to continue.", status: 401 };
  if (!team) return { error: "Join or create a team first.", status: 403 };
  if (!preview && !huntIsOpen(now, override)) {
    const w = publicWindow(now, override);
    return {
      error:
        w.phase === "before"
          ? "The hunt has not opened yet."
          : "The hunt has closed.",
      status: 403,
      opensAt: w.opensAt ?? undefined,
    };
  }
  return null;
}

/**
 * The live window, including anything set from the admin panel. Used by
 * server components that need to gate before rendering.
 */
export async function huntOpenNow(): Promise<boolean> {
  return read((db) => huntIsOpen(Date.now(), db.eventOverride ?? null));
}

/** Starts a team's clock the first time they reach the hunt after it opens. */
export function ensureStarted(team: Team, now: number): void {
  if (team.startedAt === null) team.startedAt = now;
}

/* -------------------------------- actions ------------------------- */

export type SubmitResult =
  | {
      ok: true;
      correct: true;
      successNote: string;
      finished: boolean;
      state: TeamState;
    }
  | {
      ok: true;
      correct: false;
      message: string;
      lockedUntil: number | null;
      state: TeamState;
    }
  | { ok: false; error: string; status: number; lockedUntil?: number };

const WRONG_LINES = [
  "Signal rejected. That is not the word.",
  "The lock does not turn.",
  "No match in the register.",
  "Wrong. The dark is patient; be patient with it.",
  "Rejected. Read the clue again — all of it.",
];

export async function submitAnswer(
  userId: string,
  levelId: number,
  guess: string,
  preview = false,
): Promise<SubmitResult> {
  const now = Date.now();

  return transact((db) => {
    const user = db.users[userId];
    const team = user?.teamId ? db.teams[user.teamId] : undefined;
    const denied = guard(user, team, now, preview, db.eventOverride ?? null);
    if (denied) return { ok: false as const, ...denied };

    const t = team!;
    if (t.level > totalLevels(db))
      return { ok: false as const, error: "The hunt is already complete.", status: 400 };
    if (levelId !== t.level)
      return { ok: false as const, error: "That level is not open to you.", status: 403 };
    if (t.lockedUntil > now)
      return {
        ok: false as const,
        error: "Terminal cooling down.",
        status: 429,
        lockedUntil: t.lockedUntil,
      };
    if (now - t.lastAttemptAt < MIN_GAP_MS)
      return { ok: false as const, error: "Slow down.", status: 429 };

    ensureStarted(t, now);
    const level = levelFrom(db, levelId)!;
    t.lastAttemptAt = now;

    if (level.gate && !t.gatesOpen.includes(levelId)) {
      return {
        ok: false as const,
        error: "The plates are still scrambled. Open the lock first.",
        status: 400,
      };
    }

    if (matchesAnswer(guess, level.answers)) {
      t.solvedAt[String(levelId)] = now;
      t.level = levelId + 1;
      if (t.level > totalLevels(db)) t.finishedAt = now;
      return {
        ok: true as const,
        correct: true as const,
        successNote: level.successNote,
        finished: t.level > totalLevels(db),
        state: toState(db, t, db.users, userId, now, db.eventOverride ?? null),
      };
    }

    const attempts = (t.attempts[String(levelId)] ?? 0) + 1;
    t.attempts[String(levelId)] = attempts;
    const cool = cooldownFor(attempts);
    if (cool > 0) t.lockedUntil = now + cool;

    return {
      ok: true as const,
      correct: false as const,
      message: WRONG_LINES[attempts % WRONG_LINES.length],
      lockedUntil: cool > 0 ? t.lockedUntil : null,
      state: toState(db, t, db.users, userId, now, db.eventOverride ?? null),
    };
  });
}

export type GateResult =
  | { ok: true; opened: true; level: PublicLevel }
  | { ok: true; opened: false; message: string }
  | { ok: false; error: string; status: number };

export async function checkGate(
  userId: string,
  levelId: number,
  sequence: string[],
  preview = false,
): Promise<GateResult> {
  const now = Date.now();

  return transact((db) => {
    const user = db.users[userId];
    const team = user?.teamId ? db.teams[user.teamId] : undefined;
    const denied = guard(user, team, now, preview, db.eventOverride ?? null);
    if (denied) return { ok: false as const, ...denied };

    const t = team!;
    if (levelId !== t.level)
      return { ok: false as const, error: "That level is not open to you.", status: 403 };

    const level = levelFrom(db, levelId);
    if (!level?.gate)
      return { ok: false as const, error: "This level has no lock.", status: 400 };
    if (now - t.lastAttemptAt < MIN_GAP_MS)
      return { ok: false as const, error: "Slow down.", status: 429 };

    ensureStarted(t, now);
    t.lastAttemptAt = now;

    const want = level.gate.sequence;
    const got = sequence.map(String);
    const match =
      got.length === want.length && want.every((id, i) => id === got[i]);

    if (!match) {
      return {
        ok: true as const,
        opened: false as const,
        message: "The plates rattle and reset. Wrong five, or wrong order.",
      };
    }

    if (!t.gatesOpen.includes(levelId)) t.gatesOpen.push(levelId);
    return { ok: true as const, opened: true as const, level: toPublicLevel(db, t, levelId)! };
  });
}

export type HintResult =
  | { ok: true; level: PublicLevel; state: TeamState; charged: boolean }
  | { ok: false; error: string; status: number };

export async function unlockHint(
  userId: string,
  levelId: number,
  preview = false,
): Promise<HintResult> {
  const now = Date.now();

  return transact((db) => {
    const user = db.users[userId];
    const team = user?.teamId ? db.teams[user.teamId] : undefined;
    const denied = guard(user, team, now, preview, db.eventOverride ?? null);
    if (denied) return { ok: false as const, ...denied };

    const t = team!;
    if (levelId !== t.level)
      return { ok: false as const, error: "That level is not open to you.", status: 403 };

    const level = levelFrom(db, levelId);
    if (!level) return { ok: false as const, error: "Unknown level.", status: 400 };

    const used = t.hintsUsed[String(levelId)] ?? 0;
    if (used >= level.hints.length)
      return {
        ok: false as const,
        error: "No hints left on this transmission.",
        status: 400,
      };

    ensureStarted(t, now);
    const charged = used >= level.freeHints;
    t.hintsUsed[String(levelId)] = used + 1;
    if (charged) t.penaltyMs += HINT_PENALTY_MINUTES * 60_000;

    return {
      ok: true as const,
      level: toPublicLevel(db, t, levelId)!,
      state: toState(db, t, db.users, userId, now, db.eventOverride ?? null),
      charged,
    };
  });
}

/* ------------------------------ leaderboard ----------------------- */

export async function leaderboard(
  viewerTeamId: string | null,
): Promise<LeaderboardRow[]> {
  const rows = await read((db) =>
    Object.values(db.teams).map((t) => {
      const total = totalLevels(db);
      const solved = Math.min(t.level - 1, total);
      const solveTimes = Object.values(t.solvedAt);
      const lastSolve = solveTimes.length ? Math.max(...solveTimes) : null;
      // Finished teams are timed to the finish; teams still playing are
      // timed to their most recent solve, so sitting idle costs nothing.
      const start = t.startedAt ?? t.createdAt;
      const end = t.finishedAt ?? lastSolve ?? start;
      return {
        id: t.id,
        name: t.name,
        solved,
        totalLevels: total,
        finished: t.finishedAt !== null,
        timeMs: Math.max(0, end - start) + t.penaltyMs,
        hintsUsed: Object.values(t.hintsUsed).reduce((a, b) => a + b, 0),
        startedAt: start,
      };
    }),
  );

  rows.sort((a, b) => {
    if (b.solved !== a.solved) return b.solved - a.solved;
    if (a.solved === 0) return a.startedAt - b.startedAt;
    return a.timeMs - b.timeMs;
  });

  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    solved: r.solved,
    totalLevels: r.totalLevels,
    finished: r.finished,
    timeMs: r.timeMs,
    hintsUsed: r.hintsUsed,
    isYou: r.id === viewerTeamId,
  }));
}
