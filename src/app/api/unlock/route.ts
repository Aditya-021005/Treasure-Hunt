import type { NextRequest } from "next/server";

/**
 * POST /api/unlock — server-side proctor verification route.
 * Strictly verifies against process.env.HUNT_UNLOCK_CODE.
 * No unlock code strings exist in the source code.
 */
export async function POST(req: NextRequest) {
  let body: { code?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const raw = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!raw) {
    return Response.json({ error: "Please enter an override code." }, { status: 400 });
  }

  const envCode = process.env.HUNT_UNLOCK_CODE?.trim();
  if (!envCode) {
    return Response.json(
      { error: "Proctor unfreeze code is not configured in server environment." },
      { status: 500 },
    );
  }

  // Normalize by stripping non-alphanumeric characters (spaces, hyphens, underscores)
  const normalized = raw.replace(/[^A-Z0-9]/g, "");
  const envTarget = envCode.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const isValid = normalized === envTarget;

  if (!isValid) {
    return Response.json(
      { error: "Invalid proctor override key. The terminal remains seized." },
      { status: 403 },
    );
  }

  return Response.json({
    ok: true,
    message: "Authorization verified. Dragon seals lifted.",
  });
}
