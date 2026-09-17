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
  /** Round 1 (1-5) or Round 2 (6-10). */
  round?: 1 | 2;
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
  /* ================================================================
   *  ROUND 1 (Levels 1 to 5)
   * ================================================================ */
  {
    id: 1,
    round: 1,
    codename: "VENI",
    title: "The Emperor's Third Step",
    brief: "Every alphabet has a starting line. Someone moved it.",
    blocks: [
      {
        kind: "prose",
        text: "A transmission was pulled off the campus loop at 03:12, somewhere between the Clock Tower and the Library. The letters arrived intact. Their positions did not.",
      },
      {
        kind: "cipher",
        text: "L dozdbv uxq exw qhyhu zdon. L kdyh d ehg, exw L qhyhu vohhs. L kdyh d prxwk, exw L qhyhu vshdn. Zkdw dp L?",
        caption: "pilani/intercept_01.txt",
      },
      {
        kind: "callout",
        text: "He came, he saw, he conquered — three times.",
      },
    ],
    hints: [
      "The hint is the cipher's name. A Roman general lends it his.",
      "Every letter has been pushed forward by the same small number. Push them back.",
      "D → A. L → I. The shift is three.",
    ],
    freeHints: 1,
    answers: ["river", "a river"],
    successNote:
      "Hold on to that word. The next lock does not want an answer — it wants a key.",
  },

  /* ---------------------------------------------------------------- */
  {
    id: 2,
    round: 1,
    codename: "CHIFFRE",
    title: "Le Chiffre Indéchiffrable",
    brief: "One shift was too easy. Take a different one for every letter.",
    blocks: [
      {
        kind: "prose",
        text: "The second intercept came off the Shiv Ganga uplink and resisted the Roman's trick entirely. Frequency analysis returns nothing but noise — the shift is not constant, it walks.",
      },
      {
        kind: "cipher",
        text: "Npvx timvxlim recba jr wfcm pvxa dr kym hsieqik, knw gixj io rffv, vru kpmiv cmbw ze bci vmmimex?",
        caption: "pilani/intercept_02.txt",
      },
      {
        kind: "callout",
        text: "Le chiffrage indéchiffrable. Each letter moves differently, according to one word. Your past experiences will help you.",
      },
    ],
    hints: [
      "The keyword is not hidden anywhere on this page. You already wrote it down.",
      "Repeat your previous answer over the ciphertext, letter by letter, and let each pair decide the shift.",
      "Key = RIVER. N − R = W. p − I = h. The plaintext is the oldest riddle there is.",
    ],
    freeHints: 1,
    answers: ["human", "a human", "man", "a man", "human being", "humans"],
    successNote:
      "Words are running out. The next lock does not speak — it only shows.",
  },

  /* ---------------------------------------------------------------- */
  {
    id: 3,
    round: 1,
    codename: "GLYPH",
    title: "Ten Faces, Five Names",
    brief: "Five of these begin with something you already know.",
    blocks: [
      {
        kind: "prose",
        text: "No text this time. Ten plates were recovered from a crate in the Birla Museum store room, in no particular order. Five of them are yours.",
      },
    ],
    gate: {
      prompt:
        "Your last answer has five letters. Five of these plates begin with them. Select those five — in order.",
      tiles: [
        { id: "banjo", glyph: "🪕", label: "Plate 01" },
        { id: "nose", glyph: "👃", label: "Plate 02" },
        { id: "moon", glyph: "🌙", label: "Plate 03" },
        { id: "arrow", glyph: "➡️", label: "Plate 04" },
        { id: "owl", glyph: "🦉", label: "Plate 05" },
        { id: "penguin", glyph: "🐧", label: "Plate 06" },
        { id: "llama", glyph: "🦙", label: "Plate 07" },
        { id: "heart", glyph: "❤️", label: "Plate 08" },
        { id: "joker", glyph: "🃏", label: "Plate 09" },
        { id: "umbrella", glyph: "☂️", label: "Plate 10" },
      ],
      sequence: ["heart", "umbrella", "moon", "arrow", "nose"],
      rewardCaption:
        "The five are numbered one to five in the order you found them. Two of them are now shown to you. Read them as digits.",
      reward: [
        { id: "arrow", glyph: "➡️", label: "First digit" },
        { id: "umbrella", glyph: "☂️", label: "Second digit" },
      ],
    },
    hints: [
      "H, U, M, A, N. Name each plate out loud and listen to its first letter.",
      "Heart, Umbrella, Moon, Arrow, Nose. That order gives them the numbers one through five.",
      "The two revealed plates are the fourth and the second. Write the digits side by side.",
    ],
    freeHints: 1,
    answers: ["42", "forty two", "fortytwo", "forty-two"],
    successNote:
      "A number, at last. Numbers count things. Go and count something.",
  },

  /* ---------------------------------------------------------------- */
  {
    id: 4,
    round: 1,
    codename: "COUNT",
    title: "The Forty-Second",
    brief: "The whole passage is a haystack. You were given the index.",
    blocks: [
      {
        kind: "prose",
        text: "Recovered from the Library reading room, second floor, after closing. The page will not hold still, and it will not let you copy it. Read it the slow way.",
      },
      {
        kind: "fadeEssay",
        text: "The archive keeps no lights. It keeps records; records keep better in the dark, so the shelves run on and the corridors run with them. Every visitor is handed the same three things at the door: a name, a number, a lantern. Most people take the name. The clever ones take the number. Only the patient count what they were given, and counting is how the archive decides who may pass.",
        note: "library/manuscript fragment — unstable",
      },
    ],
    hints: [
      "Your last answer was not a riddle. It was an index.",
      "Count words, not lines, and count from the very first word of the passage.",
      "Words thirty-seven onward: a, name, a, number, a, …",
    ],
    freeHints: 1,
    answers: ["lantern", "a lantern", "the lantern"],
    successNote:
      "One light left. The last page has nothing written on it — which is the point.",
  },

  /* ---------------------------------------------------------------- */
  {
    id: 5,
    round: 1,
    codename: "MIRROR",
    title: "The Last Light",
    brief: "There is nothing on this page. Look at it anyway.",
    blocks: [
      {
        kind: "altImage",
        alt: "GSV URMZO ZMHDVI RH YLHN",
        caption: "pilani/plate_final — 1 of 1",
        sourceComment:
          "the plate describes itself to anyone who cannot see it — ask your browser what it says",
      },
      {
        kind: "callout",
        text: "A is Z. B is Y. The alphabet, reflected in still water.",
      },
    ],
    hints: [
      "An image always carries a description for people who cannot see it. Open the inspector, or turn on a screen reader, and read the picture's alt text.",
      "The description is enciphered by reflection: the first letter becomes the last, the second becomes the second-last.",
      "GSV → THE. The sentence names its own answer, and the answer is four letters long.",
    ],
    freeHints: 1,
    answers: ["bosm"],
    successNote:
      "The first vault is unsealed! Round 1 is conquered. Stand by for Round 2.",
  },

  /* ================================================================
   *  ROUND 2 (Levels 6 to 10)
   * ================================================================ */
  {
    id: 6,
    round: 2,
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
    id: 7,
    round: 2,
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
    id: 8,
    round: 2,
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
    id: 9,
    round: 2,
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
        text: "Each word tells you how to solve it.",
      },
    ],
    hints: [
      "Each word tells you how to solve it.",
      "The shift advances with word and letter position.",
    ],
    freeHints: 1,
    answers: ["shivganga", "shiv ganga", "shiv-ganga", "the shiv ganga"],
    successNote:
      "The oasis waters run quiet. Only the final threshold remains.",
  },

  /* ---------------------------------------------------------------- */
  {
    id: 10,
    round: 2,
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
