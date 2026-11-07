import { Application, BlurFilter, Container, Graphics, Rectangle } from 'pixi.js';
import type { TraceResult } from '../core/beam';
import type { BeamColor, Cell, ElementKind, MirrorKind, Placement, Puzzle } from '../core/types';
import { COLORS } from '../ui/tokens';
import { beamLength, drawBeam, drawGlints } from './beamFx';
import { Tweens, easeOut, spring } from './tween';

const BEAM_GROW_MS = 150;

/** Tekent een kristalvorm per kleur (vorm-onderscheid voor kleurenblinden). */
export function crystalShape(g: Graphics, color: BeamColor, cx: number, cy: number, r: number): Graphics {
  switch (color) {
    case 'white': return g.poly([cx, cy - r, cx + r * 0.75, cy, cx, cy + r, cx - r * 0.75, cy]);
    case 'red': return g.poly([cx, cy - r, cx + r * 0.95, cy + r * 0.7, cx - r * 0.95, cy + r * 0.7]);
    case 'green': {
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      return g.poly(pts);
    }
    case 'blue': return g.circle(cx, cy, r * 0.85);
  }
}

/** Spiegel als lijn door het midden; '/' = -45°, '\' = +45°. */
function mirrorGraphic(cell: number, color: number, fixed: boolean): Graphics {
  const g = new Graphics();
  const h = cell * 0.36;
  g.moveTo(-h, 0).lineTo(h, 0).stroke({ width: Math.max(3, cell * 0.09), color, cap: 'round' });
  g.moveTo(-h * 0.7, -cell * 0.03).lineTo(h * 0.2, -cell * 0.03).stroke({ width: Math.max(1, cell * 0.02), color: 0xffffff, alpha: 0.7, cap: 'round' });
  if (fixed) {
    for (const x of [-h, h]) g.circle(x, 0, Math.max(2, cell * 0.05)).fill({ color: COLORS.wallEdge });
  }
  return g;
}
const mirrorAngle = (m: MirrorKind) => (m === '/' ? -Math.PI / 4 : Math.PI / 4);

export class BoardView {
  readonly app: Application;
  readonly tweens: Tweens;
  /** Wortel van het veld; FireFx tekent ook hierin. */
  readonly root = new Container();
  readonly beamLayer = new Container();
  readonly fxLayer = new Container();
  private plate = new Graphics();
  private elements = new Container();
  private glowCrystals = new Map<number, Graphics>();
  private crystalNodes = new Map<number, Container>();
  private mirrorNodes = new Map<number, Container>();
  private mirrorLayer = new Container();
  private beamGlow = new Graphics();
  private beamCore = new Graphics();
  private glints = new Graphics();
  private puzzle: Puzzle | null = null;
  private cell = 48;
  private trace: TraceResult | null = null;
  private progress = Infinity;
  private phase = 0;
  private tapCb: ((x: number, y: number) => void) | null = null;
  private interactive = true;
  private reduced = false;
  private lit = new Set<number>();

  private constructor(app: Application) {
    this.app = app;
    this.tweens = new Tweens(app.ticker);
    const glowBlur = new BlurFilter({ strength: 6, quality: 3 });
    this.beamGlow.filters = [glowBlur];
    this.beamGlow.blendMode = 'add';
    this.glints.blendMode = 'add';
    this.beamLayer.addChild(this.beamGlow, this.beamCore, this.glints);
    this.root.addChild(this.plate, this.elements, this.beamLayer, this.mirrorLayer, this.fxLayer);
    app.stage.addChild(this.root);
    app.stage.eventMode = 'static';
    app.stage.on('pointertap', (e) => {
      if (!this.interactive || !this.puzzle) return;
      const x = Math.floor(e.global.x / this.cell), y = Math.floor(e.global.y / this.cell);
      if (x >= 0 && y >= 0 && x < this.puzzle.width && y < this.puzzle.height) this.tapCb?.(x, y);
    });
    app.ticker.add((t) => {
      if (!this.trace) return;
      if (!this.reduced) this.phase += t.deltaMS / 1000 * 1.8;
      this.redrawBeam();
    });
  }

  static async create(host: HTMLElement): Promise<BoardView> {
    const app = new Application();
    await app.init({
      backgroundAlpha: 0, antialias: true, autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2), width: 300, height: 300,
    });
    app.canvas.style.display = 'block';
    app.canvas.setAttribute('aria-label', 'Speelveld');
    host.appendChild(app.canvas);
    return new BoardView(app);
  }

  get cellSize() { return this.cell; }

  setReducedMotion(on: boolean) { this.reduced = on; this.tweens.reduced = on; }
  onTap(cb: (x: number, y: number) => void) { this.tapCb = cb; }
  setInteractive(on: boolean) { this.interactive = on; this.app.canvas.style.cursor = on ? 'pointer' : 'default'; }

  resize(cellSize: number) {
    this.cell = cellSize;
    if (!this.puzzle) return;
    this.drawStatic();
    this.rebuildMirrors(this.currentPlacements, false);
  }

  setPuzzle(p: Puzzle) {
    this.puzzle = p;
    this.currentPlacements = [];
    this.lit.clear();
    this.trace = null;
    this.drawStatic();
    this.rebuildMirrors([], false);
  }

  private currentPlacements: Placement[] = [];

  /** Nieuwe spiegels + straal. Spiegels animeren alleen wat veranderd is. */
  update(placements: readonly Placement[], t: TraceResult, opts: { animate?: boolean } = {}) {
    const animate = opts.animate ?? true;
    const prev = new Map(this.currentPlacements.map((p) => [this.idx(p.x, p.y), p.mirror]));
    this.currentPlacements = [...placements];
    const next = new Map(placements.map((p) => [this.idx(p.x, p.y), p.mirror]));
    for (const [i, node] of this.mirrorNodes) {
      if (!next.has(i)) {
        this.mirrorNodes.delete(i);
        if (animate && !this.reduced) {
          void this.tweens.to(120, (k) => { node.scale.set(1 - k); node.alpha = 1 - k; }).then(() => node.destroy({ children: true }));
        } else node.destroy({ children: true });
      }
    }
    for (const [i, m] of next) {
      const old = prev.get(i);
      const node = this.mirrorNodes.get(i);
      if (!node) {
        const n = this.makeMirror(i, m);
        if (animate && !this.reduced) void this.tweens.to(260, (k) => n.scale.set(k), spring);
      } else if (old !== m) {
        const from = mirrorAngle(old!), to = from + Math.PI / 2;
        if (animate && !this.reduced) void this.tweens.to(180, (k) => { node.rotation = from + (to - from) * k; }, easeOut);
        else node.rotation = mirrorAngle(m);
      }
    }
    this.setTrace(t, animate);
  }

  /** Alleen de straal (voor herstel na indienen of tijdens animaties). */
  setTrace(t: TraceResult | null, animate = false) {
    this.trace = t;
    if (t && animate && !this.reduced) {
      const len = beamLength(t.segments);
      this.progress = 0;
      void this.tweens.to(BEAM_GROW_MS, (k) => { this.progress = k * len; });
    } else this.progress = Infinity;
    this.setLit(t ? t.hit : new Set());
  }

  /** Zet de gloed van kristallen (geanimeerd). */
  setLit(hit: ReadonlySet<number>, animate = true) {
    for (const [i, glow] of this.glowCrystals) {
      const on = hit.has(i);
      if (on === this.lit.has(i)) continue;
      const from = glow.alpha, to = on ? 1 : 0;
      if (animate && !this.reduced) void this.tweens.to(220, (k) => { glow.alpha = from + (to - from) * k; });
      else glow.alpha = to;
    }
    this.lit = new Set(hit);
  }

  hideBeam() { this.trace = null; this.beamGlow.clear(); this.beamCore.clear(); this.glints.clear(); }

  crystalNode(i: number) { return this.crystalNodes.get(i); }
  center(i: number) { const w = this.puzzle!.width; return { x: ((i % w) + 0.5) * this.cell, y: (Math.floor(i / w) + 0.5) * this.cell }; }

  shake(x: number, y: number) {
    const i = this.idx(x, y);
    const flash = new Graphics().roundRect(x * this.cell + 3, y * this.cell + 3, this.cell - 6, this.cell - 6, 6).fill({ color: COLORS.beam.red, alpha: 0.35 });
    this.fxLayer.addChild(flash);
    void this.tweens.to(260, (k) => { flash.alpha = 1 - k; }).then(() => flash.destroy());
    if (this.reduced) return;
    const target = this.mirrorNodes.get(i) ?? this.root;
    const base = target.x;
    void this.tweens.to(280, (k) => { target.x = base + Math.sin(k * Math.PI * 6) * (1 - k) * 5; }, (k) => k).then(() => { target.x = base; });
  }

  /** Eén subtiele puls rond alle elementen van deze soort. */
  pulse(kind: ElementKind) {
    if (!this.puzzle) return;
    this.puzzle.cells.forEach((c, i) => {
      if (c.kind !== kind) return;
      const { x, y } = this.center(i);
      const ring = new Graphics().circle(0, 0, this.cell * 0.45).stroke({ width: 2, color: COLORS.accent });
      ring.position.set(x, y);
      this.fxLayer.addChild(ring);
      const d = this.reduced ? 0 : 1100;
      void this.tweens.to(d, (k) => { ring.scale.set(0.7 + k * 0.6); ring.alpha = Math.sin(k * Math.PI); }).then(() => ring.destroy());
    });
  }

  destroy() { this.app.destroy(true, { children: true }); }

  // --- intern ---

  private idx(x: number, y: number) { return y * this.puzzle!.width + x; }

  private makeMirror(i: number, m: MirrorKind): Container {
    const n = new Container();
    n.addChild(mirrorGraphic(this.cell, COLORS.mirror, false));
    const { x, y } = this.center(i);
    n.position.set(x, y);
    n.rotation = mirrorAngle(m);
    this.mirrorLayer.addChild(n);
    this.mirrorNodes.set(i, n);
    return n;
  }

  private rebuildMirrors(placements: readonly Placement[], animate: boolean) {
    for (const n of this.mirrorNodes.values()) n.destroy({ children: true });
    this.mirrorNodes.clear();
    for (const p of placements) {
      const n = this.makeMirror(this.idx(p.x, p.y), p.mirror);
      if (animate) n.scale.set(0);
    }
  }

  private redrawBeam() {
    const t = this.trace;
    this.beamGlow.clear(); this.beamCore.clear(); this.glints.clear();
    if (!t) return;
    const c = this.cell;
    drawBeam(this.beamGlow, t.segments, this.progress, c, { width: c * 0.32, alpha: 0.55 });
    drawBeam(this.beamCore, t.segments, this.progress, c, { width: Math.max(2, c * 0.07), alpha: 1 });
    drawBeam(this.beamCore, t.segments, this.progress, c, { width: Math.max(1, c * 0.025), alpha: 0.9, colorOverride: 0xffffff });
    if (!this.reduced && this.progress === Infinity) drawGlints(this.glints, t.segments, this.phase, c);
  }

  private drawStatic() {
    const p = this.puzzle!;
    const c = this.cell;
    const W = p.width * c, H = p.height * c;
    this.app.renderer.resize(W, H);
    this.app.stage.hitArea = new Rectangle(0, 0, W, H);

    const g = this.plate.clear();
    g.roundRect(0.5, 0.5, W - 1, H - 1, Math.min(18, c * 0.35)).fill({ color: COLORS.plate, alpha: 0.85 }).stroke({ width: 1, color: COLORS.etch, alpha: 0.9 });
    for (let y = 1; y < p.height; y++) {
      for (let x = 1; x < p.width; x++) g.circle(x * c, y * c, Math.max(1, c * 0.025)).fill({ color: COLORS.etch });
    }

    this.elements.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    this.glowCrystals.clear();
    this.crystalNodes.clear();
    p.cells.forEach((cell, i) => this.drawCell(cell, i));
    for (const [i, glow] of this.glowCrystals) glow.alpha = this.lit.has(i) ? 1 : 0;
  }

  private drawCell(cell: Cell, i: number) {
    const c = this.cell;
    const { x: cx, y: cy } = this.center(i);
    const x0 = cx - c / 2, y0 = cy - c / 2;
    switch (cell.kind) {
      case 'empty': return;
      case 'wall': {
        const g = new Graphics();
        g.roundRect(x0 + 3, y0 + 3, c - 6, c - 6, Math.max(3, c * 0.12)).fill({ color: COLORS.wall });
        g.moveTo(x0 + 8, y0 + 4.5).lineTo(x0 + c - 8, y0 + 4.5).stroke({ width: 1.5, color: COLORS.wallEdge });
        this.elements.addChild(g);
        return;
      }
      case 'source': {
        const g = new Graphics();
        const glow = new Graphics().circle(cx, cy, c * 0.34).fill({ color: COLORS.beam.white, alpha: 0.5 });
        glow.filters = [new BlurFilter({ strength: 8 })];
        const dx = [1, 0, -1, 0][cell.dir], dy = [0, 1, 0, -1][cell.dir];
        g.roundRect(cx - c * 0.3, cy - c * 0.3, c * 0.6, c * 0.6, c * 0.18).fill({ color: COLORS.surface }).stroke({ width: 2, color: COLORS.accent });
        g.circle(cx + dx * c * 0.12, cy + dy * c * 0.12, c * 0.1).fill({ color: COLORS.beam.white });
        this.elements.addChild(glow, g);
        return;
      }
      case 'crystal': {
        const node = new Container();
        const r = c * 0.26;
        const glow = crystalShape(new Graphics(), cell.color, cx, cy, r * 1.5).fill({ color: COLORS.crystal[cell.color], alpha: 0.9 });
        glow.filters = [new BlurFilter({ strength: 7 })];
        glow.blendMode = 'add';
        glow.alpha = 0;
        const body = crystalShape(new Graphics(), cell.color, cx, cy, r).fill({ color: COLORS.crystal[cell.color], alpha: 0.28 }).stroke({ width: 2, color: COLORS.crystal[cell.color], alpha: 0.95 });
        node.addChild(glow, body);
        this.elements.addChild(node);
        this.glowCrystals.set(i, glow);
        this.crystalNodes.set(i, node);
        return;
      }
      case 'prism': {
        const g = new Graphics();
        const r = c * 0.32;
        const pts = [cx, cy - r, cx + r * 0.95, cy + r * 0.7, cx - r * 0.95, cy + r * 0.7];
        g.poly(pts).fill({ color: 0xffffff, alpha: 0.08 }).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
        const spectrum = [COLORS.beam.red, COLORS.accent, COLORS.beam.green, COLORS.beam.blue];
        spectrum.forEach((col, k) => {
          const t = (k + 1) / (spectrum.length + 1);
          g.moveTo(cx - r * 0.5 + t * r * 0.2, cy + r * 0.45 - t * r * 0.9).lineTo(cx + r * 0.1 + t * r * 0.5, cy + r * 0.45 - t * r * 0.3)
            .stroke({ width: 1.5, color: col, alpha: 0.8, cap: 'round' });
        });
        this.elements.addChild(g);
        return;
      }
      case 'filter': {
        const g = new Graphics();
        const col = COLORS.beam[cell.color];
        g.roundRect(x0 + 6, y0 + 6, c - 12, c - 12, Math.max(4, c * 0.16)).fill({ color: col, alpha: 0.18 }).stroke({ width: 2, color: col, alpha: 0.8 });
        crystalShape(g, cell.color, cx, cy, c * 0.1).fill({ color: col, alpha: 0.9 });
        this.elements.addChild(g);
        return;
      }
      case 'fixedMirror': {
        const g = mirrorGraphic(c, COLORS.fixedMirror, true);
        g.position.set(cx, cy);
        g.rotation = mirrorAngle(cell.mirror);
        this.elements.addChild(g);
        return;
      }
    }
  }
}
