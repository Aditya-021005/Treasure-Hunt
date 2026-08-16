"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AccountPanel from "@/components/AccountPanel";
import Countdown from "@/components/Countdown";
import Typewriter from "@/components/Typewriter";
import type { Me } from "@/lib/types";

const BOOT = [
  "BEP RELAY v5.1 — cold start, node PILANI-01",
  "mounting /clock-tower ........... ok",
  "shiv ganga uplink ............... ok",
  "cipher table .................... SEALED",
  "plate archive ................... SEALED",
  "vault seal ...................... INTACT",
  "",
  "Registration is open. The locks are not.",
];

const RULES: [string, string][] = [
  ["Sign in with BITS Google", "One account per person. Your captain creates the team; everyone else joins with the code."],
  ["Teams share one run", "Any member can play from their own device. Progress is the team's, not yours."],
  ["Answers chain", "Every answer feeds the next lock. Write them down — you will need them again."],
  ["Hints cost time", "The first hint on each lock is free. After that, every hint adds minutes to your clock."],
  ["Wrong guesses cool down", "Five misses on a lock and the terminal locks you out briefly. Think, then type."],
  ["Solve it honestly", "Inspecting the page is part of one puzzle. Guessing the API is not — and it is logged."],
];

export default function Briefing() {
  const [me, setMe] = useState<Me | null>(null);
  const params = useSearchParams();

  // Derived from the URL rather than held in state: the proxy redirects
  // here with a marker when someone reaches /hunt outside the window.
  const locked = params.get("locked")
    ? ("before" as const)
    : params.get("closed")
      ? ("closed" as const)
      : null;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.ok) setMe((await res.json()) as Me);
    } catch {
      /* offline — the panel will show its own error on the next action */
    }
  }, []);

  useEffect(() => {
    // Fetching on mount: the state update happens after the network round
    // trip, not synchronously, so it cannot cascade renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const phase = me?.event.phase ?? "before";
  const opensAt = me?.event.opensAt ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[10px] tracked text-amber glow-amber">BEP presents</p>
            <span aria-hidden className="hidden h-px w-8 bg-phos/25 sm:block" />
            <p className="text-[10px] tracked text-ink-dim">
              BITS Pilani · Pilani Campus
            </p>
          </div>

          <h1 className="mt-3 text-4xl leading-[1.05] font-bold tracking-tight text-phos glow sm:text-6xl lg:text-7xl">
            <span className="glitch" data-text="CIPHER">
              CIPHER
            </span>
            <br />
            <span className="glitch" data-text="HUNT">
              HUNT
            </span>
          </h1>

          <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-ink/85">
            Five locks. A Roman&apos;s shift, a Frenchman&apos;s unbreakable key,
            ten plates, a passage that will not sit still, and a picture that
            talks. Every answer is the key to the next door.
          </p>

          {locked && (
            <p
              role="status"
              className="mt-6 max-w-lg border border-amber/40 bg-amber/5 px-4 py-3 text-[12px] leading-relaxed text-amber"
            >
              {locked === "before"
                ? "The terminal is sealed until the hunt opens. Register now and it will unlock itself."
                : "The hunt has closed. Thanks for playing."}
            </p>
          )}

          {phase === "before" && opensAt !== null && me && (
            <div className="mt-8 max-w-lg">
              <Countdown
                target={opensAt}
                serverNow={me.event.serverNow}
                label="Locks open in"
                onElapsed={load}
              />
            </div>
          )}

          {phase === "open" && (
            <p className="mt-8 inline-flex items-center gap-2 border border-phos/30 bg-phos/5 px-4 py-2 text-[11px] tracked text-phos">
              <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-phos" />
              The hunt is live
            </p>
          )}

          <div className="panel notch brackets mt-8 max-w-lg p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 border-b border-phos/10 pb-2 text-[9px] tracked text-ink-dim">
              <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-phos" />
              tty/relay-0 · handshake
            </div>
            <Typewriter
              lines={BOOT}
              className="min-h-[10.5rem] text-[12px] leading-relaxed break-words text-phos/85 sm:text-[13px]"
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#join" className="btn notch">
              {phase === "open" ? "Enter the hunt" : "Register your team"}
            </a>
            <a href="#rules" className="btn btn-ghost notch">
              Read the rules
            </a>
          </div>
        </div>

        <div className="lg:sticky lg:top-32">
          {me ? (
            <AccountPanel me={me} onChanged={load} />
          ) : (
            <div className="panel notch brackets w-full p-5 sm:p-7" id="join">
              <p className="caret text-[11px] tracked text-ink-dim">
                Establishing link
              </p>
            </div>
          )}
        </div>
      </section>

      <section id="rules" className="mt-20 scroll-mt-32 sm:mt-28">
        <div className="flex items-center gap-3">
          <h2 className="text-[10px] tracked text-ink-dim">How it works</h2>
          <span aria-hidden className="h-px flex-1 bg-phos/12" />
          <span className="text-[9px] tracked text-phos/40">
            {RULES.length.toString().padStart(2, "0")} protocols
          </span>
        </div>

        <div className="mt-5 grid gap-px overflow-hidden border border-phos/12 bg-phos/12 sm:grid-cols-2 lg:grid-cols-3">
          {RULES.map(([title, body], i) => (
            <article key={title} className="bg-panel p-5">
              <p className="text-[10px] tracked text-phos/60">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-[14px] text-phos">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
