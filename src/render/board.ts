import { Application, BlurFilter, Container, FillGradient, Graphics, Rectangle } from 'pixi.js';
import type { TraceResult } from '../core/beam';
import type { BeamColor, Cell, ElementKind, MirrorKind, Placement, Puzzle } from '../core/types';
import { COLORS } from '../ui/tokens';
import { beamLength, crossedNotCounted, drawBeam, drawGlints } from './beamFx';
import { FireFx } from './fire';
import { sharedBlur } from './filters';
import { facetLines, innerPoints, outlinePoints } from './shapes';
import { Tweens, easeOut, spring } from './tween';
import { moveCursor } from '../ui/describe';

const BEAM_GROW_MS = 150;

/** Tekent de kristalvorm van een kleur (zie shapes.ts: ruit, druppel, smaragd, rond). */
export function crystalShape(g: Graphics, color: BeamColor, cx: number, cy: number, r: number): Graphics {
  return g.poly(outlinePoints(color, cx, cy, r));
}

/** Regenboog in het prisma. Eén gedeeld verloop: een nieuw verloop per prisma zou geheugen lekken. */
const SPECTRUM = new FillGradient({
  type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, textureSpace: 'local',
  colorStops: [{ offset: 0, color: COLORS.beam.red }, { offset: 0.35, color: COLORS.accent }, { offset: 0.65, color: COLORS.beam.green }, { offset: 1, color: COLORS.beam.blue }],
});

/**
 * Spiegel als lijn door het midden; '/' = -45°, '\' = +45°.
 * Jouw spiegel is licht met een zachte gloed; een vaste spiegel is doffer en zit met boutjes vast
 * (op een plaatje, zie drawCell).
 */
function mirrorGraphic(cell: number, color: number, fixed: boolean): Graphics {
  const g = new Graphics();
  const u = cell / 48;
  const h = cell * 0.354;
  if (!fixed) g.moveTo(-h, 0).lineTo(h, 0).stroke({ width: cell * 0.2, color: 0xaebcff, alpha: 0.16, cap: 'round' });
  g.moveTo(-h, 0).lineTo(h, 0).stroke({ width: Math.max(3, (fixed ? 4.6 : 5.5) * u), color, cap: 'round' });
  g.moveTo(-h * 0.7, -cell * 0.03).lineTo(h * 0.2, -cell * 0.03).stroke({ width: Math.max(1, cell * 0.022), color: 0xffffff, alpha: fixed ? 0.6 : 0.85, cap: 'round' });
  if (fixed) {
    for (const x of [-h, h]) g.circle(x, 0, Math.max(2, 3 * u)).fill({ color: COLORS.wallEdge }).stroke({ width: Math.max(1, u), color: COLORS.plate });
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
  readonly fire: FireFx;
  private plate = new Graphics();
  private elements = new Container();
  private glowCrystals = new Map<number, Graphics>();
  private crystalNodes = new Map<number, Container>();
  /** Kristallen liggen boven de straal, zodat te zien is welke wel en niet oplichten. */
  private crystalLayer = new Container();
  private dimPlates = new Map<number, Graphics>();
  private dimmed = new Set<number>();
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
  private cursor = { x: 0, y: 0 };
  private cursorGfx = new Graphics();
  private cursorCb: ((x: number, y: number) => void) | null = null;

  /** Wordt aangeroepen als de toetsenbordcursor naar een ander vak gaat. */
  onCursor(cb: (x: number, y: number) => void) { this.cursorCb = cb; }

  private paintMode = false;
  private painting: { x: number; y: number } | null = null;
  private paintCb: ((x: number, y: number, phase: 'start' | 'move' | 'end') => void) | null = null;

  /**
   * Tekenmodus (bouwer): muis/vinger gaat naar `onPaint` in plaats van `onTap`.
   * Enter/spatie op het toetsenbord roepen nog steeds `onTap` aan.
   */
  setPaintMode(on: boolean) { this.paintMode = on; this.painting = null; }
  onPaint(cb: (x: number, y: number, phase: 'start' | 'move' | 'end') => void) { this.paintCb = cb; }

  /** Doorzichtigheid van de spelersspiegels (bijv. 0.55 voor "Toon oplossing" in de bouwer). */
  setMirrorAlpha(a: number) { this.mirrorLayer.alpha = a; }

  private drawCursor() {
    const c = this.cell, { x, y } = this.cursor;
    this.cursorGfx.clear().roundRect(x * c + 2, y * c + 2, c - 4, c - 4, Math.max(4, c * 0.16)).stroke({ width: 2.5, color: COLORS.accent });
  }

  private constructor(app: Application) {
    this.app = app;
    this.tweens = new Tweens(app.ticker);
    const glowBlur = new BlurFilter({ strength: 6, quality: 3 });
    this.beamGlow.filters = [glowBlur];
    this.beamGlow.blendMode = 'add';
    this.glints.blendMode = 'add';
    this.beamLayer.addChild(this.beamGlow, this.beamCore, this.glints);
    this.root.addChild(this.plate, this.elements, this.beamLayer, this.crystalLayer, this.mirrorLayer, this.fxLayer);
    app.stage.addChild(this.root);
    this.fire = new FireFx(this);
    app.stage.eventMode = 'static';
    const cellAt = (gx: number, gy: number) => {
      if (!this.puzzle) return null;
      const x = Math.floor(gx / this.cell), y = Math.floor(gy / this.cell);
      return x >= 0 && y >= 0 && x < this.puzzle.width && y < this.puzzle.height ? { x, y } : null;
    };
    app.stage.on('pointertap', (e) => {
      if (!this.interactive || this.paintMode) return;
      const c = cellAt(e.global.x, e.global.y);
      if (c) this.tapCb?.(c.x, c.y);
    });
    // Tekenmodus (bouwer): indrukken, slepen over vakken, loslaten.
    app.stage.on('pointerdown', (e) => {
      if (!this.interactive || !this.paintMode) return;
      const c = cellAt(e.global.x, e.global.y);
      if (!c) return;
      this.painting = c;
      this.paintCb?.(c.x, c.y, 'start');
    });
    app.stage.on('pointermove', (e) => {
      if (!this.painting) return;
      const c = cellAt(e.global.x, e.global.y);
      if (!c || (c.x === this.painting.x && c.y === this.painting.y)) return;
      this.painting = c;
      this.paintCb?.(c.x, c.y, 'move');
    });
    const endPaint = () => {
      if (!this.painting) return;
      const c = this.painting;
      this.painting = null;
      this.paintCb?.(c.x, c.y, 'end');
    };
    app.stage.on('pointerup', endPaint);
    app.stage.on('pointerupoutside', endPaint);
    this.root.addChild(this.cursorGfx);
    this.cursorGfx.visible = false;
    const canvas = app.canvas;
    canvas.addEventListener('focus', () => { this.cursorGfx.visible = canvas.matches(':focus-visible'); this.drawCursor(); });
    canvas.addEventListener('blur', () => { this.cursorGfx.visible = false; });
    canvas.addEventListener('keydown', (e) => {
      if (!this.puzzle) return;
      const next = moveCursor(this.cursor, e.key, this.puzzle.width, this.puzzle.height);
      if (next) {
        e.preventDefault();
        this.cursor = next;
        this.cursorGfx.visible = true;
        this.drawCursor();
        this.cursorCb?.(next.x, next.y);
      } else if ((e.key === 'Enter' || e.key === ' ') && this.interactive) {
        e.preventDefault();
        this.cursorGfx.visible = true;
        this.tapCb?.(this.cursor.x, this.cursor.y);
      }
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
    app.canvas.setAttribute('role', 'application');
    app.canvas.setAttribute('aria-roledescription', 'speelveld');
    app.canvas.setAttribute('aria-label', 'Speelveld. Pijltjestoetsen om te bewegen, Enter of spatie om een spiegel te zetten of te draaien.');
    app.canvas.tabIndex = 0;
    host.appendChild(app.canvas);
    return new BoardView(app);
  }

  get cellSize() { return this.cell; }
  get currentPuzzle() { return this.puzzle; }
  get reducedMotion() { return this.reduced; }

  setReducedMotion(on: boolean) { this.reduced = on; this.tweens.reduced = on; }
  onTap(cb: (x: number, y: number) => void) { this.tapCb = cb; }
  setInteractive(on: boolean) { this.interactive = on; this.app.canvas.style.cursor = on ? 'pointer' : 'default'; }

  resize(cellSize: number) {
    if (cellSize === this.cell && this.puzzle) return;
    this.cell = cellSize;
    if (!this.puzzle) return;
    this.drawStatic();
    this.drawCursor();
    this.rebuildMirrors(this.currentPlacements, false);
  }

  /**
   * Nieuwe puzzel. Met `changed` (bouwer) blijft de toetsenbordcursor staan en krijgen de
   * gewijzigde vakken een korte plop (kristal veert op, zachte ring); niet bij reduced motion.
   */
  setPuzzle(p: Puzzle, opts: { changed?: readonly number[] } = {}) {
    const sameSize = this.puzzle?.width === p.width && this.puzzle?.height === p.height;
    this.puzzle = p;
    this.app.canvas.dataset.cols = String(p.width);
    this.app.canvas.dataset.rows = String(p.height);
    const edit = !!opts.changed && sameSize;
    if (!edit) this.cursor = { x: 0, y: 0 };
    // Bij een bewerking blijven brandende kristallen branden (geen flikkering); setLit werkt daarna alleen de verschillen bij.
    if (!edit) this.lit.clear();
    else for (const i of this.lit) if (p.cells[i]?.kind !== 'crystal') this.lit.delete(i);
    this.trace = null;
    this.currentPlacements = [];
    this.drawStatic();
    this.rebuildMirrors([], false);
    if (opts.changed && !this.reduced) for (const i of opts.changed) this.pop(i);
  }

  private pop(i: number) {
    if (!this.puzzle || i < 0 || i >= this.puzzle.cells.length) return;
    const { x, y } = this.center(i);
    const ring = new Graphics().circle(0, 0, this.cell * 0.42).stroke({ width: 2, color: COLORS.accent });
    ring.position.set(x, y);
    this.fxLayer.addChild(ring);
    void this.tweens.to(320, (k) => { ring.scale.set(0.6 + k * 0.6); ring.alpha = 0.8 * (1 - k); }, easeOut).then(() => ring.destroy());
    const node = this.crystalNodes.get(i);
    if (node) {
      node.pivot.set(x, y);
      node.position.set(x, y);
      void this.tweens.to(260, (k) => node.scale.set(0.6 + 0.4 * k), spring);
    }
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
    this.setDimmed(t && this.puzzle ? crossedNotCounted(t, this.puzzle) : new Set());
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

  hideBeam() { this.trace = null; this.beamGlow.clear(); this.beamCore.clear(); this.glints.clear(); this.setDimmed(new Set()); }

  /** Kristallen waar de straal doorheen gaat zonder dat ze tellen: donker plaatje erachter en half doorzichtig. */
  setDimmed(cells: ReadonlySet<number>) {
    this.dimmed = new Set(cells);
    for (const [i, node] of this.crystalNodes) {
      const on = this.dimmed.has(i);
      node.alpha = on ? 0.45 : 1;
      const plate = this.dimPlates.get(i);
      if (plate) plate.visible = on;
    }
  }

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

  destroy() { this.app.destroy({ removeView: true }); }

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
    this.crystalLayer.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    this.glowCrystals.clear();
    this.crystalNodes.clear();
    this.dimPlates.clear();
    p.cells.forEach((cell, i) => this.drawCell(cell, i));
    for (const [i, glow] of this.glowCrystals) glow.alpha = this.lit.has(i) ? 1 : 0;
    this.setDimmed(this.dimmed);
  }

  private drawCell(cell: Cell, i: number) {
    const c = this.cell;
    const { x: cx, y: cy } = this.center(i);
    const x0 = cx - c / 2, y0 = cy - c / 2;
    /** Eenheid: de icoontjes zijn getekend op een vak van 48. */
    const u = c / 48;
    switch (cell.kind) {
      case 'empty': return;
      case 'wall': {
        // Blok van metselwerk: lichte bovenrand, donkere onderrand, voegen.
        const g = new Graphics();
        g.roundRect(x0 + 5 * u, y0 + 5 * u, 38 * u, 38 * u, 6 * u).fill({ color: COLORS.wall }).stroke({ width: Math.max(1.5, 1.6 * u), color: COLORS.wallEdge });
        g.roundRect(x0 + 7.5 * u, y0 + 6.5 * u, 33 * u, 4.5 * u, 2 * u).fill({ color: 0x3a4a94, alpha: 0.7 });
        g.roundRect(x0 + 7.5 * u, y0 + 37 * u, 33 * u, 4.5 * u, 2 * u).fill({ color: COLORS.bgDeep, alpha: 0.5 });
        g.moveTo(x0 + 6 * u, cy).lineTo(x0 + 42 * u, cy)
          .moveTo(cx, y0 + 11 * u).lineTo(cx, cy)
          .moveTo(x0 + 14 * u, cy).lineTo(x0 + 14 * u, y0 + 37 * u)
          .moveTo(x0 + 34 * u, cy).lineTo(x0 + 34 * u, y0 + 37 * u)
          .stroke({ width: Math.max(1, 1.2 * u), color: COLORS.wallEdge, alpha: 0.55 });
        this.elements.addChild(g);
        return;
      }
      case 'source': {
        // Lampje met een loop in de schietrichting.
        const g = new Graphics();
        const glow = new Graphics().circle(cx, cy, c * 0.34).fill({ color: COLORS.beam.white, alpha: 0.5 });
        glow.filters = [sharedBlur(8)];
        const dx = [1, 0, -1, 0][cell.dir], dy = [0, 1, 0, -1][cell.dir];
        const bx = cx - dx * 3 * u, by = cy - dy * 3 * u;
        const nw = (dx ? 13 : 11) * u, nh = (dx ? 11 : 13) * u;
        g.roundRect(cx + dx * 12.5 * u - nw / 2, cy + dy * 12.5 * u - nh / 2, nw, nh, 2.5 * u).fill({ color: COLORS.surface }).stroke({ width: Math.max(1.5, 1.7 * u), color: COLORS.accent });
        g.circle(bx, by, 14 * u).fill({ color: COLORS.surface }).stroke({ width: Math.max(1.5, 2 * u), color: COLORS.accent });
        g.circle(bx, by, 9.5 * u).stroke({ width: Math.max(1, u), color: COLORS.accent, alpha: 0.4 });
        g.circle(bx, by, 6 * u).fill({ color: COLORS.beam.white });
        g.circle(bx - 2 * u, by - 2 * u, 1.8 * u).fill({ color: 0xffffff });
        this.elements.addChild(glow, g);
        return;
      }
      case 'crystal': {
        // Geslepen steen: doorschijnende omtrek, facetlijnen naar een helder middenvlak.
        const node = new Container();
        const col = COLORS.crystal[cell.color];
        const r = c * 0.33;
        const glow = crystalShape(new Graphics(), cell.color, cx, cy, r * 1.3).fill({ color: col, alpha: 0.9 });
        glow.filters = [sharedBlur(7)];
        glow.blendMode = 'add';
        glow.alpha = 0;
        const body = crystalShape(new Graphics(), cell.color, cx, cy, r).fill({ color: col, alpha: 0.2 }).stroke({ width: Math.max(1.5, 1.7 * u), color: col, join: 'round' });
        for (const [x1, y1, x2, y2] of facetLines(cell.color, cx, cy, r)) body.moveTo(x1, y1).lineTo(x2, y2);
        body.stroke({ width: Math.max(1, u), color: col, alpha: 0.6 });
        body.poly(innerPoints(cell.color, cx, cy, r)).fill({ color: col, alpha: 0.5 }).stroke({ width: Math.max(1, u), color: 0xffffff, alpha: 0.75, join: 'round' });
        // Donker plaatje dat de straal onder een niet-tellend kristal afdekt.
        const plate = new Graphics().circle(cx, cy, r * 1.05).fill({ color: COLORS.plate, alpha: 0.9 });
        plate.visible = false;
        node.addChild(plate, glow, body);
        this.crystalLayer.addChild(node);
        this.dimPlates.set(i, plate);
        this.glowCrystals.set(i, glow);
        this.crystalNodes.set(i, node);
        return;
      }
      case 'prism': {
        // Glazen driehoek met een regenboog erin (blijft ook klein zichtbaar).
        const g = new Graphics();
        const tri = (k: number, my: number) => [0, -16, 16, 13, -16, 13].map((v, n) => (n % 2 === 0 ? cx + v * k * u : cy + (my + (v - my) * k) * u));
        g.poly(tri(1, 0)).fill({ color: 0xffffff, alpha: 0.1 }).stroke({ width: Math.max(1.5, 1.8 * u), color: 0xffffff, join: 'round' });
        g.poly(tri(0.58, 3.3)).fill({ fill: SPECTRUM, alpha: 0.85 });
        this.elements.addChild(g);
        return;
      }
      case 'filter': {
        // Gekleurd ruitje met de kristalvorm van die kleur groot in het midden.
        const g = new Graphics();
        const col = COLORS.beam[cell.color];
        g.roundRect(x0 + 6 * u, y0 + 6 * u, 36 * u, 36 * u, 8 * u).fill({ color: col, alpha: 0.16 }).stroke({ width: Math.max(1.5, 1.7 * u), color: col });
        g.moveTo(x0 + 11 * u, y0 + 19 * u).lineTo(x0 + 19 * u, y0 + 11 * u).moveTo(x0 + 11 * u, y0 + 25 * u).lineTo(x0 + 25 * u, y0 + 11 * u)
          .stroke({ width: Math.max(1, 1.4 * u), color: 0xffffff, alpha: 0.35, cap: 'round' });
        crystalShape(g, cell.color, cx, cy, c * 0.2).fill({ color: col, alpha: 0.25 }).stroke({ width: Math.max(1.5, 2 * u), color: col, join: 'round' });
        this.elements.addChild(g);
        return;
      }
      case 'fixedMirror': {
        // Op een vierkant plaatje met boutjes: duidelijk anders dan je eigen spiegel.
        const plate = new Graphics().roundRect(x0 + 7 * u, y0 + 7 * u, 34 * u, 34 * u, 10 * u).fill({ color: COLORS.wall }).stroke({ width: Math.max(1.5, 1.6 * u), color: COLORS.wallEdge });
        const g = mirrorGraphic(c, COLORS.fixedMirror, true);
        g.position.set(cx, cy);
        g.rotation = mirrorAngle(cell.mirror);
        this.elements.addChild(plate, g);
        return;
      }
    }
  }
}
