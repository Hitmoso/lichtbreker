import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import { trace } from '../../src/core/beam';
import { greedy } from '../../src/core/greedy';
import { createRng } from '../../src/core/rng';
import { solve } from '../../src/core/solver';
import { randomBoard } from '../helpers/randomBoard';

describe('greedy', () => {
  it('solves the trivial board', () => {
    expect(greedy(fromAscii(['>..', '...', '.o.'], 1)).score).toBe(1);
  });

  it('never beats the solver and reports its own score honestly', () => {
    for (let i = 0; i < 50; i++) {
      const p = randomBoard(createRng(500 + i), 5, 5, 3);
      const g = greedy(p);
      expect(g.score).toBeLessThanOrEqual(solve(p).max);
      expect(trace(p, g.placements).score).toBe(g.score);
      expect(g.placements.length).toBeLessThanOrEqual(p.mirrors);
    }
  });

  it('is deterministic', () => {
    const p = randomBoard(createRng(9), 5, 5, 3);
    expect(greedy(p)).toEqual(greedy(p));
  });

  it('stops when no placement improves', () => {
    const p = fromAscii(['>.o', '...', '...'], 3);
    expect(greedy(p)).toEqual({ score: 1, placements: [] });
  });
});
