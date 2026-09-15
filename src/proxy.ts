import { NextResponse } from "next/server";

/**
 * Edge gate for the hunt.
 */
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/hunt/:path*"],
};
