"use client";

import { usePathname } from "next/navigation";

/**
 * Re-keying on the pathname remounts the subtree on every navigation, so
 * the enter animation replays: the page tips back into the screen while a
 * thin wipe races across the top edge.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="relative">
      <div aria-hidden className="route-wipe">
        <span />
      </div>
      <div className="enter-3d">{children}</div>
    </div>
  );
}
