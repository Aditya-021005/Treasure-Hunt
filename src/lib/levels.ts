import { LEVELS as SEED, type Level } from "@/content/levels";
import type { DB } from "@/lib/store";

/**
 * Where the puzzles come from.
 *
 * `src/content/levels.ts` is only a SEED now. Once anything is saved from
 * the admin panel the database is authoritative, which means the real
 * answers never have to be committed to the repository.
 */
export function levelsOf(db: DB): Level[] {
  return db.levels && db.levels.length > 0 ? db.levels : SEED;
}

export function totalLevels(db: DB): number {
  return levelsOf(db).length;
}

export function levelFrom(db: DB, id: number): Level | undefined {
  return levelsOf(db).find((l) => l.id === id);
}

/** True once the puzzles have been edited away from the shipped seed. */
export function usingCustomLevels(db: DB): boolean {
  return Boolean(db.levels && db.levels.length > 0);
}

/* ------------------------------ validation ------------------------ */

const BLOCK_KINDS = ["prose", "cipher", "callout", "fadeEssay", "altImage"];

/**
 * Validates a level set coming from the admin panel. Returns the problems
 * found; an empty array means it is safe to save.
 */
export function validateLevels(input: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(input)) return ["Levels must be a list."];
  if (input.length === 0) return ["There must be at least one level."];
  if (input.length > 50) return ["That is more than 50 levels."];

  input.forEach((raw, i) => {
    const at = `Level ${i + 1}`;
    const l = raw as Record<string, unknown>;
    if (typeof l !== "object" || l === null) {
      errors.push(`${at}: not an object.`);
      return;
    }
    if (l.id !== i + 1) errors.push(`${at}: id must be ${i + 1}.`);
    for (const key of ["codename", "title", "brief", "successNote"]) {
      if (typeof l[key] !== "string" || !(l[key] as string).trim())
        errors.push(`${at}: "${key}" is required.`);
    }
    if (!Array.isArray(l.answers) || l.answers.length === 0)
      errors.push(`${at}: needs at least one accepted answer.`);
    else if (l.answers.some((a) => typeof a !== "string" || !a.trim()))
      errors.push(`${at}: every answer must be non-empty text.`);

    if (!Array.isArray(l.hints)) errors.push(`${at}: "hints" must be a list.`);
    if (typeof l.freeHints !== "number" || l.freeHints < 0)
      errors.push(`${at}: "freeHints" must be 0 or more.`);

    if (!Array.isArray(l.blocks)) errors.push(`${at}: "blocks" must be a list.`);
    else
      l.blocks.forEach((b, bi) => {
        const block = b as Record<string, unknown>;
        const kind = block?.kind;
        if (typeof kind !== "string" || !BLOCK_KINDS.includes(kind))
          errors.push(
            `${at} block ${bi + 1}: kind must be one of ${BLOCK_KINDS.join(", ")}.`,
          );
        else if (kind === "altImage") {
          if (typeof block.alt !== "string" || !block.alt.trim())
            errors.push(`${at} block ${bi + 1}: altImage needs "alt" text.`);
        } else if (typeof block.text !== "string" || !block.text.trim())
          errors.push(`${at} block ${bi + 1}: ${kind} needs "text".`);
      });

    if (l.gate !== undefined && l.gate !== null) {
      const g = l.gate as Record<string, unknown>;
      if (!Array.isArray(g.tiles) || g.tiles.length === 0)
        errors.push(`${at}: gate needs tiles.`);
      if (!Array.isArray(g.sequence) || g.sequence.length === 0)
        errors.push(`${at}: gate needs a sequence.`);
      else if (Array.isArray(g.tiles)) {
        const ids = new Set(
          (g.tiles as Record<string, unknown>[]).map((t) => String(t?.id)),
        );
        for (const step of g.sequence as unknown[])
          if (!ids.has(String(step)))
            errors.push(`${at}: gate sequence mentions unknown tile "${step}".`);
      }
      if (typeof g.prompt !== "string" || !g.prompt.trim())
        errors.push(`${at}: gate needs a prompt.`);
    }
  });

  return errors;
}
