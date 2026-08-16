/* Wire types shared by the API routes and the browser.
 * Safe to import from client components — contains no secrets. */

export type Tile = {
  id: string;
  glyph: string;
  label: string;
};

export type PuzzleBlock =
  | { kind: "cipher"; text: string; caption?: string }
  | { kind: "prose"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "fadeEssay"; text: string; note?: string }
  | { kind: "altImage"; alt: string; caption?: string; sourceComment?: string };

export type PublicGate = {
  prompt: string;
  tiles: Tile[];
  length: number;
  open: boolean;
  /** Present only once the gate has been opened by this team. */
  rewardCaption?: string;
  reward?: Tile[];
};

export type AnswerShape = {
  /** Length of each word, in order. */
  groups: number[];
  length: number;
  kind: "letters" | "digits" | "mixed";
};

export type PublicLevel = {
  id: number;
  codename: string;
  title: string;
  brief: string;
  blocks: PuzzleBlock[];
  gate?: PublicGate;
  /** Hints this team has already unlocked, in order. */
  revealedHints: string[];
  hintsRemaining: number;
  /** Whether the next hint costs time. */
  nextHintCosts: boolean;
  attempts: number;
  /** How long the answer is. Null when the level opts out. */
  answerShape: AnswerShape | null;
};

export type RailEntry = {
  id: number;
  codename: string;
  status: "solved" | "active" | "locked";
};

export type Member = {
  name: string;
  email: string;
  isCaptain: boolean;
  /** True for the signed-in user's own row. */
  isYou: boolean;
};

export type TeamSummary = {
  name: string;
  /** Formatted join code (ABC-123). Only ever sent to that team's members. */
  code: string;
  isCaptain: boolean;
  members: Member[];
  solved: number;
  totalLevels: number;
  finished: boolean;
};

/** What the browser is allowed to know about the event window. */
export type EventInfo = {
  /** epoch ms, or null when no gate is configured */
  opensAt: number | null;
  closesAt: number | null;
  phase: "before" | "open" | "closed";
  /** Server clock, so the countdown does not trust the device clock. */
  serverNow: number;
};

export type Me = {
  user: { name: string; email: string; picture: string | null } | null;
  team: TeamSummary | null;
  event: EventInfo;
  maxTeamSize: number;
  /** Which sign-in routes are actually usable on this deployment. */
  auth: { google: boolean; mock: boolean };
  /**
   * False when the deployment cannot persist anything (serverless with no
   * database). The UI blocks sign-in and says so rather than letting
   * people register into a void.
   */
  storageReady: boolean;
  /** This browser holds an organiser preview pass: the hunt is unlocked
   *  for them even before the start. */
  preview: boolean;
  /** The signed-in account is on the admin allow-list. */
  isAdmin: boolean;
};

export type TeamState = {
  team: { name: string; code: string; members: Member[]; isCaptain: boolean };
  level: number;
  totalLevels: number;
  finished: boolean;
  startedAt: number;
  finishedAt: number | null;
  penaltyMs: number;
  elapsedMs: number;
  rail: RailEntry[];
  /** Epoch ms until which answering is rate-limited, if any. */
  lockedUntil: number | null;
  hintPenaltyMinutes: number;
  event: EventInfo;
};

export type LeaderboardRow = {
  rank: number;
  name: string;
  solved: number;
  totalLevels: number;
  finished: boolean;
  /** Elapsed + hint penalties, in ms. */
  timeMs: number;
  hintsUsed: number;
  isYou: boolean;
};

/* --------------------------------- admin -------------------------- */

export type AdminMember = { name: string; email: string; isCaptain: boolean };

export type AdminTeamRow = {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  solved: number;
  totalLevels: number;
  timeMs: number;
  penaltyMs: number;
  hintsUsed: number;
  attempts: number;
  members: AdminMember[];
};

export type AdminOverview = {
  event: EventInfo;
  /** The window is set from the panel rather than the environment. */
  overridden: boolean;
  totals: {
    teams: number;
    users: number;
    started: number;
    finished: number;
    totalLevels: number;
  };
  teams: AdminTeamRow[];
  admins: string[];
};

export type ApiError = { error: string; lockedUntil?: number; opensAt?: number };
