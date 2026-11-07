import { describe, expect, it } from 'vitest';
import { FALLBACK, generate, meetsQuality } from '../../src/core/generator';
import { hashSeed } from '../../src/core/rng';
import { solve } from '../../src/core/solver';

describe('generate', () => {
  it('is deterministic per seed', () => {
    expect(JSON.stringify(generate(42))).toBe(JSON.stringify(generate(42)));
  });

  it('daily puzzles do not shift', () => {
    // Vingerafdruk van de gegenereerde dagpuzzels; mag nooit veranderen na lancering.
    const prints = [1, 2, 3, 42, 365].map((s) => hashSeed(JSON.stringify(generate(s).puzzle)));
    expect(prints).toMatchInlineSnapshot(`
      [
        106012977,
        1856946006,
        3116585345,
        3506985471,
        672714433,
      ]
    `);
  });

  it('fallback meets the quality bar', () => {
    expect(meetsQuality(FALLBACK).ok).toBe(true);
  });

  it('produces a year of good puzzles with varied elements', () => {
    let generated = 0;
    const kinds = { prism: 0, filter: 0, fixedMirror: 0, none: 0 };
    for (let seed = 1; seed <= 365; seed++) {
      const r = generate(seed);
      if (r.source === 'generated') generated++;
      expect(r.puzzle.width).toBe(7);
      expect(r.puzzle.height).toBe(9);
      const q = meetsQuality(r.puzzle);
      expect(q.ok, `seed ${seed}`).toBe(true);
      expect(r.max).toBe(solve(r.puzzle).max);
      const present = new Set(r.puzzle.cells.map((c) => c.kind));
      let any = false;
      for (const k of ['prism', 'filter', 'fixedMirror'] as const) if (present.has(k)) { kinds[k]++; any = true; }
      if (!any) kinds.none++;
    }
    expect(generated).toBeGreaterThanOrEqual(360);
    expect(kinds.prism).toBeGreaterThan(0);
    expect(kinds.filter).toBeGreaterThan(0);
    expect(kinds.fixedMirror).toBeGreaterThan(0);
    expect(kinds.none).toBeGreaterThan(0);
  }, 300_000);

  it('is fast enough', () => {
    const times: number[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      const t0 = performance.now();
      generate(seed);
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeLessThan(400);
    expect(Math.max(...times)).toBeLessThan(2000);
  }, 120_000);
});
