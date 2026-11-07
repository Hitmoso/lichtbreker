import type { Rng } from '../../src/core/rng';
import type { Cell, Dir, Puzzle } from '../../src/core/types';

/** Willekeurige geldige puzzel met alle elementsoorten, voor fuzz- en solvertests. */
export function randomBoard(rng: Rng, w: number, h: number, mirrors: number): Puzzle {
  const cells: Cell[] = Array.from({ length: w * h }, () => ({ kind: 'empty' }) as Cell);
  // Bron op de linkerrand, naar rechts, of bovenrand naar beneden.
  let src: number, dir: Dir;
  if (rng.next() < 0.5) { src = rng.int(0, h - 1) * w; dir = 0; } else { src = rng.int(0, w - 1); dir = 1; }
  cells[src] = { kind: 'source', dir };
  const pool: Cell[] = [
    { kind: 'wall' }, { kind: 'crystal', color: 'white' }, { kind: 'crystal', color: 'white' },
    { kind: 'crystal', color: 'red' }, { kind: 'filter', color: 'red' }, { kind: 'prism' },
    { kind: 'fixedMirror', mirror: '/' }, { kind: 'fixedMirror', mirror: '\\' },
  ];
  for (let i = 0; i < cells.length; i++) {
    if (i === src || rng.next() > 0.45) continue;
    cells[i] = { ...rng.pick(pool) };
  }
  return { version: 1, width: w, height: h, mirrors, cells };
}
