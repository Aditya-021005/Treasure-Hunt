import { readSession } from "@/lib/session";
import { requireAdmin } from "@/lib/admin";

/** Shared gate for every /api/admin route. */
export async function adminOr403(): Promise<
  { ok: true; admin: { id: string; email: string; name: string } } | { ok: false; res: Response }
> {
  const admin = await requireAdmin(await readSession());
  if (!admin) {
    // Deliberately the same answer whether you are signed out, signed in
    // as a player, or the allow-list is empty.
    return {
      ok: false,
      res: Response.json({ error: "Not found." }, { status: 404 }),
    };
  }
  return { ok: true, admin };
}
