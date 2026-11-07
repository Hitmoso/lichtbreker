import type { Cell, Puzzle } from './types';

const CHARS: Record<string, Cell> = {
  '.': { kind: 'empty' },
  '#': { kind: 'wall' },
  o: { kind: 'crystal', color: 'white' },
  r: { kind: 'crystal', color: 'red' },
  g: { kind: 'crystal', color: 'green' },
  b: { kind: 'crystal', color: 'blue' },
  R: { kind: 'filter', color: 'red' },
  G: { kind: 'filter', color: 'green' },
  B: { kind: 'filter', color: 'blue' },
  '/': { kind: 'fixedMirror', mirror: '/' },
  '\\': { kind: 'fixedMirror', mirror: '\\' },
  P: { kind: 'prism' },
  '>': { kind: 'source', dir: 0 },
  v: { kind: 'source', dir: 1 },
  '<': { kind: 'source', dir: 2 },
  '^': { kind: 'source', dir: 3 },
};

/**
 * Bouwt een puzzel uit tekstregels. Legenda: `.` leeg, `#` muur, `o` wit kristal,
 * `r g b` gekleurd kristal, `R G B` filter, `/ \` vaste spiegel, `P` prisma,
 * `> v < ^` bron. Valideert niet; zie validatePuzzle.
 */
export function fromAscii(rows: string[], mirrors: number): Puzzle {
  if (rows.length === 0) throw new Error('fromAscii: geen rijen');
  const width = rows[0].length;
  const cells: Cell[] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`fromAscii: rij ${y} heeft lengte ${row.length}, verwacht ${width}`);
    for (const ch of row) {
      const cell = CHARS[ch];
      if (!cell) throw new Error(`fromAscii: onbekend teken '${ch}'`);
      cells.push({ ...cell });
    }
  });
  return { version: 1, width, height: rows.length, mirrors, cells };
}

/** Omgekeerde van fromAscii (handig voor debuggen en het latere portal). */
export function toAscii(p: Puzzle): string[] {
  const rev = new Map(Object.entries(CHARS).map(([ch, c]) => [JSON.stringify(c), ch]));
  const rows: string[] = [];
  for (let y = 0; y < p.height; y++) {
    let row = '';
    for (let x = 0; x < p.width; x++) row += rev.get(JSON.stringify(p.cells[y * p.width + x])) ?? '?';
    rows.push(row);
  }
  return rows;
}
