"use client";

import { useState } from "react";
import Btn from "@/components/Btn";
import type { PublicGate, PublicLevel } from "@/lib/types";

type Props = {
  levelId: number;
  gate: PublicGate;
  onOpened: (level: PublicLevel) => void;
};

/**
 * The level-3 lock. The correct order lives on the server, so the grid is
 * checked over the wire rather than in the bundle.
 */
export default function PlateGrid({ levelId, gate, onOpened }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);

  if (gate.open) {
    return (
      <div className="panel notch brackets pop-3d p-5 sm:p-7">
        <p className="text-[10px] tracked text-phos">Lock open</p>
        <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ink/85">
          {gate.rewardCaption}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
          {gate.reward?.map((t, i) => (
            <div key={`${t.id}-${i}`} className="flex flex-col items-center gap-2">
              <div className="grid h-24 w-24 place-items-center border border-phos/30 bg-panel-2 text-5xl shadow-[0_0_40px_-12px] shadow-phos/40 sm:h-28 sm:w-28 sm:text-6xl">
                <span aria-hidden>{t.glyph}</span>
                <span className="sr-only">{t.label}</span>
              </div>
              <span className="text-[10px] tracked text-ink-dim">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const toggle = (id: string) => {
    setMessage(null);
    setPicked((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length >= gate.length
          ? prev
          : [...prev, id],
    );
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ level: levelId, sequence: picked }),
      });
      const data = await res.json();
      if (data.opened) {
        onOpened(data.level as PublicLevel);
        return;
      }
      setMessage(data.message ?? data.error ?? "The lock does not move.");
      setWrong(true);
      setPicked([]);
      setTimeout(() => setWrong(false), 500);
    } catch {
      setMessage("Connection lost. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`panel notch brackets p-5 sm:p-7 ${wrong ? "shake" : ""}`}>
      <p className="max-w-prose text-[14px] leading-relaxed text-ink/85">
        {gate.prompt}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-3">
        {gate.tiles.map((tile) => {
          const order = picked.indexOf(tile.id);
          const active = order !== -1;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => toggle(tile.id)}
              disabled={busy}
              aria-pressed={active}
              aria-label={`${tile.label}${active ? `, selected ${order + 1}` : ""}`}
              className={`tilt relative grid aspect-square place-items-center border text-4xl sm:text-5xl ${
                active
                  ? "border-phos bg-phos/10 shadow-[0_0_30px_-8px] shadow-phos/60"
                  : "border-phos/15 bg-panel-2 hover:border-phos/45 hover:bg-phos/5"
              } ${busy ? "opacity-60" : ""}`}
            >
              <span aria-hidden className={active ? "" : "opacity-80"}>
                {tile.glyph}
              </span>
              {active && (
                <span className="absolute top-1 left-1 grid h-5 w-5 place-items-center bg-phos text-[11px] font-bold text-void">
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-[10px] tracked text-ink-dim">
          {picked.length} / {gate.length} selected
        </span>
        <div className="ml-auto flex gap-2">
          <Btn
            type="button"
            variant="ghost"
            onClick={() => {
              setPicked([]);
              setMessage(null);
            }}
            disabled={busy || picked.length === 0}
          >
            Clear
          </Btn>
          <Btn
            type="button"
            onClick={submit}
            loading={busy}
            loadingLabel="Checking"
            disabled={picked.length !== gate.length}
          >
            Open lock
          </Btn>
        </div>
      </div>

      {message && (
        <p role="status" className="mt-4 text-[13px] text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
