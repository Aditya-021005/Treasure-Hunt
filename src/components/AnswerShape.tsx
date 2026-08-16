"use client";

import type { AnswerShape as Shape } from "@/lib/types";

type Props = {
  shape: Shape;
  /** The raw contents of the answer input. */
  value: string;
};

/**
 * Crossword-style boxes showing how long the answer is, filling in as the
 * team types. Only the count comes from the server — never the answer.
 */
export default function AnswerShape({ shape, value }: Props) {
  // Match the server's normalisation so the boxes line up with what will
  // actually be compared: case folded, punctuation and spaces dropped.
  const typed = value
    .toLowerCase()
    .replace(/^(a|an|the)\s+/, "")
    .replace(/[^a-z0-9]/g, "")
    .toUpperCase();

  const exact = typed.length === shape.length;
  const over = typed.length > shape.length;

  // Flatten the word groups into absolute indices so each box knows which
  // character it should be showing.
  const words = shape.groups.reduce<{ start: number; len: number }[]>(
    (acc, len) => {
      const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].len : 0;
      acc.push({ start, len });
      return acc;
    },
    [],
  );

  const unit = shape.kind === "digits" ? "digit" : "character";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-hidden>
        {words.map((w, wi) => (
          <div key={wi} className="flex gap-1">
            {Array.from({ length: w.len }, (_, i) => {
              const ch = typed[w.start + i];
              return (
                <span
                  key={i}
                  className={`grid h-7 w-6 place-items-center border text-[13px] transition-colors duration-150 ${
                    ch
                      ? over
                        ? "border-danger/60 bg-danger/10 text-danger"
                        : exact
                          ? "border-phos bg-phos/15 text-phos glow"
                          : "border-phos/45 bg-phos/5 text-phos"
                      : "border-phos/20 text-transparent"
                  }`}
                >
                  {ch ?? "·"}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <p
        className={`text-[10px] tracked ${
          over ? "text-danger" : exact ? "text-phos" : "text-ink-dim"
        }`}
      >
        {over
          ? `${typed.length - shape.length} too many`
          : `${shape.length} ${unit}${shape.length === 1 ? "" : "s"}${
              shape.groups.length > 1 ? ` · ${shape.groups.length} words` : ""
            }`}
      </p>

      {/* Spoken instead of the boxes, which are decorative. */}
      <span className="sr-only">
        The answer is {shape.length} {unit}
        {shape.length === 1 ? "" : "s"} long
        {shape.groups.length > 1
          ? ` in ${shape.groups.length} words of ${shape.groups.join(", ")}`
          : ""}
        . You have typed {typed.length}.
      </span>
    </div>
  );
}
