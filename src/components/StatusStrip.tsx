"use client";

import { useEffect, useState } from "react";

const IST = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * The instrument strip under the nav. Pure chrome — it reports the
 * relay's notional location (Pilani), channel state and the local clock
 * in IST, which is the only clock that matters for the event.
 */
export default function StatusStrip() {
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const update = () => setClock(IST.format(new Date()));
    const kick = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, []);

  return (
    <div className="hud-strip">
      <div className="mx-auto flex max-w-6xl items-center gap-x-4 gap-y-1 overflow-hidden px-4 py-1.5 text-[9px] tracked whitespace-nowrap text-ink-dim sm:px-6">
        <span className="flex items-center gap-1.5 text-ember/80">
          <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-ember" />
          Undercroft Pilani-01
        </span>

        <span className="hidden sm:inline">28.3639°N 75.5870°E</span>

        <span className="hidden md:inline">
          Torch <span className="text-ember/70">burning</span>
        </span>

        <span className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-[2px] sm:flex" aria-hidden>
            {[5, 8, 11, 14, 17].map((h, i) => (
              <span
                key={h}
                className="sig-bar"
                style={{ height: h, animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </span>
          <span className="tabular-nums text-ink/70">{clock} IST</span>
        </span>
      </div>
    </div>
  );
}
