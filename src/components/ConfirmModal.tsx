"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import Btn from "@/components/Btn";

type Props = {
  open: boolean;
  title: string;
  body: string;
  /** Extra line rendered in gold, for the consequence of confirming. */
  note?: string;
  confirmLabel: string;
  confirmingLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A blocking confirm dialog. Escape and the backdrop both cancel, focus
 * moves in on open and returns to whatever opened it on close, and Tab is
 * kept inside the dialog while it is up.
 */
export default function ConfirmModal({
  open,
  title,
  body,
  note,
  confirmLabel,
  confirmingLabel,
  cancelLabel = "Stay here",
  tone = "default",
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  const focusables = useCallback(() => {
    const root = panelRef.current;
    if (!root) return [] as HTMLElement[];
    return [
      ...root.querySelectorAll<HTMLElement>("button:not([disabled])"),
    ].filter((el) => el.offsetParent !== null);
  }, []);

  // Take focus on open, hand it back on close.
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => confirmRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      opener.current?.focus?.();
    };
  }, [open]);

  // Escape to cancel, Tab kept inside the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel, focusables]);

  // Freeze the page behind the dialog.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-void/92 px-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="panel notch brackets pop-3d w-full max-w-md p-6 sm:p-8"
      >
        <p className="text-[10px] tracked text-scale glow-scale">Confirm</p>

        <h2 id={titleId} className="mt-3 text-xl text-ember glow sm:text-2xl">
          {title}
        </h2>

        <p id={bodyId} className="mt-3 text-[14px] leading-relaxed text-ink/85">
          {body}
        </p>

        {note && <p className="mt-3 text-[13px] text-scale italic">{note}</p>}

        <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row">
          <Btn
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
            className="flex-1"
          >
            {cancelLabel}
          </Btn>
          <Btn
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            loading={loading}
            loadingLabel={confirmingLabel ?? confirmLabel}
            className={`flex-1 ${
              tone === "danger"
                ? "[--btn-bg:var(--color-danger)] [--btn-fg:var(--color-void)]"
                : ""
            }`}
          >
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}
