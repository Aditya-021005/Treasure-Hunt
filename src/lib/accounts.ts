import { publicWindow } from "@/lib/event";
import { googleConfigured, mockAuthEnabled, type GoogleIdentity } from "@/lib/oauth";
import { toTeamSummary } from "@/lib/hunt";
import {
  blankTeam,
  blankUser,
  makeCode,
  MAX_TEAM_SIZE,
  newId,
  normalizeCode,
  read,
  slugify,
  storageReady,
  transact,
} from "@/lib/store";
import type { Me } from "@/lib/types";

const NAME_RE = /^[\p{L}\p{N} .'&_-]{3,28}$/u;

/** Creates the user on first sign-in, refreshes their profile after that. */
export async function upsertUser(identity: GoogleIdentity): Promise<string> {
  const now = Date.now();

  return transact((db) => {
    const existingId = db.userBySub[identity.sub];
    if (existingId && db.users[existingId]) {
      const u = db.users[existingId];
      u.email = identity.email;
      u.name = identity.name;
      u.picture = identity.picture;
      u.lastSeenAt = now;
      return u.id;
    }

    const id = newId();
    db.users[id] = blankUser({
      id,
      sub: identity.sub,
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
      now,
    });
    db.userBySub[identity.sub] = id;
    return id;
  });
}

/** Everything the browser is allowed to know about the current visitor. */
export async function getMe(userId: string | null): Promise<Me> {
  const now = Date.now();

  const base: Me = {
    user: null,
    team: null,
    event: publicWindow(now),
    maxTeamSize: MAX_TEAM_SIZE,
    auth: { google: googleConfigured(), mock: mockAuthEnabled() },
    storageReady: storageReady(),
  };

  if (!userId) return base;

  return read((db) => {
    const user = db.users[userId];
    if (!user) return base;

    const team = user.teamId ? db.teams[user.teamId] : undefined;
    return {
      ...base,
      user: { name: user.name, email: user.email, picture: user.picture },
      team: team ? toTeamSummary(team, db.users, userId) : null,
    };
  });
}

/* ------------------------------ team actions ---------------------- */

export type TeamActionResult =
  | { ok: true; me: Me }
  | { ok: false; error: string; status: number };

export async function createTeam(
  userId: string,
  rawName: string,
): Promise<TeamActionResult> {
  const now = Date.now();
  const name = rawName.trim();

  if (!NAME_RE.test(name))
    return {
      ok: false,
      error: "Team name must be 3–28 characters (letters, numbers, spaces).",
      status: 400,
    };

  const outcome = await transact((db) => {
    const user = db.users[userId];
    if (!user) return "no-user" as const;
    if (user.teamId && db.teams[user.teamId]) return "already" as const;

    const slug = slugify(name);
    if (db.teamBySlug[slug]) return "taken" as const;

    const id = newId();
    const code = makeCode(db.teamByCode);
    db.teams[id] = blankTeam({ id, name, code, captainId: userId, now });
    db.teamBySlug[slug] = id;
    db.teamByCode[code] = id;
    user.teamId = id;
    return "ok" as const;
  });

  switch (outcome) {
    case "no-user":
      return { ok: false, error: "Sign in first.", status: 401 };
    case "already":
      return { ok: false, error: "You are already on a team.", status: 409 };
    case "taken":
      return { ok: false, error: "That team name is taken. Pick another.", status: 409 };
    default:
      return { ok: true, me: await getMe(userId) };
  }
}

export async function joinTeam(
  userId: string,
  rawCode: string,
): Promise<TeamActionResult> {
  const code = normalizeCode(rawCode);
  if (code.length < 4 || code.length > 12)
    return { ok: false, error: "That join code does not look right.", status: 400 };

  const outcome = await transact((db) => {
    const user = db.users[userId];
    if (!user) return "no-user" as const;
    if (user.teamId && db.teams[user.teamId]) return "already" as const;

    const teamId = db.teamByCode[code];
    const team = teamId ? db.teams[teamId] : undefined;
    if (!team) return "unknown" as const;
    if (team.memberIds.includes(userId)) return "ok" as const;
    if (team.memberIds.length >= MAX_TEAM_SIZE) return "full" as const;
    // Once the hunt is underway, a team's roster is fixed.
    if (team.startedAt !== null) return "started" as const;

    team.memberIds.push(userId);
    user.teamId = team.id;
    return "ok" as const;
  });

  switch (outcome) {
    case "no-user":
      return { ok: false, error: "Sign in first.", status: 401 };
    case "already":
      return { ok: false, error: "You are already on a team.", status: 409 };
    case "unknown":
      return { ok: false, error: "No team has that code.", status: 404 };
    case "full":
      return {
        ok: false,
        error: `That team is full (${MAX_TEAM_SIZE} members).`,
        status: 409,
      };
    case "started":
      return {
        ok: false,
        error: "That team has already started the hunt and is locked.",
        status: 409,
      };
    default:
      return { ok: true, me: await getMe(userId) };
  }
}

export async function leaveTeam(userId: string): Promise<TeamActionResult> {
  const outcome = await transact((db) => {
    const user = db.users[userId];
    if (!user) return "no-user" as const;
    const team = user.teamId ? db.teams[user.teamId] : undefined;
    if (!team) return "none" as const;
    if (team.startedAt !== null) return "started" as const;

    team.memberIds = team.memberIds.filter((id) => id !== userId);
    user.teamId = null;

    if (team.memberIds.length === 0) {
      // Last one out disbands the team and frees the name and code.
      delete db.teams[team.id];
      delete db.teamBySlug[team.slug];
      delete db.teamByCode[team.code];
    } else if (team.captainId === userId) {
      team.captainId = team.memberIds[0];
    }
    return "ok" as const;
  });

  switch (outcome) {
    case "no-user":
      return { ok: false, error: "Sign in first.", status: 401 };
    case "none":
      return { ok: false, error: "You are not on a team.", status: 400 };
    case "started":
      return {
        ok: false,
        error: "The hunt has started — the roster is locked.",
        status: 409,
      };
    default:
      return { ok: true, me: await getMe(userId) };
  }
}
