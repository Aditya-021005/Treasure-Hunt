"use client";

import React, { useState } from "react";
import Link from "next/link";
import DragonEye from "@/components/DragonEye";
import { HINT_BUDGET, HINT_PENALTY_LADDER_MINUTES, WRONG_STRIKES, WRONG_PENALTY_MINUTES } from "@/lib/rules";

interface RulesGateProps {
  teamName: string;
  onAccept?: () => void;
  /** If rendered inside a modal while already playing */
  isModal?: boolean;
  onClose?: () => void;
}

export default function RulesGate({
  teamName,
  onAccept,
  isModal = false,
  onClose,
}: RulesGateProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const content = (
    <div className="relative z-10 flex w-full flex-col">
      {/* Header Tag */}
      <div className="flex flex-col items-center text-center">
        <DragonEye variant="ambient" className="mb-3 h-14 w-20 opacity-90 drop-shadow-[0_0_15px_rgba(230,57,70,0.5)]" />
        <span className="font-mono text-[10px] font-bold tracking-[0.25em] text-danger uppercase">
          [ MANDATORY TOURNAMENT PROTOCOL // CHAMBER CLEARANCE ]
        </span>
        <h1 className="mt-2 font-mono text-xl font-bold uppercase tracking-wider text-ember glow sm:text-2xl">
          RULES OF ENGAGEMENT
        </h1>
        <p className="mt-1 font-mono text-xs text-scale">
          Clearance granted to Team: <strong className="text-ink font-bold">{teamName}</strong>
        </p>
        <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-ink-dim sm:text-xs">
          Read these protocols carefully before entering the crypt. Once the descent begins, draconic integrity surveillance is actively monitoring this terminal.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* RULE 1: PROMINENT TAB-SWITCH WARNING IN BOLD CRIMSON */}
      {/* ========================================================================= */}
      <div className="mt-6 rounded-lg border-2 border-danger bg-danger/10 p-4 sm:p-5 shadow-[0_0_30px_rgba(230,57,70,0.25)] ring-1 ring-danger/40 animate-pulse">
        <div className="flex items-start gap-3.5">
          <span className="shrink-0 text-2xl" aria-hidden>⚠️</span>
          <div className="text-left">
            <span className="inline-block rounded bg-danger px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest text-void">
              CRITICAL PROTOCOL #1
            </span>
            <h2 className="mt-1.5 font-mono text-sm font-black tracking-wide text-danger uppercase sm:text-base">
              TAB SWITCHING &amp; BROWSER FOCUS LOCKOUT:
            </h2>
            <p className="mt-2 text-xs sm:text-sm font-bold leading-relaxed text-ink uppercase">
              IF YOU SWITCH TABS, MINIMIZE THE BROWSER WINDOW, OR DIVERT FOCUS 5 TIMES, YOUR WORKSTATION WILL BE INSTANTLY LOCKED OUT BY THE ELDER DRAKE.
            </p>
            <p className="mt-2 font-mono text-[11px] sm:text-xs leading-relaxed text-ink-dim">
              Once seized, you <strong className="text-danger font-bold">cannot continue on your own</strong>. You will be required to physically call an event proctor to inspect your workstation and enter a proctor override key.
            </p>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="mt-5 space-y-3 text-left">
        {/* Rule 2 */}
        <div className="rounded border border-ember/25 bg-panel-2/60 p-3.5">
          <p className="font-mono text-[11px] font-bold text-ember uppercase tracking-wider">
            RULE #2 — ONE RUN, SYNCHRONIZED TEAM:
          </p>
          <p className="mt-1 text-xs text-ink/85 leading-relaxed">
            All team members share one synchronized run. Any teammate can enter answers from their device, and unlocking a chamber advances your entire team simultaneously. Coordinate closely.
          </p>
        </div>

        {/* Rule 3 */}
        <div className="rounded border border-ember/25 bg-panel-2/60 p-3.5">
          <p className="font-mono text-[11px] font-bold text-ember uppercase tracking-wider">
            RULE #3 — ANSWERS CHAIN TOGETHER:
          </p>
          <p className="mt-1 text-xs text-ink/85 leading-relaxed">
            Every answer is a key that informs subsequent chambers. Record your solutions and notes — you will need them again deeper in the crypt.
          </p>
        </div>

        {/* Rule 4 */}
        <div className="rounded border border-ember/25 bg-panel-2/60 p-3.5">
          <p className="font-mono text-[11px] font-bold text-ember uppercase tracking-wider">
            RULE #4 — HINT BUDGET &amp; HEAVY PENALTIES:
          </p>
          <p className="mt-1 text-xs text-ink/85 leading-relaxed">
            You have a strict total budget of <strong>{HINT_BUDGET} hints</strong> for the entire hunt. The first hint on any lock is free. Subsequent hints on that same lock add <strong>+{HINT_PENALTY_LADDER_MINUTES[0]} min</strong>, then <strong>+{HINT_PENALTY_LADDER_MINUTES[1]} min</strong> penalty time to your final clock.
          </p>
        </div>

        {/* Rule 5 */}
        <div className="rounded border border-ember/25 bg-panel-2/60 p-3.5">
          <p className="font-mono text-[11px] font-bold text-ember uppercase tracking-wider">
            RULE #5 — GUESSING PENALTIES &amp; COOLDOWNS:
          </p>
          <p className="mt-1 text-xs text-ink/85 leading-relaxed">
            Every <strong>{WRONG_STRIKES} wrong answers</strong> adds <strong>+{WRONG_PENALTY_MINUTES} min</strong> penalty to your clock and triggers a cooling lockout on the submission box. Do not spam brute-force guesses.
          </p>
        </div>

        {/* Rule 6 */}
        <div className="rounded border border-ember/25 bg-panel-2/60 p-3.5">
          <p className="font-mono text-[11px] font-bold text-ember uppercase tracking-wider">
            RULE #6 — FAIR PLAY &amp; CRYPTOGRAPHIC INTEGRITY:
          </p>
          <p className="mt-1 text-xs text-ink/85 leading-relaxed">
            Inspect element is allowed where relevant. Automated dictionary scripts, API tampering, and payload injection are monitored in real time and will lead to immediate party disqualification.
          </p>
        </div>
      </div>

      {/* Acknowledgement Checkbox and CTA (Pre-hunt Gate mode) */}
      {!isModal && onAccept && (
        <div className="mt-6 border-t border-ember/20 pt-5">
          <label className="flex items-start gap-3 rounded border border-ember/40 bg-void/80 p-3.5 text-left cursor-pointer hover:border-ember transition-colors">
            <input
              type="checkbox"
              id="rules-acknowledge"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ember text-ember focus:ring-ember bg-void"
            />
            <span className="font-mono text-xs leading-relaxed text-ink">
              <strong className="text-danger font-bold uppercase">I have read and accept all rules.</strong> I explicitly understand that <strong className="text-danger">switching tabs or losing focus 5 times will lock out my terminal</strong> and require an event proctor to unfreeze.
            </span>
          </label>

          <button
            type="button"
            disabled={!acknowledged}
            onClick={onAccept}
            className="btn notch mt-4 w-full py-3.5 text-xs font-bold tracking-widest uppercase disabled:opacity-40 disabled:pointer-events-none"
          >
            I UNDERSTAND THE PROTOCOLS · COMMENCE THE HUNT →
          </button>

          <div className="mt-3 text-center">
            <Link
              href="/"
              className="font-mono text-[11px] text-ink-dim hover:text-ember transition-colors"
            >
              &lsaquo; Return to surface briefing
            </Link>
          </div>
        </div>
      )}

      {/* Modal Close CTA */}
      {isModal && onClose && (
        <div className="mt-6 border-t border-ember/20 pt-4 text-center">
          <button
            type="button"
            onClick={onClose}
            className="btn notch w-full py-2.5 text-xs font-bold tracking-wider uppercase"
          >
            RETURN TO CHAMBER PUZZLE
          </button>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Contest Rules"
        className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-void/90 p-4 backdrop-blur-md"
      >
        <div className="panel notch brackets pop-3d relative my-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 font-mono text-xs text-ink-dim hover:text-ember px-2 py-1"
            aria-label="Close rules"
          >
            ✕
          </button>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="panel notch brackets pop-3d relative overflow-hidden p-6 sm:p-10 border-2 border-ember/40 shadow-[0_0_60px_rgba(230,57,70,0.15)]">
        {content}
      </section>
    </div>
  );
}
