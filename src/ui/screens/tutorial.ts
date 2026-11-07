import { fromAscii } from '../../core/ascii';
import { trace } from '../../core/beam';
import type { Placement } from '../../core/types';
import { BoardView } from '../../render/board';
import { h } from '../dom';
import { openSheet } from '../sheet';

const DEMO = fromAscii(['>..', '...', '.o.'], 1);
const MIRROR: Placement[] = [{ x: 1, y: 0, mirror: '\\' }];

const STEPS = [
  { title: 'Een laser schijnt over het veld', text: 'Elke dag een nieuw veld met kristallen, muren en soms prisma’s of kleurfilters.' },
  { title: 'Tik om een spiegel te zetten', text: 'Tik nog eens om hem te draaien, en een derde keer om hem weg te halen. De straal volgt meteen.' },
  { title: 'Raak zoveel mogelijk kristallen', text: 'Tevreden? Druk op Vuur! Pas dan zie je hoeveel er maximaal in zat.' },
];

/** Uitleg in drie stappen met een mini-veld dat zichzelf speelt. Resolvet bij sluiten. */
export async function showTutorial(reducedMotion: boolean): Promise<void> {
  const host = h('div', { class: 'tut-board' });
  const title = h('h2', { class: 'sheet-title' });
  const text = h('p', { class: 'sheet-text' });
  const dots = h('div', { class: 'tut-dots', 'aria-hidden': 'true' }, ...STEPS.map(() => h('span')));
  const next = h('button', { class: 'btn btn-fire btn-wide', type: 'button' });
  const content = h('div', { class: 'tutorial' }, host, dots, title, text, next);

  let board: BoardView | null = null;
  let step = 0;
  let loop: ReturnType<typeof setInterval> | undefined;

  return new Promise((resolve) => {
    const sheet = openSheet(content, {
      label: 'Uitleg',
      onClose: () => { clearInterval(loop); board?.destroy(); resolve(); },
    });

    const show = (i: number) => {
      step = i;
      title.textContent = STEPS[i].title;
      text.textContent = STEPS[i].text;
      next.textContent = i < STEPS.length - 1 ? 'Volgende' : 'Spelen';
      Array.from(dots.children).forEach((d, k) => d.classList.toggle('is-on', k === i));
      clearInterval(loop);
      if (!board) return;
      if (i === 0) board.update([], trace(DEMO, []));
      if (i === 1) {
        let on = false;
        const tick = () => { on = !on; const pl = on ? MIRROR : []; board!.update(pl, trace(DEMO, pl)); };
        tick();
        if (!reducedMotion) loop = setInterval(tick, 1400);
      }
      if (i === 2) {
        const t = trace(DEMO, MIRROR);
        board.update(MIRROR, t, { animate: false });
        const fire = () => void board!.fire.play(t, { perfect: true, onHit: () => {} });
        fire();
        if (!reducedMotion) loop = setInterval(fire, 3200);
      }
    };

    next.addEventListener('click', () => (step < STEPS.length - 1 ? show(step + 1) : sheet.close()));

    void BoardView.create(host).then((b) => {
      board = b;
      b.setReducedMotion(reducedMotion);
      b.setInteractive(false);
      b.setPuzzle(DEMO);
      b.resize(52);
      show(step);
    });
    show(0);
  });
}
