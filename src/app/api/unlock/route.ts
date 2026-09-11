import type { NextRequest } from "next/server";

const MASTER_CODES = [
  "BEP-DRAKE-2026",
  "PILANI-PROCTOR",
  "DRAKE-OVERRIDE",
  "UNFREEZE-2026",
  "PROCTOR-KEY",
];

/**
 * POST /api/unlock — verify a proctor unfreeze code when a team's terminal
 * has been seized after 5 tab switches.
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

  // Normalize by stripping spaces, hyphens, underscores
  const normalized = raw.replace(/[\s\-_]/g, "");

  const envCode = process.env.HUNT_UNLOCK_CODE
    ? process.env.HUNT_UNLOCK_CODE.trim().toUpperCase().replace(/[\s\-_]/g, "")
    : null;

  const isValid =
    (envCode !== null && normalized === envCode) ||
    MASTER_CODES.some((c) => c.replace(/[\s\-_]/g, "") === normalized);

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
