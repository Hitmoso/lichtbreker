import { describe, expect, it } from 'vitest';
import type { Ticker } from 'pixi.js';
import { Tweens } from '../../src/render/tween';

class FakeTicker {
  fns: ((t: { deltaMS: number }) => void)[] = [];
  add(fn: (t: { deltaMS: number }) => void) { this.fns.push(fn); }
  tick(ms: number) { for (const f of this.fns) f({ deltaMS: ms }); }
}

describe('Tweens', () => {
  it('drops a tween whose update throws, resolves it, and keeps the others running', async () => {
    const ticker = new FakeTicker();
    const tw = new Tweens(ticker as unknown as Ticker);
    let calls = 0;
    let other = 0;
    const bad = tw.to(100, () => { if (++calls > 1) throw new TypeError('destroyed node'); });
    const good = tw.to(100, (v) => { other = v; }, (k) => k);
    expect(() => ticker.tick(50)).not.toThrow();
    ticker.tick(60);
    await expect(bad).resolves.toBeUndefined();
    await expect(good).resolves.toBeUndefined();
    expect(other).toBe(1);
  });
});
