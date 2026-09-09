"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AccountPanel from "@/components/AccountPanel";
import Countdown from "@/components/Countdown";
import DragonEye from "@/components/DragonEye";
import { BoardPreview, Faq, Steps } from "@/components/HomeSections";
import Typewriter from "@/components/Typewriter";
import {
  HINT_BUDGET,
  HINT_PENALTY_LADDER_MINUTES,
  WRONG_PENALTY_MINUTES,
  WRONG_STRIKES,
} from "@/lib/rules";
import type { Me } from "@/lib/types";

const BOOT = [
  "DESCENT LOG — Pilani undercroft, level V",
  "torch ........................... lit",
  "stair, first turning ............ clear",
  "cipher table .................... SEALED",
  "plate archive ................... SEALED",
  "vault door ...................... HOLDING",
  "",
  "Something below is awake. The party may assemble.",
];

const RULES: [string, string][] = [
  ["Sign in with BITS Google", "One account per person. Your captain creates the team; everyone else joins with the code."],
  ["Teams share one run", "Any member can play from their own device. Progress is the team's, not yours."],
  ["Answers chain", "Every answer feeds the next lock. Write them down — you will need them again."],
  [
    `You get ${HINT_BUDGET} hints. Total.`,
    `Not ${HINT_BUDGET} per lock — ${HINT_BUDGET} for the whole hunt, and there are far more than that on offer. Spend them where you are actually stuck.`,
  ],
  [
    "Hints get dearer",
    `The first hint on a lock is free. Going back to the same lock costs +${HINT_PENALTY_LADDER_MINUTES[0]} min, then +${HINT_PENALTY_LADDER_MINUTES[1]} — because by then it is telling you the answer.`,
  ],
  [
    "Guessing costs time",
    `Every ${WRONG_STRIKES} wrong answers on a lock adds +${WRONG_PENALTY_MINUTES} min to your clock and cools the terminal down. Think, then type.`,
  ],
  ["Solve it honestly", "Inspecting the page is part of one puzzle. Guessing the API is not — and it is logged."],
];

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** The hard facts a visitor wants before reading a word of flavour. */
function Facts({ me }: { me: Me | null }) {
  const opensAt = me?.event.opensAt ?? null;
  const phase = me?.event.phase ?? "before";

  const when =
    phase === "open"
      ? "Live now"
      : phase === "closed"
        ? "Closed"
        : opensAt
          ? `${IST.format(new Date(opensAt))} IST`
          : "To be announced";

  const facts: [string, string][] = [
    ["Opens", when],
    ["Locks", me ? String(me.totalLevels) : "—"],
    ["Team size", me ? `Up to ${me.maxTeamSize}` : "—"],
    ["Hints", `${HINT_BUDGET} for the whole hunt`],
  ];

  return (
    <dl className="mt-7 grid max-w-2xl grid-cols-2 gap-px overflow-hidden border border-ember/12 bg-ember/12 sm:grid-cols-4">
      {facts.map(([k, v]) => (
        <div key={k} className="bg-panel px-3 py-3">
          <dt className="text-[9px] tracked text-ink-dim">{k}</dt>
          <dd className="mt-1 text-[13px] leading-snug text-ember">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Five sealed doors. Says what the shape of the evening is without
 *  giving away a single puzzle — the codenames stay hidden. */
function SealedRail({ count }: { count: number }) {
  return (
    <div className="mt-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <p className="text-[9px] tracked text-ink-dim">The locks</p>
        <span aria-hidden className="h-px flex-1 bg-ember/12" />
        <p className="text-[9px] tracked text-ember/40">all sealed</p>
      </div>
      {/* Before /api/me lands we do not know how many locks there are, and
          guessing would print a number that might be wrong. An
          indeterminate bar holds the same height instead. */}
      {count <= 0 ? (
        <div
          aria-hidden
          className="mt-3 h-[3.25rem] animate-breathe border-t-2 border-t-ember/15 bg-ember/[0.03]"
        />
      ) : (
      <ol className="mt-3 flex items-stretch gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            className="flex flex-1 flex-col gap-1 border-t-2 border-t-ember/15 px-1.5 py-2 text-ink-dim"
          >
            <span className="text-[9px] tracked opacity-70">
              {String(i + 1).padStart(2, "0")} ✕
            </span>
            <span className="text-[11px] tracked">——</span>
          </li>
        ))}
      </ol>
      )}
    </div>
  );
}

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

  const previewFlag = params.get("preview");
  const phase = me?.event.phase ?? "before";
  const opensAt = me?.event.opensAt ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
        <div className="relative lg:col-start-1 lg:row-start-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[10px] tracked text-scale glow-scale">BEP presents</p>
            <span aria-hidden className="hidden h-px w-8 bg-ember/25 sm:block" />
            <p className="text-[10px] tracked text-ink-dim">
              BITS Pilani · Pilani Campus
            </p>
          </div>

          {/* It is watching the whole page. Behind the type, never over it. */}
          <DragonEye
            variant="hero"
            className="pointer-events-none absolute -top-10 -left-16 -z-10 hidden w-[30rem] text-ember-deep opacity-30 blur-[1px] lg:block"
          />

          <h1 className="relative mt-3 text-4xl leading-[1.05] font-bold tracking-tight text-ember glow sm:text-5xl lg:text-6xl xl:text-7xl">
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

          <Facts me={me} />

          {me?.preview && (
            <p className="mt-6 flex max-w-2xl items-start gap-2 border border-scale/50 bg-scale/10 px-4 py-3 text-[12px] leading-relaxed text-scale">
              <span aria-hidden className="mt-0.5">▲</span>
              <span>
                <strong className="tracked">Organiser preview.</strong> The
                hunt is unlocked for this browser only — everyone else still
                sees the countdown. Anything you solve is written to the real
                scoreboard, so clear it before the event.
              </span>
            </p>
          )}

          {previewFlag === "bad" && (
            <p className="mt-6 max-w-2xl border border-danger/40 bg-danger/5 px-4 py-3 text-[12px] text-danger">
              That preview link is not valid.
            </p>
          )}

          {previewFlag === "off" && (
            <p className="mt-6 max-w-2xl border border-danger/40 bg-danger/5 px-4 py-3 text-[12px] text-danger">
              Preview access is not enabled on this deployment.
            </p>
          )}

          {locked && !me?.preview && (
            <p
              role="status"
              className="mt-6 max-w-2xl border border-scale/40 bg-scale/5 px-4 py-3 text-[12px] leading-relaxed text-scale"
            >
              {locked === "before"
                ? "The terminal is sealed until the hunt opens. Register now and it will unlock itself."
                : "The hunt has closed. Thanks for playing."}
            </p>
          )}

          {phase === "before" && !me?.preview && opensAt !== null && me && (
            <div className="mt-8 max-w-2xl">
              <Countdown
                target={opensAt}
                serverNow={me.event.serverNow}
                label="Locks open in"
                onElapsed={load}
              />
            </div>
          )}

          {(phase === "open" || me?.preview) && (
            <p className="mt-8 inline-flex items-center gap-2 border border-ember/30 bg-ember/5 px-4 py-2 text-[11px] tracked text-ember">
              <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-ember" />
              {me?.preview && phase !== "open" ? "Unlocked for you" : "The hunt is live"}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#join" className="btn notch">
              {phase === "open" ? "Enter the hunt" : "Register your team"}
            </a>
            <a href="#rules" className="btn btn-ghost notch">
              Read the rules
            </a>
          </div>

          <SealedRail count={me?.totalLevels ?? 0} />
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24">
          {me ? (
            <AccountPanel me={me} onChanged={load} />
          ) : (
            <div className="panel notch brackets w-full p-5 sm:p-7" id="join">
              <p className="caret text-[11px] tracked text-ink-dim">
                Striking a torch
              </p>
              {/* Holds the panel's height so the page does not jump when
                  the session arrives. */}
              <div aria-hidden className="mt-5 flex flex-col gap-3">
                {[100, 72, 88, 60].map((w, i) => (
                  <div
                    key={i}
                    className="h-9 animate-breathe border border-ember/10 bg-ember/[0.03]"
                    style={{ width: `${w}%`, animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Atmosphere, deliberately last. It used to sit between the pitch
            and the buttons; on a phone that put the whole boot animation
            between a visitor and the registration panel. */}
        <div className="panel notch brackets max-w-2xl p-4 sm:p-5 lg:col-start-1 lg:row-start-2">
          <div className="mb-3 flex items-center gap-2 border-b border-ember/10 pb-2 text-[9px] tracked text-ink-dim">
            <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-ember" />
            tty/relay-0 · handshake
          </div>
          <Typewriter
            lines={BOOT}
            className="min-h-[10.5rem] text-[12px] leading-relaxed break-words text-ember/85 sm:text-[13px]"
          />
        </div>
      </section>

      <Steps me={me} />

      <section id="rules" className="mt-20 scroll-mt-32 sm:mt-24">
        <div className="flex items-center gap-3">
          <h2 className="text-[10px] tracked text-ink-dim">How it works</h2>
          <span aria-hidden className="h-px flex-1 bg-ember/12" />
          <span className="text-[9px] tracked text-ember/40">
            {RULES.length.toString().padStart(2, "0")} protocols
          </span>
        </div>

        <div className="mt-5 grid gap-px overflow-hidden border border-ember/12 bg-ember/12 sm:grid-cols-2 lg:grid-cols-3">
          {RULES.map(([title, body], i) => (
            <article
              key={title}
              className={`bg-panel p-5 ${
                i === RULES.length - 1
                  ? "sm:col-span-2 lg:col-span-3"
                  : ""
              }`}
            >
              <p className="text-[10px] tracked text-ember/60">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-[14px] text-ember">{title}</h3>
              <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-ink-dim">
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <BoardPreview me={me} />

      <Faq />
    </div>
  );
}
