import { adminOr403 } from "@/lib/admin-guard";
import { overview } from "@/lib/admin";
import { read } from "@/lib/store";
import { levelsOf, usingCustomLevels } from "@/lib/levels";

/** GET /api/admin/overview — everything the panel renders. */
export async function GET() {
  const gate = await adminOr403();
  if (!gate.ok) return gate.res;

  const [data, levels] = await Promise.all([
    overview(),
    read((db) => ({
      levels: levelsOf(db),
      custom: usingCustomLevels(db),
    })),
  ]);

  return Response.json({ ...data, ...levels, you: gate.admin });
}
