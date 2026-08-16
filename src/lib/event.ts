/**
 * The event window. This is the single authority on whether the hunt is
 * open, and it is deliberately edge-safe (no fs, no node built-ins) so
 * `src/proxy.ts` can import it too.
 *
 * HUNT_OPENS_AT / HUNT_CLOSES_AT are ISO 8601 strings. Always include an
 * offset so there is no ambiguity about the timezone:
 *
 *   HUNT_OPENS_AT=2026-09-12T18:00:00+05:30
 */

export type Phase = "before" | "open" | "closed";

export type EventWindow = {
  /** epoch ms, or null when unset (= no gate) */
  opensAt: number | null;
  closesAt: number | null;
  now: number;
  phase: Phase;
  /** 0 once the hunt is open */
  msUntilOpen: number;
  msUntilClose: number | null;
};

let warned = false;

function parse(value: string | undefined, label: string): number | null {
  if (!value || !value.trim()) return null;
  const ms = Date.parse(value.trim());
  if (Number.isNaN(ms)) {
    if (!warned) {
      warned = true;
      console.warn(
        `[bep-hunt] ${label}="${value}" is not a valid ISO 8601 date — ignoring it.`,
      );
    }
    return null;
  }
  return ms;
}

/**
 * A window set from the admin panel, which wins over the environment so
 * organisers can open or seal the hunt without a redeploy.
 */
export type EventOverride = {
  opensAt: number | null;
  closesAt: number | null;
} | null;

export function eventWindow(
  now: number = Date.now(),
  override: EventOverride = null,
): EventWindow {
  const opensAt = override
    ? override.opensAt
    : parse(process.env.HUNT_OPENS_AT, "HUNT_OPENS_AT");
  const closesAt = override
    ? override.closesAt
    : parse(process.env.HUNT_CLOSES_AT, "HUNT_CLOSES_AT");

  const phase: Phase =
    opensAt !== null && now < opensAt
      ? "before"
      : closesAt !== null && now >= closesAt
        ? "closed"
        : "open";

  return {
    opensAt,
    closesAt,
    now,
    phase,
    msUntilOpen: opensAt !== null ? Math.max(0, opensAt - now) : 0,
    msUntilClose: closesAt !== null ? Math.max(0, closesAt - now) : null,
  };
}

/** True only while teams are allowed to see and answer puzzles. */
export function huntIsOpen(now?: number, override: EventOverride = null): boolean {
  return eventWindow(now, override).phase === "open";
}

/** The subset of the window that is safe to hand to the browser. */
export function publicWindow(now?: number, override: EventOverride = null) {
  const w = eventWindow(now, override);
  return {
    opensAt: w.opensAt,
    closesAt: w.closesAt,
    phase: w.phase,
    serverNow: w.now,
  };
}
