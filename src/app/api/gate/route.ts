import type { NextRequest } from "next/server";
import { hasPreviewAccess, readSession } from "@/lib/session";
import { checkGate } from "@/lib/hunt";

/**
 * POST /api/gate — check an interactive lock (e.g. the plate sequence on
 * level 3). The correct order never leaves the server, so the grid can't
 * be solved by reading the bundle.
 */
export async function POST(req: NextRequest) {
  const userId = await readSession();
  if (!userId) return Response.json({ error: "Not signed in." }, { status: 401 });

  let body: { level?: unknown; sequence?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const level = Number(body.level);
  const sequence = Array.isArray(body.sequence)
    ? body.sequence.slice(0, 24).map((v) => String(v).slice(0, 40))
    : null;

  if (!Number.isInteger(level) || !sequence)
    return Response.json({ error: "Malformed request." }, { status: 400 });

  const result = await checkGate(userId, level, sequence, await hasPreviewAccess());
  if (!result.ok)
    return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}
