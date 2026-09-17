/* ==================================================================
 *  THE ONLY FILE YOU NEED TO EDIT TO CHANGE THE HUNT.
 *
 *  Everything here is SERVER-ONLY. It must never be imported from a
 *  file that carries the "use client" directive — answers, hints and
 *  gate sequences would then be shipped to the browser.
 *
 *  Adding a level  -> append to LEVELS. ids must stay 1..N, in order.
 *  Removing one    -> delete it and renumber. Existing team progress
 *                     is clamped to the new length automatically.
 * ================================================================== */

export type Tile = {
  id: string;
  glyph: string;
  /** Screen-reader / tooltip label. Keep it vague — it is sent to the client. */
  label: string;
};

export type PuzzleBlock =
  /** Monospaced ciphertext slab. */
  | { kind: "cipher"; text: string; caption?: string }
  /** Ordinary paragraph of flavour text. */
  | { kind: "prose"; text: string }
  /** Boxed aside, used for in-world instructions. */
  | { kind: "callout"; text: string }
  /** Passage whose words breathe in and out; markup is scrambled. */
  | { kind: "fadeEssay"; text: string; note?: string }
  /** An image that carries its payload in the alt text / page source. */
  | { kind: "altImage"; alt: string; caption?: string; sourceComment?: string };

export type Gate = {
  /** Instruction shown above the tile grid. */
  prompt: string;
  tiles: Tile[];
  /** Correct click order, by tile id. Never sent to the client. */
  sequence: string[];
  /** Revealed only once the sequence is entered correctly. */
  rewardCaption: string;
  reward: Tile[];
};

export type Level = {
  id: number;
  /** Short uppercase codename shown in the progress rail. */
  codename: string;
  title: string;
  /** One-line brief under the title. */
  brief: string;
  blocks: PuzzleBlock[];
  /** Optional interactive lock that must be opened before answering. */
  gate?: Gate;
  /** Progressive hints. The first `freeHints` cost nothing. */
  hints: string[];
  freeHints: number;
  /**
   * Accepted answers. Compared after normalisation (see lib/answers.ts).
   * The FIRST one is canonical — its length is what teams are shown.
   */
  answers: string[];
  /**
   * Show the answer's length as boxes under the input. On by default;
   * set false for a level where the count would give too much away.
   */
  showLength?: boolean;
  /** Shown on the transition screen after a correct answer. */
  successNote: string;
};

/*
 * The scoring dials — hint budget, hint costs, wrong-answer penalties —
 * live in `src/lib/rules.ts`. They are NOT re-exported from here on
 * purpose: the briefing page has to quote them and is a client component,
 * and scripts/check-leaks.mjs imports this file with bare Node, which
 * resolves neither the "@/" alias nor an extensionless relative path.
 * Numbers there, secrets here.
 */

export const LEVELS: Level[] = [
  /* ---------------------------------------------------------------- */
  {
    id: 1,
    codename: "REBORN",
    title: "The Reborn Flame",
    brief: "I have lived past my time, but now I'm reborn.",
    blocks: [
      {
        kind: "prose",
        text: "An encrypted transmission intercepted across campus. The letters reflect an old memory, inverted upon themselves.",
      },
      {
        kind: "cipher",
        text: "R szev or evw kzhg nb grnv, yfg mld R'n ivylim,\n Zxilhh uiln nb low hveu, gsv ervd rh uliolim,\n Drgsrm nb yvoob gsv uoznvh xlnv zorv,\n Dszg dlfow blf xzoo nv ru blf dviv gl zirev?",
        caption: "pilani/transmission_01.txt",
      },
    ],
    hints: [],
    freeHints: 0,
    answers: ["workshop", "the workshop", "a workshop"],
    successNote:
      "The fires rekindle in the belly. Keep this answer close — it forms the key to the next challenge.",
  },

  /* ---------------------------------------------------------------- */
  {
    id: 2,
    codename: "CHRONOS",
    title: "The Pillar of Hours",
    brief: "Standing tall and sublime, you look at me when you're running out of time.",
    blocks: [
      {
        kind: "prose",
        text: "A transmission intercepted from the main axis. The characters arrived in scrambled columns, waiting to be assembled.",
      },
      {
        kind: "cipher",
        text: "INEAYNFAOAKOHSYONLIOEUTOOLTOMCITTABLWEOEROYPILNMNDYTOITTLLEFIIAXGSOMUNITDWMOSDNXALLOHRUNHUSHAATODAMKNNOMWLATTETTSTUUERGMEYAYRPED",
        caption: "pilani/columnar_grid.txt",
      },
      {
        kind: "callout",
        text: "Transposed into columns. Your previous answer sets the reading order.",
      },
    ],
    hints: [
      "You have the key, but the letters have lost their way. Put them in their proper order.",
      "Columnar transposition with key WORKSHOP. Reorder the columns alphabetically by key letters.",
    ],
    freeHints: 1,
    answers: ["clocktower", "clock tower", "the clock tower", "the clocktower"],
    successNote:
      "The campus emblem stands tall. The hands of time point toward the open grounds.",
  },

  /* ---------------------------------------------------------------- */
  {
    id: 3,
    codename: "SERPENT",
    title: "Not Straight Ahead",
    brief: "Most days, you could walk past without stopping. On some days, it’s hard to miss.",
    blocks: [
      {
        kind: "prose",
        text: "Scrambled graffiti recorded near an open walkway. The path twists back and forth in an alternating rhythm.",
      },
      {
        kind: "cipher",
        text: "MDYOWPWOTINESHTSADAONNHYSAEOTASOCUDAKATIHUSOPNOSMDYISADOISRMEOCLCMODWADAEOREFTMSYULLSTTPGOATRMCPRMEONVULI",
        caption: "pilani/walkway_trail.txt",
      },
      {
        kind: "callout",
        text: "Cramped or calm, come on down and have yourself a time.",
      },
    ],
    hints: [
      "Sometimes the answer is not straight ahead.",
      "Read the letters back and forth along the path — winding like a serpentine trail.",
    ],
    freeHints: 1,
    answers: ["south park", "southpark", "the south park"],
    successNote:
      "You crossed the park in good time. Remember its name as you approach the water.",
  },

  /* ---------------------------------------------------------------- */
  {
    id: 4,
    codename: "OASIS",
    title: "The Shifting Spring",
    brief: "An allure that draws new faces, the point an oasis sprang from.",
    blocks: [
      {
        kind: "prose",
        text: "A frequency captured by the reservoir edge. The shift shifts with every passing word.",
      },
      {
        kind: "cipher",
        text: "RQ KNNHBG ARBA IDCSH YLO NEJMA, CDN FBXOD IU DJCZC DJMLHZ ZNFH",
        caption: "pilani/spring_intercept.txt",
      },
      {
        kind: "callout",
        text: "Ragbaby cipher. Key: SOUTH PARK. Each word tells you how to solve it.",
      },
    ],
    hints: [
      "Each word tells you how to solve it.",
      "Ragbaby cipher: key is SOUTH PARK. The shift advances with word and letter position.",
    ],
    freeHints: 1,
    answers: ["shivganga", "shiv ganga", "shiv-ganga", "the shiv ganga"],
    successNote:
      "The oasis waters run quiet. Only the final threshold remains.",
  },

  /* ---------------------------------------------------------------- */
  {
    id: 5,
    codename: "OBSIDIAN",
    title: "The Standards of Shadow",
    brief: "What you see is not a shade, but a standard to be translated.",
    blocks: [
      {
        kind: "prose",
        text: "The final vault lock is sealed with an encrypted inscription and three dark pigment swatches.",
      },
      {
        kind: "cipher",
        text: "OTTDSEHTBTYOURNSSSOAHIDNTDASEDRUAATLWEAAEETNBAA",
        caption: "pilani/vault_plate.txt",
      },
      {
        kind: "callout",
        text: "Three pigment seals stamped upon the vault: #4F4253 · #494449 · #414E21",
      },
    ],
    hints: [
      "Keyed columnar transposition. Key = SHIVGANGA (your previous answer).",
      "The deciphered text reveals: 'What you see is not a shade, but a standard to be translated.' Think of hex color codes and the ASCII standard.",
      "Convert each pair of hex digits into its ASCII character: 4F 42 53 → OBS, 49 44 49 → IDI, 41 4E 21 → AN!",
    ],
    freeHints: 1,
    answers: ["obsidian", "obsidian!"],
    successNote:
      "The vault clicks open. You have recovered Obsidian. Take the final word to the desk to claim your victory!",
  },
];

export const TOTAL_LEVELS = LEVELS.length;

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}
