import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eventWindow } from "@/lib/event";

/**
 * Edge gate for the hunt.
 *
 * This is a convenience redirect, not the security boundary — the API
 * routes enforce the same window server-side, so a hand-crafted request
 * cannot get puzzle content out early even if it skips this entirely.
 * Keeping both means a curious visitor never reaches a page that would
 * try to load a level before the start.
 */
export function proxy(req: NextRequest) {
  const { phase } = eventWindow();
  if (phase === "open") return NextResponse.next();

  // Organisers previewing the hunt early. Only the presence of the cookie
  // is checked here — the API verifies its signature before handing over
  // any puzzle content, so a forged cookie gets an empty terminal.
  if (req.cookies.has("bep_preview")) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = phase === "before" ? "?locked=1" : "?closed=1";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/hunt/:path*"],
};
