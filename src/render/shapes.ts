import type { BeamColor } from '../core/types';

/**
 * Kristalvormen, één per kleur, zodat ze ook zonder kleur te herkennen zijn:
 * wit = ruit, rood = druppel, groen = smaragd (langwerpige achthoek), blauw = rond.
 * Geen driehoek: die vorm is van het prisma.
 *
 * Alles in eenheden van de straal (binnen een cirkel met straal 1 om het midden), y naar beneden.
 * Geen Pixi hier, zodat het veld, de SVG-icoontjes en de tests dezelfde vormen delen.
 */
export interface Shape {
  /** Omtrek als veelhoek: x0, y0, x1, y1, … */
  outline: number[];
  /** Hoekpunten waar een facetlijn naar het midden loopt. */
  corners: number[];
  /** Midden van het binnenste facet. */
  centre: [number, number];
}

const circle = (r: number, n: number, phase = 0): number[] =>
  Array.from({ length: n }, (_, i) => [r * Math.cos(phase + (i * 2 * Math.PI) / n), r * Math.sin(phase + (i * 2 * Math.PI) / n)]).flat();

/** Druppel: punt bovenaan, ronde buik. Getekend op een raster van 17 en daarna geschaald. */
function drop(): number[] {
  const k = 1 / 17, r = 11.5, cy = 4.5;
  const right: number[] = [];
  // Bézier van de punt (0,-17) naar de flank (r, cy).
  for (let i = 0; i < 8; i++) {
    const t = i / 8, u = 1 - t;
    right.push(3 * u * u * t * 5 + 3 * u * t * t * r + t * t * t * r, u * u * u * -17 + 3 * u * u * t * -9 + 3 * u * t * t * -3 + t * t * t * cy);
  }
  const belly: number[] = [];
  for (let i = 0; i <= 14; i++) { const a = (i * Math.PI) / 14; belly.push(r * Math.cos(a), cy + r * Math.sin(a)); }
  const left: number[] = [];
  for (let i = right.length - 2; i >= 2; i -= 2) left.push(-right[i], right[i + 1]);
  return [...right, ...belly, ...left].map((v) => v * k);
}

const s16 = (pts: number[]) => pts.map((v) => v / 16);

export const SHAPES: Record<BeamColor, Shape> = {
  white: { outline: s16([0, -16, 11, 0, 0, 16, -11, 0]), corners: s16([0, -16, 11, 0, 0, 16, -11, 0]), centre: [0, 0] },
  red: { outline: drop(), corners: [0, -17, 10, -2, 10.5, 9, 0, 16, -10.5, 9, -10, -2].map((v) => v / 17), centre: [0, 3 / 17] },
  green: {
    outline: [-5, -16, 5, -16, 11, -10, 11, 10, 5, 16, -5, 16, -11, 10, -11, -10].map((v) => v / 17),
    corners: [-5, -16, 5, -16, 11, -10, 11, 10, 5, 16, -5, 16, -11, 10, -11, -10].map((v) => v / 17),
    centre: [0, 0],
  },
  blue: { outline: circle(13 / 16, 28), corners: circle(13 / 16, 8, Math.PI / 8), centre: [0, 0] },
};

const place = (pts: readonly number[], cx: number, cy: number, r: number): number[] => pts.map((v, i) => (i % 2 === 0 ? cx : cy) + v * r);

/** Omtrek van het kristal met straal `r` om (cx, cy). */
export function outlinePoints(color: BeamColor, cx: number, cy: number, r: number): number[] {
  return place(SHAPES[color].outline, cx, cy, r);
}

/** Het binnenste facet: de omtrek verkleind (factor `k`) rond het facetmidden. */
export function innerPoints(color: BeamColor, cx: number, cy: number, r: number, k = 0.5): number[] {
  const s = SHAPES[color];
  const [mx, my] = s.centre;
  return place(s.outline.map((v, i) => (i % 2 === 0 ? mx + (v - mx) * k : my + (v - my) * k)), cx, cy, r);
}

/** Facetlijnen: van elk hoekpunt naar het bijbehorende punt op het binnenste facet (x1, y1, x2, y2 per lijn). */
export function facetLines(color: BeamColor, cx: number, cy: number, r: number, k = 0.5): number[][] {
  const s = SHAPES[color];
  const [mx, my] = s.centre;
  const out: number[][] = [];
  for (let i = 0; i < s.corners.length; i += 2) {
    const x = s.corners[i], y = s.corners[i + 1];
    out.push(place([x, y, mx + (x - mx) * k, my + (y - my) * k], cx, cy, r));
  }
  return out;
}

const num = (v: number) => String(Math.round(v * 100) / 100);

/** Een veelhoek als SVG-pad. */
export function pathOf(pts: readonly number[]): string {
  let d = '';
  for (let i = 0; i < pts.length; i += 2) d += `${i ? 'L' : 'M'}${num(pts[i])} ${num(pts[i + 1])}`;
  return `${d}Z`;
}

/** Omtrek van het kristal als SVG-pad (voor icoontjes buiten het veld). */
export function outlinePath(color: BeamColor, cx: number, cy: number, r: number): string {
  return pathOf(outlinePoints(color, cx, cy, r));
}
