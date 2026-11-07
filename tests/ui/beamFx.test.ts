import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import { trace } from '../../src/core/beam';
import { beamLength, hitDistances, pointsAt } from '../../src/render/beamFx';

describe('beam animation helpers', () => {
  it('finds the distance at which each crystal is first hit', () => {
    const p = fromAscii(['>.o.', '....', '.o..'], 1);
    const t = trace(p, [{ x: 3, y: 0, mirror: '\\' }]);
    // o op (2,0): 2 vakken van de bron. Tweede o op (1,2) wordt niet geraakt.
    expect([...hitDistances(t, p.width)]).toEqual([[2, 2]]);
  });
  it('takes the first pass when a crystal is crossed twice', () => {
    const p = fromAscii(['../\\', '>.o/', '....'], 1);
    const t = trace(p, []);
    expect(hitDistances(t, p.width).get(6)).toBe(2);
  });
  it('measures length and samples points on all branches', () => {
    const t = trace(fromAscii(['.o.', '>P.', '.o.'], 1), []);
    expect(beamLength(t.segments)).toBe(2.5);
    expect(pointsAt(t.segments, 2).length).toBe(2);
  });
});
