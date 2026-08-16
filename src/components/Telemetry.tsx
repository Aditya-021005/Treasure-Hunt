"use client";

/**
 * A looping packet log. Entirely cosmetic — no live data, no secrets,
 * just the relay muttering to itself about the campus it sits on.
 */
const LINES: [string, string, string][] = [
  ["1a2f", "clock-tower relay", "ok"],
  ["1a30", "shiv ganga uplink", "ok"],
  ["1a31", "anc night channel", "idle"],
  ["1a32", "ltc lattice sync", "ok"],
  ["1a33", "oasis archive", "sealed"],
  ["1a34", "apogee log tail", "ok"],
  ["1a35", "library index", "ok"],
  ["1a36", "connaught beacon", "weak"],
  ["1a37", "saraswati checksum", "ok"],
  ["1a38", "sac packet queue", "12"],
  ["1a39", "birla museum cache", "ok"],
  ["1a3a", "fd-iii thermal", "nominal"],
];

const tone = (status: string) =>
  status === "ok" || status === "nominal"
    ? "text-phos/70"
    : status === "sealed" || status === "weak"
      ? "text-amber/80"
      : "text-ink-dim";

export default function Telemetry() {
  return (
    <div className="panel notch brackets p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracked text-ink-dim">Relay log</p>
        <span className="flex items-center gap-1.5 text-[9px] tracked text-phos/70">
          <span className="h-1 w-1 animate-breathe rounded-full bg-phos" />
          live
        </span>
      </div>

      <div className="ticker-mask mt-3" aria-hidden>
        <div className="ticker-run">
          {[...LINES, ...LINES].map(([hex, label, status], i) => (
            <div
              key={i}
              className="flex items-baseline gap-2 py-[3px] text-[10px] whitespace-nowrap"
            >
              <span className="text-ink-dim/60">0x{hex}</span>
              <span className="truncate text-ink/55">{label}</span>
              <span className={`ml-auto ${tone(status)}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
