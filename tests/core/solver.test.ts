import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import { trace } from '../../src/core/beam';
import { createRng } from '../../src/core/rng';
import { solve } from '../../src/core/solver';
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
