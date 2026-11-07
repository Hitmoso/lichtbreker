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

export function placementMap(p: Puzzle, placements: readonly Placement[]): Map<number, MirrorKind> {
  const m = new Map<number, MirrorKind>();
  for (const pl of placements) m.set(pl.y * p.width + pl.x, pl.mirror);
  return m;
}

/** Volgt de straal vanaf de bron. Takken worden in BFS-volgorde afgehandeld. */
export function trace(p: Puzzle, placements: readonly Placement[] | ReadonlyMap<number, MirrorKind>): TraceResult {
  const mirrors = placements instanceof Map ? placements : placementMap(p, placements as readonly Placement[]);
  const { width: w, height: h, cells } = p;
  const segments: Segment[] = [];
  const hit = new Set<number>();
  const visited = new Set<number>();
  const colorIdx: Record<BeamColor, number> = { white: 0, red: 1, green: 2, blue: 3 };

  const srcIdx = cells.findIndex((c) => c.kind === 'source');
  if (srcIdx < 0) return { segments, hit, score: 0 };
  const src = cells[srcIdx] as { kind: 'source'; dir: Dir };
  const queue: Branch[] = [{ cell: srcIdx, dir: src.dir, color: 'white', dist: 0 }];

  const center = (i: number): Point => ({ x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5 });

  for (let qi = 0; qi < queue.length; qi++) {
    let { cell, dir, color, dist } = queue[qi];
    let from = center(cell);
    let fromDist = dist;
    const end = (to: Point, toDist: number) => {
      segments.push({ from, to, color, startDist: fromDist, endDist: toDist });
    };

    for (;;) {
      const x = cell % w, y = Math.floor(cell / w);
      const nx = x + DX[dir], ny = y + DY[dir];
      const c = center(cell);
      const face: Point = { x: c.x + DX[dir] / 2, y: c.y + DY[dir] / 2 };
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) { end(face, dist + 0.5); break; }
      const next = ny * w + nx;
      const key = ((next * 4 + dir) * 4) + colorIdx[color];
      if (visited.has(key)) { end(face, dist + 0.5); break; }
      visited.add(key);

      const nc = cells[next];
      if (nc.kind === 'wall' || nc.kind === 'source') { end(face, dist + 0.5); break; }

      cell = next;
      dist += 1;
      const placed = mirrors.get(next);
      if (placed !== undefined || nc.kind === 'fixedMirror') {
        const kind: MirrorKind = placed ?? (nc as { mirror: MirrorKind }).mirror;
        const here = center(next);
        end(here, dist);
        from = here; fromDist = dist;
        dir = REFLECT[kind][dir];
      } else if (nc.kind === 'crystal') {
        if (nc.color === 'white' || nc.color === color) hit.add(next);
      } else if (nc.kind === 'filter') {
        const here = center(next);
        end(here, dist);
        from = here; fromDist = dist;
        color = nc.color;
      } else if (nc.kind === 'prism') {
        end(center(next), dist);
        queue.push({ cell: next, dir: ((dir + 3) % 4) as Dir, color, dist });
        queue.push({ cell: next, dir: ((dir + 1) % 4) as Dir, color, dist });
        break;
      }
    }
  }
  return { segments, hit, score: hit.size };
}
