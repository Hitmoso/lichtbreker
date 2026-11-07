import { amsterdamDate, msUntilNextPuzzle } from '../../core/daily';
import { shareText } from '../../core/share';
import { startGame, toSaved } from '../../state/game';
import { requestDaily } from '../../worker/client';
import { h } from '../dom';
import { Round } from '../round';
import { showResult } from '../screens/result';
import { closeSheet } from '../sheet';
import type { Mode, ModeContext } from './types';

/** In dev kan ?date=YYYY-MM-DD een andere dag nabootsen. */
export function today(): string {
  if (import.meta.env.DEV) {
    const d = new URLSearchParams(location.search).get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  }
  return amsterdamDate(new Date());
}

export interface DailyMode extends Mode {
  /** Puzzelnummer van vandaag (ook als de puzzel nog laadt: 0). */
  readonly number: number;
  reload(): Promise<void>;
}

export function createDailyMode(ctx: ModeContext): DailyMode {
  let active = false;
  let loaded = false;
  let loading: Promise<void> | null = null;
  let date = today();

  const resultBtn = h('button', { class: 'btn btn-fire', type: 'button', onClick: () => openResult() }, 'Resultaat');
  const mineBtn = h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => round.showMine() }, 'Jouw straal');

  const round: Round = new Round(ctx.board, ctx.announce, {
    persist: (g) => ctx.setSaved(toSaved(ctx.getSaved(), g)),
    afterFire: () => openResult(),
    idleButtons: () => [],
    doneButtons: (viewing) => (viewing ? [mineBtn, resultBtn] : [resultBtn]),
  });

  const openResult = () => {
    const g = round.game;
    if (!g) return;
    const score = g.score ?? 0;
    showResult({
      title: `Lichtbreker #${g.number}`,
      score,
      max: g.max,
      share: shareText(g.number, score, g.max),
      secondary: { label: 'Bekijk beste oplossing', onClick: () => void round.showSolution() },
      extra: [{ label: 'Meer spelen', onClick: () => ctx.switchTo('endless') }],
      countdown: true,
    });
  };

  const load = async () => {
    if (active) closeSheet();
    round.setBusy(true);
    if (active) ctx.setLoading(true);
    date = today();
    const daily = await requestDaily(date);
    ctx.setLoading(false);
    if (active) closeSheet();
    const g = startGame(ctx.getSaved(), daily);
    round.set(g);
    ctx.setSaved(toSaved(ctx.getSaved(), g));
    loaded = true;
    scheduleDayCheck();
    if (active) {
      ctx.refreshHeader();
      if (g.submitted) openResult();
      ctx.onPuzzle();
    }
  };
  const ensureLoaded = () => (loaded ? Promise.resolve() : (loading ??= load()));

  // --- dagwissel ---
  let dayTimer: ReturnType<typeof setTimeout> | undefined;
  const checkDay = () => {
    if (!loaded || today() === date) return scheduleDayCheck();
    if (round.busy) { dayTimer = setTimeout(checkDay, 2000); return; }
    void load();
  };
  function scheduleDayCheck() {
    clearTimeout(dayTimer);
    // setTimeout tot middernacht kan uitlopen in een slapend tabblad; visibilitychange vangt dat op.
    dayTimer = setTimeout(checkDay, Math.min(msUntilNextPuzzle(new Date()) + 1000, 2 ** 31 - 1));
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });

  return {
    name: 'daily',
    round,
    controls: null,
    get number() { return round.game?.number ?? 0; },
    label: () => (round.game ? `#${round.game.number}` : ''),
    async enter() {
      active = true;
      round.activate();
      ctx.refreshHeader();
      if (!loaded) {
        await ensureLoaded();
      } else {
        ctx.fit();
      }
    },
    leave() {
      active = false;
      round.deactivate();
    },
    reload: load,
  };
}
