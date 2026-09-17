"use client";

import { useCallback, useEffect, useState } from "react";
import DragonEye from "@/components/DragonEye";

const STEPS: [number, string][] = [
  [0, "awakening the dragon sanctum"],
  [15, "breaking volcanic seals"],
  [34, "stoking subterranean embers"],
  [52, "cipher table · 5 draconic locks"],
  [70, "unsealing the plate archives"],
  [86, "elder drake fatalis stirs in the deep"],
  [96, "the descent begins"],
];

const HOLD_MS = 1900; // full run before the splash tips away
const OUT_MS = 550; // exit animation

/**
 * The draconic loader that plays before the site appears:
 * an ancient arcane dragon sigil counter-rotating in gold and crimson
 * while the subterranean chambers are unsealed.
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
      <div aria-hidden className="veil veil-grain" />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-8 px-6">
        {/* Animated Draconic Sigil */}
        <div className="relative flex h-44 w-44 items-center justify-center">
          {/* Ambient Glow */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-gradient-to-tr from-ember/35 via-ember-deep/25 to-scale/25 blur-2xl animate-pulse"
          />

          {/* Outer Arcane Gold Orbit */}
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-0 h-full w-full animate-[ringSpin_16s_linear_infinite]"
            aria-hidden
          >
            <circle
              cx="100"
              cy="100"
              r="92"
              fill="none"
              stroke="#dfa84b"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              strokeOpacity="0.75"
            />
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              stroke="#dfa84b"
              strokeWidth="0.75"
              strokeOpacity="0.35"
            />
            {[0, 90, 180, 270].map((deg) => (
              <g key={deg} transform={`rotate(${deg} 100 100)`}>
                <polygon
                  points="100,2 96,12 104,12"
                  fill="#dfa84b"
                  opacity="0.9"
                />
                <circle cx="100" cy="18" r="2" fill="#dfa84b" />
              </g>
            ))}
            {[45, 135, 225, 315].map((deg) => (
              <g key={deg} transform={`rotate(${deg} 100 100)`}>
                <rect
                  x="98.5"
                  y="6"
                  width="3"
                  height="3"
                  transform="rotate(45 100 7.5)"
                  fill="#dfa84b"
                  opacity="0.75"
                />
              </g>
            ))}
          </svg>

          {/* Inner Counter-Rotating Crimson Scale Teeth */}
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-0 h-full w-full animate-[ringSpinBack_11s_linear_infinite]"
            aria-hidden
          >
            <circle
              cx="100"
              cy="100"
              r="74"
              fill="none"
              stroke="#e63946"
              strokeWidth="2"
              strokeDasharray="14 10"
              strokeOpacity="0.8"
            />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <g key={deg} transform={`rotate(${deg} 100 100)`}>
                <path
                  d="M100 28 L97 34 L103 34 Z"
                  fill="#e63946"
                  opacity="0.95"
                />
              </g>
            ))}
          </svg>

          {/* Central Burning Dragon Eye */}
          <div className="relative z-10 flex items-center justify-center drop-shadow-[0_0_25px_rgba(230,57,70,0.7)]">
            <DragonEye
              variant="splash"
              className="h-16 w-24 animate-breathe"
            />
          </div>

          {/* Ambient Pulsing Sparks */}
          <span
            aria-hidden
            className="absolute top-2 right-4 h-1.5 w-1.5 rounded-full bg-scale animate-ping"
            style={{ animationDuration: "2.5s" }}
          />
          <span
            aria-hidden
            className="absolute bottom-2 left-4 h-1.5 w-1.5 rounded-full bg-ember animate-ping"
            style={{ animationDuration: "1.8s", animationDelay: "0.4s" }}
          />
        </div>

        <div className="w-full">
          <div className="flex items-baseline justify-between text-[11px] font-mono tracking-wider text-ink-dim">
            <span className="truncate uppercase text-ink-dim/90">{line}</span>
            <span className="ml-3 tabular-nums text-scale font-bold">
              {String(progress).padStart(3, "0")}%
            </span>
          </div>

          <div className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full border border-ember/30 bg-panel-2 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-ember-deep via-ember to-scale transition-[width] duration-100 ease-out shadow-[0_0_16px_rgba(230,57,70,0.7)]"
              style={{ width: `${Math.max(4, progress)}%` }}
            >
              <span className="absolute top-0 right-0 h-full w-2.5 rounded-full bg-white/90 blur-[1px]" />
            </div>
          </div>

          <p className="mt-6 text-center text-[9px] font-mono tracking-widest text-ink-dim/60 uppercase">
            BEP CIPHER HUNT · BITS PILANI · PRESS ANY KEY TO PROCEED
          </p>
        </div>
      </div>
    </div>
  );
}
