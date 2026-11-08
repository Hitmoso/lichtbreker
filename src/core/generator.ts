import { DAILY, DIFFICULTIES, type Difficulty, type GenSettings } from '../config';
import fallbackEasy from '../data/fallback-easy.json';
import fallbackHard from '../data/fallback-hard.json';
import fallbackJson from '../data/fallback.json';
import { score } from './beam';
import { greedy } from './greedy';
import { createRng, hashSeed, type Rng } from './rng';
import { solve, solveWithin } from './solver';
import type { Cell, Dir, ElementKind, FilterColor, MirrorKind, Placement, Puzzle } from './types';
import { ELEMENT_KINDS, FILTER_COLORS } from './types';
import { validatePuzzle } from './validate';

export const FALLBACK = fallbackJson as Puzzle;
export const FALLBACKS: Record<Difficulty, Puzzle> = {
  easy: fallbackEasy as Puzzle,
  normal: FALLBACK,
  hard: fallbackHard as Puzzle,
};

/** Reservepuzzel bij deze instellingen (die van het niveau, anders de dagreserve). */
function fallbackFor(settings: GenSettings): Puzzle {
  for (const [d, s] of Object.entries(DIFFICULTIES)) if (s === settings) return FALLBACKS[d as Difficulty];
  return FALLBACK;
}

export interface Generated {
  puzzle: Puzzle;
  max: number;
  solution: Placement[];
  source: 'generated' | 'fallback';
}

/** Kwaliteitseisen uit spec 4.2. */
export function meetsQuality(p: Puzzle, settings: GenSettings = DAILY): { ok: boolean; max: number; solution: Placement[] } {
  const fail = { ok: false, max: 0, solution: [] as Placement[] };
  if (validatePuzzle(p).length) return fail;
  const { max, solution } = solve(p);
  const res = { max, solution };
  if (max < settings.maxScore[0] || max > settings.maxScore[1]) return { ok: false, ...res };
  if (score(p, new Map()) * 2 >= max) return { ok: false, ...res };
  if (greedy(p).score >= max) return { ok: false, ...res };
  if (solve(p, p.mirrors - 1).max >= max) return { ok: false, ...res };
  return { ok: true, ...res };
}

export interface QualityReport {
  /** Fouten van validatePuzzle; leeg = geldig. */
  errors: string[];
  max: number;
  solution: Placement[];
  /** false: het zoeken is afgebroken (budget op); max is dan een ondergrens en ok is false. */
  exact: boolean;
  /** Max binnen settings.maxScore. */
  maxInRange: boolean;
  /** Zonder spiegels raak je al de helft (of meer) van het maximum. */
  tooEasyWithout: boolean;
  /** Gulzig spelen haalt het maximum al. */
  greedyReachesMax: boolean;
  /** Met één spiegel minder haal je het maximum ook. */
  fewerMirrorsSuffice: boolean;
  /** Gelijk aan meetsQuality(...).ok. */
  ok: boolean;
}

/** Zoekstappen voor de analyse in de bouwer (± 1 s per solve op een trage telefoon). */
export const ANALYSE_BUDGET = 300_000;

/**
 * Zoals meetsQuality, maar met elke eis afzonderlijk (voor de bouwer). Verandert de generator niet.
 * Met een `budget` stopt het zoeken op grote borden; dan is `exact` false.
 */
export function qualityReport(p: Puzzle, settings: GenSettings = DAILY, budget = Infinity): QualityReport {
  const errors = validatePuzzle(p);
  if (errors.length) {
    return { errors, max: 0, solution: [], exact: false, maxInRange: false, tooEasyWithout: false, greedyReachesMax: false, fewerMirrorsSuffice: false, ok: false };
  }
  const { max, solution, exact } = solveWithin(p, p.mirrors, budget);
  if (!exact) {
    return { errors, max, solution, exact, maxInRange: false, tooEasyWithout: false, greedyReachesMax: false, fewerMirrorsSuffice: false, ok: false };
  }
  const maxInRange = max >= settings.maxScore[0] && max <= settings.maxScore[1];
  const tooEasyWithout = score(p, new Map()) * 2 >= max;
  const greedyReachesMax = greedy(p).score >= max;
  // Met één spiegel minder is de zoekboom kleiner; bij budget-op tellen we het niet als probleem.
  const fewer = solveWithin(p, p.mirrors - 1, budget);
  const fewerMirrorsSuffice = fewer.max >= max;
  const ok = maxInRange && !tooEasyWithout && !greedyReachesMax && !fewerMirrorsSuffice;
  return { errors, max, solution, exact, maxInRange, tooEasyWithout, greedyReachesMax, fewerMirrorsSuffice, ok };
}

const range = (rng: Rng, r: readonly [number, number]) => rng.int(r[0], r[1]);

function build(rng: Rng, S: GenSettings): Puzzle {
  const { width: w, height: h } = S;
  const cells: Cell[] = Array.from({ length: w * h }, () => ({ kind: 'empty' }) as Cell);

  // Bron op een randvak (geen hoek), wijzend naar binnen.
  const side = rng.int(0, 3);
  let x: number, y: number, dir: Dir;
  if (side === 0) { x = 0; y = rng.int(1, h - 2); dir = 0; }
  else if (side === 1) { x = rng.int(1, w - 2); y = 0; dir = 1; }
  else if (side === 2) { x = w - 1; y = rng.int(1, h - 2); dir = 2; }
  else { x = rng.int(1, w - 2); y = h - 1; dir = 3; }
  cells[y * w + x] = { kind: 'source', dir };

  const free = rng.shuffle(cells.flatMap((c, i) => (c.kind === 'empty' ? [i] : [])));
  const put = (c: Cell) => { const i = free.pop(); if (i !== undefined) cells[i] = c; };

  const extras = rng.shuffle([...ELEMENT_KINDS]).slice(0, range(rng, S.extras)) as ElementKind[];
  const filterColors: FilterColor[] = [];
  for (const kind of extras) {
    if (kind === 'fixedMirror') {
      for (let n = range(rng, S.fixedMirrors); n > 0; n--) put({ kind: 'fixedMirror', mirror: rng.pick<MirrorKind>(['/', '\\']) });
    } else if (kind === 'prism') {
      for (let n = range(rng, S.prisms); n > 0; n--) put({ kind: 'prism' });
    } else {
      const colors = rng.shuffle([...FILTER_COLORS]);
      for (let n = range(rng, S.filters); n > 0; n--) {
        const color = colors[n % colors.length];
        filterColors.push(color);
        put({ kind: 'filter', color });
      }
    }
  }
  for (let n = range(rng, S.walls); n > 0; n--) put({ kind: 'wall' });
  const crystals = range(rng, S.crystals);
  const share = S.coloredCrystalShare[0] + rng.next() * (S.coloredCrystalShare[1] - S.coloredCrystalShare[0]);
  const colored = filterColors.length ? Math.round(crystals * share) : 0;
  for (let n = 0; n < crystals; n++) {
    put({ kind: 'crystal', color: n < colored ? rng.pick(filterColors) : 'white' });
  }
  return { version: 1, width: w, height: h, mirrors: range(rng, S.mirrors), cells };
}

/**
 * Voorspelbare puzzel voor een seed (standaard: dagpuzzel-instellingen).
 * Valt na `settings.attempts` pogingen terug op de reservepuzzel.
 */
export function generate(seed: number, settings: GenSettings = DAILY): Generated {
  for (let a = 0; a < settings.attempts; a++) {
    const puzzle = build(createRng(hashSeed(seed, a)), settings);
    const q = meetsQuality(puzzle, settings);
    if (q.ok) return { puzzle, max: q.max, solution: q.solution, source: 'generated' };
  }
  const puzzle = fallbackFor(settings);
  const { max, solution } = solve(puzzle);
  return { puzzle, max, solution, source: 'fallback' };
}
