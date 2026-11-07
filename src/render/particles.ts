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

/**
 * Regen van glinsterende scherven over het hele veld (maximum gehaald). De scherven starten in een
 * golf van links naar rechts, vallen met lichte versnelling, draaien en flonkeren.
 */
export function shardRain(layer: Container, tweens: Tweens, width: number, height: number, colors: number[], count = 36): Promise<void> {
  const all: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    const s = 3 + Math.random() * 4;
    const g = new Graphics().poly([0, -s * 1.8, s, 0, 0, s * 1.8, -s, 0]).fill({ color: colors[i % colors.length] });
    g.blendMode = 'add';
    // Gelijk verdeeld over de breedte (met wat speling), zodat de golf netjes oogt.
    const x0 = ((i + 0.2 + Math.random() * 0.6) / count) * width;
    const drift = (Math.random() - 0.5) * 40;
    const delay = (x0 / width) * 450 + Math.random() * 120;
    const spin = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 4);
    const twinkle = Math.random() * Math.PI * 2;
    g.position.set(x0, -12);
    g.alpha = 0;
    layer.addChild(g);
    all.push(tweens.wait(delay).then(() => tweens.to(1300 + Math.random() * 500, (k) => {
      g.position.set(x0 + drift * k, -12 + (height + 36) * (0.6 * k + 0.4 * k * k));
      g.rotation = spin * k;
      const fade = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
      g.alpha = fade * (0.7 + 0.3 * Math.sin(k * Math.PI * 10 + twinkle));
    }, (k) => k)).then(() => g.destroy()));
  }
  return Promise.all(all).then(() => undefined);
}
