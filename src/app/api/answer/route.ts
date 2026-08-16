import type { NextRequest } from "next/server";
import { readSession } from "@/lib/session";
import { read } from "@/lib/store";
import { submitAnswer, toPublicLevel } from "@/lib/hunt";

/** POST /api/answer — submit an answer for the team's current level. */
export async function POST(req: NextRequest) {
  const userId = await readSession();
  if (!userId) return Response.json({ error: "Not signed in." }, { status: 401 });

  let body: { level?: unknown; answer?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const level = Number(body.level);
  const answer = typeof body.answer === "string" ? body.answer : "";
  if (!Number.isInteger(level) || level < 1)
    return Response.json({ error: "Bad level." }, { status: 400 });
  if (!answer.trim())
    return Response.json({ error: "Type something first." }, { status: 400 });
  if (answer.length > 200)
    return Response.json({ error: "That is not an answer." }, { status: 400 });

  const result = await submitAnswer(userId, level, answer);

  if (!result.ok) {
    return Response.json(
      { error: result.error, lockedUntil: result.lockedUntil },
      { status: result.status },
    );
  }

  if (!result.correct) return Response.json(result);

  // Correct: hand back the next level in the same round-trip.
  const nextLevel = await read((db) => {
    const user = db.users[userId];
    const team = user?.teamId ? db.teams[user.teamId] : undefined;
    return team ? toPublicLevel(team, team.level) : null;
  });

  return Response.json({ ...result, nextLevel });
}
