import type { NextRequest } from "next/server";
import { adminOr403 } from "@/lib/admin-guard";
import { wipeEverything } from "@/lib/admin";

/** POST /api/admin/wipe — { confirm: "WIPE" }. Clears teams and users. */
export async function POST(req: NextRequest) {
  const gate = await adminOr403();
  if (!gate.ok) return gate.res;

  let body: { confirm?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  if (body.confirm !== "WIPE")
    return Response.json({ error: 'Type WIPE to confirm.' }, { status: 400 });

  const counts = await wipeEverything();
  console.warn(
    `[bep-hunt] admin ${gate.admin.email} wiped ${counts.teams} teams / ${counts.users} users`,
  );
  return Response.json({ ok: true, ...counts });
}
