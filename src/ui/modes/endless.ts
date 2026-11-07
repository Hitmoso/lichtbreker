import { DIFFICULTY_LEVELS, DIFFICULTY_NAMES, type Difficulty } from '../../config';
import { recordEndlessResult, type EndlessCurrent, type EndlessState } from '../../state/endless';
import { resumeGame } from '../../state/game';
import { requestEndless } from '../../worker/client';
import { h } from '../dom';
import { Round } from '../round';
import { confirmSkip } from '../screens/confirm';
import { showResult } from '../screens/result';
import { segmented } from '../segmented';
import type { Mode, ModeContext } from './types';

/** Willekeurige 32-bit seed (alleen in de UI-laag; de kern blijft voorspelbaar). */
export function newSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}

export function createEndlessMode(ctx: ModeContext): Mode {
  let active = false;
  let started = false;
  let request = 0;
  let pending = false;

  const getE = (): EndlessState => ctx.getSaved().endless;
  const setE = (e: EndlessState) => ctx.setSaved({ ...ctx.getSaved(), endless: e });

  const level = segmented<Difficulty>({
    label: 'Moeilijkheid',
    size: 'small',
    options: DIFFICULTY_LEVELS.map((d) => ({ value: d, text: DIFFICULTY_NAMES[d] })),
    value: getE().difficulty,
    onChange: (d) => void changeLevel(d),
  });
  const controls = h('div', { class: 'endless-controls' }, level.el);

  const skipBtn = h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => void skip() }, 'Overslaan');
  const nextBtn = h('button', { class: 'btn btn-fire', type: 'button', onClick: () => void next() }, 'Volgende puzzel');

  const round: Round = new Round(ctx.board, ctx.announce, {
    persist: (g) => {
      const e = getE();
      if (!e.current) return;
      let updated: EndlessState = { ...e, current: { ...e.current, placements: g.placements, submitted: g.submitted } };
      // Statistieken bij het indienen zelf, zodat herladen tijdens de animatie niets kwijtraakt.
      if (g.submitted && !e.current.submitted) updated = recordEndlessResult(updated, e.current.difficulty, g.score ?? 0, g.max);
      setE(updated);
    },
    afterFire: () => openResult(),
    idleButtons: () => [skipBtn],
    doneButtons: () => [nextBtn],
  });
  round.onBusyChange((busy) => level.setDisabled(busy));

  const openResult = () => {
    const g = round.game;
    const cur = getE().current;
    if (!g || !cur) return;
    showResult({
      title: `Oneindig, ${DIFFICULTY_NAMES[cur.difficulty]}`,
      score: g.score ?? 0,
      max: g.max,
      primary: { label: 'Volgende puzzel', onClick: () => void next() },
      secondary: { label: 'Bekijk beste oplossing', onClick: () => void round.showSolution() },
    });
  };

  async function show(cur: EndlessCurrent) {
    const id = ++request;
    round.setBusy(true);
    if (active) ctx.setLoading(true);
    const gen = await requestEndless(cur.seed, cur.difficulty);
    if (id !== request) return;
    ctx.setLoading(false);
    setE({ ...getE(), current: cur });
    level.set(cur.difficulty);
    round.set(resumeGame({ number: 0, puzzle: gen.puzzle, max: gen.max, solution: gen.solution }, cur.placements, cur.submitted));
    if (active) {
      ctx.refreshHeader();
      ctx.onPuzzle();
    }
  }

  /** Nieuwe puzzel op het gekozen niveau. Een tweede aanroep tijdens het laden doet niets. */
  async function next() {
    if (pending) return;
    pending = true;
    try {
      await show({ difficulty: getE().difficulty, seed: newSeed(), placements: [], submitted: false });
    } finally {
      pending = false;
    }
  }

  /** Lopende puzzel met spiegels verlaten? Eerst vragen. */
  async function mayLeave(): Promise<boolean> {
    const g = round.game;
    if (!g || g.submitted || g.placements.length === 0) return true;
    return confirmSkip();
  }

  async function skip() {
    if (round.busy || pending) return;
    if (await mayLeave()) await next();
  }

  async function changeLevel(d: Difficulty) {
    const before = getE().difficulty;
    if (round.busy || pending || !(await mayLeave())) { level.set(before); return; }
    setE({ ...getE(), difficulty: d });
    await next();
  }

  return {
    name: 'endless',
    round,
    controls,
    label: () => '∞',
    async enter() {
      active = true;
      round.activate();
      ctx.refreshHeader();
      if (!started) {
        started = true;
        const cur = getE().current;
        await (cur ? show(cur) : next());
      } else {
        ctx.fit();
      }
    },
    leave() {
      active = false;
      round.deactivate();
    },
  };
}
