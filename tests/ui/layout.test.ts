import { describe, expect, it } from 'vitest';
import { computeCellSize, fitCell } from '../../src/ui/layout';

describe('fitCell', () => {
  it('fits the available stage area, even when that is small', () => {
    expect(fitCell(358, 420, 7, 9)).toBe(46);
    expect(fitCell(800, 180, 7, 9)).toBe(20);
    expect(fitCell(2000, 2000, 7, 9)).toBe(64);
    expect(fitCell(10, 10, 7, 9)).toBe(8);
  });
});

describe('computeCellSize', () => {
  it('fits a phone, caps on desktop, shrinks for big grids', () => {
    expect(computeCellSize(360, 640, 7, 9, 200)).toBe(46);
    expect(computeCellSize(1920, 1080, 7, 9, 200)).toBe(64);
    expect(computeCellSize(390, 844, 12, 14, 200)).toBe(29);
  });
  it('never goes below 24', () => {
    expect(computeCellSize(200, 300, 12, 14, 200)).toBe(24);
  });
  it('always fits the viewport for supported sizes', () => {
    const views = [[360, 640], [390, 844], [430, 932], [844, 390], [1280, 800], [1920, 1080]];
    for (const [w, h] of views) {
      for (const [gw, gh] of [[7, 9], [5, 5], [10, 12]]) {
        const s = computeCellSize(w, h, gw, gh, 200);
        if (s === 24) continue;
        expect(s * gw + 32).toBeLessThanOrEqual(w);
        expect(s * gh + 200 + 16).toBeLessThanOrEqual(h);
      }
    }
  });
});
