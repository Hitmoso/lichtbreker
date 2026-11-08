/** Datum van puzzel #1 (Europe/Amsterdam). Stel in vóór publicatie. */
export const EPOCH = '2026-11-07';
export const DEFAULT_WIDTH = 7;
export const DEFAULT_HEIGHT = 9;

type Range = readonly [number, number];

/** Instellingen voor de puzzelgenerator (bereiken zijn inclusief). */
export interface GenSettings {
  width: number;
  height: number;
  /** Spelersspiegels. */
  mirrors: Range;
  walls: Range;
  crystals: Range;
  /** Aantal extra elementsoorten (vaste spiegel, prisma, filter). */
  extras: Range;
  fixedMirrors: Range;
  prisms: Range;
  filters: Range;
  coloredCrystalShare: Range;
  /** Toegestaan maximum (kwaliteitseis). */
  maxScore: Range;
  attempts: number;
  /** Alleen generator v2: uit hoeveel goede kandidaten gekozen wordt (standaard GEN_V2.candidates). */
  candidates?: number;
  /** Alleen generator v2: maximaal aantal pogingen voor een lokfilter (standaard GEN_V2.decoyAttempts). */
  decoyAttempts?: number;
}

/**
 * Dagpuzzel. NIET aanpassen na lancering: elke wijziging verandert de puzzels
 * van toekomstige dagen en mogelijk die van vandaag.
 */
export const DAILY: GenSettings = Object.freeze<GenSettings>({
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  mirrors: [3, 6],
  walls: [4, 8],
  crystals: [10, 16],
  extras: [0, 3],
  fixedMirrors: [1, 3],
  prisms: [1, 2],
  filters: [1, 2],
  coloredCrystalShare: [0.3, 0.5],
  maxScore: [6, 12],
  attempts: 200,
});

/**
 * Generator versie 2: rustiger velden (opvulkristallen weg, een paar lokkertjes blijven)
 * en kleurfilters die ertoe doen. Geldt voor dagpuzzels vanaf `from` en voor de oneindige modus.
 * NIET aanpassen na `from`: elke wijziging verandert de puzzels van die dagen.
 */
export const GEN_V2 = Object.freeze({
  /** Eerste dag (Europe/Amsterdam) met een v2-dagpuzzel. */
  from: '2026-11-10',
  /** Kans op een kleurfilter in een puzzel (als het niveau extra's toestaat). */
  filterChance: 1 / 3,
  /** Deel van de filterpuzzels met een lokfilter (verleidelijk, maar niet nodig). */
  decoyShare: 0.4,
  /** Maximaal aantal pogingen voor een lokfilterpuzzel. */
  decoyAttempts: 20,
  /** Aantal ongeraakte kristallen dat blijft liggen als lokkertje. */
  lures: [3, 5] as const,
  /** Uit hoeveel goede kandidaten de moeilijkste (grootste gulzig-achterstand) wint. */
  candidates: 2,
});

/** Oude naam; gelijk aan DAILY. */
export const GEN = DAILY;

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTY_LEVELS: readonly Difficulty[] = ['easy', 'normal', 'hard'];
export const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: 'Makkelijk', normal: 'Normaal', hard: 'Moeilijk' };

/**
 * Oneindige modus, per niveau. Vrij aan te passen; de tests in
 * tests/core/difficulties.test.ts laten zien als een combinatie geen goede puzzels meer geeft.
 */
export const DIFFICULTIES: Record<Difficulty, GenSettings> = {
  easy: { ...DAILY, width: 5, height: 7, mirrors: [2, 3], extras: [0, 0], walls: [2, 4], crystals: [6, 9], maxScore: [4, 7] },
  normal: { ...DAILY },
  hard: { ...DAILY, width: 8, height: 10, mirrors: [5, 6], extras: [2, 3], walls: [6, 10], crystals: [14, 20], maxScore: [9, 14], candidates: 1, decoyAttempts: 6 },
};

/** Waar de bouwer dagpuzzels publiceert (GitHub-API). */
export const PUBLISH = {
  owner: 'Hitmoso',
  repo: 'lichtbreker',
  branch: 'main',
  path: 'src/data/overrides.json',
  workflow: 'pages.yml',
} as const;
