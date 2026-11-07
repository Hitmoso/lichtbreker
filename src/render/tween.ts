import type { Ticker } from 'pixi.js';

export type Ease = (k: number) => number;
export const easeOut: Ease = (k) => 1 - Math.pow(1 - k, 3);
export const easeInOut: Ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
/** Overschiet licht en veert terug. */
export const spring: Ease = (k) => {
  const c1 = 1.70158 * 1.3, c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};

interface Tween { elapsed: number; dur: number; ease: Ease; update: (v: number) => void; resolve: () => void }

/** Minimale tween-motor op de Pixi-ticker. Duur 0 voert direct de eindstand uit. */
export class Tweens {
  private list: Tween[] = [];
  reduced = false;

  constructor(ticker: Ticker) {
    ticker.add((t) => this.step(t.deltaMS));
  }

  to(dur: number, update: (v: number) => void, ease: Ease = easeOut): Promise<void> {
    return new Promise((resolve) => {
      if (dur <= 0) { update(1); resolve(); return; }
      update(ease(0));
      this.list.push({ elapsed: 0, dur, ease, update, resolve });
    });
  }

  wait(ms: number): Promise<void> {
    return this.to(ms, () => {});
  }

  cancelAll(): void {
    for (const t of this.list) { t.update(t.ease(1)); t.resolve(); }
    this.list = [];
  }

  private step(dt: number) {
    if (!this.list.length) return;
    const keep: Tween[] = [];
    for (const t of this.list) {
      t.elapsed += dt;
      const k = Math.min(1, t.elapsed / t.dur);
      t.update(t.ease(k));
      if (k >= 1) t.resolve(); else keep.push(t);
    }
    // tweens die tijdens update zijn toegevoegd blijven staan
    this.list = keep.concat(this.list.filter((t) => !keep.includes(t) && t.elapsed === 0));
  }
}
