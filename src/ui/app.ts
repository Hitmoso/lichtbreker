import { trace } from '../core/beam';
import { amsterdamDate, msUntilNextPuzzle } from '../core/daily';
import { BoardView } from '../render/board';
import { resetPlacements, startGame, submit, tapCell, toSaved, type GameState } from '../state/game';
import { loadState, saveState, type SavedState } from '../state/storage';
import { requestDaily } from '../worker/client';
import './app.css';
import { h, svgIcon } from './dom';
import { computeCellSize } from './layout';
import { confirmFire } from './screens/confirm';
import { showResult } from './screens/result';
import { closeSheet } from './sheet';

function safeStorage(): Storage | null {
  try { const s = window.localStorage; s.getItem('x'); return s; } catch { return null; }
}

/** In dev kan ?date=YYYY-MM-DD een andere dag nabootsen. */
export function today(): string {
  if (import.meta.env.DEV) {
    const d = new URLSearchParams(location.search).get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  }
  return amsterdamDate(new Date());
}

export interface AppHooks {
  onHelp?: (g: GameState) => void;
  onStats?: (saved: SavedState, g: GameState) => void;
  /** Na elke (her)laadbeurt van een puzzel. */
  onPuzzle?: (ctx: AppContext) => void;
}

export interface AppContext {
  board: BoardView;
  get game(): GameState;
  get saved(): SavedState;
  setSaved(s: SavedState): void;
  reload(): Promise<void>;
}

export async function startApp(root: HTMLElement, hooks: AppHooks = {}): Promise<AppContext> {
  const storage = safeStorage();
  let saved = loadState(storage);
  let g!: GameState;
  let busy = false;
  let viewingSolution = false;
  let date = today();

  // --- opbouw ---
  const numEl = h('span', { class: 'top-num' });
  const helpBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Uitleg', onClick: () => hooks.onHelp?.(g) },
    svgIcon('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.8" r=".6" fill="currentColor"/>', 'Uitleg'));
  const statsBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Statistieken', onClick: () => hooks.onStats?.(saved, g) },
    svgIcon('<path d="M5 20V12M12 20V5M19 20v-6"/>', 'Statistieken'));
  const header = h('header', { class: 'top' },
    h('h1', { class: 'brand' }, 'Lichtbreker'), numEl, h('span', { class: 'top-spacer' }), helpBtn, statsBtn);

  const host = h('div', { class: 'board-host' });
  const loading = h('p', { class: 'loading', role: 'status' }, 'Licht wordt gebroken…');
  const stage = h('main', { class: 'stage' }, host, loading);

  const tray = h('div', { class: 'tray', role: 'img' });
  const counter = h('p', { class: 'counter', 'aria-live': 'polite' });
  const resetBtn = h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => onReset() }, 'Opnieuw');
  const fireBtn = h('button', { class: 'btn btn-fire', type: 'button', onClick: () => void onFire() }, 'Vuur!');
  const resultBtn = h('button', { class: 'btn btn-fire', type: 'button', onClick: () => openResult() }, 'Resultaat');
  const mineBtn = h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => showMine() }, 'Jouw straal');
  const actions = h('div', { class: 'actions' });
  const dock = h('footer', { class: 'dock' }, h('div', { class: 'dock-row' }, tray, counter), actions);

  root.replaceChildren(header, stage, dock);

  const board = await BoardView.create(host);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  board.setReducedMotion(motion.matches);
  motion.addEventListener?.('change', () => board.setReducedMotion(motion.matches));

  // --- weergave ---
  const persist = () => { saved = toSaved(saved, g); saveState(storage, saved); };

  const renderTray = () => {
    const left = g.puzzle.mirrors - g.placements.length;
    tray.setAttribute('aria-label', `Spiegels over: ${left} van ${g.puzzle.mirrors}`);
    if (tray.children.length !== g.puzzle.mirrors) {
      tray.replaceChildren(...Array.from({ length: g.puzzle.mirrors }, () => h('span', { class: 'tray-mirror' })));
    }
    Array.from(tray.children).forEach((el, i) => el.classList.toggle('is-used', i >= left));
  };

  const renderActions = () => {
    if (g.submitted) actions.replaceChildren(...(viewingSolution ? [mineBtn, resultBtn] : [resultBtn]));
    else actions.replaceChildren(resetBtn, fireBtn);
    resetBtn.disabled = busy || g.placements.length === 0;
    fireBtn.disabled = busy;
  };

  const renderCounter = (n?: number) => {
    if (g.submitted && n === undefined) n = g.score ?? 0;
    counter.textContent = n === undefined ? '' : `💎 ${n}`;
    counter.classList.toggle('is-visible', n !== undefined);
  };

  const fit = () => {
    if (!g) return;
    const chrome = header.offsetHeight + dock.offsetHeight + 32;
    const size = computeCellSize(root.clientWidth, root.clientHeight, g.puzzle.width, g.puzzle.height, chrome);
    board.resize(size);
  };

  const render = (animate: boolean) => {
    board.update(g.placements, trace(g.puzzle, g.placements), { animate });
    renderTray(); renderActions(); renderCounter();
  };

  // --- acties ---
  board.onTap((x, y) => {
    if (busy || g.submitted) return;
    const r = tapCell(g, x, y);
    if (r.rejected) { board.shake(x, y); navigator.vibrate?.(20); return; }
    g = r.state;
    persist();
    render(true);
  });

  const onReset = () => {
    if (busy || g.submitted) return;
    g = resetPlacements(g);
    persist();
    render(true);
  };

  const onFire = async () => {
    if (busy || g.submitted) return;
    busy = true;
    renderActions();
    const yes = await confirmFire();
    if (!yes || g.submitted) { busy = false; renderActions(); return; }
    g = submit(g);
    persist();
    board.setInteractive(false);
    renderTray();
    actions.replaceChildren();
    renderCounter(0);
    const t = trace(g.puzzle, g.placements);
    await board.fire.play(t, { perfect: (g.score ?? 0) >= g.max, onHit: (n) => renderCounter(n) });
    busy = false;
    renderActions();
    renderCounter();
    openResult();
  };

  const openResult = () => {
    showResult({ number: g.number, score: g.score ?? 0, max: g.max, onShowSolution: () => void showSolution() });
  };

  const showSolution = async () => {
    if (busy) return;
    busy = true;
    viewingSolution = true;
    actions.replaceChildren();
    await board.fire.playSolution(g.solution, trace(g.puzzle, g.solution));
    busy = false;
    renderActions();
  };

  const showMine = () => {
    if (busy) return;
    viewingSolution = false;
    render(false);
  };

  // --- laden ---
  const load = async () => {
    closeSheet();
    loading.hidden = false;
    date = today();
    const daily = await requestDaily(date);
    g = startGame(saved, daily);
    viewingSolution = false;
    busy = false;
    loading.hidden = true;
    numEl.textContent = `#${g.number}`;
    board.setPuzzle(g.puzzle);
    board.setInteractive(!g.submitted);
    renderTray(); renderActions();
    fit();
    render(false);
    persist();
    scheduleDayCheck();
    if (g.submitted) openResult();
    hooks.onPuzzle?.(ctx);
  };

  // --- dagwissel ---
  let dayTimer: ReturnType<typeof setTimeout> | undefined;
  const checkDay = () => {
    if (today() === date) return scheduleDayCheck();
    if (busy) { dayTimer = setTimeout(checkDay, 2000); return; }
    void load();
  };
  function scheduleDayCheck() {
    clearTimeout(dayTimer);
    // setTimeout tot middernacht kan uitlopen in een slapend tabblad; visibilitychange vangt dat op.
    dayTimer = setTimeout(checkDay, Math.min(msUntilNextPuzzle(new Date()) + 1000, 2 ** 31 - 1));
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });

  const ctx: AppContext = {
    board,
    get game() { return g; },
    get saved() { return saved; },
    setSaved(s) { saved = s; saveState(storage, saved); },
    reload: load,
  };

  await load();
  addEventListener('resize', fit);
  new ResizeObserver(fit).observe(root);
  return ctx;
}
