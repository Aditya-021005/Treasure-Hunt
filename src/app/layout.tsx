import type { Metadata, Viewport } from "next";
import Link from "next/link";
import BitStream from "@/components/BitStream";
import BootSplash from "@/components/BootSplash";
import NavLink from "@/components/NavLink";
import PageTransition from "@/components/PageTransition";
import StatusStrip from "@/components/StatusStrip";
import "./globals.css";

export const metadata: Metadata = {
  title: "BEP // Cipher Hunt",
  description:
    "A five-stage treasure hunt of ciphers, glyphs and hidden text. Organised by BEP, BITS Pilani.",
  applicationName: "BEP Cipher Hunt",
  openGraph: {
    title: "BEP // Cipher Hunt",
    description: "Five locks. One key each. Organised by BEP, BITS Pilani.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#04070a",
  colorScheme: "dark",
};

function Nav() {
  const links = [
    { href: "/", label: "Briefing" },
    { href: "/hunt", label: "Terminal" },
    { href: "/leaderboard", label: "Standings" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-phos/15 bg-void/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center border border-phos/40 text-[11px] font-bold text-phos glow"
          >
            B
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[11px] tracked text-ink-dim transition-colors group-hover:text-phos">
              BEP <span className="text-phos/60">{"//"}</span> Cipher Hunt
            </span>
            <span className="block text-[8px] tracked text-ink-dim/60">
              BITS Pilani
            </span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              className="border border-transparent px-2 py-1.5 text-[10px] tracked text-ink-dim transition-colors hover:border-phos/30 hover:text-phos sm:px-3 sm:text-[11px]"
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <StatusStrip />
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="relative min-h-dvh antialiased">
        <BootSplash />

        {/* Background layers — decorative, never intercept pointer events */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 grid-bg" />
        <BitStream />

        {/* CRT chrome, above the background but below the UI */}
        <div aria-hidden className="crt-layer crt-vignette" />
        <div aria-hidden className="crt-layer crt-lines" />
        <div aria-hidden className="crt-layer crt-sweep" />

        <div className="relative z-10 flex min-h-dvh flex-col animate-flicker">
          <Nav />
          <main className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
          <footer className="border-t border-phos/10 px-4 py-6 text-center text-[10px] tracked text-ink-dim sm:px-6">
            BITS Pilani · Organised by BEP · Solve it honestly
          </footer>
        </div>
      </body>
    </html>
  );
}
