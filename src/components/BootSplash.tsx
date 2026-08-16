"use client";

import { useCallback, useEffect, useState } from "react";

const STEPS: [number, string][] = [
  [0, "power on · node PILANI-01"],
  [14, "mounting /clock-tower"],
  [31, "shiv ganga uplink"],
  [48, "cipher table · 5 locks"],
  [66, "plate archive"],
  [82, "negotiating secure channel"],
  [95, "vault seal verified"],
];

const HOLD_MS = 1900; // full run before the splash tips away
const OUT_MS = 550; // exit animation

/**
 * The loader that plays before the site appears: a wireframe vault
 * tumbling in 3D while the relay reports what it is mounting.
 *
 * It runs on hard loads only — client-side navigation never remounts the
 * layout — and any click or key press skips it.
 */
export default function BootSplash() {
  const [progress, setProgress] = useState(0);
  const [gone, setGone] = useState(false);
  const leaving = progress >= 100;

  const finish = useCallback(() => setProgress(100), []);

  // Fill the bar. Uneven increments read as real work rather than a timer.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = reduce ? 400 : HOLD_MS;
    const started = performance.now();

    let raf = 0;
    const tick = (t: number) => {
      const linear = Math.min(1, (t - started) / total);
      // ease-out so it sprints early and settles at the end
      const eased = 1 - Math.pow(1 - linear, 2.2);
      setProgress((p) => Math.max(p, Math.round(eased * 100)));
      if (linear < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Skip on any interaction.
  useEffect(() => {
    window.addEventListener("pointerdown", finish);
    window.addEventListener("keydown", finish);
    return () => {
      window.removeEventListener("pointerdown", finish);
      window.removeEventListener("keydown", finish);
    };
  }, [finish]);

  // Hold the page still while the splash is up. Keyed on `gone` rather
  // than unmount: rendering null does not tear an effect down, so the
  // cleanup has to be triggered by the state change itself.
  useEffect(() => {
    if (gone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [gone]);

  // Unmount once the exit animation has played out.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setGone(true), OUT_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  if (gone) return null;

  const line =
    [...STEPS].reverse().find(([at]) => progress >= at)?.[1] ?? STEPS[0][1];

  return (
    <div
      className={`splash ${leaving ? "out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading BEP Cipher Hunt"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-bg" />
      <div aria-hidden className="crt-layer crt-lines" />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-8 px-6">
        <div className="relative">
          <span aria-hidden className="orbit-ring" />
          <div className="cube-stage" aria-hidden>
            <div className="cube">
              <span className="cube-face" />
              <span className="cube-face" />
              <span className="cube-face" />
              <span className="cube-face" />
              <span className="cube-face" />
              <span className="cube-face" />
              <div className="cube-inner">
                <span className="cube-face" />
                <span className="cube-face" />
                <span className="cube-face" />
                <span className="cube-face" />
                <span className="cube-face" />
                <span className="cube-face" />
              </div>
              <span className="cube-core" />
            </div>
          </div>
        </div>

        <div className="w-full">
          <div className="flex items-baseline justify-between text-[10px] tracked text-ink-dim">
            <span className="truncate">{line}</span>
            <span className="ml-3 tabular-nums text-phos">
              {String(progress).padStart(3, "0")}%
            </span>
          </div>

          <div className="mt-2 h-[3px] w-full overflow-hidden bg-phos/12">
            <div
              className="h-full bg-phos shadow-[0_0_14px] shadow-phos/70 transition-[width] duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-6 text-center text-[9px] tracked text-ink-dim/60">
            BEP · BITS Pilani · press anything to skip
          </p>
        </div>
      </div>
    </div>
  );
}
