#!/usr/bin/env node
/**
 * Round-trips the Postgres store so you can confirm DATABASE_URL works
 * before the event, without touching real team data.
 *
 *   DATABASE_URL='postgres://...' npm run db:check
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load .env.local the same way Next does, so the script needs no extra flags.
try {
  const { readFileSync } = await import("node:fs");
  const raw = readFileSync(path.join(root, ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* no .env.local — rely on the real environment */
}

const { databaseUrl, pgLoad, pgTransact, pgClose } = await import(
  path.join(root, "src/lib/db.ts")
);

const url = databaseUrl();
if (!url) {
  console.error(
    "\n  DATABASE_URL is not set.\n  The app will use the local JSON file instead, which is fine for\n  development but loses data on Vercel.\n",
  );
  process.exit(1);
}

const redacted = url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
console.log(`\n  connecting to ${redacted}`);

const EMPTY = {
  version: 2,
  users: {},
  teams: {},
  userBySub: {},
  teamBySlug: {},
  teamByCode: {},
};

try {
  const before = await pgLoad(EMPTY);
  console.log(
    `  read ok · ${Object.keys(before.users ?? {}).length} users, ${Object.keys(before.teams ?? {}).length} teams`,
  );

  // Write a throwaway marker, read it back, then remove it. Real data is
  // never touched.
  const marker = `dbcheck-${process.pid}`;
  await pgTransact(EMPTY, (doc) => {
    doc.userBySub[marker] = "probe";
  });
  const mid = await pgLoad(EMPTY);
  const wrote = mid.userBySub?.[marker] === "probe";
  await pgTransact(EMPTY, (doc) => {
    delete doc.userBySub[marker];
  });
  const after = await pgLoad(EMPTY);

  if (!wrote) throw new Error("write did not persist");
  if (after.userBySub?.[marker]) throw new Error("cleanup did not persist");

  console.log("  write ok · lock and commit round-tripped");
  console.log(
    `  data preserved · ${Object.keys(after.users ?? {}).length} users, ${Object.keys(after.teams ?? {}).length} teams\n`,
  );
  console.log("  Postgres store is ready.\n");
} catch (err) {
  console.error(`\n  FAILED: ${err.message}\n`);
  console.error("  Check the URL, that the host allows your IP, and that");
  console.error("  the connection string ends with ?sslmode=require for");
  console.error("  hosted providers like Neon or Supabase.\n");
  await pgClose();
  process.exit(1);
}

await pgClose();
