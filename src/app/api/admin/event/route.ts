import type { NextRequest } from "next/server";
import { adminOr403 } from "@/lib/admin-guard";
import { clearEventWindow, setEventWindow } from "@/lib/admin";

function parseWhen(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const ms = typeof v === "number" ? v : Date.parse(String(v));
  return Number.isNaN(ms) ? null : ms;
}

/**
 * POST /api/admin/event
 *   { action: "open" }                       open immediately
 *   { action: "lock", opensAt, closesAt? }   seal until a moment
 *   { action: "close" }                      end it now
 *   { action: "env" }                        hand control back to the env vars
 */
export async function POST(req: NextRequest) {
  const gate = await adminOr403();
  if (!gate.ok) return gate.res;

  let body: { action?: unknown; opensAt?: unknown; closesAt?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const action = String(body.action ?? "");

  if (action === "env") {
    await clearEventWindow();
  } else if (action === "open") {
    await setEventWindow(null, null);
  } else if (action === "close") {
    await setEventWindow(null, Date.now());
  } else if (action === "round2") {
    const { setRound2Unlocked } = await import("@/lib/admin");
    const unlocked = Boolean((body as { unlocked?: unknown }).unlocked);
    await setRound2Unlocked(unlocked);
  } else if (action === "round1-closed") {
    const { setRound1Closed } = await import("@/lib/admin");
    const closed = Boolean((body as { closed?: unknown }).closed);
    await setRound1Closed(closed);
  } else if (action === "advance-round2") {
    const { advanceAllTeamsToRound2 } = await import("@/lib/admin");
    const r = await advanceAllTeamsToRound2();
    return Response.json({ ok: true, ...r });
  } else if (action === "unlock-user") {
    const { unlockUserAccount } = await import("@/lib/admin");
    const targetUserId = String((body as { userId?: unknown }).userId ?? "");
    if (!targetUserId) return Response.json({ error: "No userId provided." }, { status: 400 });
    await unlockUserAccount(targetUserId);
  } else if (action === "lock") {
    const opensAt = parseWhen(body.opensAt);
    if (opensAt === null)
      return Response.json({ error: "Give a valid opening time." }, { status: 400 });
    await setEventWindow(opensAt, parseWhen(body.closesAt));
  } else {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }

  return Response.json({ ok: true });
}
