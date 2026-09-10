"use client";

import React from "react";
import DragonEye from "@/components/DragonEye";

interface DragonLoaderProps {
  /** Progress percentage from 0 to 100, or null/undefined for indeterminate breathing */
  progress?: number | null;
  /** Primary title text (defaults to "AWAKENING ANCIENT DRAKE...") */
  title?: string;
  /** Optional custom subtitle or phase description */
  subtitle?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Optional extra CSS classes */
  className?: string;
}

export default function DragonLoader({
  progress,
  title = "AWAKENING ANCIENT DRAKE...",
  subtitle,
  size = "md",
  className = "",
}: DragonLoaderProps) {
  const pct = typeof progress === "number" ? Math.min(100, Math.max(0, progress)) : null;

  // Derive dynamic lore text if not explicitly provided
  const statusText =
    subtitle ??
    (pct === null
      ? "Stoking subterranean embers..."
      : pct < 25
        ? "Igniting abyssal forge & runes..."
        : pct < 55
          ? "Forging obsidian scales & 9.5MB mesh..."
          : pct < 85
            ? "Infusing primordial draconic flame..."
            : "Elder Drake Fatalis breaking free...");

  // Size configurations
  const dimensions = {
    sm: { box: 110, eyeW: "w-14", eyeH: "h-9", barW: "w-44" },
    md: { box: 150, eyeW: "w-20", eyeH: "h-13", barW: "w-60" },
    lg: { box: 190, eyeW: "w-24", eyeH: "h-16", barW: "w-72" },
  }[size];

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Draconic Rune Circle Sigil */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: dimensions.box, height: dimensions.box }}
      >
        {/* Ambient Backlight Halo */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-ember/30 via-ember-deep/20 to-scale/20 blur-xl animate-pulse"
        />

        {/* Outer Rotating Arcane Gold Rune Ring */}
        <svg
          viewBox="0 0 200 200"
          className="absolute inset-0 h-full w-full animate-[ringSpin_16s_linear_infinite]"
          aria-hidden
        >
          {/* Outer Dashed Orbit */}
          <circle
            cx="100"
            cy="100"
            r="92"
            fill="none"
            stroke="#dfa84b"
            strokeWidth="1.5"
            strokeDasharray="4 8"
            strokeOpacity="0.65"
          />
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke="#dfa84b"
            strokeWidth="0.75"
            strokeOpacity="0.3"
          />

          {/* 4 Cardinal Dragon Claws / Runes */}
          {[0, 90, 180, 270].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 100 100)`}>
              <polygon
                points="100,2 96,12 104,12"
                fill="#dfa84b"
                opacity="0.85"
              />
              <circle cx="100" cy="18" r="1.75" fill="#dfa84b" />
            </g>
          ))}

          {/* 4 Diagonal Runic Glyphs */}
          {[45, 135, 225, 315].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 100 100)`}>
              <rect
                x="98.5"
                y="6"
                width="3"
                height="3"
                transform="rotate(45 100 7.5)"
                fill="#dfa84b"
                opacity="0.7"
              />
            </g>
          ))}
        </svg>

        {/* Inner Counter-Rotating Crimson Scale Ring */}
        <svg
          viewBox="0 0 200 200"
          className="absolute inset-0 h-full w-full animate-[ringSpinBack_11s_linear_infinite]"
          aria-hidden
        >
          {/* Inner Tooth/Scale Orbit */}
          <circle
            cx="100"
            cy="100"
            r="75"
            fill="none"
            stroke="#e63946"
            strokeWidth="2"
            strokeDasharray="14 10"
            strokeOpacity="0.75"
          />

          {/* 8 Draconic Scale Teeth */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 100 100)`}>
              <path
                d="M100 28 L97 34 L103 34 Z"
                fill="#e63946"
                opacity="0.9"
              />
            </g>
          ))}
        </svg>

        {/* Pulsing Central Dragon Eye */}
        <div className="relative z-10 flex items-center justify-center drop-shadow-[0_0_20px_rgba(230,57,70,0.65)]">
          <DragonEye
            variant={`loader-${size}`}
            className={`${dimensions.eyeW} ${dimensions.eyeH} animate-breathe`}
          />
        </div>

        {/* Decorative Corner Sparks */}
        <span
          aria-hidden
          className="absolute -top-1 right-2 h-1.5 w-1.5 rounded-full bg-scale/80 animate-ping"
          style={{ animationDuration: "2.4s" }}
        />
        <span
          aria-hidden
          className="absolute -bottom-1 left-2 h-1.5 w-1.5 rounded-full bg-ember/80 animate-ping"
          style={{ animationDuration: "1.9s", animationDelay: "0.5s" }}
        />
      </div>

      {/* Primary Draconic Status */}
      <div className="mt-5 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-ember animate-ping" />
        <h3 className="font-mono text-[11px] font-bold tracking-[0.25em] text-ember uppercase drop-shadow-[0_0_10px_rgba(230,57,70,0.4)] sm:text-[12px]">
          {title}
        </h3>
        <span className="h-1.5 w-1.5 rounded-full bg-scale/80 animate-pulse" />
      </div>

      {/* Lore Status Subtitle */}
      <p className="mt-1 font-mono text-[10px] tracking-wider text-ink-dim">
        {statusText}
      </p>

      {/* Molten Draconic Progress Gauge */}
      <div className={`mt-3.5 ${dimensions.barW}`}>
        <div className="relative h-2 w-full overflow-hidden rounded-full border border-ember/30 bg-panel-2/90 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]">
          {pct !== null ? (
            /* Deterministic Bar */
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-ember-deep via-ember to-scale transition-all duration-300 shadow-[0_0_14px_rgba(230,57,70,0.6)]"
              style={{ width: `${Math.max(6, pct)}%` }}
            >
              {/* Traveling Spark at Head */}
              <span className="absolute top-0 right-0 h-full w-2 rounded-full bg-white/90 blur-[1px]" />
            </div>
          ) : (
            /* Indeterminate Molten Shimmer */
            <div className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-ember to-transparent animate-[barSlide_1.3s_ease-in-out_infinite]" />
          )}
        </div>

        {/* Numerical Telemetry & Milestone Marks */}
        <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono tracking-widest text-ink-dim/70">
          <span className="text-scale/80">RUNIC CIPHER</span>
          <span className="text-ember font-bold">
            {pct !== null ? `[ ${String(pct).padStart(2, "0")}% ]` : "[ STOKING ]"}
          </span>
        </div>
      </div>
    </div>
  );
}
