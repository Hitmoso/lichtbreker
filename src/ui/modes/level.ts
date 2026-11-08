import type { Puzzle } from '../../core/types';
import type { GameState } from '../../state/game';
import { requestAnalyse } from '../../worker/client';
import { h } from '../dom';
import { Round } from '../round';
import { showResult } from '../screens/result';
import type { Mode, ModeContext } from './types';

/** Naar de gewone site (zonder ?level=). */
export const goHome = () => { location.href = location.pathname; };

/** Een gedeeld level (?level=…): spelen zoals altijd, maar niets wordt bewaard. */
export function createLevelMode(ctx: ModeContext, puzzle: Puzzle): Mode {
  let active = false;
  let loaded = false;

  const openResult = () => {
    const g = round.game;
    if (!g) return;
    showResult({
      title: 'Eigen level',
      score: g.score ?? 0,
      max: g.max,
      primary: { label: 'Naar het spel', onClick: goHome },
      secondary: { label: 'Bekijk beste oplossing', onClick: () => void round.showSolution() },
    });
  };
  const resultBtn = h('button', { class: 'btn btn-fire', type: 'button', onClick: () => openResult() }, 'Resultaat');

  const round: Round = new Round(ctx.board, ctx.announce, ctx.sfx, {
    persist: () => {},
    afterFire: () => openResult(),
    idleButtons: () => [],
    doneButtons: () => [resultBtn],
  });

  const load = async () => {
    round.setBusy(true);
    ctx.setLoading(true);
    const a = await requestAnalyse(puzzle).result;
    ctx.setLoading(false);
    const g: GameState = { number: 0, puzzle, max: a?.max ?? 0, solution: a?.solution ?? [], placements: [], submitted: false, score: null };
    round.set(g);
    loaded = true;
    if (active) { ctx.refreshHeader(); ctx.onPuzzle(); }
  };

  return {
    name: 'level',
    round,
    controls: null,
    label: () => 'Eigen level',
    async enter() {
      active = true;
      round.activate();
      ctx.refreshHeader();
      if (!loaded) await load();
      else ctx.fit();
    },
    leave() {
      active = false;
      round.deactivate();
    },
  };
}
