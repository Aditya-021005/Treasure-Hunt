import type { Metadata, Viewport } from "next";
import { Courier_Prime, EB_Garamond, Grenze_Gotisch } from "next/font/google";
import Link from "next/link";
import BitStream from "@/components/BitStream";
import DragonEye from "@/components/DragonEye";
import BootSplash from "@/components/BootSplash";
import NavLink from "@/components/NavLink";
import PageTransition from "@/components/PageTransition";
import StatusStrip from "@/components/StatusStrip";
import "./globals.css";

/* Gothic condensed — a face for things carved into a dungeon wall. */
const gotisch = Grenze_Gotisch({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-gotisch",
  display: "swap",
});

/* Old-style serif for reading — the field journal voice. */
const garamond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-garamond",
  display: "swap",
});

/* A real monospace, because the ciphers depend on characters lining up.
   Typewriter rather than terminal. */
const courier = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-courier",
  display: "swap",
});

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
  themeColor: "#100c08",
  colorScheme: "dark",
};

function Nav() {
  const links = [
    { href: "/", label: "Briefing" },
    { href: "/hunt", label: "The Descent" },
    { href: "/leaderboard", label: "Standings" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-ember/15 bg-void/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <DragonEye
            variant="nav"
            className="h-7 w-11 shrink-0 text-ember-dim drop-shadow-[0_0_10px_rgba(230,57,70,0.55)] transition-transform group-hover:scale-110"
          />
          <span className="hidden leading-tight sm:block">
            <span className="block text-[11px] tracked text-ink-dim transition-colors group-hover:text-ember">
              BEP <span className="text-ember/60">·</span> Cipher Hunt
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
              className="border border-transparent px-2 py-1.5 text-[10px] tracked text-ink-dim transition-colors hover:border-ember/30 hover:text-ember sm:px-3 sm:text-[11px]"
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
    <html
      lang="en"
      className={`${gotisch.variable} ${garamond.variable} ${courier.variable}`}
      suppressHydrationWarning
    >
      <body className="relative min-h-dvh antialiased" suppressHydrationWarning>
        <BootSplash />

        {/* Background layers — decorative, never intercept pointer events */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 grid-bg" />
        <BitStream />

        {/* CRT chrome, above the background but below the UI */}
        <div aria-hidden className="veil veil-vignette" />
        <div aria-hidden className="veil veil-grain" />
        <div aria-hidden className="veil veil-torch" />

        <div className="relative z-10 flex min-h-dvh flex-col animate-flicker">
          <Nav />
          <main className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
          <footer className="border-t border-ember/10 px-4 py-6 text-center text-[10px] tracked text-ink-dim sm:px-6">
            BITS Pilani · Organised by BEP · Descend honestly
          </footer>
        </div>
      </body>
    </html>
  );
}
