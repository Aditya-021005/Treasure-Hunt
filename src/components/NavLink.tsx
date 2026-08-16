"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";

/** Renders inside a <Link>, so it can read that link's pending state. */
function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className={pending ? "opacity-60" : undefined}>{children}</span>
      {pending && <span aria-hidden className="pending-bar" />}
      {pending && <span className="sr-only">Loading</span>}
    </>
  );
}

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * A link that reports its own navigation as an indeterminate bar. Prefetch
 * is off so the pending state is real rather than instantaneous.
 */
export default function NavLink({ href, children, className = "" }: Props) {
  return (
    <Link href={href} prefetch={false} className={`relative ${className}`}>
      <Pending>{children}</Pending>
    </Link>
  );
}
