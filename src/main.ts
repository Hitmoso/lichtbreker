import './ui/theme.css';
import { trace } from './core/beam';
import { amsterdamDate } from './core/daily';
import { BoardView } from './render/board';
import { startGame, tapCell } from './state/game';
import { defaultState } from './state/storage';
import { computeCellSize } from './ui/layout';
import { requestDaily } from './worker/client';

// Tijdelijke demo (Task 10): veld + live straal. Wordt in Task 12 vervangen door de app.
async function demo() {
  const root = document.getElementById('app')!;
  root.style.justifyContent = 'center';
  root.style.alignItems = 'center';
  const daily = await requestDaily(amsterdamDate(new Date()));
  const board = await BoardView.create(root);
  board.setReducedMotion(matchMedia('(prefers-reduced-motion: reduce)').matches);
  let g = startGame(defaultState(), daily);
  const fit = () => board.resize(computeCellSize(innerWidth, innerHeight, g.puzzle.width, g.puzzle.height, 200));
  board.setPuzzle(g.puzzle);
  fit();
  board.update(g.placements, trace(g.puzzle, g.placements), { animate: false });
  board.onTap((x, y) => {
    const r = tapCell(g, x, y);
    if (r.rejected) return board.shake(x, y);
    g = r.state;
    board.update(g.placements, trace(g.puzzle, g.placements));
  });
  addEventListener('resize', fit);
  Object.assign(window, { __lb: { get state() { return g; }, board } });
}
void demo();
