import { score, walk } from './beam';
import type { MirrorKind, Placement, Puzzle } from './types';

export interface Solution { max: number; solution: Placement[] }
/** Met budget: `exact` is false als het zoeken is afgebroken; `max` is dan een ondergrens. */
export interface BoundedSolution extends Solution { exact: boolean }

/**
 * Hoogst haalbare score met maximaal `mirrorLimit` spelersspiegels.
 * Diepte-eerst: vertak op het eerste lege, onbesliste vak waar de straal binnenkomt
 * (leeg laten, '/', '\'). Alleen vakken op de straal doen ertoe.
 */
export function solve(p: Puzzle, mirrorLimit = p.mirrors): Solution {
  const { max, solution } = search(p, mirrorLimit, Infinity);
  return { max, solution };
}

/**
 * Zoals solve, maar stopt na `budget` zoekstappen (voor grote borden in de bouwer).
 * Zonder afbreken is het resultaat gelijk aan solve.
 */
export function solveWithin(p: Puzzle, mirrorLimit: number, budget: number): BoundedSolution {
  return search(p, mirrorLimit, budget);
}

function search(p: Puzzle, mirrorLimit: number, budget: number): BoundedSolution {
  const crystals = p.cells.reduce((n, c) => n + (c.kind === 'crystal' ? 1 : 0), 0);
  const mirrors = new Map<number, MirrorKind>();
  const none = new Set<number>();
  let best = -1;
  let bestMirrors = new Map<number, MirrorKind>();

  const record = (s: number) => {
    if (s > best) { best = s; bestMirrors = new Map(mirrors); }
  };

  let steps = 0;
  let stopped = false;

  const rec = (left: number) => {
    if (best === crystals || stopped) return;
    if (++steps > budget) { stopped = true; return; }
    if (left === 0) { record(score(p, mirrors)); return; }
    const { hit, stoppedAt } = walk(p, { mirrors, onEmpty: (c) => !none.has(c) });
    if (stoppedAt < 0) { record(hit.size); return; }
    for (const kind of ['/', '\\'] as const) {
      mirrors.set(stoppedAt, kind);
      rec(left - 1);
      mirrors.delete(stoppedAt);
    }
    none.add(stoppedAt);
    rec(left);
    none.delete(stoppedAt);
  };

  rec(mirrorLimit);
  const w = p.width;
  const solution = [...bestMirrors].map(([i, mirror]) => ({ x: i % w, y: Math.floor(i / w), mirror }));
  return { max: Math.max(best, 0), solution, exact: !stopped };
}
