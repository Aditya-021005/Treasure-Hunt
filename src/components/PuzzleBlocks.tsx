"use client";

import { useMemo } from "react";
import ScrambleIn from "@/components/ScrambleIn";
import type { PuzzleBlock } from "@/lib/types";

/* ----------------------------- fade essay ------------------------- */

/** Deterministic PRNG so the scramble is stable across re-renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seconds between two consecutive words appearing. */
const WORD_STEP_S = 0.04;

/**
 * The passage is a counting puzzle, so the word ORDER is the secret.
 * Words are emitted into the DOM in a shuffled order and put back into
 * place with CSS `order`, and selection is disabled. Reading it on screen
 * works exactly as normal; copy-pasting the markup does not.
 *
 * The words then write themselves out one at a time, in reading order, and
 * STAY. They used to breathe in and out forever, which fought the puzzle —
 * you cannot count to forty-two when a word is mid-fade.
 */
function FadeEssay({ text, note }: { text: string; note?: string }) {
  const { words, domOrder } = useMemo(() => {
    const w = text.split(/\s+/).filter(Boolean);
    const rand = mulberry32(hash(text));
    const idx = w.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return { words: w, domOrder: idx };
  }, [text]);

  return (
    <figure className="panel notch brackets p-5 sm:p-7">
      <figcaption className="mb-4 flex items-center gap-2 text-[10px] tracked text-ink-dim">
        <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-scale" />
        {note ?? "unstable text"}
      </figcaption>

      <div
        className="no-copy flex flex-wrap gap-x-[0.5ch] gap-y-1.5 text-[15px] leading-[2] text-ink sm:text-base"
        style={{ display: "flex" }}
      >
        {domOrder.map((original) => (
          <span
            key={original}
            className="fade-word"
            style={
              {
                order: original,
                // `original` is the word's VISUAL position, so the stagger
                // runs left to right even though the DOM is shuffled.
                "--delay": `${(original * WORD_STEP_S).toFixed(2)}s`,
              } as React.CSSProperties
            }
          >
            {words[original]}
          </span>
        ))}
      </div>

      <p className="mt-5 border-t border-ember/10 pt-3 text-[10px] tracked text-ink-dim">
        The fragment writes itself out once, and cannot be copied. Read it.
      </p>
    </figure>
  );
}

/* ------------------------------ alt image ------------------------- */

const LANTERN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260" width="200" height="260">
<defs>
<radialGradient id="g" cx="50%" cy="55%" r="55%">
<stop offset="0%" stop-color="#ffd98a" stop-opacity=".95"/>
<stop offset="55%" stop-color="#ffb347" stop-opacity=".35"/>
<stop offset="100%" stop-color="#ffb347" stop-opacity="0"/>
</radialGradient>
</defs>
<circle cx="100" cy="140" r="86" fill="url(#g)"/>
<path d="M100 14c14 0 22 9 22 20 0 6-3 10-7 13h-30c-4-3-7-7-7-13 0-11 8-20 22-20z" fill="none" stroke="#7a5c2c" stroke-width="3"/>
<rect x="60" y="47" width="80" height="12" rx="3" fill="#2e2413" stroke="#7a5c2c" stroke-width="2"/>
<path d="M66 59h68l10 20H56z" fill="#241b0e" stroke="#7a5c2c" stroke-width="2"/>
<rect x="56" y="79" width="88" height="112" rx="4" fill="#15100a" stroke="#7a5c2c" stroke-width="2"/>
<rect x="68" y="91" width="64" height="88" rx="2" fill="#1b1409" stroke="#4a3a1c" stroke-width="1.5"/>
<path d="M100 108c11 14 17 24 17 34a17 17 0 0 1-34 0c0-10 6-20 17-34z" fill="#ffb347"/>
<path d="M100 122c6 8 9 14 9 19a9 9 0 0 1-18 0c0-5 3-11 9-19z" fill="#fff3d1"/>
<rect x="52" y="191" width="96" height="14" rx="3" fill="#2e2413" stroke="#7a5c2c" stroke-width="2"/>
<rect x="66" y="205" width="68" height="10" rx="2" fill="#241b0e" stroke="#7a5c2c" stroke-width="2"/>
</svg>`;

function AltImage({
  alt,
  caption,
  sourceComment,
}: {
  alt: string;
  caption?: string;
  sourceComment?: string;
}) {
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(LANTERN_SVG)}`;
  return (
    <figure className="panel notch brackets flex flex-col items-center gap-4 p-6 sm:p-10">
      {sourceComment ? (
        <div
          className="hidden"
          dangerouslySetInnerHTML={{
            // The payload has to be a real HTML comment for the puzzle to
            // work, so this cannot be escaped — but "--" would let anything
            // typed into the admin panel close the comment and become live
            // markup. Neutralise the only sequence that can break out.
            __html: `<!-- ${sourceComment.replace(/-{2,}/g, "–")} -->`,
          }}
        />
      ) : null}

      {/* Deliberately a plain <img>: the payload lives in its alt text. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={200}
        height={260}
        draggable={false}
        className="w-32 select-none drop-shadow-[0_0_40px_rgba(223,168,75,0.35)] sm:w-44"
      />

      {caption ? (
        <figcaption className="text-[10px] tracked text-ink-dim">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/* ------------------------------- exports -------------------------- */

export function Block({ block }: { block: PuzzleBlock }) {
  switch (block.kind) {
    case "prose":
      return (
        <p className="max-w-prose text-[15px] leading-relaxed text-ink/85 select-none">
          {block.text}
        </p>
      );

    case "cipher":
      return (
        <figure className="panel notch brackets overflow-hidden select-none">
          <figcaption className="flex items-center gap-3 border-b border-ember/12 bg-panel-2 px-4 py-2 text-[10px] tracked text-ink-dim">
            <span className="truncate">{block.caption ?? "ciphertext"}</span>
            <span className="hidden text-ink-dim/60 sm:inline">
              {block.text.length} B
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-ember/50">
              <span className="h-1 w-1 animate-breathe rounded-full bg-ember" />
              encrypted
            </span>
          </figcaption>
          <ScrambleIn
            as="pre"
            text={block.text}
            className="overflow-x-auto px-4 py-5 text-[13px] leading-[1.9] whitespace-pre-wrap break-words text-ember glow-soft select-none sm:px-6 sm:text-[15px]"
          />
        </figure>
      );

    case "callout":
      return (
        <aside className="panel-flush notch border-l-2 border-l-scale px-4 py-3.5 select-none sm:px-5">
          <p className="text-[10px] tracked text-scale/70">Field note</p>
          <p className="mt-1.5 text-[14px] text-scale glow-scale italic">{block.text}</p>
        </aside>
      );

    case "fadeEssay":
      return <FadeEssay text={block.text} note={block.note} />;

    case "altImage":
      return (
        <AltImage
          alt={block.alt}
          caption={block.caption}
          sourceComment={block.sourceComment}
        />
      );
  }
}

export function Blocks({ blocks }: { blocks: PuzzleBlock[] }) {
  return (
    <div id="puzzle-blocks-container" className="flex flex-col gap-5 select-none">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}
