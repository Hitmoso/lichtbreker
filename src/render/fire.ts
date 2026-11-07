import { BlurFilter, Graphics } from 'pixi.js';
import type { Segment, TraceResult } from '../core/beam';
import type { Placement } from '../core/types';
import { COLORS } from '../ui/tokens';
import type { BoardView } from './board';
import { beamLength, drawBeam, hitDistances, pointsAt } from './beamFx';
import { celebrate } from './celebrate';
import { burst } from './particles';
import { spring } from './tween';

const CELLS_PER_SEC = 6;
const MAX_MS = 3000;
/** Beste oplossing: rustiger, zodat te volgen is waar elke spiegel komt. */
const SOLUTION_MIRROR_MS = 550;
const SOLUTION_PAUSE_MS = 300;
const SOLUTION_CELLS_PER_SEC = CELLS_PER_SEC;
const SOLUTION_MAX_MS = MAX_MS;

export interface PlayOpts {
  perfect: boolean;
  onHit: (count: number) => void;
  /** Viering bij het maximum: noot per kristalpuls, akkoord bij de schokgolf, gouden teller. */
  onNote?: (i: number) => void;
  onBloom?: () => void;
  onPerfect?: () => void;
}

const noop = () => {};

const EMPTY: TraceResult = { segments: [], hit: new Set(), score: 0 };

export class FireFx {
  private dim = new Graphics();
  private glow = new Graphics();
  private core = new Graphics();
  private head = new Graphics();

  constructor(private board: BoardView) {
    this.glow.filters = [new BlurFilter({ strength: 8, quality: 3 })];
    this.glow.blendMode = 'add';
    this.head.filters = [new BlurFilter({ strength: 6 })];
    this.head.blendMode = 'add';
    this.dim.alpha = 0;
    board.root.addChildAt(this.dim, 2);
    board.fxLayer.addChild(this.glow, this.core, this.head);
  }

  /** De grote animatie na "Vuur!". Resolvet als alles klaar is (een scherfregen mag nog doorlopen). */
  async play(t: TraceResult, opts: PlayOpts): Promise<void> {
    const b = this.board;
    b.setInteractive(false);
    b.hideBeam();
    b.setLit(new Set(), false);
    const reduced = b.reducedMotion;
    const W = b.app.screen.width, H = b.app.screen.height;
    this.dim.clear().rect(0, 0, W, H).fill({ color: COLORS.bgDeep });

    if (reduced) {
      await b.tweens.to(250, (k) => { this.dim.alpha = 0.35 * k; });
      b.setTrace(t);
      opts.onHit(t.score);
      if (opts.perfect) await celebrate(b, t, this.celebrateOpts(opts));
      await b.tweens.to(250, (k) => { this.dim.alpha = 0.35 * (1 - k); });
      return;
    }

    await b.tweens.to(260, (k) => { this.dim.alpha = 0.5 * k; });
    const len = beamLength(t.segments);
    const dur = Math.min(MAX_MS, (len / CELLS_PER_SEC) * 1000);
    const pending = [...hitDistances(t, b.currentPuzzle!.width)].sort((a, z) => a[1] - z[1]);
    const lit = new Set<number>();
    await b.tweens.to(dur, (k) => {
      const d = k * len;
      this.drawProgress(t.segments, d, true);
      while (pending.length && pending[0][1] <= d) {
        const [i] = pending.shift()!;
        lit.add(i);
        b.setLit(lit);
        const { x, y } = b.center(i);
        const cell = b.currentPuzzle!.cells[i];
        const color = cell.kind === 'crystal' ? COLORS.crystal[cell.color] : COLORS.accent;
        burst(b.fxLayer, b.tweens, x, y, color, b.cellSize);
        const node = b.crystalNode(i);
        if (node) {
          node.pivot.set(x, y); node.position.set(x, y);
          void b.tweens.to(380, (q) => node.scale.set(1 + 0.45 * Math.sin(q * Math.PI)), spring);
        }
        opts.onHit(lit.size);
      }
    }, (k) => k);
    this.clearProgress();
    b.setTrace(t);
    if (opts.perfect) await celebrate(b, t, this.celebrateOpts(opts));
    await b.tweens.to(420, (k) => { this.dim.alpha = 0.5 * (1 - k); });
  }

  /** Spiegels van de beste oplossing verschijnen één voor één, daarna de straal. */
  async playSolution(solution: readonly Placement[], t: TraceResult, opts: { onMirror?(k: number): void; onHit?(n: number): void } = {}): Promise<void> {
    const b = this.board;
    b.setInteractive(false);
    b.update([], EMPTY, { animate: false });
    b.hideBeam();
    const reduced = b.reducedMotion;
    for (let k = 1; k <= solution.length; k++) {
      b.update(solution.slice(0, k), EMPTY, { animate: true });
      b.hideBeam();
      if (!reduced) this.ring(solution[k - 1]);
      opts.onMirror?.(k);
      await b.tweens.wait(reduced ? 0 : SOLUTION_MIRROR_MS);
    }
    if (reduced) { b.setTrace(t); return; }
    await b.tweens.wait(SOLUTION_PAUSE_MS);
    const len = beamLength(t.segments);
    const dur = Math.min(SOLUTION_MAX_MS, (len / SOLUTION_CELLS_PER_SEC) * 1000);
    const hits = hitDistances(t, b.currentPuzzle!.width);
    const lit = new Set<number>();
    await b.tweens.to(dur, (k) => {
      const d = k * len;
      this.drawProgress(t.segments, d, true);
      for (const [i, at] of hits) if (at <= d && !lit.has(i)) { lit.add(i); b.setLit(lit); opts.onHit?.(lit.size); }
    }, (k) => k);
    this.clearProgress();
    b.setTrace(t);
  }

  private drawProgress(segments: readonly Segment[], d: number, withHead: boolean) {
    const c = this.board.cellSize;
    this.glow.clear(); this.core.clear(); this.head.clear();
    drawBeam(this.glow, segments, d, c, { width: c * 0.4, alpha: 0.7 });
    drawBeam(this.core, segments, d, c, { width: Math.max(2, c * 0.09), alpha: 1 });
    drawBeam(this.core, segments, d, c, { width: Math.max(1, c * 0.035), alpha: 1, colorOverride: 0xffffff });
    if (!withHead) return;
    for (const { p, color } of pointsAt(segments, d)) {
      this.head.circle(p.x * c, p.y * c, c * 0.28).fill({ color: COLORS.beam[color], alpha: 0.9 });
      this.head.circle(p.x * c, p.y * c, c * 0.12).fill({ color: 0xffffff });
    }
  }

  /** Korte ring rond het vak waar een spiegel van de oplossing verschijnt. */
  private ring(p: Placement) {
    const b = this.board;
    const c = b.cellSize;
    const ring = new Graphics().circle(0, 0, c * 0.48).stroke({ width: 2.5, color: COLORS.accent });
    ring.position.set((p.x + 0.5) * c, (p.y + 0.5) * c);
    b.fxLayer.addChild(ring);
    void b.tweens.to(560, (k) => { ring.scale.set(0.6 + k * 0.5); ring.alpha = 1 - k; }).then(() => ring.destroy());
  }

  private celebrateOpts(o: PlayOpts) {
    return { onNote: o.onNote ?? noop, onBloom: o.onBloom ?? noop, onPerfect: o.onPerfect ?? noop };
  }

  private clearProgress() { this.glow.clear(); this.core.clear(); this.head.clear(); }
}
