import { Graphics } from 'pixi.js';
import type { Point, Segment, TraceResult } from '../core/beam';
import { COLORS } from '../ui/tokens';
import type { BoardView } from './board';
import { beamLength, drawBeam, hitDistances, pointsAt } from './beamFx';
import { sharedBlur } from './filters';
import { shardRain } from './particles';
import { spring } from './tween';

/** Flits van de hele straal vóór de lichtpuls. */
export const FLASH_MS = 250;
const PULSE_CELLS_PER_SEC = 18;
const PULSE_MIN_MS = 500;
const PULSE_MAX_MS = 900;
const TAIL_CELLS = 1.2;
const WAVE_MS = 700;
const BREATH_MS = 500;
const REDUCED_NOTE_MS = 80;
const REDUCED_FADE_MS = 300;

export interface CelebrationTimeline {
  pulseMs: number;
  /** Geteld kristal en het moment (ms vanaf de start van de puls) waarop de puls het bereikt. */
  pulses: { cell: number; at: number }[];
  /** Cel van het laatste getelde kristal: daar begint de schokgolf. */
  waveFrom: number | null;
}

export function celebrationTimeline(t: TraceResult, width: number): CelebrationTimeline {
  const len = beamLength(t.segments);
  const pulseMs = Math.min(PULSE_MAX_MS, Math.max(PULSE_MIN_MS, (len / PULSE_CELLS_PER_SEC) * 1000));
  const pulses = [...hitDistances(t, width)]
    .sort((a, b) => a[1] - b[1])
    .map(([cell, d]) => ({ cell, at: len > 0 ? (d / len) * pulseMs : 0 }));
  return { pulseMs, pulses, waveFrom: pulses.length ? pulses[pulses.length - 1].cell : null };
}

export interface CelebrateOpts {
  /** i-de kristalpuls (0-gebaseerd): speel een noot. */
  onNote(i: number): void;
  /** Schokgolf: het akkoord bloeit open. */
  onBloom(): void;
  /** Teller mag goud worden. */
  onPerfect(): void;
}

const lerp = (a: Point, b: Point, k: number): Point => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/** Tekent alleen het stuk straal tussen afstand `from` en `to`. */
function drawWindow(g: Graphics, segments: readonly Segment[], from: number, to: number, cell: number, width: number, alpha: number, color?: number) {
  for (const s of segments) {
    const a = Math.max(from, s.startDist), z = Math.min(to, s.endDist);
    if (z <= a || s.endDist === s.startDist) continue;
    const span = s.endDist - s.startDist;
    const p = lerp(s.from, s.to, (a - s.startDist) / span), q = lerp(s.from, s.to, (z - s.startDist) / span);
    g.moveTo(p.x * cell, p.y * cell).lineTo(q.x * cell, q.y * cell)
      .stroke({ width, color: color ?? COLORS.beam[s.color], alpha, cap: 'round' });
  }
}

/**
 * Viering bij het maximum: flits, lichtpuls langs de baan met meeveerende kristallen,
 * schokgolf over het veld en een gouden teller. Resolvet na de golf; de scherfregen loopt door.
 */
export async function celebrate(b: BoardView, t: TraceResult, opts: CelebrateOpts): Promise<void> {
  const puzzle = b.currentPuzzle;
  if (!puzzle) return;
  const tl = celebrationTimeline(t, puzzle.width);
  const W = b.app.screen.width, H = b.app.screen.height;

  if (b.reducedMotion) {
    const c = b.cellSize;
    const rim = new Graphics().rect(1, 1, W - 2, H - 2).stroke({ width: Math.max(3, c * 0.08), color: COLORS.accent });
    rim.alpha = 0;
    b.fxLayer.addChild(rim);
    await b.tweens.to(REDUCED_FADE_MS, (k) => { rim.alpha = k; });
    for (let i = 0; i < tl.pulses.length; i++) {
      opts.onNote(i);
      await b.tweens.wait(REDUCED_NOTE_MS);
    }
    opts.onBloom();
    opts.onPerfect();
    await b.tweens.to(REDUCED_FADE_MS, (k) => { rim.alpha = 1 - k; });
    rim.destroy();
    return;
  }

  const c = b.cellSize;
  const len = beamLength(t.segments);
  const halo = new Graphics();
  halo.filters = [sharedBlur(10)];
  halo.blendMode = 'add';
  const core = new Graphics();
  core.blendMode = 'add';
  const comet = new Graphics();
  comet.filters = [sharedBlur(6)];
  comet.blendMode = 'add';
  const cometCore = new Graphics();
  cometCore.blendMode = 'add';
  b.fxLayer.addChild(halo, core, comet, cometCore);
  const all = [halo, core, comet, cometCore];

  // 1. Flits: de hele straal licht fel op en zakt terug tot een nagloed.
  drawBeam(halo, t.segments, len, c, { width: c * 0.7, alpha: 0.9 });
  drawBeam(core, t.segments, len, c, { width: Math.max(2, c * 0.12), alpha: 1, colorOverride: 0xffffff });
  await b.tweens.to(FLASH_MS, (k) => {
    const a = k < 0.3 ? k / 0.3 : 1 - ((k - 0.3) / 0.7) * 0.7;
    halo.alpha = a; core.alpha = a;
  }, (k) => k);

  // 2 + 3. Lichtpuls met staart; kristallen veren op als de puls ze bereikt.
  const pending = [...tl.pulses];
  let note = 0;
  await b.tweens.to(tl.pulseMs, (k) => {
    const d = k * len;
    halo.alpha = core.alpha = 0.3 * (1 - k);
    comet.clear(); cometCore.clear();
    // Staart in vier stukjes die naar achteren vervagen.
    for (let s = 0; s < 4; s++) {
      const a = d - TAIL_CELLS * ((s + 1) / 4), z = d - TAIL_CELLS * (s / 4);
      drawWindow(comet, t.segments, a, z, c, c * 0.5, 0.85 * (1 - s / 4));
      drawWindow(cometCore, t.segments, a, z, c, Math.max(2, c * 0.1), 1 - s / 4, 0xffffff);
    }
    for (const { p, color } of pointsAt(t.segments, d)) {
      comet.circle(p.x * c, p.y * c, c * 0.42).fill({ color: COLORS.beam[color], alpha: 0.95 });
      cometCore.circle(p.x * c, p.y * c, c * 0.14).fill({ color: 0xffffff });
    }
    const elapsed = k * tl.pulseMs;
    while (pending.length && pending[0].at <= elapsed) {
      const { cell } = pending.shift()!;
      pulseCrystal(b, cell);
      opts.onNote(note++);
    }
  }, (k) => k);
  // Afronding: kristallen die precies op het eind liggen.
  for (const { cell } of pending) { pulseCrystal(b, cell); opts.onNote(note++); }
  comet.clear(); cometCore.clear();
  halo.alpha = core.alpha = 0;

  // 4. Schokgolf vanuit het laatste kristal; het veld ademt mee.
  opts.onBloom();
  const from = tl.waveFrom !== null ? b.center(tl.waveFrom) : { x: W / 2, y: H / 2 };
  const reach = Math.max(Math.hypot(from.x, from.y), Math.hypot(W - from.x, from.y), Math.hypot(from.x, H - from.y), Math.hypot(W - from.x, H - from.y)) + c;
  const wave = new Graphics();
  wave.filters = [sharedBlur(4)];
  wave.blendMode = 'add';
  const waveCore = new Graphics();
  waveCore.blendMode = 'add';
  b.fxLayer.addChild(wave, waveCore);
  all.push(wave, waveCore);
  void breathe(b, W, H);
  let gold = false;
  await b.tweens.to(WAVE_MS, (k) => {
    const r = c * 0.3 + reach * k;
    wave.clear().circle(from.x, from.y, r).stroke({ width: c * 0.24 * (1 - k * 0.6), color: COLORS.accent, alpha: 0.9 * (1 - k) });
    waveCore.clear().circle(from.x, from.y, r).stroke({ width: Math.max(1.5, c * 0.06), color: 0xffffff, alpha: 1 - k });
    if (!gold && k > 0.3) { gold = true; opts.onPerfect(); }
  });
  if (!gold) opts.onPerfect();
  for (const g of all) g.destroy();

  // 6. Scherfregen in de kleuren van de geraakte kristallen.
  const colors = [COLORS.accent, 0xffffff];
  for (const i of t.hit) {
    const cell = puzzle.cells[i];
    if (cell.kind === 'crystal' && !colors.includes(COLORS.crystal[cell.color])) colors.push(COLORS.crystal[cell.color]);
  }
  void shardRain(b.fxLayer, b.tweens, W, H, colors);
}

/** Kristal veert op en zendt een ring uit. */
function pulseCrystal(b: BoardView, i: number) {
  const { x, y } = b.center(i);
  const c = b.cellSize;
  const node = b.crystalNode(i);
  if (node) {
    node.pivot.set(x, y); node.position.set(x, y);
    void b.tweens.to(420, (q) => node.scale.set(1 + 0.35 * Math.sin(q * Math.PI)), spring);
  }
  const cell = b.currentPuzzle?.cells[i];
  const color = cell?.kind === 'crystal' ? COLORS.crystal[cell.color] : COLORS.accent;
  const ring = new Graphics().circle(0, 0, c * 0.36).stroke({ width: Math.max(2, c * 0.06), color });
  ring.position.set(x, y);
  ring.blendMode = 'add';
  b.fxLayer.addChild(ring);
  void b.tweens.to(480, (k) => { ring.scale.set(1 + k * 1.4); ring.alpha = 1 - k; }).then(() => ring.destroy());
}

/** Het veld zwelt even een paar procent op rond het midden. */
async function breathe(b: BoardView, W: number, H: number) {
  const root = b.root;
  root.pivot.set(W / 2, H / 2);
  root.position.set(W / 2, H / 2);
  await b.tweens.to(BREATH_MS, (k) => root.scale.set(1 + 0.02 * Math.sin(k * Math.PI)), (k) => k);
  root.scale.set(1);
  root.pivot.set(0, 0);
  root.position.set(0, 0);
}
