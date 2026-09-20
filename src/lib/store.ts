import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, randomInt } from "node:crypto";
import { pgLoad, pgTransact, usingPostgres } from "@/lib/db";

/* ------------------------------------------------------------------ *
 *  The store. One document, two drivers.
 *
 *  DATABASE_URL set  -> Postgres. The document lives in a single JSONB
 *                       row and every mutation takes a row lock, so it
 *                       is safe across serverless instances (Vercel) and
 *                       across processes (Render, a VPS).
 *
 *  DATABASE_URL unset -> a JSON file, serialised through a promise chain
 *                       and committed with an atomic rename. Perfect for
 *                       local development; single-process only.
 *
 *  Callers see the same API either way: `transact` for read-modify-write,
 *  `read` for a snapshot. The callback mutates the document in place.
 * ------------------------------------------------------------------ */

export type User = {
  id: string;
  /** Google subject claim — the stable account identifier. */
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  teamId: string | null;
  createdAt: number;
  lastSeenAt: number;
  /** Proctoring: tab switches recorded for this account. */
  tabSwitches?: number;
  /** Proctoring: whether this particular account is locked out. */
  isLockedDown?: boolean;
};

export type { DB };

export type Team = {
  id: string;
  name: string;
  /** Lower-cased name, used as the uniqueness key. */
  slug: string;
  /** Join code, stored normalised (upper case, no separator). */
  code: string;
  captainId: string;
  memberIds: string[];
  createdAt: number;
  /**
   * When this team's clock started — set on their first authenticated
   * request after the hunt opens, so registering early costs nothing.
   */
  startedAt: number | null;
  /** When this team entered Round 2 (Level 6). */
  round2StartedAt?: number | null;
  /** When this team entered Round 3 (Level 11). */
  round3StartedAt?: number | null;
  /** 1-based. Equals TOTAL_LEVELS + 1 once the hunt is finished. */
  level: number;
  finishedAt: number | null;
  /** levelId -> epoch ms */
  solvedAt: Record<string, number>;
  /** levelId -> hints revealed */
  hintsUsed: Record<string, number>;
  /** levelId -> wrong attempts */
  attempts: Record<string, number>;
  /** Level ids whose interactive gate has been opened. */
  gatesOpen: number[];
  penaltyMs: number;
  lastAttemptAt: number;
  lockedUntil: number;
};

type DB = {
  version: 2;
  /** Event window set from the admin panel; null = follow the env vars. */
  eventOverride?: { opensAt: number | null; closesAt: number | null } | null;
  /** Puzzles edited in the admin panel; empty = use the shipped seed. */
  levels?: import("@/content/levels").Level[];
  /**
   * What the vault page tells a team once every lock is open — where to
   * physically go and who to say the last word to. Set from the admin
   * panel so it can change on the day without a deploy.
   */
  vaultNote?: string | null;
  /** Whether Round 2 (levels 6-10) is open for teams that cleared Round 1. */
  round2Unlocked?: boolean;
  /** Whether Round 1 is closed for the day. */
  round1Closed?: boolean;
  /** Active round for today (1 or 2). */
  activeRound?: 1 | 2;
  users: Record<string, User>;
  teams: Record<string, Team>;
  /** google sub -> user id */
  userBySub: Record<string, string>;
  /** team slug -> team id */
  teamBySlug: Record<string, string>;
  /** join code -> team id */
  teamByCode: Record<string, string>;
};

const DATA_FILE =
  process.env.HUNT_DATA_FILE ?? path.join(process.cwd(), "data", "hunt.json");

const EMPTY: DB = {
  version: 2,
  eventOverride: null,
  levels: [],
  vaultNote: null,
  users: {},
  teams: {},
  userBySub: {},
  teamBySlug: {},
  teamByCode: {},
};

export const MAX_TEAM_SIZE = (() => {
  const n = Number(process.env.HUNT_MAX_TEAM_SIZE);
  return Number.isInteger(n) && n >= 1 && n <= 20 ? n : 4;
})();

let cache: DB | null = null;
/** mtime of the file the cache was built from. */
let cacheStamp = 0;
let chain: Promise<unknown> = Promise.resolve();

/**
 * The cached document is only good while the file behind it is unchanged.
 * Next's dev server runs pages and route handlers in separate processes,
 * so a write from one would otherwise stay invisible to the other until a
 * restart. One stat per read keeps them coherent.
 */
async function cacheIsFresh(): Promise<boolean> {
  if (!cache) return false;
  try {
    const { mtimeMs } = await fs.stat(/*turbopackIgnore: true*/ DATA_FILE);
    return mtimeMs === cacheStamp;
  } catch {
    // File is gone; what we hold is as good as it gets.
    return true;
  }
}

/** True on hosts whose filesystem is read-only and per-instance. */
function ephemeralFilesystem(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * Whether the store can actually hold data. False means the deployment is
 * misconfigured — serverless with no database — and every write would
 * throw. Endpoints check this so players get a clear message instead of a
 * 500, and the organisers see the reason in the log.
 */
export function storageReady(): boolean {
  return usingPostgres() || !ephemeralFilesystem();
}

if (!storageReady()) {
  console.error(
    "[bep-hunt] FATAL CONFIG: serverless host with no DATABASE_URL. " +
      "Sign-in and registration cannot be saved. " +
      "Set DATABASE_URL to a Postgres connection string and redeploy.",
  );
}

async function load(): Promise<DB> {
  if (await cacheIsFresh()) return cache!;
  try {
    const raw = await fs.readFile(/*turbopackIgnore: true*/ DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<DB> & { version?: number };

    if (parsed.version !== 2) {
      // An older layout. Keep it aside rather than silently dropping it.
      const backup = `${DATA_FILE}.v${parsed.version ?? "unknown"}.bak`;
      await fs.rename(/*turbopackIgnore: true*/ DATA_FILE, backup);
      console.warn(
        `[bep-hunt] data file was version ${parsed.version}; moved to ${backup} and starting fresh.`,
      );
      cache = structuredClone(EMPTY);
    } else {
      cache = { ...structuredClone(EMPTY), ...parsed } as DB;
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.error("[bep-hunt] could not read data file, starting empty:", err);
    }
    cache = structuredClone(EMPTY);
  }

  try {
    cacheStamp = (await fs.stat(/*turbopackIgnore: true*/ DATA_FILE)).mtimeMs;
  } catch {
    cacheStamp = 0;
  }
  return cache;
}

async function persist(db: DB): Promise<void> {
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(DATA_FILE), {
    recursive: true,
  });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(/*turbopackIgnore: true*/ tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(/*turbopackIgnore: true*/ tmp, DATA_FILE);

  // Keep the stamp in step so our own write does not look like someone
  // else's and force a needless reload.
  try {
    cacheStamp = (await fs.stat(/*turbopackIgnore: true*/ DATA_FILE)).mtimeMs;
    cache = db;
  } catch {
    cacheStamp = 0;
  }
}

/** Read-modify-write. Nothing else can interleave with the callback. */
export function transact<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  if (usingPostgres()) return pgTransact<T, DB>(EMPTY, fn);

  const run = chain.then(async () => {
    const db = await load();
    const result = await fn(db);
    await persist(db);
    return result;
  });
  // keep the chain alive even if this transaction rejects
  chain = run.catch(() => {});
  return run;
}

/** A snapshot. Do not mutate the document from here — use `transact`. */
export async function read<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  if (usingPostgres()) return fn(await pgLoad<DB>(EMPTY));

  const run = chain.then(async () => fn(await load()));
  chain = run.catch(() => {});
  return run;
}

/* -------------------------------- helpers ------------------------- */

export function newId(): string {
  return randomBytes(9).toString("base64url");
}

export function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Unambiguous alphabet: no O/0, no I/1, no S/5. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Human-friendly rendering of a stored code: ABC-123. */
export function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

export function makeCode(taken: Record<string, string>): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    if (!taken[code]) return code;
  }
  // Astronomically unlikely; widen rather than loop forever.
  return `${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function blankTeam(opts: {
  id: string;
  name: string;
  code: string;
  captainId: string;
  now: number;
}): Team {
  return {
    id: opts.id,
    name: opts.name.trim(),
    slug: slugify(opts.name),
    code: opts.code,
    captainId: opts.captainId,
    memberIds: [opts.captainId],
    createdAt: opts.now,
    startedAt: null,
    round2StartedAt: null,
    level: 1,
    finishedAt: null,
    solvedAt: {},
    hintsUsed: {},
    attempts: {},
    gatesOpen: [],
    penaltyMs: 0,
    lastAttemptAt: 0,
    lockedUntil: 0,
  };
}

export function blankUser(opts: {
  id: string;
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  now: number;
}): User {
  return {
    id: opts.id,
    sub: opts.sub,
    email: opts.email,
    name: opts.name,
    picture: opts.picture,
    teamId: null,
    createdAt: opts.now,
    lastSeenAt: opts.now,
  };
}
