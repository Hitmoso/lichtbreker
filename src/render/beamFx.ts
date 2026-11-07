import type { Graphics } from 'pixi.js';
import type { Point, Segment } from '../core/beam';
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

/** Glinsteringen die in looprichting meestromen; `phase` loopt met de tijd op. */
export function drawGlints(g: Graphics, segments: readonly Segment[], phase: number, cell: number, spacing = 1.6): void {
  const len = beamLength(segments);
  for (let d = phase % spacing; d < len; d += spacing) {
    for (const { p, color } of pointsAt(segments, d)) {
      g.circle(p.x * cell, p.y * cell, Math.max(1.5, cell * 0.045)).fill({ color: color === 'white' ? 0xffffff : COLORS.beam[color], alpha: 0.9 });
    }
  }
}
