import { describe, expect, it } from 'vitest';
import { BEAM_COLORS } from '../../src/core/types';
import { SHAPES, outlinePath, outlinePoints } from '../../src/render/shapes';

const bbox = (pts: number[]) => {
  const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};
const area = (pts: number[]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
  }
  return Math.abs(a) / 2;
};

describe('crystal shapes', () => {
  it('stay inside their radius', () => {
    for (const c of BEAM_COLORS) {
      const pts = outlinePoints(c, 100, 100, 20);
      for (let i = 0; i < pts.length; i += 2) expect(Math.hypot(pts[i] - 100, pts[i + 1] - 100)).toBeLessThanOrEqual(20.01);
    }
  });

  it('none is a triangle (that shape belongs to the prism)', () => {
    for (const c of BEAM_COLORS) expect(SHAPES[c].outline.length / 2).toBeGreaterThanOrEqual(4);
  });

  it('are told apart by shape alone (colour-blind safe)', () => {
    // Per vorm: hoe vol het omhullende rechthoekje is, en de verhouding breedte/hoogte.
    const sig = BEAM_COLORS.map((c) => {
      const pts = outlinePoints(c, 0, 0, 1);
      const b = bbox(pts);
      return { c, fill: area(pts) / (b.w * b.h), aspect: b.w / b.h };
    });
    for (const a of sig) for (const b of sig) {
      if (a.c >= b.c) continue;
      expect(Math.abs(a.fill - b.fill) > 0.09 || Math.abs(a.aspect - b.aspect) > 0.2, `${a.c} lijkt op ${b.c}`).toBe(true);
    }
  });

  it('give an SVG path for icons', () => {
    expect(outlinePath('white', 12, 12, 8)).toBe('M12 4L17.5 12L12 20L6.5 12Z');
  });
});
