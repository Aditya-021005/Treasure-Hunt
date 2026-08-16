import type { NextRequest } from "next/server";
import { adminOr403 } from "@/lib/admin-guard";
import { actOnTeam } from "@/lib/admin";

/** POST /api/admin/team — { id, action: "reset" | "delete" } */
export async function POST(req: NextRequest) {
  const gate = await adminOr403();
  if (!gate.ok) return gate.res;

  let body: { id?: unknown; action?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const id = String(body.id ?? "");
  const action = String(body.action ?? "");
  if (!id || (action !== "reset" && action !== "delete"))
    return Response.json({ error: "Bad request." }, { status: 400 });

  const result = await actOnTeam(id, action);
  if (!result.ok) return Response.json({ error: result.error }, { status: 404 });

  console.warn(`[bep-hunt] admin ${gate.admin.email} ${action}d team ${id}`);
  return Response.json({ ok: true });
}
