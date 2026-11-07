import { BoardView } from '../render/board';
import type { GameState } from '../state/game';
import { loadState, saveState, type SavedState } from '../state/storage';
import './app.css';
import { h, svgIcon } from './dom';
import { fitCell } from './layout';
import { createDailyMode, type DailyMode } from './modes/daily';
import { createEndlessMode } from './modes/endless';
import type { Mode, ModeContext, ModeName } from './modes/types';
import { segmented } from './segmented';
import { closeSheet } from './sheet';

export { today } from './modes/daily';

function safeStorage(): Storage | null {
  try { const s = window.localStorage; s.getItem('x'); return s; } catch { return null; }
}

export interface AppHooks {
  onHelp?: (g: GameState) => void;
  onStats?: (saved: SavedState, todayNumber: number) => void;
  /** Na elke nieuwe puzzel in de actieve modus. */
  onPuzzle?: (ctx: AppContext) => void;
}

export interface AppContext {
  board: BoardView;
  /** Ronde van de actieve modus. */
  get game(): GameState;
  get saved(): SavedState;
  setSaved(s: SavedState): void;
  /** Dagpuzzel opnieuw laden (dagwissel). */
  reload(): Promise<void>;
  switchTo(mode: ModeName): Promise<void>;
}

export async function startApp(root: HTMLElement, hooks: AppHooks = {}): Promise<AppContext> {
  const storage = safeStorage();
  let saved = loadState(storage);

  // --- opbouw ---
  const numEl = h('span', { class: 'top-num' });
  const helpBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Uitleg', onClick: () => { const g = active.round.game; if (g) hooks.onHelp?.(g); } },
    svgIcon('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.8" r=".6" fill="currentColor"/>', 'Uitleg'));
  const statsBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Statistieken', onClick: () => hooks.onStats?.(saved, daily.number) },
    svgIcon('<path d="M5 20V12M12 20V5M19 20v-6"/>', 'Statistieken'));
  const header = h('header', { class: 'top' },
    h('h1', { class: 'brand' }, 'Lichtbreker'), numEl, h('span', { class: 'top-spacer' }), helpBtn, statsBtn);

  const host = h('div', { class: 'board-host' });
  const loading = h('p', { class: 'loading', role: 'status', hidden: true }, 'Licht wordt gebroken…');
  const stage = h('main', { class: 'stage' }, host, loading);
  const modeSwitch = segmented<ModeName>({
    label: 'Modus',
    options: [{ value: 'daily', text: 'Dagelijks' }, { value: 'endless', text: 'Oneindig' }],
    value: 'daily',
    onChange: (m) => void switchTo(m),
  });
  const controlsSlot = h('div', { class: 'mode-controls' });
  const dockSlot = h('div', { class: 'dock-slot' });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  root.replaceChildren(header, h('nav', { class: 'mode-switch' }, modeSwitch.el), controlsSlot, stage, dockSlot, live);

  const board = await BoardView.create(host);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  board.setReducedMotion(motion.matches);
  motion.addEventListener?.('change', () => board.setReducedMotion(motion.matches));

  const announce = (msg: string) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); setTimeout(() => { live.textContent = msg; }, 60); };

  const fit = () => {
    const g = active?.round.game;
    if (!g) return;
    // De stage krijgt de ruimte die kop, keuzes en dok overlaten; het veld past daar altijd in.
    board.resize(fitCell(stage.clientWidth, stage.clientHeight - 8, g.puzzle.width, g.puzzle.height));
  };

  const modeCtx: ModeContext = {
    board,
    getSaved: () => saved,
    setSaved: (s) => { saved = s; saveState(storage, saved); },
    announce,
    onPuzzle: () => hooks.onPuzzle?.(ctx),
    switchTo: (m) => void switchTo(m),
    refreshHeader: () => { numEl.textContent = active.label(); fit(); },
    fit,
    setLoading: (on) => { loading.hidden = !on; },
  };

  const daily: DailyMode = createDailyMode(modeCtx);
  const modes: Record<ModeName, Mode> = { daily, endless: createEndlessMode(modeCtx) };
  let active: Mode = daily;
  // Tijdens een animatie of laden kan er niet gewisseld worden.
  for (const m of Object.values(modes)) m.round.onBusyChange(() => modeSwitch.setDisabled(active.round.busy));

  board.onTap((x, y) => active.round.tap(x, y));
  board.onCursor((x, y) => active.round.describe(x, y));

  async function switchTo(name: ModeName) {
    const next = modes[name];
    if (next === active || active.round.busy) { modeSwitch.set(active.name); return; }
    modeSwitch.set(name);
    closeSheet();
    active.leave();
    active = next;
    controlsSlot.replaceChildren(...(next.controls ? [next.controls] : []));
    dockSlot.replaceChildren(next.round.dock);
    modeSwitch.setDisabled(next.round.busy);
    await next.enter();
  }

  const ctx: AppContext = {
    board,
    get game() { return active.round.game!; },
    get saved() { return saved; },
    setSaved: modeCtx.setSaved,
    reload: () => daily.reload(),
    switchTo,
  };

  dockSlot.replaceChildren(daily.round.dock);
  await daily.enter();
  addEventListener('resize', fit);
  new ResizeObserver(fit).observe(root);
  return ctx;
}
