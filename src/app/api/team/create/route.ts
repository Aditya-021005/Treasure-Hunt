import type { NextRequest } from "next/server";
import { readSession } from "@/lib/session";
import { createTeam } from "@/lib/accounts";

/** POST /api/team/create */
export async function POST(req: NextRequest) {
  const userId = await readSession();
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });

  let body: { name?: unknown; code?: unknown } = {};
  if (req.headers.get("content-length") !== "0") {
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }
  }

  const arg =
    typeof body.name === "string"
      ? body.name
      : typeof body.code === "string"
        ? body.code
        : "";

  const result = await createTeam(userId, arg);
  if (!result.ok)
    return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.me);
}
