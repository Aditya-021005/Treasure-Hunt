import type { NextRequest } from "next/server";
import {
  grantPreview,
  previewEnabled,
  previewKeyMatches,
  revokePreview,
} from "@/lib/session";

/**
 * GET /api/preview?key=... — claim an organiser preview pass, which
 * unlocks the hunt early for this browser only.
 *
 * DELETE — hand the pass back.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  if (!previewEnabled())
    return Response.redirect(`${origin}/?preview=off`, 302);

  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!previewKeyMatches(key))
    return Response.redirect(`${origin}/?preview=bad`, 302);

  await grantPreview();
  return Response.redirect(`${origin}/?preview=on`, 302);
}

export async function DELETE() {
  await revokePreview();
  return Response.json({ ok: true });
}
