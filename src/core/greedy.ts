import { score } from './beam';
import type { MirrorKind, Placement, Puzzle } from './types';

/**
 * Gretige strategie (spec 4.4): plaats steeds de spiegel die de score het meest verhoogt.
 * Gelijkspel: eerste in leesvolgorde, '/' vóór '\'. Stopt zonder verbetering.
 */
export function greedy(p: Puzzle): { score: number; placements: Placement[] } {
  const mirrors = new Map<number, MirrorKind>();
  const placements: Placement[] = [];
  let current = score(p, mirrors);
  while (placements.length < p.mirrors) {
    let bestScore = current, bestCell = -1, bestKind: MirrorKind = '/';
    for (let i = 0; i < p.cells.length; i++) {
      if (p.cells[i].kind !== 'empty' || mirrors.has(i)) continue;
      for (const kind of ['/', '\\'] as const) {
        mirrors.set(i, kind);
        const s = score(p, mirrors);
        mirrors.delete(i);
        if (s > bestScore) { bestScore = s; bestCell = i; bestKind = kind; }
      }
    }
    if (bestCell < 0) break;
    mirrors.set(bestCell, bestKind);
    placements.push({ x: bestCell % p.width, y: Math.floor(bestCell / p.width), mirror: bestKind });
    current = bestScore;
  }
  return { score: current, placements };
}
