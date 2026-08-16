"use client";

import { useEffect, useRef } from "react";

/**
 * Bits, literally: columns of ones and zeroes drifting down behind the
 * page. Deliberately faint — it is texture, not decoration you look at.
 *
 * Cheap by design: ~28px columns, capped at 30fps, one canvas, and it
 * shuts off entirely for prefers-reduced-motion.
 */
export default function BitStream() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const COL = 28; // px between columns
    const STEP = 20; // px per glyph
    let cols = 0;
    let heads: number[] = [];
    let speeds: number[] = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "top";

      cols = Math.ceil(window.innerWidth / COL);
      heads = Array.from({ length: cols }, () => -Math.random() * window.innerHeight);
      speeds = Array.from({ length: cols }, () => 0.35 + Math.random() * 0.75);
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 33) return; // ~30fps
      last = t;

      const h = window.innerHeight;
      // Fade the previous frame rather than clearing: leaves a soft trail.
      ctx.fillStyle = "rgba(4, 7, 10, 0.28)";
      ctx.fillRect(0, 0, window.innerWidth, h);

      for (let i = 0; i < cols; i++) {
        const x = i * COL + 6;
        const y = heads[i];
        const bit = Math.random() > 0.5 ? "1" : "0";

        ctx.fillStyle = "rgba(53, 255, 155, 0.42)";
        ctx.fillText(bit, x, y);
        ctx.fillStyle = "rgba(53, 255, 155, 0.13)";
        ctx.fillText(Math.random() > 0.5 ? "1" : "0", x, y - STEP);

        heads[i] += STEP * speeds[i];
        if (heads[i] > h + STEP) heads[i] = -Math.random() * h * 0.5;
      }
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.13] mix-blend-screen"
    />
  );
}
