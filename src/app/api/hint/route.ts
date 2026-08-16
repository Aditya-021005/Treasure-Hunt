import type { NextRequest } from "next/server";
import { readSession } from "@/lib/session";
import { unlockHint } from "@/lib/hunt";

/** POST /api/hint — reveal the next hint, charging a time penalty if due. */
export async function POST(req: NextRequest) {
  const userId = await readSession();
  if (!userId) return Response.json({ error: "Not signed in." }, { status: 401 });

  let body: { level?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const level = Number(body.level);
  if (!Number.isInteger(level) || level < 1)
    return Response.json({ error: "Bad level." }, { status: 400 });

  const result = await unlockHint(userId, level);
  if (!result.ok)
    return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}
