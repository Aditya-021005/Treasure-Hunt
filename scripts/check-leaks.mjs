#!/usr/bin/env node
/**
 * Fails the build if anything a team is supposed to work out ends up in
 * files the browser can download.
 *
 * Checks every accepted answer, every hint, and the gate sequences from
 * src/content/levels.ts against the client bundle and the prerendered
 * HTML. Run it after `next build`.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { LEVELS } = await import(path.join(root, "src/content/levels.ts"));

/** Short or very common strings would produce noise, so they are skipped. */
const MIN_LENGTH = 4;

const secrets = [];
for (const level of LEVELS) {
  for (const a of level.answers) secrets.push([`L${level.id} answer`, a]);
  for (const h of level.hints) secrets.push([`L${level.id} hint`, h]);
  // Only the ORDER is secret. Individual tile ids are ordinary words
  // ("arrow", "moon") that collide with framework strings, so checking
  // them alone produces false positives rather than signal.
  if (level.gate)
    secrets.push([`L${level.id} gate order`, level.gate.sequence.join(",")]);
}

const checked = secrets.filter(([, value]) => value.length >= MIN_LENGTH);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (/\.(js|html|json|txt|rsc)$/.test(e.name)) yield full;
  }
}

const targets = [
  path.join(root, ".next/static"),
  path.join(root, ".next/server/app"),
];

// .next/server/app also holds server-only chunks; only the prerendered
// HTML and flight payloads in it actually reach a browser.
const isClientVisible = (file) =>
  file.includes(`${path.sep}static${path.sep}`) ||
  /\.(html|rsc|body)$/.test(file) ||
  file.endsWith(".meta");

let scanned = 0;
const hits = [];

for (const target of targets) {
  try {
    await stat(target);
  } catch {
    console.error(`\n  ${path.relative(root, target)} is missing — run "npm run build" first.\n`);
    process.exit(2);
  }
  for await (const file of walk(target)) {
    if (!isClientVisible(file)) continue;
    scanned += 1;
    const text = await readFile(file, "utf8");
    const haystack = text.toLowerCase();
    for (const [label, value] of checked) {
      const needle = value.toLowerCase();
      let idx = 0;
      let matched = false;
      while ((idx = haystack.indexOf(needle, idx)) !== -1) {
        const prev = idx > 0 ? haystack[idx - 1] : " ";
        const next = idx + needle.length < haystack.length ? haystack[idx + needle.length] : " ";
        const isPrevWord = /[a-z0-9]/.test(prev);
        const isNextWord = /[a-z0-9]/.test(next);
        if (!isPrevWord && !isNextWord) {
          matched = true;
          break;
        }
        idx += needle.length;
      }
      if (matched) {
        hits.push({ label, value, file: path.relative(root, file) });
      }
    }
  }
}

console.log(
  `\n  leak check · ${checked.length} secrets vs ${scanned} client-visible files`,
);

if (hits.length === 0) {
  console.log("  clean — no answers, hints or gate orders reach the browser\n");
  process.exit(0);
}

console.error("\n  LEAKED:");
for (const h of hits) {
  console.error(`   ${h.label}: ${JSON.stringify(h.value)}\n     in ${h.file}`);
}
console.error(
  "\n  Something imported src/content/levels.ts into a client component.\n",
);
process.exit(1);
