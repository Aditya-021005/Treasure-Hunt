import type { NextRequest } from "next/server";
import { adminOr403 } from "@/lib/admin-guard";
import { setVaultNote } from "@/lib/admin";

/**
 * POST /api/admin/vault — { note: string }
 *
 * What a team reads once the last lock opens. Empty clears it and the
 * vault page falls back to its built-in line.
 */
export async function POST(req: NextRequest) {
  const gate = await adminOr403();
  if (!gate.ok) return gate.res;

  let body: { note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  if (body.note !== undefined && typeof body.note !== "string")
    return Response.json({ error: "The note must be text." }, { status: 400 });

  await setVaultNote(String(body.note ?? ""));
  return Response.json({ ok: true });
}
