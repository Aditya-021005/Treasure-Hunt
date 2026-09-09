"use client";

import { useEffect, useState } from "react";

/**
 * A scratchpad that survives reloads. Deliberately dumb — it only stores
 * what the team types (workings, partial decodes), never anything from
 * the server.
 *
 * The stored value is loaded when the panel is first opened rather than on
 * mount, which keeps localStorage out of the render path entirely.
 */
export default function Notepad({ teamKey }: { teamKey: string }) {
  const storageKey = `bep-hunt:notes:${teamKey}`;
  const [value, setValue] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const toggle = () => {
    if (value === null) {
      let stored = "";
      try {
        stored = window.localStorage.getItem(storageKey) ?? "";
      } catch {
        /* private mode — notes just won't persist */
      }
      setValue(stored);
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (value === null) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, value);
      } catch {
        /* ignore quota / private mode */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [value, storageKey]);

  return (
    <div className="panel notch p-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-[10px] tracked text-ink-dim transition-colors hover:text-ember"
      >
        <span>Scratchpad</span>
        <span aria-hidden className="text-ember/60">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <>
          <textarea
            value={value ?? ""}
            onChange={(e) => setValue(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={"workings, partial decodes,\nletters you are sure of…"}
            className="field notch mt-3 resize-y text-[13px] leading-relaxed tracking-normal"
          />
          <p className="mt-2 text-[9px] tracked text-ink-dim">
            Saved in this browser only
          </p>
        </>
      )}
    </div>
  );
}
