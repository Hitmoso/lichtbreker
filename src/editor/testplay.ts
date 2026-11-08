import { Sound } from '../audio/sound';
import type { GameState } from '../state/game';
import { h } from '../ui/dom';
import { Round } from '../ui/round';
import { showResult } from '../ui/screens/result';
import { closeSheet } from '../ui/sheet';
import { requestAnalyse } from '../worker/client';
import type { EditorApi } from './screen';

const safeLocal = (): Storage | null => { try { return localStorage; } catch { return null; } };
let sound: Sound | null = null;

/**
 * Speelt het ontwerp zoals een speler (spiegeldok, Vuur!, viering, geluid). Niets wordt bewaard.
 * Geeft een functie terug die de test beëindigt; `onExit` wordt daarna aangeroepen.
 */
export function enterTest(api: EditorApi, onExit: () => void): () => void {
  sound ??= new Sound({ storage: safeLocal() });
  const puzzle = api.puzzle;
  let done = false;

  const exit = () => {
    if (done) return;
    done = true;
    round.deactivate();
    closeSheet();
    api.testSlot.replaceChildren();
    api.setTesting(false);
    api.bindBoard();
    onExit();
  };

  const backBtn = h('button', { class: 'btn btn-fire', type: 'button', onClick: exit }, 'Terug naar bouwen');
  const round: Round = new Round(api.board, api.announce, sound, {
    persist: () => {},
    afterFire: (g) => showResult({
      title: 'Test',
      score: g.score ?? 0,
      max: g.max,
      primary: { label: 'Terug naar bouwen', onClick: exit },
      secondary: { label: 'Bekijk beste oplossing', onClick: () => void round.showSolution() },
    }),
    idleButtons: () => [],
    doneButtons: () => [backBtn],
  });

  api.setTesting(true);
  api.board.setPaintMode(false);
  api.board.setMirrorAlpha(1);
  api.board.onTap((x, y) => round.tap(x, y));
  api.board.onCursor((x, y) => round.describe(x, y));
  api.testSlot.replaceChildren(round.dock);
  round.activate();

  const start = (max: number, solution: GameState['solution']) => {
    if (done) return;
    round.set({ number: 0, puzzle, max, solution, placements: [], submitted: false, score: null });
    api.fit();
    api.announce('Testen. Zet je spiegels en druk op Vuur!');
  };
  const known = api.analysis;
  if (known) start(known.max, known.solution);
  else {
    round.setBusy(true);
    void requestAnalyse(puzzle).result.then((a) => start(a?.max ?? 0, a?.solution ?? []));
  }
  return exit;
}
