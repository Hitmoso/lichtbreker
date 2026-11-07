import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import { trace } from '../../src/core/beam';
import { beamLength, crossedNotCounted, hitDistances, pointsAt } from '../../src/render/beamFx';

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

describe('crossedNotCounted', () => {
  it('lists crystals the beam passes that do not count', () => {
    // wit door r (telt niet), R kleurt rood, daarna o (telt niet) en r (telt)
    const p = fromAscii(['>rRor', '.....'], 1);
    const t = trace(p, []);
    expect([...crossedNotCounted(t, p)].sort()).toEqual([1, 3]);
    expect([...t.hit]).toEqual([4]);
  });
  it('ignores crystals off the beam and counted ones', () => {
    const p = fromAscii(['>.o', 'r.b'], 1);
    expect(crossedNotCounted(trace(p, []), p).size).toBe(0);
  });
});
