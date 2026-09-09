"use client";

import { useEffect, useRef } from "react";

/**
 * Embers off whatever is burning below. Sparks climb, wander, cool from
 * white through orange to a dull red, and go out.
 *
 * Cheap by design: a bounded particle count, capped at 30fps, one canvas,
 * and it shuts off entirely for prefers-reduced-motion.
 */
export default function BitStream() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    type Spark = {
      x: number; y: number; r: number;
      vx: number; vy: number;
      life: number; max: number;
    };
    let sparks: Spark[] = [];
    let raf = 0;
    let last = 0;
    let W = 0;
    let H = 0;

    /* Born along the bottom edge, because that is where the fire is. */
    const spawn = (): Spark => {
      const max = 160 + Math.random() * 260;
      return {
        x: Math.random() * W,
        y: H + Math.random() * 40,
        r: 0.6 + Math.random() * 1.9,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -(0.5 + Math.random() * 1.5),
        life: 0,
        max,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(120, Math.round((W * H) / 16000));
      sparks = Array.from({ length: count }, () => {
        const s = spawn();
        // Stagger the first generation so they do not all rise together.
        s.y = Math.random() * H;
        s.life = Math.random() * s.max;
        return s;
      });
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 33) return; // ~30fps
      last = t;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.life += 1;
        if (s.life > s.max || s.y < -10) {
          sparks[i] = spawn();
          continue;
        }

        // Sparks wander as they rise, and slow as they cool.
        s.vx += (Math.random() - 0.5) * 0.06;
        s.vx = Math.max(-0.8, Math.min(0.8, s.vx));
        s.vy *= 0.995;
        s.x += s.vx;
        s.y += s.vy;

        const k = s.life / s.max;          // 0 hot, 1 spent
        const a = Math.sin((1 - k) * Math.PI * 0.5) * 0.85;
        const g = Math.round(90 + (1 - k) * 130);
        const b = Math.round(20 + (1 - k) * 90);

        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
        glow.addColorStop(0, `rgba(255, ${g}, ${b}, ${a})`);
        glow.addColorStop(1, "rgba(255, 60, 0, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
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
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.75] mix-blend-screen"
    />
  );
}
