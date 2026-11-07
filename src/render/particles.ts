import { Container, Graphics } from 'pixi.js';
import type { Tweens } from './tween';

/** Kristal barst open: scherfjes vliegen naar buiten en vervagen. */
export function burst(layer: Container, tweens: Tweens, x: number, y: number, color: number, size: number, count = 14): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = size * (0.6 + Math.random() * 0.9);
    const s = Math.max(1.5, size * (0.04 + Math.random() * 0.05));
    const g = new Graphics().poly([0, -s * 1.6, s, 0, 0, s * 1.6, -s, 0]).fill({ color: Math.random() < 0.3 ? 0xffffff : color });
    g.blendMode = 'add';
    g.position.set(x, y);
    g.rotation = a;
    layer.addChild(g);
    void tweens.to(520 + Math.random() * 260, (k) => {
      g.position.set(x + Math.cos(a) * dist * k, y + Math.sin(a) * dist * k);
      g.alpha = 1 - k;
      g.scale.set(1 - k * 0.5);
    }).then(() => g.destroy());
  }
  const ring = new Graphics().circle(0, 0, size * 0.3).stroke({ width: 2, color });
  ring.position.set(x, y);
  ring.blendMode = 'add';
  layer.addChild(ring);
  void tweens.to(420, (k) => { ring.scale.set(1 + k * 1.6); ring.alpha = 1 - k; }).then(() => ring.destroy());
}

/** Regen van glinsterende scherven over het hele veld (maximum gehaald). */
export function shardRain(layer: Container, tweens: Tweens, width: number, height: number, colors: number[], count = 46): Promise<void> {
  const all: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    const s = 3 + Math.random() * 5;
    const g = new Graphics().poly([0, -s * 1.8, s, 0, 0, s * 1.8, -s, 0]).fill({ color: colors[i % colors.length] });
    g.blendMode = 'add';
    const x0 = Math.random() * width, drift = (Math.random() - 0.5) * 60;
    const delay = Math.random() * 500, spin = (Math.random() - 0.5) * 8;
    g.position.set(x0, -10);
    g.alpha = 0;
    layer.addChild(g);
    all.push(tweens.wait(delay).then(() => tweens.to(1300 + Math.random() * 700, (k) => {
      g.position.set(x0 + drift * k, -10 + (height + 30) * k);
      g.rotation = spin * k;
      g.alpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    }, (k) => k)).then(() => g.destroy()));
  }
  return Promise.all(all).then(() => undefined);
}
