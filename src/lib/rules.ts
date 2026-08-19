/* ==================================================================
 *  Scoring dials, and nothing else.
 *
 *  These live apart from `src/content/levels.ts` on purpose: the
 *  briefing page has to quote the rules to players, and it is a client
 *  component. Importing the puzzle file there would ship every answer
 *  and hint to the browser — which is exactly what `npm run check:leaks`
 *  exists to catch.
 *
 *  So: numbers here, secrets there. Nothing in this file may import
 *  from the content module.
 * ================================================================== */

/**
 * What a penalised hint costs, in minutes, by how many charged hints the
 * team has already taken ON THIS LEVEL. The nudge is cheap; the hint that
 * hands over the answer is not. Teams that run past the end of the ladder
 * keep paying the last value.
 */
export const HINT_PENALTY_LADDER_MINUTES = [5, 12];

/**
 * Hints a team may unlock across the WHOLE hunt, free ones included. This
 * is what stops a team buying its way down every level's hint ladder: the
 * five locks hold fifteen hints between them and a team may have eight.
 */
export const HINT_BUDGET = 8;

export function hintCostMinutes(chargedOnThisLevel: number): number {
  const ladder = HINT_PENALTY_LADDER_MINUTES;
  return ladder[Math.min(chargedOnThisLevel, ladder.length - 1)] ?? 0;
}

/* ------------------------------ wrong answers --------------------- */

/** Wrong answers allowed before the terminal bites back. */
export const WRONG_STRIKES = 3;

/**
 * Every `WRONG_STRIKES` misses also costs this many minutes. The lockout
 * below only exists to make brute-forcing a two-digit answer unattractive;
 * this is the part that actually punishes guessing, and it does it without
 * making the team sit and watch a counter.
 */
export const WRONG_PENALTY_MINUTES = 1;

export const COOLDOWN_STEP_SECONDS = 20;
export const COOLDOWN_MAX_SECONDS = 120;
