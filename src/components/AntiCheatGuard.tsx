"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import DragonEye from "@/components/DragonEye";

interface AntiCheatGuardProps {
  /** Explicit enable flag; only active when quiz is actively underway */
  enabled?: boolean;
  /** Optional container element ID to bind copy interception, or defaults to document */
  containerId?: string;
  /** Callback fired whenever user returns after tabbing away */
  onTabSwitch?: (count: number) => void;
  /** Custom warning duration in ms (default 4500) */
  toastDuration?: number;
}

// Zero-width characters and homoglyphs that confuse automated parsers/LLMs if scraped
const ZERO_WIDTH_SALT = "\u200B\u200C\u200D\uFEFF";

const emptySubscribe = () => () => {};

export default function AntiCheatGuard({
  enabled = true,
  containerId,
  onTabSwitch,
  toastDuration = 4500,
}: AntiCheatGuardProps) {
  const pathname = usePathname();
  const isQuizActive = Boolean(enabled && pathname === "/hunt");

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const [tabSwitches, setTabSwitches] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      return Number(sessionStorage.getItem("bep_tab_switches") || "0");
    } catch {
      return 0;
    }
  });

  const [isLockedDown, setIsLockedDown] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const sw = Number(sessionStorage.getItem("bep_tab_switches") || "0");
      return (
        sessionStorage.getItem("bep_locked_down") === "true" ||
        localStorage.getItem("bep_locked_down") === "true" ||
        sw >= 5
      );
    } catch {
      return false;
    }
  });

  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Unlock state
  const [overrideCode, setOverrideCode] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockSuccess, setUnlockSuccess] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [shakeInput, setShakeInput] = useState(false);

  // 1. Console Security Banner
  useEffect(() => {
    if (!isQuizActive || typeof window === "undefined") return;
    const styleTitle =
      "color: #e63946; font-size: 14px; font-weight: bold; text-shadow: 0 0 8px rgba(230,57,70,0.6);";
    const styleBody = "color: #dfa84b; font-size: 11px; font-family: monospace;";
    const styleWarn = "color: #ef4444; font-size: 10px; font-weight: bold;";

    console.log(
      "%c🐉 [BEP CIPHER HUNT: DRACONIC INTEGRITY ACTIVE]",
      styleTitle
    );
    console.log(
      "%cAll network transmissions, session cadence, and solver velocities are cryptographically audited.\nAutomated solvers, dictionary spam, or payload tampering will lead to immediate party disqualification.",
      styleBody
    );
    console.log(
      "%c⚠️ SOLVE WITH YOUR OWN WITS. THE ELDER DRAKE IS WATCHING.",
      styleWarn
    );
  }, [isQuizActive]);

  // 2. Clipboard Poisoning / Anti-Copy
  useEffect(() => {
    if (!isQuizActive) return;

    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (containerId) {
        const container = document.getElementById(containerId);
        if (container && !container.contains(target)) return;
      }

      const selection = window.getSelection();
      const rawText = selection ? selection.toString() : "";
      if (!rawText || rawText.trim().length === 0) return;

      e.preventDefault();

      const poisoned = `[CIPHER HUNT SHIELD: Direct transcript prohibited. Consult the ancient stones with your own mind, hunter.]\n\n${ZERO_WIDTH_SALT}`;

      if (e.clipboardData) {
        e.clipboardData.setData("text/plain", poisoned);
      }

      setWarningMessage("Direct transcription guarded. Decipher the clue with your own mind.");
      setShowWarning(true);
    };

    document.addEventListener("copy", handleCopy);
    return () => {
      document.removeEventListener("copy", handleCopy);
    };
  }, [isQuizActive, containerId]);

  // 3. Tab-Switch / Out-of-Focus Proctoring ("Dragon Eye Surveillance")
  useEffect(() => {
    if (!isQuizActive) return;

    let isAway = false;

    const handleLeave = () => {
      if (!isAway) {
        isAway = true;
      }
    };

    const handleReturn = () => {
      if (isAway) {
        isAway = false;
        setTabSwitches((prev) => {
          const next = prev + 1;
          try {
            sessionStorage.setItem("bep_tab_switches", String(next));
          } catch {
            // Ignore storage restrictions
          }
          if (onTabSwitch) onTabSwitch(next);

          if (next >= 5) {
            setIsLockedDown(true);
            try {
              sessionStorage.setItem("bep_locked_down", "true");
              localStorage.setItem("bep_locked_down", "true");
            } catch {
              // Ignore storage restrictions
            }
          } else {
            setWarningMessage(
              `⚠️ GAZE DIVERTED: The Elder Drake noticed your attention wander into other realms. [Switches: ${next}/5]`
            );
            setShowWarning(true);
          }
          return next;
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleLeave();
      } else {
        handleReturn();
      }
    };

    const handleWindowBlur = () => {
      handleLeave();
    };

    const handleWindowFocus = () => {
      handleReturn();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isQuizActive, onTabSwitch]);

  // Auto-hide warning toast
  useEffect(() => {
    if (!isQuizActive || !showWarning) return;
    const timer = setTimeout(() => {
      setShowWarning(false);
    }, toastDuration);
    return () => clearTimeout(timer);
  }, [isQuizActive, showWarning, toastDuration]);

  // Handle unlock submission
  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideCode.trim() || unlocking) return;
    setUnlocking(true);
    setUnlockError(null);

    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: overrideCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUnlockError(data.error || "Invalid proctor override key.");
        setShakeInput(true);
        setTimeout(() => setShakeInput(false), 500);
        return;
      }

      setUnlockSuccess(true);
      setTimeout(() => {
        setIsLockedDown(false);
        setTabSwitches(0);
        setOverrideCode("");
        setUnlockSuccess(false);
        try {
          sessionStorage.removeItem("bep_locked_down");
          localStorage.removeItem("bep_locked_down");
          sessionStorage.setItem("bep_tab_switches", "0");
        } catch {
          // Ignore
        }
      }, 1100);
    } catch {
      setUnlockError("Failed to reach server. Please check your connection.");
    } finally {
      setUnlocking(false);
    }
  };

  if (!isMounted || !isQuizActive) return null;

  /* ---------------------- Lockdown Fullscreen Modal ---------------------- */
  if (isLockedDown) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Contest Lockdown Screen"
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-y-auto bg-void/98 p-6 text-center backdrop-blur-2xl"
      >
        {/* Ambient Pulsing Crimson Flare */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-radial from-ember-deep/40 via-transparent to-transparent opacity-80"
        />

        <div className="relative z-10 flex w-full max-w-lg flex-col items-center rounded-xl border-2 border-danger/80 bg-panel/95 p-6 shadow-[0_0_80px_rgba(230,57,70,0.5)] backdrop-blur-xl sm:p-8 animate-enter-3d">
          {/* Pulsing Eye */}
          <div className="relative mb-5 flex items-center justify-center">
            <div
              aria-hidden
              className="absolute -inset-4 rounded-full bg-danger/30 blur-xl animate-pulse"
            />
            <DragonEye variant="lockdown" className="h-16 w-24 drop-shadow-[0_0_20px_rgba(230,57,70,0.8)]" />
          </div>

          {/* Telemetry Tag */}
          <span className="font-mono text-[10px] font-bold tracking-[0.25em] text-danger uppercase">
            [ TERMINAL LOCKDOWN // 5 OF 5 REALM SWITCHES ]
          </span>

          {/* Title */}
          <h2 className="mt-2 font-mono text-lg font-bold tracking-wider text-ink uppercase sm:text-xl">
            QUIZ BLOCKED BY THE ELDER DRAKE
          </h2>

          {/* Description */}
          <p className="mt-3 text-xs leading-relaxed text-ink-dim sm:text-sm">
            You have switched tabs or lost focus <strong className="text-danger">5 times</strong>. To preserve tournament fairness, this workstation has been frozen.
          </p>

          {/* Code Input Form */}
          <form
            onSubmit={handleUnlockSubmit}
            className="mt-6 w-full flex flex-col items-center gap-3"
          >
            <div className={`w-full ${shakeInput ? "shake" : ""}`}>
              <label
                htmlFor="proctor-code"
                className="mb-1.5 block text-left font-mono text-[10px] tracking-wider text-scale uppercase"
              >
                Enter Proctor Override Key:
              </label>
              <input
                id="proctor-code"
                type="text"
                value={overrideCode}
                onChange={(e) => {
                  setOverrideCode(e.target.value.toUpperCase());
                  if (unlockError) setUnlockError(null);
                }}
                disabled={unlocking || unlockSuccess}
                autoFocus
                autoComplete="off"
                placeholder="e.g. BEP-DRAKE-2026"
                className="w-full rounded border-2 border-danger/60 bg-void/90 px-4 py-2.5 font-mono text-center text-sm font-bold tracking-widest text-ink transition-all focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/40 placeholder:text-ink-dim/40 uppercase"
              />
            </div>

            {/* Error Message */}
            {unlockError && (
              <p className="font-mono text-xs text-danger drop-shadow-[0_0_6px_rgba(230,57,70,0.6)]">
                {unlockError}
              </p>
            )}

            {/* Success Message */}
            {unlockSuccess && (
              <p className="font-mono text-xs text-scale font-bold drop-shadow-[0_0_8px_rgba(223,168,75,0.7)] animate-pulse">
                ✓ Authorization verified. Lifting dragon seals...
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={unlocking || unlockSuccess || !overrideCode.trim()}
              className="mt-2 w-full rounded border border-ember bg-ember px-4 py-2.5 font-mono text-xs font-bold tracking-wider text-void uppercase transition-all hover:bg-ember/90 hover:shadow-[0_0_20px_rgba(230,57,70,0.5)] disabled:opacity-50 disabled:pointer-events-none"
            >
              {unlocking ? "VERIFYING AUTHORIZATION..." : "VERIFY & UNLOCK TERMINAL"}
            </button>
          </form>

          {/* Ask for Code / Proctor Help section */}
          <div className="mt-5 w-full border-t border-ember/20 pt-4 text-center">
            <button
              type="button"
              onClick={() => setShowHelp((h) => !h)}
              className="font-mono text-[11px] tracking-wider text-scale/80 hover:text-scale underline underline-offset-2 transition-colors"
            >
              {showHelp ? "▲ Hide proctor contact instructions" : "▼ Don't have a code? Ask for one here"}
            </button>

            {showHelp && (
              <div className="mt-3 rounded border border-ember/25 bg-panel-2/90 p-3.5 text-left text-xs text-ink-dim animate-fadeIn">
                <p className="font-bold text-scale mb-1">
                  How to receive a Proctor Unfreeze Key:
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed text-ink/80 font-mono">
                  <li>Call or approach an event coordinator at the front desk.</li>
                  <li>State your team name and show this blocked terminal.</li>
                  <li>The proctor will inspect your workstation and provide the override key.</li>
                </ol>
                <p className="mt-2 text-[10px] text-ink-dim/60 italic font-mono">
                  Note: Multiple unfreeze requests are flagged in the organizer audit log.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------- Warning Toast (< 5 switches) --------------------------- */
  if (!showWarning) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 z-[9999] flex max-w-sm items-center gap-3 rounded-lg border-2 border-ember bg-void/95 p-4 text-xs text-ink shadow-[0_0_40px_rgba(230,57,70,0.6)] backdrop-blur-md animate-enter-3d ring-1 ring-ember/50"
    >
      <span className="shrink-0 text-xl animate-pulse">👁️</span>
      <div className="flex-1 font-mono text-[11px] leading-snug">
        <span className="font-bold text-ember uppercase">Dragon Eye Alert: </span>
        <span className="text-ink/90">{warningMessage}</span>
        {tabSwitches > 0 && (
          <span className="ml-2 inline-block rounded bg-danger/30 px-1.5 py-0.5 text-[9px] font-bold text-danger">
            {tabSwitches}/5
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setShowWarning(false)}
        className="shrink-0 text-ink-dim hover:text-ember px-1 font-mono text-xs"
        aria-label="Dismiss warning"
      >
        ✕
      </button>
    </div>
  );
}
