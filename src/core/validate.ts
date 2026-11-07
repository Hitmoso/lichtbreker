import { BEAM_COLORS, DX, DY, FILTER_COLORS, type Placement, type Puzzle } from './types';

export const LIMITS = { width: [3, 12], height: [3, 14], mirrors: [1, 8] } as const;

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const inRange = (v: unknown, [lo, hi]: readonly [number, number]) => isInt(v) && v >= lo && v <= hi;

/** Geeft een lijst met fouten; leeg betekent geldig. */
export function validatePuzzle(p: unknown): string[] {
  if (typeof p !== 'object' || p === null) return ['geen object'];
  const o = p as Record<string, unknown>;
  const errs: string[] = [];
  if (o.version !== 1) errs.push('version moet 1 zijn');
  if (!inRange(o.width, LIMITS.width)) errs.push('width buiten bereik');
  if (!inRange(o.height, LIMITS.height)) errs.push('height buiten bereik');
  if (!inRange(o.mirrors, LIMITS.mirrors)) errs.push('mirrors buiten bereik');
  if (!Array.isArray(o.cells)) return [...errs, 'cells is geen array'];
  if (errs.length) return errs;
  const w = o.width as number, h = o.height as number;
  if (o.cells.length !== w * h) return ['cells heeft verkeerde lengte'];

  let sources = 0;
  o.cells.forEach((c: unknown, i: number) => {
    const cell = c as Record<string, unknown> | null;
    if (typeof cell !== 'object' || cell === null) return void errs.push(`cel ${i}: geen object`);
    switch (cell.kind) {
      case 'empty': case 'wall': case 'prism': break;
      case 'crystal':
        if (!BEAM_COLORS.includes(cell.color as never)) errs.push(`cel ${i}: onbekende kristalkleur`);
        break;
      case 'filter':
        if (!FILTER_COLORS.includes(cell.color as never)) errs.push(`cel ${i}: onbekende filterkleur`);
        break;
      case 'fixedMirror':
        if (cell.mirror !== '/' && cell.mirror !== '\\') errs.push(`cel ${i}: onbekende spiegel`);
        break;
      case 'source': {
        sources++;
        const d = cell.dir;
        if (d !== 0 && d !== 1 && d !== 2 && d !== 3) { errs.push(`cel ${i}: onbekende richting`); break; }
        const x = i % w, y = Math.floor(i / w);
        const onEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        const nx = x + DX[d], ny = y + DY[d];
        if (!onEdge) errs.push('bron staat niet op de rand');
        else if (nx < 0 || ny < 0 || nx >= w || ny >= h) errs.push('bron wijst naar buiten');
        break;
      }
      default: errs.push(`cel ${i}: onbekend soort '${String(cell.kind)}'`);
    }
  });
  if (sources !== 1) errs.push(`precies één bron nodig, gevonden: ${sources}`);
  return errs;
}

/** Geeft de plaatsingen terug als ze geldig zijn voor deze puzzel, anders null. */
export function validatePlacements(p: Puzzle, pl: unknown): Placement[] | null {
  if (!Array.isArray(pl) || pl.length > p.mirrors) return null;
  const seen = new Set<number>();
  const out: Placement[] = [];
  for (const raw of pl) {
    if (typeof raw !== 'object' || raw === null) return null;
    const { x, y, mirror } = raw as Record<string, unknown>;
    if (!isInt(x) || !isInt(y) || x < 0 || y < 0 || x >= p.width || y >= p.height) return null;
    if (mirror !== '/' && mirror !== '\\') return null;
    const i = y * p.width + x;
    if (seen.has(i) || p.cells[i].kind !== 'empty') return null;
    seen.add(i);
    out.push({ x, y, mirror });
  }
  return out;
}
