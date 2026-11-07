import type { Graphics } from 'pixi.js';
import type { Point, Segment, TraceResult } from '../core/beam';
import type { Puzzle } from '../core/types';
import { COLORS } from '../ui/tokens';

export interface BeamStyle { width: number; alpha: number; colorOverride?: number }

/** Totale lengte van de langste tak. */
export const beamLength = (segments: readonly Segment[]) => segments.reduce((m, s) => Math.max(m, s.endDist), 0);

const lerp = (a: Point, b: Point, k: number): Point => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/**
 * Tekent de straal tot afstand `progress` (in vakken vanaf de bron).
 * Coördinaten in vakeenheden worden met `cell` geschaald.
 */
export function drawBeam(g: Graphics, segments: readonly Segment[], progress: number, cell: number, style: BeamStyle): void {
  for (const s of segments) {
    if (s.startDist >= progress) continue;
    const k = s.endDist <= progress ? 1 : (progress - s.startDist) / (s.endDist - s.startDist);
    const to = lerp(s.from, s.to, k);
    g.moveTo(s.from.x * cell, s.from.y * cell)
      .lineTo(to.x * cell, to.y * cell)
      .stroke({ width: style.width, color: style.colorOverride ?? COLORS.beam[s.color], alpha: style.alpha, cap: 'round' });
  }
}

/** Punt op afstand d langs alle takken (meerdere bij prisma's). */
export function pointsAt(segments: readonly Segment[], d: number): { p: Point; color: Segment['color'] }[] {
  const out: { p: Point; color: Segment['color'] }[] = [];
  for (const s of segments) {
    if (d < s.startDist || d > s.endDist || s.endDist === s.startDist) continue;
    out.push({ p: lerp(s.from, s.to, (d - s.startDist) / (s.endDist - s.startDist)), color: s.color });
  }
  return out;
}

/** Kleinste afstand langs de straal tot het midden van vak i, of Infinity als de straal er niet langskomt. */
function firstPass(t: TraceResult, width: number, i: number): number {
  const cx = (i % width) + 0.5, cy = Math.floor(i / width) + 0.5;
  let best = Infinity;
  for (const s of t.segments) {
    const onLine = s.from.x === s.to.x ? cx === s.from.x : cy === s.from.y;
    const within = cx >= Math.min(s.from.x, s.to.x) && cx <= Math.max(s.from.x, s.to.x)
      && cy >= Math.min(s.from.y, s.to.y) && cy <= Math.max(s.from.y, s.to.y);
    if (onLine && within) best = Math.min(best, s.startDist + Math.abs(cx - s.from.x) + Math.abs(cy - s.from.y));
  }
  return best;
}

/** Afstand langs de straal waarop elk geraakt kristal voor het eerst geraakt wordt. */
export function hitDistances(t: TraceResult, width: number): Map<number, number> {
  const out = new Map<number, number>();
  for (const i of t.hit) {
    const d = firstPass(t, width, i);
    out.set(i, d === Infinity ? 0 : d);
  }
  return out;
}

/** Kristallen waar de straal doorheen gaat, maar die niet meetellen (verkeerde kleur). */
export function crossedNotCounted(t: TraceResult, p: Puzzle): Set<number> {
  const out = new Set<number>();
  p.cells.forEach((c, i) => {
    if (c.kind === 'crystal' && !t.hit.has(i) && firstPass(t, p.width, i) !== Infinity) out.add(i);
  });
  return out;
}

/** Glinsteringen die in looprichting meestromen; `phase` loopt met de tijd op. */
export function drawGlints(g: Graphics, segments: readonly Segment[], phase: number, cell: number, spacing = 1.6): void {
  const len = beamLength(segments);
  for (let d = phase % spacing; d < len; d += spacing) {
    for (const { p, color } of pointsAt(segments, d)) {
      g.circle(p.x * cell, p.y * cell, Math.max(1.5, cell * 0.045)).fill({ color: color === 'white' ? 0xffffff : COLORS.beam[color], alpha: 0.9 });
    }
  }
}
