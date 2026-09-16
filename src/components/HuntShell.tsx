"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Blocks } from "@/components/PuzzleBlocks";
import PlateGrid from "@/components/PlateGrid";
import Notepad from "@/components/Notepad";
import Telemetry from "@/components/Telemetry";
import Btn from "@/components/Btn";
import AnswerShape from "@/components/AnswerShape";
import ConfirmModal from "@/components/ConfirmModal";
import DragonLoader from "@/components/DragonLoader";
import ScrambleIn from "@/components/ScrambleIn";
import AntiCheatGuard from "@/components/AntiCheatGuard";
import DragonEye from "@/components/DragonEye";
import RulesGate from "@/components/RulesGate";
import { formatDuration, pad2 } from "@/lib/format";
import type { PublicLevel, TeamState } from "@/lib/types";

type Feedback = { kind: "error" | "info"; text: string } | null;

/** Cosmetic session fingerprint — a stable hex tag for the HUD. */
function sessionTag(name: string): string {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 6).toUpperCase();
}

export default function HuntShell() {
  const router = useRouter();

  const [state, setState] = useState<TeamState | null>(null);
  const [level, setLevel] = useState<PublicLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);      // answer submission
  const [hinting, setHinting] = useState(false);  // hint reveal
  const [gateStatus, setGateStatus] = useState<{
    error: string;
    opensAt?: number;
  } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [shake, setShake] = useState(false);
  const [solvedNote, setSolvedNote] = useState<{
    note: string;
    finished: boolean;
    next: PublicLevel | null;
  } | null>(null);
  const [confirm, setConfirm] = useState<"exit" | "signout" | "hint" | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [rulesAccepted, setRulesAccepted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem("bep_rules_accepted") === "true";
    } catch {
      return false;
    }
  });
  const [showRulesModal, setShowRulesModal] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  /** Which lock the screen is currently showing, readable from callbacks. */
  const shownLevelRef = useRef<number | null>(null);
  /** Set while a request of our own is in flight, or a modal is up. */
  const pausePollRef = useRef(false);

  /* --------------------------- bootstrap -------------------------- */

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/");
          return;
        }
        if (res.status === 403) {
          // Hunt not open or team not created yet — render chamber locked view on /hunt
          const data = await res.json().catch(() => ({}));
          if (!alive) return;
          setGateStatus({
            error: data.error || "The chamber is sealed.",
            opensAt: data.opensAt,
          });
          return;
        }
        const data = await res.json();
        if (!alive) return;
        setState(data.state);
        setLevel(data.level);
      } catch {
        if (alive) setFeedback({ kind: "error", text: "Nothing answers from below." });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  /* ------------------------------ sync ---------------------------- */

  /**
   * Teams share one run across devices, so the screen has to be told when
   * somebody else moves it. Without this a teammate one lock behind
   * submits, gets a 403, and — because 403 used to mean "signed out" — is
   * thrown back to the briefing page for no visible reason.
   */
  type SyncResult = "moved" | "same" | "denied" | "error";

  const sync = useCallback(async (): Promise<SyncResult> => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return "denied";
      const data = await res.json();
      const was = shownLevelRef.current;
      setState(data.state);
      setLevel(data.level);
      if (data.level && was !== null && data.level.id !== was) {
        setAnswer("");
        return "moved";
      }
      return "same";
    } catch {
      return "error";
    }
  }, []);

  useEffect(() => {
    shownLevelRef.current = level?.id ?? null;
  }, [level?.id]);

  const finished = state?.finished ?? false;

  useEffect(() => {
    if (loading || finished) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (pausePollRef.current) return;
      void sync();
    };
    const id = setInterval(tick, 10_000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [loading, finished, sync]);

  /* --------------------------- CRT decay -------------------------- */

  /* The dig degrades as the team gets deeper: scanlines thicken and
     the flicker comes round more often. Level 1 looks exactly as it always
     did; the stylesheet clamps this back to 0 under reduced motion. */
  useEffect(() => {
    const root = document.documentElement;
    const span = Math.max(1, (state?.totalLevels ?? 1) - 1);
    const depth = Math.min(1, Math.max(0, ((state?.level ?? 1) - 1) / span));
    root.style.setProperty("--depth", String(depth.toFixed(3)));
    return () => {
      root.style.removeProperty("--depth");
    };
  }, [state?.level, state?.totalLevels]);

  /* ------------------------------ clock --------------------------- */

  useEffect(() => {
    if (state?.finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state?.finished]);

  const cooldownLeft = state?.lockedUntil
    ? Math.max(0, Math.ceil((state.lockedUntil - now) / 1000))
    : 0;

  const budgetLeft = state
    ? Math.max(0, state.hintBudget - state.hintsTaken)
    : 0;

  const elapsed = state
    ? state.finished
      ? state.elapsedMs
      : Math.max(0, now - state.startedAt) + state.penaltyMs
    : 0;

  /* ---------------------------- actions --------------------------- */

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!level || busy || !answer.trim()) return;
      setBusy(true);
      pausePollRef.current = true;
      setFeedback(null);
      try {
        const tabSwitches = Number(
          (typeof window !== "undefined" &&
            sessionStorage.getItem("bep_tab_switches")) ||
            "0",
        );
        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ level: level.id, answer, tabSwitches }),
        });
        const data = await res.json();

        if (res.status === 401) {
          router.replace("/");
          return;
        }
        // 403 is ambiguous: it covers "signed out", "hunt closed" AND
        // "your team already opened this lock". Ask the server which.
        if (res.status === 403) {
          const r = await sync();
          if (r === "denied") {
            router.replace("/");
            return;
          }
          setFeedback({
            kind: "info",
            text:
              r === "moved"
                ? "A teammate opened that lock while you were typing. Here is the next one."
                : (data.error ?? "That lock is not open to you."),
          });
          return;
        }
        if (!res.ok) {
          setFeedback({ kind: "error", text: data.error ?? "Rejected." });
          if (data.lockedUntil && state)
            setState({ ...state, lockedUntil: data.lockedUntil });
          setShake(true);
          setTimeout(() => setShake(false), 500);
          return;
        }

        setState(data.state);
        if (data.correct) {
          setAnswer("");
          setSolvedNote({
            note: data.successNote,
            finished: data.finished,
            next: data.nextLevel ?? null,
          });
        } else {
          setFeedback({ kind: "error", text: data.message });
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setLevel((l) => (l ? { ...l, attempts: l.attempts + 1 } : l));
        }
      } catch {
        setFeedback({ kind: "error", text: "The dark swallowed that. Try again." });
      } finally {
        setBusy(false);
        pausePollRef.current = false;
      }
    },
    [answer, busy, level, router, state, sync],
  );

  const takeHint = useCallback(async () => {
    if (!level || hinting || busy) return;
    setHinting(true);
    pausePollRef.current = true;
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ level: level.id }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      if (res.status === 403) {
        const r = await sync();
        if (r === "denied") {
          router.replace("/");
          return;
        }
        setFeedback({
          kind: "info",
          text:
            r === "moved"
              ? "A teammate opened that lock. No hint spent."
              : (data.error ?? "That lock is not open to you."),
        });
        return;
      }
      if (!res.ok) {
        setFeedback({ kind: "error", text: data.error ?? "No hint available." });
        return;
      }
      setLevel(data.level);
      setState(data.state);
      if (data.chargedMinutes > 0)
        setFeedback({
          kind: "info",
          text: `Hint unlocked. +${data.chargedMinutes} min added to your time.`,
        });
    } finally {
      setHinting(false);
      pausePollRef.current = false;
    }
  }, [busy, hinting, level, router, sync]);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      try {
        sessionStorage.removeItem("bep_locked_down");
        localStorage.removeItem("bep_locked_down");
        sessionStorage.setItem("bep_tab_switches", "0");
        sessionStorage.removeItem("bep_rules_accepted");
      } catch {}
      await fetch("/api/auth/signout", { method: "POST" });
      router.replace("/");
    } finally {
      setSigningOut(false);
    }
  }, [router]);

  /** Back to the briefing, session intact. */
  const leaveDig = useCallback(() => {
    setLeaving(true);
    router.push("/");
  }, [router]);

  const proceed = () => {
    if (!solvedNote) return;
    if (solvedNote.next) setLevel(solvedNote.next);
    setSolvedNote(null);
    setFeedback(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  /* ---------------------------- rendering ------------------------- */

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-4">
        <DragonLoader
          size="md"
          title="DESCENDING INTO THE UNDERCROFT..."
          subtitle="Striking torches · Unlocking chamber seals"
        />
      </div>
    );
  }

  if (gateStatus) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-12 text-center">
        <section className="panel notch brackets pop-3d w-full p-8 text-center sm:p-12">
          <DragonEye variant="lockdown" className="mx-auto mb-4 h-16 w-24" />
          <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-danger uppercase">
            [ CHAMBER LOCKED // DESCENT SEALED ]
          </p>
          <h1 className="mt-2 text-xl font-bold uppercase tracking-wider text-ember glow sm:text-2xl">
            THE VAULT REMAINS SEALED
          </h1>
          <p className="mt-3 text-xs leading-relaxed text-ink-dim sm:text-sm">
            {gateStatus.error}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              onClick={() => {
                try {
                  sessionStorage.removeItem("bep_locked_down");
                  localStorage.removeItem("bep_locked_down");
                  sessionStorage.setItem("bep_tab_switches", "0");
                } catch {}
              }}
              className="btn notch"
            >
              Return to Surface
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-ghost notch"
            >
              Check Chamber Seal
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-[13px] text-danger">
          {feedback?.text ?? "No active session."}
        </p>
        <Link href="/" className="btn notch">
          Back to briefing
        </Link>
      </div>
    );
  }

  if (state && !state.finished && !rulesAccepted) {
    return (
      <RulesGate
        teamName={state.team.name}
        onAccept={() => {
          try {
            sessionStorage.setItem("bep_rules_accepted", "true");
          } catch {}
          setRulesAccepted(true);
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <AntiCheatGuard enabled={Boolean(!loading && state && level && !state.finished && rulesAccepted)} />

      {showRulesModal && (
        <RulesGate
          isModal={true}
          teamName={state.team.name}
          onClose={() => setShowRulesModal(false)}
        />
      )}

      {/* ----------------------------- status bar ------------------- */}
      <div className="panel notch brackets mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => setConfirm("exit")}
          title="Back to the briefing page"
          className="notch flex shrink-0 items-center gap-2 border border-ember/35 px-3 py-2 text-[10px] tracked text-ember transition-all hover:border-ember hover:bg-ember/10 hover:shadow-[0_0_20px_-6px] hover:shadow-ember/70"
        >
          <span aria-hidden className="text-[13px] leading-none">&lsaquo;</span>
          Back
        </button>

        <span aria-hidden className="hidden h-8 w-px bg-ember/15 sm:block" />

        <div className="min-w-0">
          <p className="text-[10px] tracked text-ink-dim">Team</p>
          <p className="truncate text-[14px] text-ember glow">{state.team.name}</p>
        </div>

        <div className="hidden sm:block">
          <p className="text-[10px] tracked text-ink-dim">Seal</p>
          <p className="text-[14px] tabular-nums text-ink/70">
            0x{sessionTag(state.team.name)}
          </p>
        </div>

        <div>
          <p className="text-[10px] tracked text-ink-dim">Elapsed</p>
          <p className="text-[14px] tabular-nums text-ink">
            {formatDuration(elapsed)}
            {state.penaltyMs > 0 && (
              <span className="ml-2 text-[11px] text-scale">
                +{Math.round(state.penaltyMs / 60000)}m
              </span>
            )}
          </p>
        </div>

        {/* The board does not rank on the wall clock — it stops at your
            last solve. Showing only the running one makes teams think
            they are being charged for thinking. */}
        <div title="What the leaderboard ranks you on. It stops between solves.">
          <p className="text-[10px] tracked text-ink-dim">Ranked</p>
          <p className="text-[14px] tabular-nums text-ember">
            {formatDuration(state.rankedMs)}
          </p>
        </div>

        <div>
          <p className="text-[10px] tracked text-ink-dim">Progress</p>
          <p className="text-[14px] tabular-nums text-ink">
            {pad2(Math.min(state.level - 1, state.totalLevels))} / {pad2(state.totalLevels)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="ml-auto text-[10px] tracked text-scale hover:text-ember transition-colors flex items-center gap-1.5 border border-ember/25 bg-ember/5 px-2.5 py-1 rounded"
        >
          <span aria-hidden>📜</span> Rules
        </button>

        <button
          type="button"
          onClick={() => setConfirm("signout")}
          className="text-[10px] tracked text-ink-dim underline-offset-4 transition-colors hover:text-danger hover:underline"
        >
          Sign out
        </button>
      </div>

      {/* ------------------------------ rail ------------------------ */}
      <ol className="mb-6 flex items-stretch gap-1.5 overflow-x-auto pb-1" aria-label="Level progress">
        {state.rail.map((r, i) => (
          <li key={r.id} className="flex flex-1 items-stretch">
            <div
              className={`relative flex min-w-[86px] flex-1 flex-col gap-1 border-t-2 px-2 py-2 transition-colors ${
                r.status === "solved"
                  ? "border-t-ember text-ember"
                  : r.status === "active"
                    ? "border-t-scale text-scale"
                    : "border-t-ember/15 text-ink-dim"
              }`}
            >
              {r.status === "active" && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-scale/12 to-transparent"
                />
              )}
              <span className="relative text-[9px] tracked opacity-70">
                {pad2(r.id)} {r.status === "solved" ? "✓" : r.status === "locked" ? "✕" : "▶"}
              </span>
              <span className="relative truncate text-[11px] tracked">
                {r.status === "locked" ? "——" : r.codename}
              </span>
            </div>
            {i < state.rail.length - 1 && (
              <span
                aria-hidden
                className={`mt-[-1px] self-start text-[9px] ${
                  r.status === "solved" ? "text-ember/50" : "text-ember/15"
                }`}
              >
                ›
              </span>
            )}
          </li>
        ))}
      </ol>

      {state.finished ? (
        <FinishedCard state={state} elapsed={elapsed} />
      ) : level ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* ------------------------- puzzle ----------------------- */}
          <section key={level.id} className="decrypting turn-3d">
            <header className="mb-5">
              <p className="flex flex-wrap items-center gap-x-3 text-[10px] tracked text-scale">
                <span>
                  Lock {pad2(level.id)} · {level.codename}
                </span>
                <span aria-hidden className="h-px w-6 bg-scale/30" />
                <span className="text-ink-dim">
                  chamber {pad2(level.id)} of {pad2(state.totalLevels)} · opened
                </span>
              </p>
              <ScrambleIn
                text={level.title}
                tick={22}
                className="mt-1.5 block text-2xl leading-tight text-ember glow sm:text-3xl"
              />
              <p className="mt-2 max-w-prose text-[13px] text-ink-dim italic">
                {level.brief}
              </p>
            </header>

            <Blocks blocks={level.blocks} />

            {level.gate && (
              <div className="mt-5">
                <PlateGrid
                  levelId={level.id}
                  gate={level.gate}
                  onOpened={(next) => setLevel(next)}
                />
              </div>
            )}

            {/* ------------------------ answer ---------------------- */}
            <form
              onSubmit={submit}
              className={`panel notch brackets mt-6 p-4 sm:p-5 ${shake ? "shake" : ""}`}
            >
              <label
                htmlFor="answer"
                className="mb-2 block text-[10px] tracked text-ink-dim"
              >
                Enter the key
              </label>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <div className="relative flex-1">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ember/50"
                  >
                    &gt;
                  </span>
                  <input
                    id="answer"
                    ref={inputRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                      setFeedback({
                        kind: "error",
                        text: "Direct paste guarded. Decipher the clue and type the key with your own keystrokes.",
                      });
                      setShake(true);
                      setTimeout(() => setShake(false), 500);
                    }}
                    disabled={busy || hinting || cooldownLeft > 0}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder={
                      cooldownLeft > 0
                        ? `locked · ${cooldownLeft}s`
                        : "type your answer"
                    }
                    className="field notch pl-8"
                  />
                </div>
                <Btn
                  type="submit"
                  loading={busy}
                  loadingLabel="Checking"
                  disabled={hinting || cooldownLeft > 0 || !answer.trim()}
                  className="sm:w-40"
                >
                  {cooldownLeft > 0 ? `${cooldownLeft}s` : "Submit"}
                </Btn>
              </div>

              {level.answerShape && (
                <AnswerShape shape={level.answerShape} value={answer} />
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                {feedback && (
                  <p
                    role="status"
                    className={`text-[13px] ${
                      feedback.kind === "error" ? "text-danger" : "text-scale"
                    }`}
                  >
                    {feedback.text}
                  </p>
                )}
                {level.attempts > 0 && (
                  <p className="ml-auto text-[10px] tracked text-ink-dim">
                    {level.attempts} failed attempt{level.attempts === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </form>
          </section>

          {/* -------------------------- sidebar --------------------- */}
          <aside className="flex flex-col gap-4">
            <div className="panel notch brackets p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] tracked text-ink-dim">Hints</p>
                <p
                  className={`text-[10px] tracked ${
                    budgetLeft === 0 ? "text-danger" : "text-ink-dim"
                  }`}
                  title="Hints left for the whole hunt"
                >
                  {budgetLeft}/{state.hintBudget} left
                </p>
              </div>

              <ul className="mt-3 flex flex-col gap-2.5">
                {level.revealedHints.map((h, i) => (
                  <li
                    key={i}
                    className="pop-3d border-l-2 border-l-ember/40 pl-3 text-[13px] leading-relaxed text-ink/80"
                  >
                    {h}
                  </li>
                ))}
                {level.revealedHints.length === 0 && (
                  <li className="text-[12px] text-ink-dim italic">
                    Nothing revealed yet.
                  </li>
                )}
              </ul>

              {level.hintsRemaining > 0 ? (
                <Btn
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    level.nextHintCostMinutes > 0
                      ? setConfirm("hint")
                      : takeHint()
                  }
                  loading={hinting}
                  loadingLabel="Working"
                  disabled={busy}
                  className="mt-4 w-full"
                >
                  {level.nextHintCostMinutes > 0
                    ? `Reveal (+${level.nextHintCostMinutes} min)`
                    : "Reveal hint"}
                </Btn>
              ) : (
                <p className="mt-4 text-[11px] leading-relaxed text-ink-dim italic">
                  {budgetLeft === 0
                    ? "Hint budget spent. The rest of the hunt is yours alone."
                    : "Nothing further on this lock."}
                </p>
              )}

              <p className="mt-3 border-t border-ember/10 pt-2.5 text-[10px] leading-relaxed tracked text-ink-dim">
                {state.hintBudget} hints for the whole hunt. They get dearer
                each time you go back to the same lock.
              </p>
            </div>

            {state.keys.length > 0 && (
              <div className="panel notch brackets p-4">
                <p className="text-[10px] tracked text-ink-dim">Keys recovered</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {state.keys.map((k) => (
                    <li key={k.id} className="flex items-baseline gap-2">
                      <span className="text-[9px] tracked text-ink-dim/70">
                        {pad2(k.id)}
                      </span>
                      <span className="text-[9px] tracked text-ink-dim/70">
                        {k.codename}
                      </span>
                      <span className="ml-auto text-[13px] text-ember">
                        {k.answer}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-ember/10 pt-2.5 text-[10px] leading-relaxed tracked text-ink-dim">
                  Every answer feeds the next lock. Yours are kept here.
                </p>
              </div>
            )}

            <Notepad teamKey={state.team.name} />

            <Telemetry />

            <Link
              href="/leaderboard"
              className="btn btn-ghost notch w-full text-center"
            >
              Standings
            </Link>
          </aside>
        </div>
      ) : null}

      {/* ------------------------- leave / sign out ----------------- */}
      <ConfirmModal
        open={confirm === "exit"}
        title="Climb back out?"
        body="You will go back to the briefing page. Your progress is saved on the server and nothing is lost — sign back in with the same team name and passphrase whenever you want."
        note="Your clock keeps running while you are away."
        confirmLabel="Leave"
        confirmingLabel="Leaving"
        cancelLabel="Stay here"
        loading={leaving}
        onConfirm={leaveDig}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmModal
        open={confirm === "hint"}
        title={`Spend a hint on ${level?.codename ?? "this lock"}?`}
        body={`This is one of your ${state.hintBudget} hints for the whole hunt, and you have ${budgetLeft} left. There is no way to get it back.`}
        note={`+${level?.nextHintCostMinutes ?? 0} minutes will be added to your time.`}
        confirmLabel="Spend it"
        confirmingLabel="Working"
        cancelLabel="Keep thinking"
        loading={hinting}
        onConfirm={() => {
          setConfirm(null);
          void takeHint();
        }}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmModal
        open={confirm === "signout"}
        title="Sign out of this device?"
        body="This closes the session in this browser. Your team's progress stays on the server — you will need the team name and passphrase to get back in."
        confirmLabel="Sign out"
        confirmingLabel="Closing"
        cancelLabel="Cancel"
        tone="danger"
        loading={signingOut}
        onConfirm={signOut}
        onCancel={() => setConfirm(null)}
      />

      {/* --------------------------- transition --------------------- */}
      {solvedNote && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] grid place-items-center bg-void/92 px-4 backdrop-blur-sm"
        >
          <div className="panel notch brackets pop-3d w-full max-w-lg p-6 text-center sm:p-9">
            <p className="text-[10px] tracked text-ember glow">
              {solvedNote.finished ? "Final lock released" : "Lock released"}
            </p>
            <p className="mt-4 text-lg leading-relaxed text-ink sm:text-xl">
              {solvedNote.note}
            </p>
            <p className="mt-4 text-[11px] tracked text-ink-dim">
              Elapsed {formatDuration(elapsed)}
            </p>
            <Btn type="button" onClick={proceed} className="mt-7 w-full">
              {solvedNote.finished ? "Open the vault" : "Next lock"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ finished ---------------------------- */

function FinishedCard({ state, elapsed }: { state: TeamState; elapsed: number }) {
  return (
    <section className="panel notch brackets pop-3d mx-auto max-w-2xl p-6 text-center sm:p-10">
      <p className="text-[10px] tracked text-ember glow">Vault open</p>
      <h1 className="mt-3 text-3xl text-ember glow sm:text-4xl">Hunt complete</h1>
      <p className="mx-auto mt-4 max-w-prose text-[14px] leading-relaxed text-ink/85">
        {state.totalLevels} locks, {state.totalLevels} keys. {state.team.name} is
        through.
      </p>

      {/* The point of this page: something the answer box did not already
          give them. Organisers set it from the admin panel. */}
      {state.vaultNote ? (
        <div className="notch mt-7 border border-ember/30 bg-ember/[0.06] px-5 py-6 text-left sm:px-7">
          <p className="text-[10px] tracked text-ember glow">Extraction</p>
          <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-ink">
            {state.vaultNote}
          </p>
        </div>
      ) : null}

      <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden border border-ember/15 bg-ember/15 sm:grid-cols-3">
        {[
          ["Final time", formatDuration(elapsed)],
          ["Locks", `${state.totalLevels}/${state.totalLevels}`],
          ["Hint penalty", `${Math.round(state.penaltyMs / 60000)} min`],
        ].map(([k, v]) => (
          <div key={k} className="bg-panel px-3 py-4">
            <dt className="text-[9px] tracked text-ink-dim">{k}</dt>
            <dd className="mt-1 text-[15px] tabular-nums text-ember">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/leaderboard" className="btn notch">
          See standings
        </Link>
        <Link href="/" className="btn btn-ghost notch">
          Back to briefing
        </Link>
      </div>
    </section>
  );
}
