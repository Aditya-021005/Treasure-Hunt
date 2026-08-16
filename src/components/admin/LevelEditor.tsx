"use client";

import { useState } from "react";
import Btn from "@/components/Btn";

/* The editor works on loosely-typed level objects: the server is the
   authority on shape and rejects anything invalid, so the UI stays
   forgiving while you are mid-edit. */
type Block = Record<string, unknown> & { kind: string };
type Level = Record<string, unknown> & {
  id: number;
  codename: string;
  title: string;
  brief: string;
  blocks: Block[];
  hints: string[];
  freeHints: number;
  answers: string[];
  successNote: string;
  showLength?: boolean;
  gate?: unknown;
};

const BLOCK_KINDS = [
  ["prose", "Paragraph"],
  ["cipher", "Ciphertext slab"],
  ["callout", "Field note"],
  ["fadeEssay", "Uncopyable passage"],
  ["altImage", "Image with hidden alt text"],
] as const;

const blankLevel = (id: number): Level => ({
  id,
  codename: "NEW",
  title: "Untitled lock",
  brief: "One line under the title.",
  blocks: [{ kind: "prose", text: "" }],
  hints: [""],
  freeHints: 1,
  answers: [""],
  successNote: "On to the next.",
});

const label = "mb-1.5 block text-[10px] tracked text-ink-dim";

export default function LevelEditor({
  initial,
  custom,
  onSaved,
}: {
  initial: Level[];
  custom: boolean;
  onSaved: () => void;
}) {
  const [levels, setLevels] = useState<Level[]>(initial);
  const [open, setOpen] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const patch = (i: number, changes: Partial<Level>) =>
    setLevels((ls) => ls.map((l, n) => (n === i ? { ...l, ...changes } : l)));

  const renumber = (ls: Level[]) => ls.map((l, i) => ({ ...l, id: i + 1 }));

  const move = (i: number, by: number) =>
    setLevels((ls) => {
      const next = [...ls];
      const j = i + by;
      if (j < 0 || j >= next.length) return ls;
      [next[i], next[j]] = [next[j], next[i]];
      return renumber(next);
    });

  const save = async () => {
    setBusy(true);
    setErrors([]);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/levels", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ levels: renumber(levels) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? [data.error ?? "Could not save."]);
        return;
      }
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setErrors(["Could not reach the server."]);
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    if (!confirm("Discard the saved puzzles and go back to the ones in the code?"))
      return;
    setBusy(true);
    await fetch("/api/admin/levels", { method: "DELETE" });
    setBusy(false);
    onSaved();
  };

  return (
    <section className="panel notch brackets p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-[10px] tracked text-phos">Puzzles</h2>
        <span className="text-[10px] tracked text-ink-dim">
          {levels.length} locks · {custom ? "saved in the database" : "from the code seed"}
        </span>
        <div className="ml-auto flex gap-2">
          <Btn
            type="button"
            variant="ghost"
            onClick={() => {
              setLevels((ls) => renumber([...ls, blankLevel(ls.length + 1)]));
              setOpen(levels.length);
            }}
          >
            Add lock
          </Btn>
          <Btn type="button" onClick={save} loading={busy} loadingLabel="Saving">
            Save puzzles
          </Btn>
        </div>
      </header>

      {errors.length > 0 && (
        <ul className="mt-4 border border-danger/40 bg-danger/5 px-4 py-3 text-[12px] text-danger">
          {errors.slice(0, 6).map((e, i) => (
            <li key={i}>· {e}</li>
          ))}
        </ul>
      )}
      {saved && (
        <p className="mt-4 border border-phos/40 bg-phos/5 px-4 py-2 text-[12px] text-phos">
          Saved. Players see the new puzzles on their next request.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {levels.map((l, i) => (
          <article key={i} className="panel-flush notch">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="text-[10px] tracked text-amber">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="truncate text-[13px] text-phos">{l.title}</span>
                <span className="truncate text-[10px] tracked text-ink-dim">
                  {l.codename}
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <IconBtn onClick={() => move(i, -1)} disabled={i === 0} title="Move up">
                  ↑
                </IconBtn>
                <IconBtn
                  onClick={() => move(i, 1)}
                  disabled={i === levels.length - 1}
                  title="Move down"
                >
                  ↓
                </IconBtn>
                <IconBtn
                  onClick={() => {
                    if (levels.length === 1) return;
                    setLevels((ls) => renumber(ls.filter((_, n) => n !== i)));
                    setOpen(null);
                  }}
                  disabled={levels.length === 1}
                  title="Delete lock"
                  danger
                >
                  ✕
                </IconBtn>
              </div>
            </div>

            {open === i && (
              <div className="border-t border-phos/12 p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id={`code-${i}`}
                    text="Codename (shown in the rail)"
                    value={l.codename}
                    onChange={(v) => patch(i, { codename: v.toUpperCase() })}
                  />
                  <Field
                    id={`title-${i}`}
                    text="Title"
                    value={l.title}
                    onChange={(v) => patch(i, { title: v })}
                  />
                </div>

                <Field
                  id={`brief-${i}`}
                  text="Brief (italic line under the title)"
                  value={l.brief}
                  onChange={(v) => patch(i, { brief: v })}
                  className="mt-3"
                />

                {/* ------------------------------- blocks ------------- */}
                <p className={`${label} mt-5`}>Puzzle content</p>
                <div className="flex flex-col gap-2">
                  {l.blocks.map((b, bi) => (
                    <div key={bi} className="border border-phos/15 bg-void/40 p-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={b.kind}
                          onChange={(e) => {
                            const blocks = [...l.blocks];
                            blocks[bi] = { ...b, kind: e.target.value };
                            patch(i, { blocks });
                          }}
                          className="field notch max-w-[15rem] py-1.5 text-[12px]"
                        >
                          {BLOCK_KINDS.map(([k, name]) => (
                            <option key={k} value={k}>
                              {name}
                            </option>
                          ))}
                        </select>
                        <IconBtn
                          onClick={() =>
                            patch(i, { blocks: l.blocks.filter((_, n) => n !== bi) })
                          }
                          disabled={l.blocks.length === 1}
                          title="Remove block"
                          danger
                        >
                          ✕
                        </IconBtn>
                      </div>

                      <textarea
                        rows={b.kind === "fadeEssay" ? 5 : 3}
                        value={String(
                          (b.kind === "altImage" ? b.alt : b.text) ?? "",
                        )}
                        onChange={(e) => {
                          const blocks = [...l.blocks];
                          blocks[bi] =
                            b.kind === "altImage"
                              ? { ...b, alt: e.target.value }
                              : { ...b, text: e.target.value };
                          patch(i, { blocks });
                        }}
                        placeholder={
                          b.kind === "altImage"
                            ? "Text hidden in the image's alt attribute"
                            : b.kind === "cipher"
                              ? "The ciphertext players will see"
                              : "Text"
                        }
                        className="field notch mt-2 text-[13px] tracking-normal"
                      />

                      {b.kind === "cipher" && (
                        <input
                          value={String(b.caption ?? "")}
                          onChange={(e) => {
                            const blocks = [...l.blocks];
                            blocks[bi] = { ...b, caption: e.target.value };
                            patch(i, { blocks });
                          }}
                          placeholder="filename shown above the slab"
                          className="field notch mt-2 text-[12px]"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    patch(i, { blocks: [...l.blocks, { kind: "prose", text: "" }] })
                  }
                  className="mt-2 text-[10px] tracked text-ink-dim underline-offset-4 hover:text-phos hover:underline"
                >
                  + add block
                </button>

                {/* ------------------------------ answers ------------- */}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ListField
                    text="Accepted answers (first one sets the length shown)"
                    values={l.answers}
                    onChange={(answers) => patch(i, { answers })}
                    placeholder="the accepted spelling"
                  />
                  <ListField
                    text="Hints, in order"
                    values={l.hints}
                    onChange={(hints) => patch(i, { hints })}
                    placeholder="a nudge towards it"
                  />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`free-${i}`} className={label}>
                      Free hints (rest cost time)
                    </label>
                    <input
                      id={`free-${i}`}
                      type="number"
                      min={0}
                      value={l.freeHints}
                      onChange={(e) =>
                        patch(i, { freeHints: Math.max(0, Number(e.target.value)) })
                      }
                      className="field notch"
                    />
                  </div>
                  <label className="flex items-end gap-2 pb-2 text-[12px] text-ink-dim">
                    <input
                      type="checkbox"
                      checked={l.showLength !== false}
                      onChange={(e) => patch(i, { showLength: e.target.checked })}
                      className="h-4 w-4 accent-[#35ff9b]"
                    />
                    Show the answer length to players
                  </label>
                </div>

                <Field
                  id={`note-${i}`}
                  text="Message shown after they solve it"
                  value={l.successNote}
                  onChange={(v) => patch(i, { successNote: v })}
                  className="mt-3"
                />

                {l.gate ? (
                  <p className="mt-4 border-l-2 border-l-amber pl-3 text-[11px] leading-relaxed text-amber">
                    This lock has an interactive tile grid. Its tiles and the
                    correct order are kept as-is — editing them needs the JSON
                    view, which is not in this panel yet.
                  </p>
                ) : null}
              </div>
            )}
          </article>
        ))}
      </div>

      {custom && (
        <button
          type="button"
          onClick={revert}
          className="mt-5 text-[10px] tracked text-ink-dim underline-offset-4 hover:text-danger hover:underline"
        >
          Discard and go back to the puzzles in the code
        </button>
      )}
    </section>
  );
}

/* --------------------------------- bits --------------------------- */

function IconBtn({
  children,
  onClick,
  disabled,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`grid h-7 w-7 place-items-center border text-[12px] transition-colors disabled:opacity-25 ${
        danger
          ? "border-danger/30 text-danger hover:bg-danger/10"
          : "border-phos/25 text-phos hover:bg-phos/10"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  id,
  text,
  value,
  onChange,
  className = "",
}: {
  id: string;
  text: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field notch text-[13px] tracking-normal"
      />
    </div>
  );
}

function ListField({
  text,
  values,
  onChange,
  placeholder,
}: {
  text: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  return (
    <div>
      <p className={label}>{text}</p>
      <div className="flex flex-col gap-1.5">
        {values.map((v, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={v}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...values];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="field notch text-[13px] tracking-normal"
            />
            <IconBtn
              onClick={() => onChange(values.filter((_, n) => n !== i))}
              disabled={values.length === 1}
              title="Remove"
              danger
            >
              ✕
            </IconBtn>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        className="mt-1.5 text-[10px] tracked text-ink-dim underline-offset-4 hover:text-phos hover:underline"
      >
        + add
      </button>
    </div>
  );
}
