"use client";

import { useEffect, useRef, useState } from "react";

const NOISE = "!<>-_\\/[]{}—=+*^?#01·§¤";

type Props = {
  text: string;
  className?: string;
  /** ms between frames */
  tick?: number;
  /** frames of noise each character churns through before settling */
  churn?: number;
  as?: "span" | "p" | "pre";
};

/**
 * Resolves text out of noise, left to right — the "decrypting" reveal.
 * Long strings settle faster so a full ciphertext doesn't take all day.
 */
export default function ScrambleIn({
  text,
  className = "",
  tick = 26,
  churn = 3,
  as = "span",
}: Props) {
  const [out, setOut] = useState(text);
  const [prev, setPrev] = useState(text);
  const frame = useRef(0);

  // Reset during render when the prop changes, so a new level's title
  // never flashes the previous one.
  if (prev !== text) {
    setPrev(text);
    setOut(text);
  }

  useEffect(() => {
    // Reduced motion: `out` already holds the final text, nothing to do.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const chars = [...text];
    // reveal a few characters per frame on long passages
    const perFrame = Math.max(1, Math.ceil(chars.length / 90));
    frame.current = 0;

    const id = setInterval(() => {
      frame.current += 1;
      const settled = frame.current * perFrame;

      if (settled - churn * perFrame > chars.length) {
        setOut(text);
        clearInterval(id);
        return;
      }

      setOut(
        chars
          .map((c, i) => {
            if (i < settled - churn * perFrame) return c;
            if (i > settled) return " ";
            if (c === " " || c === "\n") return c;
            return NOISE[(Math.random() * NOISE.length) | 0];
          })
          .join(""),
      );
    }, tick);

    return () => clearInterval(id);
  }, [text, tick, churn]);

  const Tag = as;
  return (
    <Tag className={className}>
      {/* The settled text stays in the accessibility tree throughout, so a
          screen reader never has to wait out the animation. */}
      <span className="sr-only">{text}</span>
      <span aria-hidden>{out}</span>
    </Tag>
  );
}
