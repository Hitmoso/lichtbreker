import { trace } from '../../src/core/beam';
import type { MirrorKind, Puzzle } from '../../src/core/types';

/** Probeert alle combinaties van ≤ k spiegels op lege vakken. Alleen voor kleine rasters. */
export function bruteForceMax(p: Puzzle, k: number): number {
  const empties = p.cells.flatMap((c, i) => (c.kind === 'empty' ? [i] : []));
  let best = 0;
  const m = new Map<number, MirrorKind>();
  const rec = (start: number, left: number) => {
    best = Math.max(best, trace(p, m).score);
    if (left === 0) return;
    for (let j = start; j < empties.length; j++) {
      for (const kind of ['/', '\\'] as const) {
        m.set(empties[j], kind);
        rec(j + 1, left - 1);
        m.delete(empties[j]);
      }
    }
  };
  rec(0, k);
  return best;
}
