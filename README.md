# BEP // Cipher Hunt

A five-lock treasure hunt for BITS Pilani. Teams register with their BITS
Google account before the event, a countdown runs until the start, and at
the moment the locks open the terminal unlocks itself. Each answer is the
key to the next puzzle, and a live leaderboard ranks teams by locks opened
and time taken.

Built with Next.js 16 (App Router) + Tailwind v4. No database, no auth
library, no API keys beyond a Google OAuth client.

---

## Run it

```bash
npm install
cp .env.example .env.local          # then fill it in — see below
npm run dev                         # http://localhost:3000
```

For the real event:

```bash
npm run verify                      # build + leak check
npm run start                       # or: PORT=8080 npm run start
```

### Environment

| Variable | Required | What it does |
| --- | --- | --- |
| `HUNT_SECRET` | **yes** | Signs the session cookie. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `HUNT_OPENS_AT` | for the event | ISO 8601 with offset, e.g. `2026-09-12T18:00:00+05:30`. Blank = open immediately. |
| `HUNT_CLOSES_AT` | no | Hard stop. Blank = never closes. |
| `GOOGLE_CLIENT_ID` | **yes** | From Google Cloud → APIs & Services → Credentials. |
| `GOOGLE_CLIENT_SECRET` | **yes** | Same place. |
| `HUNT_OAUTH_REDIRECT` | no | Only if a proxy rewrites the origin. |
| `HUNT_ALLOWED_DOMAINS` | no | Comma-separated email domains. Defaults to the four BITS campus domains; `*` allows any account. |
| `HUNT_MAX_TEAM_SIZE` | no | Default 4. |
| `HUNT_DATA_FILE` | no | Default `./data/hunt.json`. |
| `HUNT_AUTH_MOCK` | dev only | `1` enables a fake sign-in so you can test without Google. Ignored in production builds. |

### Setting up Google sign-in

1. Google Cloud Console → **APIs & Services → Credentials → Create
   credentials → OAuth client ID**, application type **Web application**.
2. Add an **Authorised redirect URI**:
   - local: `http://localhost:3000/api/auth/callback`
   - event: `https://your-domain/api/auth/callback`
3. Copy the client ID and secret into `.env.local`.

No consent-screen verification is needed while the app is restricted to
your own Workspace domain.

---

## How the event runs

**Before `HUNT_OPENS_AT`** — the site shows the countdown and takes
registrations. `/hunt` redirects to the briefing (`src/proxy.ts`), and
every puzzle endpoint returns 403 with no level attached. Nothing
decryptable exists in any response, any bundle, or any prerendered page.

**At the start** — the countdown hits zero, the page re-fetches, and the
team panel's button becomes *Enter the terminal*. No deploy, no restart.

**A team's clock** starts the first time they open the terminal after the
start, not when they registered, so registering early costs nothing. Their
roster locks at that same moment — nobody can join or leave a team that is
already running.

**Registration** — the captain signs in and creates a team, which mints a
six-character join code (`ABC-123`). Teammates sign in and enter that code.
Any member can then play from their own device; progress belongs to the
team.

---

## Where the content lives

**`src/content/levels.ts` is the only file you need to edit to change the
hunt.** It holds every clue, hint, accepted answer and success message.
It is server-only: nothing in it reaches the browser except the fields
that `toPublicLevel()` in `src/lib/hunt.ts` explicitly copies out.

A level looks like this:

```ts
{
  id: 3,
  codename: "GLYPH",            // shown in the progress rail
  title: "Ten Faces, Five Names",
  brief: "One line under the title.",
  blocks: [ /* the puzzle itself, see below */ ],
  gate: { /* optional interactive lock */ },
  hints: ["nudge", "bigger nudge", "near-spoiler"],
  freeHints: 1,                 // how many cost no time
  answers: ["42", "forty two"], // all accepted spellings
  successNote: "Shown after a correct answer.",
}
```

To add a level, append to `LEVELS` and keep the ids running `1..N`. To
remove one, delete it and renumber — teams already past that point are
clamped to the new length. Nothing else in the app hard-codes five levels.

### Block types

| kind | renders as |
| --- | --- |
| `prose` | a paragraph of flavour text |
| `cipher` | a monospaced ciphertext slab that decrypts out of noise |
| `callout` | an amber "field note" aside — good for in-world hints |
| `fadeEssay` | a passage whose words breathe; markup is scrambled, copy disabled |
| `altImage` | a picture whose payload is in its `alt` text and an HTML comment |

`fadeEssay` shuffles the words in the DOM and puts them back with CSS
`order`. On screen it reads normally; pasting the page source into
anything gives a scrambled passage, so a word-counting puzzle can't be
short-circuited. `altImage` is the inspect-the-page puzzle — the answer
sits in the alt attribute.

### Answer length

Under the input, teams see one box per character of the answer, filling in
as they type, plus a "5 characters" / "2 digits" label. Multi-word answers
show a gap between words. It is derived from the **first** entry in
`answers[]`, so put the canonical spelling first:

```ts
answers: ["42", "forty two"],   // shows "2 digits"
answers: ["forty two", "42"],   // shows "8 characters · 2 words"
```

Only the count crosses to the browser, never the answer. To hide it on a
level where the length would give the game away:

```ts
showLength: false,
```

### Gates

A `gate` is an ordered tile lock (level 3). The correct sequence lives on
the server and is checked at `POST /api/gate`, so reading the JS bundle
doesn't give it away. A level with a gate refuses answers until the gate
is open.

---

## The shipped hunt

| # | Codename | Puzzle | Answer |
| - | --- | --- | --- |
| 1 | VENI | Caesar shift +3 | RIVER |
| 2 | CHIFFRE | Vigenère, key = previous answer | HUMAN |
| 3 | GLYPH | Ten plates, pick H·U·M·A·N in order | 42 |
| 4 | COUNT | 42nd word of a passage | LANTERN |
| 5 | MIRROR | Atbash hidden in an image's alt text | BOSM |

Answers are matched loosely: case, punctuation, a leading "a/an/the" and
spelled-out numbers are all normalised away (`src/lib/answers.ts`).

---

## Not leaking the answers

Four things keep the puzzles out of the browser:

1. **Import boundary.** `src/content/levels.ts` is imported only by
   `src/lib/hunt.ts`, which is imported only by route handlers. No client
   component can reach it.
2. **Projection.** `toPublicLevel()` copies out a fixed set of fields.
   Answers, un-unlocked hints and gate sequences have no path to the wire.
3. **Window guard.** `guard()` runs before any level is projected, so
   before the start there is no puzzle payload to intercept at all.
4. **`npm run check:leaks`.** Greps the built client bundle and every
   prerendered page for each answer, hint and gate order, and fails the
   build if one shows up. `npm run verify` does both steps.

`src/proxy.ts` also redirects `/hunt` before the start, but that is a
convenience, not the boundary — the API enforces the same window
independently, so a hand-crafted request gains nothing.

---

## Scoring and anti-cheat

- The first hint on each lock is free; every hint after that adds
  `HINT_PENALTY_MINUTES` (default 3) to the team's clock.
- Five wrong answers on a lock triggers a cooldown (15s, then 30s, 45s…
  capped at 90s). Submissions are also throttled to one per 700ms.
- A team's leaderboard time runs from their first terminal access to their
  **last solve**, so sitting idle between sessions costs nothing.
- Rosters freeze once a team starts.

Tune all of this in `src/lib/hunt.ts` (`MIN_GAP_MS`, `STRIKES`,
`COOLDOWN_STEP_MS`) and `src/content/levels.ts` (`HINT_PENALTY_MINUTES`).

---

## Deploying

The same build runs on both. The only thing that differs is where the
data lives.

### Vercel (primary)

Vercel's filesystem is read-only and each request can land on a different
instance, so **`DATABASE_URL` is required** — without it teams and
progress disappear mid-event.

1. Create a Postgres database (Neon, Supabase, Vercel Postgres — any of
   them). Copy the connection string; hosted providers need
   `?sslmode=require` on the end.
2. `npm run db:check` locally with that URL to confirm it connects and
   round-trips. It writes a throwaway marker and removes it; real data is
   never touched.
3. Import the repo in Vercel. Framework preset: Next.js. No build command
   override needed — `npm run build` already runs the leak check, so a
   deploy fails rather than shipping a leaked answer.
4. Environment variables (Production **and** Preview):
   `HUNT_SECRET`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `HUNT_OPENS_AT`.
5. Add `https://your-project.vercel.app/api/auth/callback` to the Google
   OAuth client's redirect URIs.

**Preview deployments** get random URLs that can't all be whitelisted with
Google. Set `HUNT_OAUTH_REDIRECT` to the production callback in the
Preview environment and previews will sign in through it.

### Render

Render can run either driver.

- **With Postgres** (matches Vercel): use `render.yaml` in the repo root —
  it provisions the database and wires `DATABASE_URL` automatically.
- **With the file store**: attach a persistent disk mounted at
  `/var/data` and set `HUNT_DATA_FILE=/var/data/hunt.json`. No database to
  manage, but then it is Render only.

Add `https://your-service.onrender.com/api/auth/callback` to the Google
OAuth client either way.

### Google OAuth redirect URIs

Every origin the app is reachable from needs its own entry, exactly:

```
http://localhost:3000/api/auth/callback
http://localhost:3002/api/auth/callback
https://your-project.vercel.app/api/auth/callback
https://your-service.onrender.com/api/auth/callback
```

Authorized JavaScript origins can be left empty — the flow is entirely
server-side and never calls Google from the browser.

---

## Storage

One document, two drivers, chosen by whether `DATABASE_URL` is set.

**Postgres** (`src/lib/db.ts`) — the whole dataset is one JSONB row, and
every mutation runs `SELECT ... FOR UPDATE` inside a transaction. That
sounds crude, but it fits: the event is a few hundred records, each
mutation touches related state at once, and the row lock gives the same
all-or-nothing behaviour across serverless instances that the file store
gave within one process. If it ever outgrows this, split `doc` into real
tables — nothing above `transact`/`read` in `src/lib/store.ts` changes.

**JSON file** — `data/hunt.json` (override with `HUNT_DATA_FILE`), writes
serialised through a promise chain and committed with an atomic rename.
Single process only. This is the local-development default and is fine on
a VPS or a Render instance with a persistent disk.

Callers see one API either way, so game logic is identical on both.

Back up the database (or `data/hunt.json`) during the event — it is the
whole scoreboard. `data/` is gitignored so nobody commits live team data.

---

## Layout

```
src/
  proxy.ts                  edge redirect for /hunt outside the window
  app/
    page.tsx                briefing · countdown · registration
    hunt/page.tsx           the terminal
    leaderboard/page.tsx    standings
    api/
      auth/start            begins the Google flow (PKCE)
      auth/callback         code exchange, domain check, session
      auth/signout          drops the session
      auth/mock             dev-only sign-in, disabled in production
      me                    session + team + event window (no puzzles)
      team/create|join|leave
      state                 progress + current level
      answer | gate | hint  puzzle actions
      leaderboard           public standings
  content/levels.ts         ← all puzzle content (server-only)
  lib/
    event.ts                the event window; edge-safe, used by proxy too
    oauth.ts                Google OAuth: PKCE, id_token checks, domains
    accounts.ts             users, teams, join codes
    hunt.ts                 game rules, scoring, the public-view boundary
    store.ts                JSON file store
    session.ts              signed cookies
    answers.ts              answer normalisation
  components/               UI
scripts/check-leaks.mjs     build-time secret scan
```

---

## Interface

The chrome is a fake terminal relay sitting on the Pilani campus. The BITS
references are all cosmetic — campus landmarks in the flavour text,
`NODE PILANI-01` and the campus coordinates in the instrument strip, an
IST clock, and a looping relay log naming the Clock Tower, Shiv Ganga,
ANC, LTC, Connaught, the Library, Oasis and APOGEE. None of it is load
bearing; edit or delete it freely.

- **Boot loader** (`BootSplash.tsx`) — a wireframe vault tumbling in 3D
  with a progress readout, shown on hard loads. Any click or key press
  skips it. Tune `HOLD_MS` to change how long it runs.
- **Bit stream** (`BitStream.tsx`) — ones and zeroes drifting behind the
  page on a throttled canvas.
- **3D transitions** — pages tip in on navigation (`PageTransition.tsx`),
  each new lock turns in like a card, and dialogs pop in on the Z axis.
- **Decrypt reveals** (`ScrambleIn.tsx`) — level titles and ciphertext
  resolve out of noise. The settled text is always in the accessibility
  tree, so a screen reader never waits for the animation.
- **Pending states** — every button goes through `Btn.tsx`, so a press
  always gives a spinner plus a sweeping progress band. Nav links show
  their own pending bar via `useLinkStatus`.

All of it is disabled under `prefers-reduced-motion`.

### Leaving and coming back

The terminal has a **Back** button (to the briefing, session intact) and
**Sign out**. Both go through a confirm dialog with focus trapping,
Escape-to-cancel and backdrop-cancel. The briefing page shows the team
roster and join code rather than redirecting.

---

## Before the event — checklist

- [ ] `DATABASE_URL` set and `npm run db:check` passes (**required on
      Vercel** — the file store loses data there)
- [ ] `HUNT_SECRET` set to a fresh random value
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set, redirect URI added
      in Google Cloud for the real domain
- [ ] `HUNT_OPENS_AT` set to the real start, with the `+05:30` offset
- [ ] `HUNT_AUTH_MOCK` **not** set
- [ ] `HUNT_ALLOWED_DOMAINS` correct for the campuses you are inviting
- [ ] Real puzzles written in `src/content/levels.ts`
- [ ] `npm run verify` passes (build + leak check)
- [ ] `data/hunt.json` on a disk you back up

---

## Accessibility notes

The interface is keyboard-navigable, respects `prefers-reduced-motion`
(the CRT sweep, flicker, boot cube, 3D transitions and typewriter all
stop), and every control has a label. Dialogs trap focus and return it to
whatever opened them.

Two puzzles are visual by design and will not work with a screen reader:
the plate grid (level 3) and the scrambled passage (level 4). If you need
an accessible run, offer those two levels' answers on request at the desk,
or replace those blocks with `prose` and `cipher` versions.
