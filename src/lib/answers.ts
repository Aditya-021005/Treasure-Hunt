/**
 * Answer normalisation.
 *
 * Players type "A River", "the river", "RIVER." — all of those should
 * pass. We fold case, strip anything that is not a letter or digit,
 * drop a leading article, and spell out a couple of number words that
 * teams reliably write out instead of as digits.
 */

const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

export function normalizeAnswer(raw: string): string {
  let s = raw
    .normalize("NFKD")
    // strip combining accents so "chiffré" == "chiffre"
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  s = s.replace(/^(a|an|the)\s+/, "");

  // "forty two" / "forty-two" -> "fortytwo"; "four two" -> "42"
  s = s.replace(/[\s\-_.,!?'"“”‘’]+/g, " ").trim();

  const words = s.split(" ").filter(Boolean);
  if (words.length > 1 && words.every((w) => w in NUMBER_WORDS)) {
    return words.map((w) => NUMBER_WORDS[w]).join("");
  }

  return s.replace(/[^a-z0-9]/g, "");
}

export function matchesAnswer(raw: string, accepted: readonly string[]): boolean {
  const guess = normalizeAnswer(raw);
  if (!guess) return false;
  return accepted.some((a) => normalizeAnswer(a) === guess);
}

/* ------------------------------- answer shape --------------------- */

export type AnswerShape = {
  /** Length of each word, in order. "forty two" -> [5, 3] */
  groups: number[];
  /** Total characters, ignoring spaces. */
  length: number;
  kind: "letters" | "digits" | "mixed";
};

/**
 * The shape of an answer — how many letters or digits, and where the word
 * breaks fall. Shown to teams so they can tell a near-miss from a wrong
 * track. It is derived from the canonical (first) accepted answer and
 * reveals nothing beyond the count.
 */
export function answerShape(raw: string): AnswerShape {
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(a|an|the)\s+/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  const groups = words.map((w) => w.length);
  const joined = words.join("");

  return {
    groups: groups.length ? groups : [0],
    length: joined.length,
    kind: /^\d+$/.test(joined)
      ? "digits"
      : /^[a-z]+$/.test(joined)
        ? "letters"
        : "mixed",
  };
}
