import { Suspense } from "react";
import Briefing from "@/components/Briefing";

/**
 * The public landing page. It renders no puzzle content at any point —
 * everything it shows comes from /api/me, which carries only the session,
 * the team roster and the event window.
 */
export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="caret text-[11px] tracked text-ink-dim">Establishing link</p>
        </div>
      }
    >
      <Briefing />
    </Suspense>
  );
}
