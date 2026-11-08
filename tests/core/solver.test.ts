import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import { trace } from '../../src/core/beam';
import { createRng } from '../../src/core/rng';
import { solve, solveWithin } from '../../src/core/solver';
import { validatePlacements } from '../../src/core/validate';
import { bruteForceMax } from '../helpers/bruteForce';
import { randomBoard } from '../helpers/randomBoard';

describe('solve', () => {
  it('finds the single-mirror solution', () => {
    const p = fromAscii(['>..', '...', '.o.'], 1);
    const { max, solution } = solve(p);
    expect(max).toBe(1);
    expect(solution.length).toBeLessThanOrEqual(1);
    expect(trace(p, solution).score).toBe(1);
  });

  it('with limit 0 equals the empty trace', () => {
    const p = randomBoard(createRng(5), 5, 5, 3);
    expect(solve(p, 0).max).toBe(trace(p, []).score);
  });

  it('matches brute force on small random boards', () => {
    for (let i = 0; i < 200; i++) {
      const k = 1 + (i % 3);
      const p = randomBoard(createRng(1000 + i), 4, 4, k);
      const { max, solution } = solve(p);
      expect(max, `board ${i}`).toBe(bruteForceMax(p, k));
      expect(validatePlacements(p, solution)).not.toBeNull();
      expect(trace(p, solution).score).toBe(max);
    }
  });
});

describe('solveWithin (budget)', () => {
  const big = (m: number) => fromAscii(Array.from({ length: 14 }, (_, y) => Array.from({ length: 12 }, (_, x) => (x === 0 && y === 7 ? '>' : (x * 7 + y * 3) % 11 === 0 ? 'o' : '.')).join('')), m);

  it('is exact and equal to solve with enough budget', () => {
    const p = big(3);
    const r = solveWithin(p, p.mirrors, 10_000_000);
    expect(r.exact).toBe(true);
    expect(r.max).toBe(solve(p).max);
  });

  it('stops early on a huge search and gives a lower bound', () => {
    const p = big(8);
    const t0 = performance.now();
    const r = solveWithin(p, p.mirrors, 20_000);
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(r.exact).toBe(false);
    expect(r.max).toBeGreaterThan(0);
    expect(r.solution.length).toBeLessThanOrEqual(8);
  });
});
