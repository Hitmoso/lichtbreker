import { trace } from '../core/beam';
import type { BoardView } from '../render/board';
import { resetPlacements, submit, tapCell, type GameState } from '../state/game';
import { h } from './dom';
import { describeCell } from './describe';
import { confirmFire } from './screens/confirm';

export interface RoundHooks {
  /** Na elke wijziging van de ronde (plaatsen, wissen, indienen). */
  persist(g: GameState): void;
  /** Na de vuur-animatie: bijv. het resultaatpaneel openen. */
  afterFire(g: GameState): void;
  /** Extra knoppen vóór Opnieuw/Vuur! (bijv. Overslaan). */
  idleButtons(): HTMLElement[];
  /** Knoppen na indienen (bijv. Resultaat of Volgende puzzel). */
  doneButtons(viewingSolution: boolean): HTMLElement[];
}

/**
 * Eén speelronde: voorraad, teller, Opnieuw/Vuur!, vuur-animatie en beste oplossing.
 * Kent geen dagen of niveaus. Het veld (BoardView) wordt gedeeld; alleen de actieve ronde tekent erop.
 */
export class Round {
  readonly dock: HTMLElement;
  private tray = h('div', { class: 'tray', role: 'img' });
  private counter = h('p', { class: 'counter', 'aria-live': 'polite' });
  private actions = h('div', { class: 'actions' });
  private resetBtn = h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => this.reset() }, 'Opnieuw');
  private fireBtn = h('button', { class: 'btn btn-fire', type: 'button', onClick: () => void this.fire() }, 'Vuur!');
  private g: GameState | null = null;
  private isBusy = false;
  private viewing = false;
  private active = false;

  constructor(private board: BoardView, private announce: (msg: string) => void, private hooks: RoundHooks) {
    this.dock = h('footer', { class: 'dock' }, h('div', { class: 'dock-row' }, this.tray, this.counter), this.actions);
  }

  get game(): GameState | null { return this.g; }
  get busy(): boolean { return this.isBusy; }
  get viewingSolution(): boolean { return this.viewing; }

  /** Nieuwe of hervatte ronde. Tekent op het veld als deze ronde actief is. */
  set(g: GameState): void {
    this.g = g;
    this.viewing = false;
    this.isBusy = false;
    if (this.active) this.takeBoard();
    this.refresh();
  }

  /** Laden of iets anders bezig: knoppen en veld uit. */
  setBusy(on: boolean): void {
    this.isBusy = on;
    if (on) this.actions.replaceChildren();
    if (this.active) this.board.setInteractive(!on && !!this.g && !this.g.submitted);
    if (!on) this.refresh();
  }

  activate(): void {
    this.active = true;
    if (this.g) this.takeBoard();
  }

  deactivate(): void { this.active = false; }

  /** Dok opnieuw tekenen. */
  refresh(): void {
    if (!this.g) return;
    this.renderTray();
    this.renderActions();
    this.renderCounter();
  }

  tap(x: number, y: number): void {
    const g = this.g;
    if (!g || this.isBusy || g.submitted) return;
    const r = tapCell(g, x, y);
    if (r.rejected) {
      this.board.shake(x, y);
      navigator.vibrate?.(20);
      const empty = g.puzzle.cells[y * g.puzzle.width + x].kind === 'empty';
      this.announce(empty ? 'Geen spiegels meer over. Tik op een spiegel om hem te draaien of weg te halen.' : 'Hier kan geen spiegel.');
      return;
    }
    this.change(r.state, true);
    this.announce(`${describeCell(r.state.puzzle, r.state.placements, x, y)}. De straal raakt nu ${trace(r.state.puzzle, r.state.placements).score} kristallen.`);
  }

  describe(x: number, y: number): void {
    if (this.g) this.announce(describeCell(this.g.puzzle, this.g.placements, x, y));
  }

  reset(): void {
    if (!this.g || this.isBusy || this.g.submitted) return;
    this.change(resetPlacements(this.g), true);
  }

  async fire(): Promise<void> {
    const start = this.g;
    if (!start || this.isBusy || start.submitted) return;
    this.isBusy = true;
    this.renderActions();
    const yes = await confirmFire();
    // Intussen een andere ronde geladen (dagwissel, overslaan)? Dan niets indienen.
    if (this.g !== start) return;
    if (!yes) { this.isBusy = false; this.renderActions(); return; }
    const g = submit(start);
    this.g = g;
    this.hooks.persist(g);
    this.board.setInteractive(false);
    this.renderTray();
    this.actions.replaceChildren();
    this.renderCounter(0);
    await this.board.fire.play(trace(g.puzzle, g.placements), { perfect: (g.score ?? 0) >= g.max, onHit: (n) => this.renderCounter(n) });
    if (this.g !== g) return;
    this.isBusy = false;
    this.refresh();
    this.hooks.afterFire(g);
  }

  async showSolution(): Promise<void> {
    const g = this.g;
    if (!g || this.isBusy) return;
    this.isBusy = true;
    this.viewing = true;
    this.actions.replaceChildren();
    await this.board.fire.playSolution(g.solution, trace(g.puzzle, g.solution));
    if (this.g !== g) return;
    this.isBusy = false;
    this.refresh();
  }

  showMine(): void {
    if (!this.g || this.isBusy) return;
    this.viewing = false;
    this.render(false);
  }

  // --- intern ---

  private change(g: GameState, animate: boolean) {
    this.g = g;
    this.hooks.persist(g);
    this.render(animate);
  }

  private takeBoard() {
    const g = this.g!;
    this.board.setPuzzle(g.puzzle);
    this.board.setInteractive(!this.isBusy && !g.submitted);
    this.render(false);
  }

  private render(animate: boolean) {
    const g = this.g!;
    if (this.active) {
      const pl = this.viewing ? g.solution : g.placements;
      this.board.update(pl, trace(g.puzzle, pl), { animate });
    }
    this.refresh();
  }

  private renderTray() {
    const g = this.g!;
    const left = g.puzzle.mirrors - g.placements.length;
    this.tray.setAttribute('aria-label', `Spiegels over: ${left} van ${g.puzzle.mirrors}`);
    if (this.tray.children.length !== g.puzzle.mirrors) {
      this.tray.replaceChildren(...Array.from({ length: g.puzzle.mirrors }, () => h('span', { class: 'tray-mirror' })));
    }
    Array.from(this.tray.children).forEach((el, i) => el.classList.toggle('is-used', i >= left));
  }

  private renderActions() {
    const g = this.g!;
    if (g.submitted) this.actions.replaceChildren(...this.hooks.doneButtons(this.viewing));
    else this.actions.replaceChildren(...this.hooks.idleButtons(), this.resetBtn, this.fireBtn);
    this.actions.classList.toggle('has-extra', !g.submitted && this.hooks.idleButtons().length > 0);
    this.resetBtn.disabled = this.isBusy || g.placements.length === 0;
    this.fireBtn.disabled = this.isBusy;
  }

  private renderCounter(n?: number) {
    const g = this.g!;
    if (g.submitted && n === undefined) n = this.viewing ? g.max : (g.score ?? 0);
    this.counter.textContent = n === undefined ? '' : `💎 ${n}`;
    this.counter.classList.toggle('is-visible', n !== undefined);
  }
}
