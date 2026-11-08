import './ui/theme.css';
import { decodeLevel } from './core/levelcode';
import { computeStats } from './state/stats';
import { startApp, type AppContext } from './ui/app';
import { showLevelError } from './ui/screens/levelError';
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
  // Na de tutorial kan de speler intussen van modus zijn gewisseld.
  const g = ctx.game;
  if (!g || g.submitted) return;
  const fresh = elementKinds(g.puzzle).filter((k) => !ctx.saved.seenElements.includes(k));
  if (!fresh.length) return;
  ctx.setSaved({ ...ctx.saved, seenElements: [...ctx.saved.seenElements, ...fresh] });
  await showFirstSeenTips(ctx.board, document.querySelector('.stage')!, fresh);
}

const params = new URLSearchParams(location.search);
const root = document.getElementById('app')!;

if (params.has('bouwer')) {
  // Puzzelbouwer: eigen chunk, alleen geladen als je hem opent (ook in productie).
  void import('./editor').then((m) => m.mount(root));
} else if (import.meta.env.DEV && params.has('geluid')) {
  // Geluidsproef (alleen in dev): ?geluid
  void import('./audio/proef').then((m) => m.mount());
} else {
  const code = params.get('level');
  const level = code === null ? undefined : decodeLevel(code);
  if (level === null) {
    showLevelError(root);
  } else {
    void startApp(root, {
      onHelp: (g) => showHelp(g.puzzle),
      onStats: (saved, todayNumber) => showStats(computeStats(saved.history, todayNumber), saved.endless.stats),
      onPuzzle: (ctx) => void onboarding(ctx),
    }, { level }).then((ctx) => {
      if (import.meta.env.DEV) Object.assign(window, { __lb: ctx });
    });
  }
}
