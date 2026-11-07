import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import { trace } from '../../src/core/beam';
import { beamLength, hitDistances } from '../../src/render/beamFx';
import { celebrationTimeline } from '../../src/render/celebrate';

describe('celebrationTimeline', () => {
  it('pulses crystals in beam order within the pulse duration', () => {
    const p = fromAscii(['>.o..', '....o', '.....', 'o...o'], 1);
    const t = trace(p, [{ x: 4, y: 0, mirror: '\\' }]);
    const tl = celebrationTimeline(t, p.width);
    const order = [...hitDistances(t, p.width)].sort((a, b) => a[1] - b[1]).map(([c]) => c);
    expect(tl.pulses.map((q) => q.cell)).toEqual(order);
    expect(order.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < tl.pulses.length; i++) expect(tl.pulses[i].at).toBeGreaterThanOrEqual(tl.pulses[i - 1].at);
    for (const q of tl.pulses) {
      expect(q.at).toBeGreaterThanOrEqual(0);
      expect(q.at).toBeLessThanOrEqual(tl.pulseMs);
    }
    expect(tl.waveFrom).toBe(order[order.length - 1]);
  });
  it('keeps the pulse between 500 and 900 ms', () => {
    const short = trace(fromAscii(['>o'], 1), []);
    expect(beamLength(short.segments)).toBeLessThan(9);
    expect(celebrationTimeline(short, 2).pulseMs).toBe(500);
    const long = trace(fromAscii(['>' + '.'.repeat(30) + 'o'], 1), []);
    expect(celebrationTimeline(long, 32).pulseMs).toBe(900);
  });
  it('handles a beam without crystals', () => {
    const t = trace(fromAscii(['>...'], 1), []);
    expect(celebrationTimeline(t, 4)).toMatchObject({ pulses: [], waveFrom: null });
  });
});
