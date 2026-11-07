import './ui/theme.css';
import { computeStats } from './state/stats';
import { startApp, type AppContext } from './ui/app';
import { elementKinds, showHelp } from './ui/screens/help';
import { showStats } from './ui/screens/stats';
import { showTutorial } from './ui/screens/tutorial';
import { showFirstSeenTips } from './ui/tips';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

async function onboarding(ctx: AppContext) {
  if (!ctx.saved.tutorialSeen) {
    await showTutorial(reduced());
    ctx.setSaved({ ...ctx.saved, tutorialSeen: true });
  }
  if (ctx.game.submitted) return;
  const fresh = elementKinds(ctx.game.puzzle).filter((k) => !ctx.saved.seenElements.includes(k));
  if (!fresh.length) return;
  ctx.setSaved({ ...ctx.saved, seenElements: [...ctx.saved.seenElements, ...fresh] });
  await showFirstSeenTips(ctx.board, document.querySelector('.stage')!, fresh);
}

void startApp(document.getElementById('app')!, {
  onHelp: (g) => showHelp(g.puzzle),
  onStats: (saved, g) => showStats(computeStats(saved.history, g.number)),
  onPuzzle: (ctx) => void onboarding(ctx),
}).then((ctx) => {
  if (import.meta.env.DEV) Object.assign(window, { __lb: ctx });
});
