"use client";

import { useEffect, useRef, useState } from "react";
import { pad2 } from "@/lib/format";

type Props = {
  /** epoch ms of the moment being counted down to */
  target: number;
  /** the server's clock at the time this payload was built */
  serverNow: number;
  label?: string;
  /** Fired once when the countdown reaches zero. */
  onElapsed?: () => void;
};

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/**
 * Counts down to the start. The device clock is not trusted — everything
 * is measured against an offset from the server's clock, so changing the
 * system time locally does not move the countdown.
 */
export default function Countdown({ target, serverNow, label, onElapsed }: Props) {
  // How far the local clock is from the server's. Measured in an effect —
  // reading the clock during render would make the component impure.
  const offsetRef = useRef(0);
  const firedRef = useRef(false);
  const elapsedRef = useRef(onElapsed);

  // Correct at the moment the payload was built; the interval refines it.
  const [remaining, setRemaining] = useState(() => Math.max(0, target - serverNow));

  useEffect(() => {
    elapsedRef.current = onElapsed;
  });

  useEffect(() => {
    offsetRef.current = serverNow - Date.now();
    const id = setInterval(() => {
      const left = Math.max(0, target - (Date.now() + offsetRef.current));
      setRemaining(left);
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        elapsedRef.current?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, serverNow]);

  const total = Math.floor(remaining / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const cells: [string, string][] = [
    ["days", String(days).padStart(2, "0")],
    ["hrs", pad2(hours)],
    ["min", pad2(mins)],
    ["sec", pad2(secs)],
  ];

  return (
    <div>
      {label && (
        <p className="text-[10px] tracked text-amber glow-amber">{label}</p>
      )}

      <div
        className="mt-3 grid grid-cols-4 gap-px overflow-hidden border border-phos/20 bg-phos/20"
        role="timer"
        aria-live="off"
      >
        {cells.map(([unit, value]) => (
          <div key={unit} className="bg-panel px-2 py-3 text-center sm:px-4 sm:py-4">
            <div className="text-2xl tabular-nums text-phos glow sm:text-4xl">
              {value}
            </div>
            <div className="mt-1 text-[9px] tracked text-ink-dim">{unit}</div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] tracked text-ink-dim">
        Opens {IST.format(new Date(target))} IST
      </p>
    </div>
  );
}
