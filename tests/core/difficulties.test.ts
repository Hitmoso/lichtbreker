import { describe, expect, it } from 'vitest';
import { DAILY, DIFFICULTIES, type Difficulty } from '../../src/config';
import { FALLBACKS, generate, meetsQuality } from '../../src/core/generator';

const LEVELS: Difficulty[] = ['easy', 'normal', 'hard'];

describe('DIFFICULTIES', () => {
  it('normal starts as a separate copy of DAILY', () => {
    expect(DIFFICULTIES.normal).not.toBe(DAILY);
    expect(DIFFICULTIES.normal).toEqual(DAILY);
  });

  for (const d of LEVELS) {
    it(`${d}: 100 seeds give good puzzles of the right size`, () => {
      const s = DIFFICULTIES[d];
      let generated = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const r = generate(seed, s);
        if (r.source === 'generated') generated++;
        expect(r.puzzle.width).toBe(s.width);
        expect(r.puzzle.height).toBe(s.height);
        expect(meetsQuality(r.puzzle, s).ok, `${d} seed ${seed}`).toBe(true);
        expect(r.max).toBeGreaterThanOrEqual(s.maxScore[0]);
        expect(r.max).toBeLessThanOrEqual(s.maxScore[1]);
        if (d === 'easy') {
          expect(r.puzzle.cells.some((c) => c.kind === 'prism' || c.kind === 'filter' || c.kind === 'fixedMirror')).toBe(false);
        }
      }
      expect(generated).toBeGreaterThanOrEqual(95);
    }, 300_000);

    it(`${d}: fast enough`, () => {
      const times: number[] = [];
      for (let seed = 1; seed <= 30; seed++) {
        const t0 = performance.now();
        generate(seed, DIFFICULTIES[d]);
        times.push(performance.now() - t0);
      }
      expect(times.reduce((a, b) => a + b, 0) / times.length).toBeLessThan(400);
      expect(Math.max(...times)).toBeLessThan(2000);
    }, 120_000);

    it(`${d}: fallback meets the quality bar`, () => {
      expect(meetsQuality(FALLBACKS[d], DIFFICULTIES[d]).ok).toBe(true);
    });
  }
});
