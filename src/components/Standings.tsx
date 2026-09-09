"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDuration, pad2 } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";

export default function Standings() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        const data = await res.json();
        if (alive) setRows(data.rows ?? []);
      } catch {
        if (alive) setError("Nothing answers from below.");
      }
    };
    load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="text-[10px] tracked text-scale">Live</p>
        <h1 className="mt-2 text-3xl text-ember glow sm:text-4xl">Standings</h1>
        <p className="mt-2 max-w-prose text-[13px] text-ink-dim">
          Ranked by locks opened, then by time taken. Hint penalties are already
          folded into the clock. Refreshes every 20 seconds.
        </p>
      </header>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      {!rows && !error && (
        <p className="caret text-[11px] tracked text-ink-dim">Fetching board</p>
      )}

      {rows && rows.length === 0 && (
        <div className="panel notch p-8 text-center">
          <p className="text-[13px] text-ink-dim">
            No teams have registered yet. Be the first.
          </p>
          <Link href="/" className="btn notch mt-6">
            Register
          </Link>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="panel notch overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ember/15 text-[9px] tracked text-ink-dim">
                <th className="px-4 py-3 font-normal">#</th>
                <th className="px-4 py-3 font-normal">Team</th>
                <th className="px-4 py-3 font-normal">Locks</th>
                <th className="px-4 py-3 font-normal">Time</th>
                <th className="px-4 py-3 text-right font-normal">Hints</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.rank}-${r.name}`}
                  className={`border-b border-ember/8 last:border-0 transition-colors ${
                    r.isYou ? "bg-ember/8" : "hover:bg-ember/4"
                  }`}
                >
                  <td className="px-4 py-3 text-[13px] tabular-nums text-ink-dim">
                    {pad2(r.rank)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[14px] ${r.isYou ? "text-ember glow" : "text-ink"}`}
                    >
                      {r.name}
                    </span>
                    {r.isYou && (
                      <span className="ml-2 text-[9px] tracked text-ember/70">you</span>
                    )}
                    {r.finished && (
                      <span className="ml-2 text-[9px] tracked text-scale">cleared</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] tabular-nums text-ink">
                        {r.solved}/{r.totalLevels}
                      </span>
                      <span
                        aria-hidden
                        className="hidden h-1 w-16 bg-ember/15 sm:block"
                      >
                        <span
                          className="block h-full bg-ember"
                          style={{ width: `${(r.solved / r.totalLevels) * 100}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-ink-dim">
                    {r.solved > 0 ? formatDuration(r.timeMs) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] tabular-nums text-ink-dim">
                    {r.hintsUsed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/hunt" className="btn notch">
          Back down
        </Link>
        <Link href="/" className="btn btn-ghost notch">
          Briefing
        </Link>
      </div>
    </div>
  );
}
