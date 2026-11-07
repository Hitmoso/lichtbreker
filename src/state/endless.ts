import { DIFFICULTY_LEVELS, type Difficulty } from '../config';
import type { Placement } from '../core/types';

export interface EndlessStat { played: number; perfect: number; run: number; bestRun: number }
export interface EndlessCurrent { difficulty: Difficulty; seed: number; placements: Placement[]; submitted: boolean }
export interface EndlessState {
  difficulty: Difficulty;
  current: EndlessCurrent | null;
  stats: Record<Difficulty, EndlessStat>;
}

const zero = (): EndlessStat => ({ played: 0, perfect: 0, run: 0, bestRun: 0 });

export function defaultEndless(): EndlessState {
  return { difficulty: 'normal', current: null, stats: { easy: zero(), normal: zero(), hard: zero() } };
}

const isLevel = (v: unknown): v is Difficulty => DIFFICULTY_LEVELS.includes(v as Difficulty);
const nat = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);

function parseCurrent(v: unknown): EndlessCurrent | null {
  if (typeof v !== 'object' || v === null) return null;
  const c = v as Record<string, unknown>;
  const seedOk = typeof c.seed === 'number' && Number.isInteger(c.seed) && c.seed >= 0 && c.seed < 2 ** 32;
  if (!isLevel(c.difficulty) || !seedOk || !Array.isArray(c.placements) || typeof c.submitted !== 'boolean') return null;
  // Plaatsingen worden tegen de puzzel gecontroleerd in resumeGame.
  return { difficulty: c.difficulty, seed: c.seed as number, placements: c.placements as Placement[], submitted: c.submitted };
}

/** Leest de oneindige stand; ongeldige delen worden standaardwaarden. */
export function parseEndless(v: unknown): EndlessState {
  const def = defaultEndless();
  if (typeof v !== 'object' || v === null) return def;
  const o = v as Record<string, unknown>;
  const rawStats = (typeof o.stats === 'object' && o.stats !== null ? o.stats : {}) as Record<string, unknown>;
  const stats = { ...def.stats };
  for (const d of DIFFICULTY_LEVELS) {
    const s = rawStats[d] as Record<string, unknown> | undefined;
    if (s && typeof s === 'object') stats[d] = { played: nat(s.played), perfect: nat(s.perfect), run: nat(s.run), bestRun: nat(s.bestRun) };
  }
  return { difficulty: isLevel(o.difficulty) ? o.difficulty : def.difficulty, current: parseCurrent(o.current), stats };
}

/** Werkt de statistieken van een niveau bij na indienen. */
export function recordEndlessResult(e: EndlessState, d: Difficulty, score: number, max: number): EndlessState {
  const s = e.stats[d];
  const perfect = score >= max;
  const run = perfect ? s.run + 1 : 0;
  const next: EndlessStat = { played: s.played + 1, perfect: s.perfect + (perfect ? 1 : 0), run, bestRun: Math.max(s.bestRun, run) };
  return { ...e, stats: { ...e.stats, [d]: next } };
}
