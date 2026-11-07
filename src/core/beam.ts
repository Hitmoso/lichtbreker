import { DX, DY, REFLECT, type BeamColor, type Dir, type MirrorKind, type Placement, type Puzzle } from './types';

/** In vakeenheden; het midden van vak (x,y) is (x+0.5, y+0.5). */
export interface Point { x: number; y: number }

export interface Segment {
  from: Point;
  to: Point;
  color: BeamColor;
  /** Afgelegde weg vanaf de bron langs deze tak, bij `from` en bij `to`. */
  startDist: number;
  endDist: number;
}

export interface TraceResult {
  segments: Segment[];
  /** Celindices van geraakte kristallen. */
  hit: Set<number>;
  score: number;
}

interface Branch { cell: number; dir: Dir; color: BeamColor; dist: number }

const COLOR_IDX: Record<BeamColor, number> = { white: 0, red: 1, green: 2, blue: 3 };

export function placementMap(p: Puzzle, placements: readonly Placement[]): Map<number, MirrorKind> {
  const m = new Map<number, MirrorKind>();
  for (const pl of placements) m.set(pl.y * p.width + pl.x, pl.mirror);
  return m;
}

export interface WalkOptions {
  /** Spelersspiegels per celindex. */
  mirrors: ReadonlyMap<number, MirrorKind>;
  /** Wordt aangeroepen bij het binnengaan van een leeg vak zonder spiegel; true = stop de hele wandeling. */
  onEmpty?: (cell: number) => boolean;
  /** Zonder deze callback worden geen segmenten gebouwd. */
  onSegment?: (s: Segment) => void;
}

/**
 * Volgt de straal vanaf de bron (takken in BFS-volgorde) en geeft de geraakte kristallen.
 * `stoppedAt` is het vak waarop `onEmpty` true gaf, anders -1.
 */
export function walk(p: Puzzle, opts: WalkOptions): { hit: Set<number>; stoppedAt: number } {
  const { width: w, height: h, cells } = p;
  const { mirrors, onEmpty, onSegment } = opts;
  const hit = new Set<number>();
  const visited = new Set<number>();
  const srcIdx = cells.findIndex((c) => c.kind === 'source');
  if (srcIdx < 0) return { hit, stoppedAt: -1 };
  const queue: Branch[] = [{ cell: srcIdx, dir: (cells[srcIdx] as { dir: Dir }).dir, color: 'white', dist: 0 }];
  const center = (i: number): Point => ({ x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5 });

  for (let qi = 0; qi < queue.length; qi++) {
    let { cell, dir, color, dist } = queue[qi];
    let from = onSegment ? center(cell) : null;
    let fromDist = dist;
    const end = (to: () => Point, toDist: number) => {
      if (onSegment) onSegment({ from: from!, to: to(), color, startDist: fromDist, endDist: toDist });
    };
    const turnHere = (i: number) => {
      if (onSegment) { const here = center(i); end(() => here, dist); from = here; }
      fromDist = dist;
    };

    for (;;) {
      const x = cell % w, y = Math.floor(cell / w);
      const nx = x + DX[dir], ny = y + DY[dir];
      const d = dir;
      const face = () => { const c = center(cell); return { x: c.x + DX[d] / 2, y: c.y + DY[d] / 2 }; };
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) { end(face, dist + 0.5); break; }
      const next = ny * w + nx;
      const key = (next * 4 + dir) * 4 + COLOR_IDX[color];
      if (visited.has(key)) { end(face, dist + 0.5); break; }
      visited.add(key);

      const nc = cells[next];
      if (nc.kind === 'wall' || nc.kind === 'source') { end(face, dist + 0.5); break; }

      const placed = mirrors.get(next);
      if (placed === undefined && nc.kind === 'empty' && onEmpty && onEmpty(next)) {
        return { hit, stoppedAt: next };
      }
      cell = next;
      dist += 1;
      if (placed !== undefined || nc.kind === 'fixedMirror') {
        const kind: MirrorKind = placed ?? (nc as { mirror: MirrorKind }).mirror;
        turnHere(next);
        dir = REFLECT[kind][dir];
      } else if (nc.kind === 'crystal') {
        // Strikte kleuren: een kristal telt alleen bij een straal in zijn eigen kleur (wit bij wit).
        if (nc.color === color) hit.add(next);
      } else if (nc.kind === 'filter') {
        turnHere(next);
        color = nc.color;
      } else if (nc.kind === 'prism') {
        turnHere(next);
        queue.push({ cell: next, dir: ((dir + 3) % 4) as Dir, color, dist });
        queue.push({ cell: next, dir: ((dir + 1) % 4) as Dir, color, dist });
        break;
      }
    }
  }
  return { hit, stoppedAt: -1 };
}

/** Volgt de straal vanaf de bron, met segmenten voor de weergave. */
export function trace(p: Puzzle, placements: readonly Placement[] | ReadonlyMap<number, MirrorKind>): TraceResult {
  const mirrors = placements instanceof Map ? placements : placementMap(p, placements as readonly Placement[]);
  const segments: Segment[] = [];
  const { hit } = walk(p, { mirrors, onSegment: (s) => segments.push(s) });
  return { segments, hit, score: hit.size };
}

/** Alleen de score, zonder segmenten (sneller). */
export function score(p: Puzzle, mirrors: ReadonlyMap<number, MirrorKind>): number {
  return walk(p, { mirrors }).hit.size;
}
