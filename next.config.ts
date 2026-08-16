import type { NextConfig } from "next";

/**
 * Security headers. Nothing here is load-bearing for the puzzles — the
 * real boundary is that answers never leave the server — but there is no
 * reason to advertise the stack or allow the terminal to be framed.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  /**
   * No source maps in the client build. Minified JavaScript is always
   * readable in devtools — that is true of every web app and cannot be
   * prevented — but without maps there is no original TypeScript, no
   * component names and no comments to recover.
   *
   * Note that one puzzle (level 5) deliberately requires the player to
   * inspect the page, so nothing here tries to obstruct devtools.
   */
  productionBrowserSourceMaps: false,

  /** Don't announce the framework. */
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The terminal is per-team and time-sensitive; never let a proxy
        // or the browser hold on to a level payload.
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
