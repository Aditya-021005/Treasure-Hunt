import {
  COOLDOWN_MAX_SECONDS,
  COOLDOWN_STEP_SECONDS,
  HINT_BUDGET,
  WRONG_PENALTY_MINUTES,
  WRONG_STRIKES,
  hintCostMinutes,
} from "@/lib/rules";
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
const STRIKES = WRONG_STRIKES;
const COOLDOWN_STEP_MS = COOLDOWN_STEP_SECONDS * 1_000;
const COOLDOWN_MAX_MS = COOLDOWN_MAX_SECONDS * 1_000;
const WRONG_PENALTY_MS = WRONG_PENALTY_MINUTES * 60_000;

export function cooldownFor(attempts: number): number {
  if (attempts === 0 || attempts % STRIKES !== 0) return 0;
  return Math.min((attempts / STRIKES) * COOLDOWN_STEP_MS, COOLDOWN_MAX_MS);
}

/* ------------------------------- projection ----------------------- */

/** Hints this team has unlocked across every level. */
export function hintsTaken(team: Team): number {
  return Object.values(team.hintsUsed).reduce((a, b) => a + b, 0);
}

export const R1_OFFICIAL_START = 1789560713083; // 2026-09-16T12:11:53.083Z
export const R3_OFFICIAL_START = 1789919640000; // 2026-09-20T15:54:00.000Z
export const MAX_QUESTION_MS = 45 * 60 * 1000; // Cap single-question time at 45m to prevent overnight inactive gaps

/**
 * Calculates active time for each individual round based solely on the time
 * spent actively solving questions in that round.
 * Idle pre-hunt waiting, inter-round pauses, and overnight inactive gaps are strictly excluded.
 */
export function roundTimes(team: Team, now: number): {
  round1Elapsed: number;
  round1Ranked: number;
  round2Elapsed: number;
  round2Ranked: number;
  round3Elapsed: number;
  round3Ranked: number;
  currentQuestionElapsed: number;
} {
  const isVigen = /vigen/i.test(team.name);
  let round1Ranked = 0;
  let round1Elapsed = 0;
  let round2Ranked = 0;
  let round2Elapsed = 0;
  let round3Ranked = 0;
  let round3Elapsed = 0;
  let currentQuestionElapsed = 0;

  for (let q = 1; q <= 15; q++) {
    let start: number | null = null;
    const isSolved = typeof team.solvedAt[String(q)] === "number";
    const end = isSolved ? team.solvedAt[String(q)] : null;

    if (q === 1) {
      if (isVigen) {
        start = (team.solvedAt["1"] ?? R1_OFFICIAL_START) - 5000;
      } else if (team.startedAt) {
        start = Math.max(team.startedAt, R1_OFFICIAL_START);
      } else {
        start = R1_OFFICIAL_START;
      }
    } else if (q === 6) {
      start = team.round2StartedAt ?? (team.solvedAt["6"] ? team.solvedAt["6"] - 30000 : null);
    } else if (q === 11) {
      start = team.round3StartedAt ?? R3_OFFICIAL_START;
    } else {
      start = team.solvedAt[String(q - 1)] ?? null;
    }

    if (isSolved && start !== null && end !== null) {
      const duration = Math.min(Math.max(0, end - start), MAX_QUESTION_MS);
      if (q <= 5) {
        round1Ranked += duration;
        round1Elapsed += duration;
      } else if (q <= 10) {
        round2Ranked += duration;
        round2Elapsed += duration;
      } else {
        round3Ranked += duration;
        round3Elapsed += duration;
      }
    } else if (team.level === q && start !== null && !team.finishedAt) {
      const duration = Math.min(Math.max(0, now - start), MAX_QUESTION_MS);
      currentQuestionElapsed = duration;
      if (q <= 5) {
        round1Elapsed += duration;
      } else if (q <= 10) {
        round2Elapsed += duration;
      } else {
        round3Elapsed += duration;
      }
    }
  }

  return {
    round1Elapsed,
    round1Ranked,
    round2Elapsed,
    round2Ranked,
    round3Elapsed,
    round3Ranked,
    currentQuestionElapsed,
  };
}

export function rankedMs(team: Team): number {
  const { round1Ranked, round2Ranked, round3Ranked } = roundTimes(team, Date.now());
  return round1Ranked + round2Ranked + round3Ranked + team.penaltyMs;
}

export function elapsedMs(team: Team, now: number): number {
  const { round1Elapsed, round2Elapsed, round3Elapsed } = roundTimes(team, now);
  return round1Elapsed + round2Elapsed + round3Elapsed + team.penaltyMs;
}

function rail(db: DB, team: Team): RailEntry[] {
  return levelsOf(db).map((l) => ({
    id: l.id,
    round: l.round ?? (l.id <= 5 ? 1 : 2),
    codename: l.codename,
    status:
      team.solvedAt[String(l.id)]
        ? "solved"
        : l.id === team.level
        ? "active"
        : "locked",
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
  const solvedCount = Object.values(team.solvedAt).filter(
    (t): t is number => typeof t === "number",
  ).length;
  return {
    name: team.name,
    code: formatCode(team.code),
    isCaptain: team.captainId === viewerId,
    members: membersOf(team, users, viewerId),
    solved: Math.min(solvedCount, totalLevels(db)),
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
  const round2Unlocked = Boolean(db.round2Unlocked);
  const round1Closed = Boolean(db.round1Closed || db.activeRound === 2);
  const round1Cleared = team.level > 5;
  const round = team.level <= 5 ? 1 : 2;
  const viewer = users[viewerId];
  const isLockedDown = Boolean(viewer?.isLockedDown);
  const tabSwitches = viewer?.tabSwitches ?? 0;

  return {
    team: {
      name: team.name,
      code: formatCode(team.code),
      members: membersOf(team, users, viewerId),
      isCaptain: team.captainId === viewerId,
    },
    level: team.level,
    round,
    totalLevels: totalLevels(db),
    finished: team.level > totalLevels(db),
    round1Cleared,
    round2Unlocked,
    round1Closed,
    activeRound: db.activeRound ?? (round2Unlocked ? 2 : 1),
    isLockedDown,
    tabSwitches,
    startedAt: team.startedAt ?? now,
    round2StartedAt: team.round2StartedAt,
    round3StartedAt: team.round3StartedAt,
    finishedAt: team.finishedAt,
    penaltyMs: team.penaltyMs,
    elapsedMs: elapsedMs(team, now),
    round1Ms: roundTimes(team, now).round1Elapsed,
    round2Ms: roundTimes(team, now).round2Elapsed,
    round3Ms: roundTimes(team, now).round3Elapsed,
    currentQuestionElapsedMs: roundTimes(team, now).currentQuestionElapsed,
    rail: rail(db, team),
    lockedUntil: team.lockedUntil > now ? team.lockedUntil : null,
    hintBudget: HINT_BUDGET,
    hintsTaken: hintsTaken(team),
    vaultNote:
      team.level > totalLevels(db) ? (db.vaultNote?.trim() || null) : null,
    rankedMs: rankedMs(team),
    // Every answer feeds the next lock, so a team that lost its notes is
    // stuck on bookkeeping rather than on the puzzle. These are answers
    // they have already earned; nothing unsolved is included.
    keys: levelsOf(db)
      .filter((l) => Boolean(team.solvedAt[String(l.id)]))
      .map((l) => ({
        id: l.id,
        codename: l.codename,
        answer: l.answers[0] ?? "",
      })),
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
    round: level.round ?? (level.id <= 5 ? 1 : 2),
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
    // The global budget can cut a level's ladder short even when the level
    // itself still has hints left to give.
    hintsRemaining: Math.min(
      Math.max(0, level.hints.length - revealed),
      Math.max(0, HINT_BUDGET - hintsTaken(team)),
    ),
    nextHintCostMinutes:
      revealed >= level.freeHints
        ? hintCostMinutes(revealed - level.freeHints)
        : 0,
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
export function ensureStarted(
  team: Team,
  now: number,
  round2Unlocked = false,
  round1Closed = false,
): void {
  if (team.startedAt === null) team.startedAt = now;
  if (round1Closed && team.level < 6) {
    team.level = 6;
  }
  if (
    team.level >= 6 &&
    round2Unlocked &&
    (team.round2StartedAt === null || team.round2StartedAt === undefined)
  ) {
    team.round2StartedAt = now;
  }
  if (
    team.level >= 11 &&
    (team.round3StartedAt === null || team.round3StartedAt === undefined)
  ) {
    team.round3StartedAt = now;
  }
  if (team.finishedAt !== null && team.level <= 15) {
    team.finishedAt = null;
  }
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
    if (user?.isLockedDown) {
      return {
        ok: false as const,
        error: "Your account is locked down due to proctoring violations. Enter the override code to unlock.",
        status: 403,
      };
    }
    const round1Closed = Boolean(db.round1Closed || db.activeRound === 2);
    if (levelId <= 5 && round1Closed) {
      return {
        ok: false as const,
        error: "Round 1 has concluded for today. Round 2 is now active.",
        status: 403,
      };
    }
    if (t.level > totalLevels(db))
      return { ok: false as const, error: "The hunt is already complete.", status: 400 };
    if (t.level >= 6 && !db.round2Unlocked && !preview)
      return {
        ok: false as const,
        error: "Round 2 has not been unlocked yet. Please stand by.",
        status: 403,
      };
    if (levelId !== t.level)
      return { ok: false as const, error: "That level is not open to you.", status: 403 };
    if (t.lockedUntil > now)
      return {
        ok: false as const,
        error: "The mechanism is seized. Give it a moment.",
        status: 429,
        lockedUntil: t.lockedUntil,
      };
    if (now - t.lastAttemptAt < MIN_GAP_MS)
      return { ok: false as const, error: "Slow down.", status: 429 };

    ensureStarted(t, now, Boolean(db.round2Unlocked), round1Closed);
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
      if (levelId === 5 && db.round2Unlocked) {
        t.round2StartedAt = now;
      }
      if (levelId === 10) {
        t.round3StartedAt = now;
      }
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

    // The cooldown and the time penalty land on the same beat, so a team
    // only ever gets told off once.
    const penalised = attempts % STRIKES === 0;
    if (penalised) t.penaltyMs += WRONG_PENALTY_MS;

    const line = WRONG_LINES[attempts % WRONG_LINES.length];
    return {
      ok: true as const,
      correct: false as const,
      message: penalised
        ? `${line} +${WRONG_PENALTY_MS / 60_000} min for guessing.`
        : line,
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
    if (user?.isLockedDown) {
      return { ok: false as const, error: "Your account is locked down. Enter the override code.", status: 403 };
    }
    if (levelId !== t.level)
      return { ok: false as const, error: "That level is not open to you.", status: 403 };

    const level = levelFrom(db, levelId);
    if (!level?.gate)
      return { ok: false as const, error: "This level has no lock.", status: 400 };
    if (t.lockedUntil > now)
      return { ok: false as const, error: "The mechanism is seized. Give it a moment.", status: 429 };
    if (now - t.lastAttemptAt < MIN_GAP_MS)
      return { ok: false as const, error: "Slow down.", status: 429 };

    ensureStarted(t, now);
    t.lastAttemptAt = now;

    const want = level.gate.sequence;
    const got = sequence.map(String);
    const match =
      got.length === want.length && want.every((id, i) => id === got[i]);

    if (!match) {
      // Every other guess in the hunt costs something; this one used to be
      // free, which made the grid the one place worth brute-forcing.
      const attempts = (t.attempts[String(levelId)] ?? 0) + 1;
      t.attempts[String(levelId)] = attempts;
      const cool = cooldownFor(attempts);
      if (cool > 0) {
        t.lockedUntil = now + cool;
        t.penaltyMs += WRONG_PENALTY_MS;
      }
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
  | { ok: true; level: PublicLevel; state: TeamState; chargedMinutes: number }
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
    if (user?.isLockedDown) {
      return { ok: false as const, error: "Your account is locked down. Enter the override code.", status: 403 };
    }
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
    if (hintsTaken(t) >= HINT_BUDGET)
      return {
        ok: false as const,
        error: `Your hint budget is spent — ${HINT_BUDGET} for the whole hunt.`,
        status: 400,
      };

    ensureStarted(t, now);
    // Free hints first, then the ladder, counted per level.
    const chargedMinutes =
      used >= level.freeHints ? hintCostMinutes(used - level.freeHints) : 0;
    t.hintsUsed[String(levelId)] = used + 1;
    t.penaltyMs += chargedMinutes * 60_000;

    return {
      ok: true as const,
      level: toPublicLevel(db, t, levelId)!,
      state: toState(db, t, db.users, userId, now, db.eventOverride ?? null),
      chargedMinutes,
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
      const solved = Object.values(t.solvedAt).filter(
        (ts): ts is number => typeof ts === "number",
      ).length;
      const start = t.startedAt ?? t.createdAt;
      return {
        id: t.id,
        name: t.name,
        solved,
        totalLevels: total,
        finished: t.finishedAt !== null && t.level > total,
        timeMs: rankedMs(t),
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
