import { describe, expect, it } from 'vitest';
import { DAILY } from '../../src/config';
import { fromAscii } from '../../src/core/ascii';
import { DIFFICULTIES } from '../../src/config';
import { ANALYSE_BUDGET, generate, meetsQuality, qualityReport } from '../../src/core/generator';
import type { Puzzle } from '../../src/core/types';

const perturb = (p: Puzzle): Puzzle => {
  const i = p.cells.findIndex((c) => c.kind === 'empty');
  return { ...p, cells: p.cells.map((c, j) => (j === i ? { kind: 'wall' } : c)) };
};

describe('qualityReport', () => {
  it('agrees with meetsQuality', () => {
    const cases: Puzzle[] = [];
    for (let s = 1; s <= 200; s++) cases.push(generate(s, DAILY).puzzle);
    for (let s = 1; s <= 50; s++) cases.push(perturb(generate(s, DAILY).puzzle));
    let notOk = 0;
    for (const p of cases) {
      const r = qualityReport(p);
      const q = meetsQuality(p);
      expect(r.ok).toBe(q.ok);
      expect(r.max).toBe(q.max);
      if (!r.ok) notOk++;
    }
    expect(notOk).toBeGreaterThan(0);
  });

  it('flags a puzzle that is too easy without mirrors', () => {
    const r = qualityReport(fromAscii(['.....', '>ooo.', '.....'], 1));
    expect(r.tooEasyWithout).toBe(true);
    expect(r.ok).toBe(false);
  });

  it('flags a max outside the range', () => {
    const r = qualityReport(fromAscii(['....', '>o..', '....'], 1));
    expect(r.max).toBe(1);
    expect(r.maxInRange).toBe(false);
  });

  it('reports validation errors', () => {
    const r = qualityReport(fromAscii(['....', '.o..', '....'], 1));
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r).toMatchObject({ ok: false, max: 0, solution: [], maxInRange: false, tooEasyWithout: false, greedyReachesMax: false, fewerMirrorsSuffice: false });
  });

  it('is exact for normal and hard puzzles within the analysis budget', () => {
    for (let s = 1; s <= 30; s++) {
      for (const settings of [DAILY, DIFFICULTIES.hard]) {
        const p = generate(s, settings).puzzle;
        const r = qualityReport(p, settings, ANALYSE_BUDGET);
        expect(r.exact).toBe(true);
        expect(r.ok).toBe(meetsQuality(p, settings).ok);
      }
    }
  });

  it('gives up quickly on a huge board and says so', () => {
    const rows = Array.from({ length: 14 }, (_, y) => Array.from({ length: 12 }, (_, x) => (x === 0 && y === 7 ? '>' : (x * 7 + y * 3) % 11 === 0 ? 'o' : '.')).join(''));
    const t0 = performance.now();
    const r = qualityReport(fromAscii(rows, 8), DAILY, ANALYSE_BUDGET);
    expect(performance.now() - t0).toBeLessThan(5000);
    expect(r.exact).toBe(false);
    expect(r.ok).toBe(false);
    expect(r.max).toBeGreaterThan(0);
  });
});
