import type { BeamColor, MirrorKind, Placement, Puzzle } from '../core/types';

const COLOR: Record<BeamColor, string> = { white: 'wit', red: 'rood', green: 'groen', blue: 'blauw' };
const GLYPH: Record<MirrorKind, string> = { '/': '╱', '\\': '╲' };

/** Tekst voor schermlezers: wat staat er op vak (x,y)? */
export function describeCell(p: Puzzle, placements: readonly Placement[], x: number, y: number): string {
  const where = `Rij ${y + 1}, kolom ${x + 1}`;
  const placed = placements.find((pl) => pl.x === x && pl.y === y);
  const c = p.cells[y * p.width + x];
  let what: string;
  switch (c.kind) {
    case 'empty': what = placed ? `jouw spiegel ${GLYPH[placed.mirror]}` : 'leeg'; break;
    case 'wall': what = 'muur'; break;
    case 'source': what = 'laserbron'; break;
    case 'prism': what = 'prisma'; break;
    case 'crystal': what = `${COLOR[c.color]} kristal`; break;
    case 'filter': what = `${COLOR[c.color]} filter`; break;
    case 'fixedMirror': what = `vaste spiegel ${GLYPH[c.mirror]}`; break;
  }
  return `${where}: ${what}`;
}

const MOVES: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };

/** Nieuwe cursorpositie voor een pijltjestoets, of null als het geen pijltjestoets is. */
export function moveCursor(cur: { x: number; y: number }, key: string, w: number, h: number): { x: number; y: number } | null {
  const m = MOVES[key];
  if (!m) return null;
  return { x: Math.min(w - 1, Math.max(0, cur.x + m[0])), y: Math.min(h - 1, Math.max(0, cur.y + m[1])) };
}
