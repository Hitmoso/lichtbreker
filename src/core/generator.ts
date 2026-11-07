import { GEN } from '../config';
import fallbackJson from '../data/fallback.json';
import { score } from './beam';
import { greedy } from './greedy';
import { createRng, hashSeed, type Rng } from './rng';
import { solve } from './solver';
import type { Cell, Dir, ElementKind, FilterColor, MirrorKind, Placement, Puzzle } from './types';
import { ELEMENT_KINDS, FILTER_COLORS } from './types';
import { validatePuzzle } from './validate';

export const FALLBACK = fallbackJson as Puzzle;

export interface Generated {
  puzzle: Puzzle;
  max: number;
  solution: Placement[];
  source: 'generated' | 'fallback';
}

/** Kwaliteitseisen uit spec 4.2. */
export function meetsQuality(p: Puzzle): { ok: boolean; max: number; solution: Placement[] } {
  const fail = { ok: false, max: 0, solution: [] as Placement[] };
  if (validatePuzzle(p).length) return fail;
  const { max, solution } = solve(p);
  const res = { max, solution };
  if (max < GEN.maxScore[0] || max > GEN.maxScore[1]) return { ok: false, ...res };
  if (score(p, new Map()) * 2 >= max) return { ok: false, ...res };
  if (greedy(p).score >= max) return { ok: false, ...res };
  if (solve(p, p.mirrors - 1).max >= max) return { ok: false, ...res };
  return { ok: true, ...res };
}

const range = (rng: Rng, r: readonly [number, number]) => rng.int(r[0], r[1]);

function build(rng: Rng): Puzzle {
  const { width: w, height: h } = GEN;
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

  const extras = rng.shuffle([...ELEMENT_KINDS]).slice(0, range(rng, GEN.extrasPerDay)) as ElementKind[];
  const filterColors: FilterColor[] = [];
  for (const kind of extras) {
    if (kind === 'fixedMirror') {
      for (let n = range(rng, GEN.fixedMirrors); n > 0; n--) put({ kind: 'fixedMirror', mirror: rng.pick<MirrorKind>(['/', '\\']) });
    } else if (kind === 'prism') {
      for (let n = range(rng, GEN.prisms); n > 0; n--) put({ kind: 'prism' });
    } else {
      const colors = rng.shuffle([...FILTER_COLORS]);
      for (let n = range(rng, GEN.filters); n > 0; n--) {
        const color = colors[n % colors.length];
        filterColors.push(color);
        put({ kind: 'filter', color });
      }
    }
  }
  for (let n = range(rng, GEN.walls); n > 0; n--) put({ kind: 'wall' });
  const crystals = range(rng, GEN.crystals);
  const share = GEN.coloredCrystalShare[0] + rng.next() * (GEN.coloredCrystalShare[1] - GEN.coloredCrystalShare[0]);
  const colored = filterColors.length ? Math.round(crystals * share) : 0;
  for (let n = 0; n < crystals; n++) {
    put({ kind: 'crystal', color: n < colored ? rng.pick(filterColors) : 'white' });
  }
  return { version: 1, width: w, height: h, mirrors: range(rng, GEN.mirrors), cells };
}

/** Voorspelbare dagpuzzel voor een seed; valt na GEN.attempts pogingen terug op FALLBACK. */
export function generate(seed: number): Generated {
  for (let a = 0; a < GEN.attempts; a++) {
    const puzzle = build(createRng(hashSeed(seed, a)));
    const q = meetsQuality(puzzle);
    if (q.ok) return { puzzle, max: q.max, solution: q.solution, source: 'generated' };
  }
  const { max, solution } = solve(FALLBACK);
  return { puzzle: FALLBACK, max, solution, source: 'fallback' };
}
