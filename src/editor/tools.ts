import { DX, DY, type BeamColor, type Cell, type Dir, type FilterColor, type MirrorKind, type Puzzle } from '../core/types';

export type Tool = 'wall' | 'crystal' | 'mirror' | 'prism' | 'filter' | 'source' | 'eraser';
/** In deze volgorde in de dok (toetsen 1–7). */
export const TOOLS: readonly Tool[] = ['wall', 'crystal', 'mirror', 'prism', 'filter', 'source', 'eraser'];

/** Gekozen kleur/stand/richting per gereedschap. */
export interface Variants { crystal: BeamColor; filter: FilterColor; mirror: MirrorKind; source: Dir }
export const DEFAULT_VARIANTS: Variants = Object.freeze({ crystal: 'white', filter: 'red', mirror: '/', source: 0 });

export const CRYSTAL_CYCLE: readonly BeamColor[] = ['white', 'red', 'green', 'blue'];
export const FILTER_CYCLE: readonly FilterColor[] = ['red', 'green', 'blue'];

export interface ApplyResult { puzzle: Puzzle; changed: boolean; rejected: boolean; variants: Variants }

const next = <T>(list: readonly T[], cur: T) => list[(list.indexOf(cur) + 1) % list.length];

/** Richtingen (0..3) waarin een bron op (x, y) naar binnen wijst. Leeg voor een binnenvak. */
export function inwardDirs(w: number, h: number, x: number, y: number): Dir[] {
  const onEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
  if (!onEdge) return [];
  return ([0, 1, 2, 3] as Dir[]).filter((d) => {
    const nx = x + DX[d], ny = y + DY[d];
    return nx >= 0 && ny >= 0 && nx < w && ny < h;
  });
}

/** Richting recht het veld in, weg van de rand (bij een hoek: de eerste passende). */
function awayFromEdge(w: number, x: number, y: number): Dir {
  if (x === 0) return 0;
  if (x === w - 1) return 2;
  if (y === 0) return 1;
  return 3;
}

const withCell = (p: Puzzle, i: number, c: Cell): Puzzle => ({ ...p, cells: p.cells.map((old, j) => (j === i ? c : old)) });

/** Past een gereedschap toe op vak (x, y). Muteert niets. */
export function applyTool(p: Puzzle, x: number, y: number, tool: Tool, v: Variants): ApplyResult {
  const i = y * p.width + x;
  const cur = p.cells[i];
  const same = (puzzle: Puzzle, variants = v): ApplyResult => ({ puzzle, changed: puzzle !== p, rejected: false, variants });

  switch (tool) {
    case 'eraser':
      return cur.kind === 'empty' ? same(p) : same(withCell(p, i, { kind: 'empty' }));
    case 'wall':
      return cur.kind === 'wall' ? same(p) : same(withCell(p, i, { kind: 'wall' }));
    case 'prism':
      return cur.kind === 'prism' ? same(p) : same(withCell(p, i, { kind: 'prism' }));
    case 'crystal': {
      const color = cur.kind === 'crystal' ? next(CRYSTAL_CYCLE, cur.color) : v.crystal;
      return same(withCell(p, i, { kind: 'crystal', color }), { ...v, crystal: color });
    }
    case 'filter': {
      const color = cur.kind === 'filter' ? next(FILTER_CYCLE, cur.color) : v.filter;
      return same(withCell(p, i, { kind: 'filter', color }), { ...v, filter: color });
    }
    case 'mirror': {
      const mirror: MirrorKind = cur.kind === 'fixedMirror' ? (cur.mirror === '/' ? '\\' : '/') : v.mirror;
      return same(withCell(p, i, { kind: 'fixedMirror', mirror }), { ...v, mirror });
    }
    case 'source': {
      const dirs = inwardDirs(p.width, p.height, x, y);
      if (!dirs.length) return { puzzle: p, changed: false, rejected: true, variants: v };
      const dir = cur.kind === 'source' ? next(dirs, cur.dir) : dirs.includes(v.source) ? v.source : awayFromEdge(p.width, x, y);
      const cells = p.cells.map((c, j): Cell => (j === i ? { kind: 'source', dir } : c.kind === 'source' ? { kind: 'empty' } : c));
      return same({ ...p, cells }, { ...v, source: dir });
    }
  }
}

/** Leeg veld met een bron links in het midden, naar rechts. */
export function emptyPuzzle(w: number, h: number, mirrors: number): Puzzle {
  const cells: Cell[] = Array.from({ length: w * h }, () => ({ kind: 'empty' }));
  cells[Math.floor(h / 2) * w] = { kind: 'source', dir: 0 };
  return { version: 1, width: w, height: h, mirrors, cells };
}

/** Andere rastermaat: knipt rechts/onder af en vult aan met lege vakken. */
export function resizePuzzle(p: Puzzle, w: number, h: number): Puzzle {
  const cells: Cell[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) cells.push(x < p.width && y < p.height ? p.cells[y * p.width + x] : { kind: 'empty' });
  }
  return { ...p, width: w, height: h, cells };
}
