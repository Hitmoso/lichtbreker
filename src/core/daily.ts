import { EPOCH, GEN_V2 } from '../config';
import overridesJson from '../data/overrides.json';
import { generate } from './generator';
import { generateV2 } from './generator2';
import { hashSeed } from './rng';
import { solve } from './solver';
import type { Placement, Puzzle } from './types';
import { validatePuzzle } from './validate';

const TZ = 'Europe/Amsterdam';
const DAY = 86_400_000;
const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
});

/** 'YYYY-MM-DD' in Amsterdamse tijd. */
export function amsterdamDate(now: Date): string {
  return dateFmt.format(now);
}

const utcDay = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Puzzel #1 valt op EPOCH; eerdere datums geven ook 1. */
export function puzzleNumber(dateStr: string): number {
  return Math.max(1, Math.round((utcDay(dateStr) - utcDay(EPOCH)) / DAY) + 1);
}

/** Verschil tussen Amsterdamse kloktijd en UTC op tijdstip t (ms). */
function offset(t: number): number {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wall - Math.floor(t / 1000) * 1000;
}

/** Milliseconden tot de volgende Amsterdamse middernacht. */
export function msUntilNextPuzzle(now: Date): number {
  const tomorrow = utcDay(amsterdamDate(now)) + DAY;
  const midnight = tomorrow - offset(tomorrow - 3_600_000);
  return midnight - now.getTime();
}

export interface Daily {
  number: number;
  puzzle: Puzzle;
  max: number;
  solution: Placement[];
  source: 'override' | 'generated' | 'fallback';
}

export function getDaily(dateStr: string, overrides: Record<string, unknown> = overridesJson): Daily {
  const number = puzzleNumber(dateStr);
  const o = overrides[dateStr];
  if (o !== undefined) {
    const errs = validatePuzzle(o);
    if (errs.length === 0) {
      const puzzle = o as Puzzle;
      return { number, puzzle, ...solve(puzzle), source: 'override' };
    }
    console.warn(`Lichtbreker: override voor ${dateStr} is ongeldig en wordt genegeerd:`, errs);
  }
  // Vanaf GEN_V2.from de nieuwe generator; eerdere dagen blijven precies gelijk.
  const seed = hashSeed('lichtbreker', number);
  const g = dateStr >= GEN_V2.from ? generateV2(seed) : generate(seed);
  return { number, puzzle: g.puzzle, max: g.max, solution: g.solution, source: g.source };
}
