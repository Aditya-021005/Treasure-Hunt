/**
 * Lightweight in-memory rate limiter for anti-automation and anti-abuse.
 * Uses a sliding window log per IP address.
 */

type RecordEntry = {
  timestamps: number[];
};

const hits = new Map<string, RecordEntry>();

// Purge entries older than 5 minutes periodically
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - 300_000;
  for (const [key, entry] of hits.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      hits.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

/**
 * Checks if a given key (e.g. client IP or identifier) is within allowed limits.
 *
 * @param key Unique client identifier (e.g. IP address)
 * @param limit Maximum allowed hits within the window
 * @param windowMs Time window in milliseconds (default 30,000ms = 30s)
 */
export function checkRateLimit(
  key: string,
  limit = 15,
  windowMs = 30_000,
): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  let entry = hits.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    hits.set(key, entry);
  }

  const windowStart = now - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(Math.max(1, retryAfterMs / 1000)),
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
  };
}

/**
 * Extract a reasonable client IP from Next.js request headers.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown-client";
}
