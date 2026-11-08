import { describe, expect, it } from 'vitest';
import { DAILY, DIFFICULTIES, GEN_V2, type Difficulty } from '../../src/config';
import { trace } from '../../src/core/beam';
import { generate, meetsQuality } from '../../src/core/generator';
import { generateV2, withoutFilters } from '../../src/core/generator2';
import { greedy } from '../../src/core/greedy';
import { hashSeed } from '../../src/core/rng';
import { solve } from '../../src/core/solver';
import type { Puzzle } from '../../src/core/types';

const SEEDS = Array.from({ length: 60 }, (_, i) => hashSeed('lichtbreker', i + 4));

const unhit = (p: Puzzle, solution: ReturnType<typeof solve>['solution']) => {
  const { hit } = trace(p, solution);
  return p.cells.filter((c, i) => c.kind === 'crystal' && !hit.has(i)).length;
};
const hasFilter = (p: Puzzle) => p.cells.some((c) => c.kind === 'filter');

describe('generateV2 (dagpuzzel)', () => {
  const results = SEEDS.map((s) => generateV2(s));

  it('is deterministic per seed', () => {
    expect(JSON.stringify(generateV2(SEEDS[0]))).toBe(JSON.stringify(results[0]));
  });

  it('gives good, generated puzzles with an exact maximum', () => {
    expect(results.filter((r) => r.source === 'generated').length).toBeGreaterThanOrEqual(57);
    for (const r of results) {
      expect(r.puzzle.width).toBe(DAILY.width);
      expect(r.puzzle.height).toBe(DAILY.height);
      expect(meetsQuality(r.puzzle).ok).toBe(true);
      expect(r.max).toBe(solve(r.puzzle).max);
    }
  });

  it('is tidy: at most 5 lures, about 3-5 on average', () => {
    const gen = results.filter((r) => r.source === 'generated');
    const counts = gen.map((r) => unhit(r.puzzle, r.solution));
    for (const n of counts) expect(n).toBeLessThanOrEqual(GEN_V2.lures[1]);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(avg).toBeGreaterThanOrEqual(2.5);
  });

  it('has a colour filter in roughly 1 of 3 puzzles', () => {
    const n = results.filter((r) => hasFilter(r.puzzle)).length;
    expect(n / results.length).toBeGreaterThanOrEqual(0.25);
    expect(n / results.length).toBeLessThanOrEqual(0.45);
  });

  it('needed filters are really needed and hit coloured crystals', () => {
    const needed = results.filter((r) => r.filter === 'needed');
    expect(needed.length).toBeGreaterThan(0);
    for (const r of needed) {
      expect(solve(withoutFilters(r.puzzle)).max).toBeLessThan(r.max);
      const { hit } = trace(r.puzzle, r.solution);
      const colouredHit = r.puzzle.cells.filter((c, i) => c.kind === 'crystal' && c.color !== 'white' && hit.has(i)).length;
      expect(colouredHit).toBeGreaterThanOrEqual(2);
    }
  });

  it('decoy filters are rare, not needed, but tempting', () => {
    const withF = results.filter((r) => hasFilter(r.puzzle));
    const decoys = results.filter((r) => r.filter === 'decoy');
    expect(decoys.length).toBeGreaterThan(0);
    expect(decoys.length).toBeLessThanOrEqual(withF.length / 2);
    for (const r of decoys) {
      expect(hasFilter(r.puzzle)).toBe(true);
      expect(solve(withoutFilters(r.puzzle)).max).toBe(r.max);
      expect(r.puzzle.cells.filter((c) => c.kind === 'crystal' && c.color !== 'white').length).toBeGreaterThanOrEqual(2);
    }
    for (const r of results) if (r.filter === 'none') expect(hasFilter(r.puzzle)).toBe(false);
  });

  it('is not easier than the old generator (greedy gap)', () => {
    const gap = (rs: { puzzle: Puzzle; max: number }[]) =>
      rs.reduce((a, r) => a + r.max - greedy(r.puzzle).score, 0) / rs.length;
    const old = SEEDS.map((s) => generate(s));
    expect(gap(results)).toBeGreaterThanOrEqual(gap(old));
  });

  it('daily v2 puzzles do not shift', () => {
    const prints = SEEDS.slice(0, 5).map((s) => hashSeed(JSON.stringify(generateV2(s).puzzle)));
    expect(prints).toMatchInlineSnapshot(`
      [
        3455686085,
        99791332,
        1723425397,
        3642121828,
        1573225070,
      ]
    `);
  });
});

describe('generateV2 (oneindig, per niveau)', () => {
  const LEVELS: Difficulty[] = ['easy', 'normal', 'hard'];
  for (const d of LEVELS) {
    it(`${d}: good puzzles of the right size, fast enough`, () => {
      const s = DIFFICULTIES[d];
      const times: number[] = [];
      let generated = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const t0 = performance.now();
        const r = generateV2(seed, s);
        times.push(performance.now() - t0);
        if (r.source === 'generated') generated++;
        expect(r.puzzle.width).toBe(s.width);
        expect(r.puzzle.height).toBe(s.height);
        expect(meetsQuality(r.puzzle, s).ok, `${d} seed ${seed}`).toBe(true);
        if (d === 'easy') expect(r.puzzle.cells.some((c) => c.kind === 'prism' || c.kind === 'filter' || c.kind === 'fixedMirror')).toBe(false);
      }
      expect(generated).toBeGreaterThanOrEqual(28);
      // Ruime grenzen: deze suite draait ook vóór elke publicatie op GitHub (tragere machines).
      // Los gemeten is het gemiddelde ± 0,2 s; een echte vertraging (seconden) valt hier wel op.
      expect(times.reduce((a, b) => a + b, 0) / times.length).toBeLessThan(1000);
      expect(Math.max(...times)).toBeLessThan(5000);
    }, 120_000);
  }
});
