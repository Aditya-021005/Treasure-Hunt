import { adminOr403 } from "@/lib/admin-guard";
import { exportCsv } from "@/lib/admin";

/** GET /api/admin/export — results as CSV. */
export async function GET() {
  const gate = await adminOr403();
  if (!gate.ok) return gate.res;

  return new Response(await exportCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="cipher-hunt-results.csv"',
      "cache-control": "no-store",
    },
  });
}
