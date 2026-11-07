import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import { trace } from '../../src/core/beam';
import { createRng } from '../../src/core/rng';
import { validatePuzzle } from '../../src/core/validate';
import { randomBoard } from '../helpers/randomBoard';

describe('trace', () => {
  it('runs straight off the grid', () => {
    const t = trace(fromAscii(['>..o'], 1), []);
    expect(t.score).toBe(1);
    expect([...t.hit]).toEqual([3]);
    expect(t.segments).toEqual([
      { from: { x: 0.5, y: 0.5 }, to: { x: 4, y: 0.5 }, color: 'white', startDist: 0, endDist: 3.5 },
    ]);
  });

  it('reflects on player mirrors', () => {
    const p = fromAscii(['>..', '...', '.o.'], 1);
    expect(trace(p, [{ x: 1, y: 0, mirror: '\\' }]).score).toBe(1);
    expect(trace(p, [{ x: 1, y: 0, mirror: '/' }]).score).toBe(0);
    const t = trace(p, [{ x: 1, y: 0, mirror: '\\' }]);
    expect(t.segments).toEqual([
      { from: { x: 0.5, y: 0.5 }, to: { x: 1.5, y: 0.5 }, color: 'white', startDist: 0, endDist: 1 },
      { from: { x: 1.5, y: 0.5 }, to: { x: 1.5, y: 3 }, color: 'white', startDist: 1, endDist: 3.5 },
    ]);
  });

  it('reflects all four directions per mirror kind', () => {
    // '/' from the left goes up; from below (moving up) goes right.
    const p = fromAscii(['.o.', '>/.', '...'], 1);
    expect(trace(p, []).score).toBe(1);
    const q = fromAscii(['...', '>\\.', '.o.'], 1);
    expect(trace(q, []).score).toBe(1);
  });

  it('stops at walls on the wall face', () => {
    const t = trace(fromAscii(['>.#o'], 1), []);
    expect(t.score).toBe(0);
    expect(t.segments.at(-1)!.to).toEqual({ x: 2, y: 0.5 });
  });

  it('applies colour filters to crystals', () => {
    expect(trace(fromAscii(['>RrB.b'], 1), []).score).toBe(2);
    expect(trace(fromAscii(['>.r'], 1), []).score).toBe(0);
    expect(trace(fromAscii(['>Bo'], 1), []).score).toBe(1);
    const t = trace(fromAscii(['>R.'], 1), []);
    expect(t.segments.map((s) => s.color)).toEqual(['white', 'red']);
  });

  it('splits on prisms', () => {
    const t = trace(fromAscii(['.o.', '>P.', '.o.'], 1), []);
    expect(t.score).toBe(2);
    expect(t.segments.length).toBe(3);
  });

  it('counts a crystal once even when crossed twice', () => {
    // rechts door o op (2,1), via drie spiegels omhoog-links-omlaag weer door o
    const p = fromAscii(['../\\', '>.o/', '....'], 1);
    const t = trace(p, []);
    expect(t.score).toBe(1);
    expect(t.segments.at(-1)).toMatchObject({ from: { x: 2.5, y: 0.5 }, to: { x: 2.5, y: 3 } });
  });

  it('fixed mirrors reflect like player mirrors', () => {
    expect(trace(fromAscii(['>.\\', '...', '..o'], 1), []).score).toBe(1);
  });

  it('terminates on random boards', () => {
    for (let i = 0; i < 500; i++) {
      const p = randomBoard(createRng(i), 6, 6, 3);
      expect(validatePuzzle(p)).toEqual([]);
      const t = trace(p, []);
      expect(t.segments.length).toBeLessThan(6 * 6 * 4 * 4 * 2);
      expect(t.score).toBe(t.hit.size);
    }
  });
});
