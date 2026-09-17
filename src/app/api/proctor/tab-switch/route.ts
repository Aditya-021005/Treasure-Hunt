import { readSession } from "@/lib/session";
import { transact } from "@/lib/store";

export async function POST() {
  const userId = await readSession();
  if (!userId) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const result = await transact((db) => {
    const user = db.users[userId];
    if (!user) {
      return { ok: false, error: "User not found." };
    }

    const nextCount = (user.tabSwitches ?? 0) + 1;
    user.tabSwitches = nextCount;

    if (nextCount >= 5) {
      user.isLockedDown = true;
    }

    return {
      ok: true,
      tabSwitches: user.tabSwitches,
      isLockedDown: Boolean(user.isLockedDown),
    };
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 });
  }

  return Response.json(result);
}
