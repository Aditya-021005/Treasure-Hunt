"use client";

/**
 * A looping page of survey notes. Entirely cosmetic — no live data, no
 * secrets, just the expedition's own record of the ground it is standing
 * on.
 */
const LINES: [string, string, string][] = [
  ["i", "the long stair", "clear"],
  ["ii", "flooded gallery", "waist deep"],
  ["iii", "the ossuary", "sealed"],
  ["iv", "hall of plates", "sealed"],
  ["v", "cistern, east", "cold"],
  ["vi", "the scriptorium", "burned"],
  ["vii", "collapsed span", "roped"],
  ["viii", "brazier chamber", "lit"],
  ["ix", "the wyrm's stair", "warm"],
  ["x", "bone midden", "12 skulls"],
  ["xi", "the low door", "sealed"],
  ["xii", "beneath the floor", "MOVING"],
];

const tone = (status: string) =>
  status === "MOVING"
    ? "text-danger"
    : status === "lit" || status === "warm" || status === "burned"
      ? "text-ember/80"
      : status === "sealed"
        ? "text-scale/80"
        : "text-ink-dim";

export default function Telemetry() {
  return (
    <div className="panel notch brackets p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracked text-ink-dim">Descent log</p>
        <span className="flex items-center gap-1.5 text-[9px] tracked text-ember/70">
          <span className="h-1 w-1 animate-breathe rounded-full bg-ember" />
          below
        </span>
      </div>

      <div className="ticker-mask mt-3" aria-hidden>
        <div className="ticker-run">
          {[...LINES, ...LINES].map(([hex, label, status], i) => (
            <div
              key={i}
              className="flex items-baseline gap-2 py-[3px] text-[10px] whitespace-nowrap"
            >
              <span className="w-6 shrink-0 text-ink-dim/60">{hex}.</span>
              <span className="truncate text-ink/55">{label}</span>
              <span className={`ml-auto ${tone(status)}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
