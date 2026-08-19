"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDuration, pad2 } from "@/lib/format";
import { HINT_BUDGET } from "@/lib/rules";
import type { LeaderboardRow, Me } from "@/lib/types";

/* ------------------------------- the run -------------------------- */

/**
 * The shape of the evening, in order. Logistics rather than mechanics —
 * the protocol grid below it covers the rules themselves.
 */
export function Steps({ me }: { me: Me | null }) {
  const size = me?.maxTeamSize ?? 4;
  const locks = me?.totalLevels ?? 5;

  const steps: [string, string][] = [
    ["Sign in", "One account per person. Nothing to install."],
    ["Form a team", `Your captain creates it and shares a join code — up to ${size} of you.`],
    ["Wait for the seal to break", "The terminal unlocks itself the moment the hunt opens. Stay on the page."],
    [`Open ${locks} locks`, "Each answer is the key to the next one. There is no skipping ahead."],
    ["Carry the last word", "The final answer is not typed anywhere. You take it with you."],
  ];

  return (
    <section className="mt-20 sm:mt-24">
      <div className="flex items-center gap-3">
        <h2 className="text-[10px] tracked text-ink-dim">The run</h2>
        <span aria-hidden className="h-px flex-1 bg-phos/12" />
        <span className="text-[9px] tracked text-phos/40">
          {pad2(steps.length)} steps
        </span>
      </div>

      <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map(([title, body], i) => (
          <li key={title} className="relative flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center border border-phos/35 text-[11px] text-phos">
                {i + 1}
              </span>
              {/* Connector, drawn only between cards on one row. */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="hidden h-px flex-1 bg-gradient-to-r from-phos/30 to-transparent lg:block"
                />
              )}
            </div>
            <h3 className="text-[13px] leading-snug text-phos">{title}</h3>
            <p className="text-[12px] leading-relaxed text-ink-dim">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------------------------- board preview ----------------------- */

/**
 * A glance at the board. Before the hunt opens the API returns nothing by
 * design — it would only reveal who registered — so this shows the
 * registration count instead of an empty table.
 */
export function BoardPreview({ me }: { me: Me | null }) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setRows(data.rows ?? []);
      } catch {
        /* the section simply stays in its pre-event state */
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const top = (rows ?? []).slice(0, 3);
  const registered = me?.teamsRegistered ?? 0;

  return (
    <section className="mt-20 sm:mt-24">
      <div className="flex items-center gap-3">
        <h2 className="text-[10px] tracked text-ink-dim">Standings</h2>
        <span aria-hidden className="h-px flex-1 bg-phos/12" />
        <Link
          href="/leaderboard"
          className="text-[9px] tracked text-phos/60 underline-offset-4 hover:text-phos hover:underline"
        >
          full board →
        </Link>
      </div>

      {top.length > 0 ? (
        <ol className="mt-5 grid gap-px overflow-hidden border border-phos/12 bg-phos/12 sm:grid-cols-3">
          {top.map((r) => (
            <li key={r.rank} className="flex flex-col gap-1 bg-panel px-5 py-4">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] tracked text-phos/60">
                  {pad2(r.rank)}
                </span>
                <span className="truncate text-[14px] text-ink">{r.name}</span>
              </div>
              <div className="flex items-baseline gap-3 text-[11px] tracked text-ink-dim">
                <span className="tabular-nums text-phos">
                  {pad2(r.solved)}/{pad2(r.totalLevels)}
                </span>
                <span className="tabular-nums">{formatDuration(r.timeMs)}</span>
                {r.finished && <span className="ml-auto text-amber">cleared</span>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-4 border border-phos/12 bg-panel px-5 py-6">
          <div>
            <p className="text-[9px] tracked text-ink-dim">Teams registered</p>
            <p className="mt-1 text-3xl tabular-nums text-phos glow">
              {registered}
            </p>
          </div>
          <p className="max-w-prose text-[12px] leading-relaxed text-ink-dim">
            The board stays dark until the locks open — publishing it early
            would only show who has signed up. Once the hunt is live it ranks
            on locks opened, then on time.
          </p>
        </div>
      )}
    </section>
  );
}

/* -------------------------------- faq ----------------------------- */

const FAQ: [string, string][] = [
  [
    "Can we play from more than one device?",
    "Yes. The run belongs to the team, not to you — any member can answer from their own phone or laptop, and every screen follows along as locks open.",
  ],
  [
    "What if I close the tab, or my battery dies?",
    "Nothing is lost. Progress lives on the server. Sign back in with the same account and you are exactly where you left off.",
  ],
  [
    "Does thinking time count against us?",
    "The clock you are ranked on stops at your last solved lock, so arguing round a table costs you nothing. Hints and wrong answers are what add minutes.",
  ],
  [
    "Do we have to solve them in order?",
    "Yes, and not by accident — each answer is the key that opens the next lock. There is nothing to skip ahead to.",
  ],
  [
    "What happens when the hints run out?",
    `You are on your own. The ${HINT_BUDGET} are for the whole hunt and there is no way to buy more, so spend them where you are genuinely stuck rather than on the first lock that annoys you.`,
  ],
];

export function Faq() {
  return (
    <section className="mt-20 sm:mt-24">
      <div className="flex items-center gap-3">
        <h2 className="text-[10px] tracked text-ink-dim">Questions</h2>
        <span aria-hidden className="h-px flex-1 bg-phos/12" />
        <span className="text-[9px] tracked text-phos/40">{pad2(FAQ.length)}</span>
      </div>

      <div className="mt-5 flex flex-col gap-px overflow-hidden border border-phos/12 bg-phos/12">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group bg-panel">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-[13px] text-ink transition-colors hover:text-phos">
              <span className="flex-1">{q}</span>
              <span
                aria-hidden
                className="text-[13px] text-phos/50 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="max-w-prose px-5 pb-5 text-[13px] leading-relaxed text-ink-dim">
              {a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
