"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  lines: string[];
  /** ms per character */
  speed?: number;
  /** ms of pause between lines */
  linePause?: number;
  className?: string;
  onDone?: () => void;
};

/**
 * Types lines out one character at a time. Respects prefers-reduced-motion
 * by rendering everything immediately.
 */
export default function Typewriter({
  lines,
  speed = 18,
  linePause = 260,
  className = "",
  onDone,
}: Props) {
  const [shown, setShown] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const doneRef = useRef(onDone);
  const linesRef = useRef(lines);

  // Restart on content change, not array identity, so an inline `lines`
  // prop doesn't retype on every parent render.
  const key = lines.join("\n");

  // Declared before the typing effect so the refs are fresh when it runs.
  useEffect(() => {
    doneRef.current = onDone;
    linesRef.current = lines;
  });

  useEffect(() => {
    const script = linesRef.current;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setShown(script);
      setDone(true);
      doneRef.current?.();
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let line = 0;
    let char = 0;
    const buf: string[] = [];

    const step = () => {
      if (cancelled) return;
      if (line >= script.length) {
        setDone(true);
        doneRef.current?.();
        return;
      }
      const target = script[line];
      if (char < target.length) {
        char += 1;
        buf[line] = target.slice(0, char);
        setShown([...buf]);
        timer = setTimeout(step, speed);
      } else {
        line += 1;
        char = 0;
        buf[line] = "";
        timer = setTimeout(step, linePause);
      }
    };

    timer = setTimeout(step, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, speed, linePause]);

  return (
    <div className={className}>
      {shown.map((l, i) => (
        <p key={i} className={i === shown.length - 1 && !done ? "caret" : undefined}>
          {l || " "}
        </p>
      ))}
    </div>
  );
}
