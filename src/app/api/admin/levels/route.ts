import type { NextRequest } from "next/server";
import { adminOr403 } from "@/lib/admin-guard";
import { read, transact } from "@/lib/store";
import { levelsOf, usingCustomLevels, validateLevels } from "@/lib/levels";
import type { Level } from "@/content/levels";

/** GET /api/admin/levels — the puzzle set currently in play. */
export async function GET() {
  const gate = await adminOr403();
  if (!gate.ok) return gate.res;

  return Response.json(
    await read((db) => ({
      levels: levelsOf(db),
      custom: usingCustomLevels(db),
    })),
  );
}

/**
 * PUT /api/admin/levels — replace the whole puzzle set.
 *
 * Saving is all-or-nothing and validated first, so a half-written level
 * can never reach players. Teams already past a level they have solved
 * keep their progress; if the set gets shorter, they are clamped.
 */
export async function PUT(req: NextRequest) {
  const gate = await adminOr403();
  if (!gate.ok) return gate.res;

  let body: { levels?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const errors = validateLevels(body.levels);
  if (errors.length)
    return Response.json({ error: errors[0], errors }, { status: 400 });

  const levels = body.levels as Level[];

  const clamped = await transact((db) => {
    db.levels = levels;
    let moved = 0;
    for (const team of Object.values(db.teams)) {
      if (team.level > levels.length + 1) {
        team.level = levels.length + 1;
        moved += 1;
      }
    }
    return moved;
  });

  console.warn(
    `[bep-hunt] admin ${gate.admin.email} saved ${levels.length} levels`,
  );
  return Response.json({ ok: true, count: levels.length, clamped });
}

/** DELETE — go back to the puzzles shipped in src/content/levels.ts. */
export async function DELETE() {
  const gate = await adminOr403();
  if (!gate.ok) return gate.res;

  await transact((db) => {
    db.levels = [];
  });
  console.warn(`[bep-hunt] admin ${gate.admin.email} reverted to the seed levels`);
  return Response.json({ ok: true });
}
