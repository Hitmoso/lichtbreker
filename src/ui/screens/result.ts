import { msUntilNextPuzzle } from '../../core/daily';
import { shareText } from '../../core/share';
import { h } from '../dom';
import { shareResult } from '../share';
import { openSheet, type SheetHandle } from '../sheet';

export const formatCountdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

function verdict(score: number, max: number): string {
  if (score >= max) return 'Maximaal. Elk haalbaar kristal licht op.';
  const diff = max - score;
  return diff === 1 ? 'Er zat nog één kristal meer in.' : `Er zaten nog ${diff} kristallen meer in.`;
}

export function showResult(opts: { number: number; score: number; max: number; onShowSolution: () => void; onClose?: () => void }): SheetHandle {
  const { number, score, max } = opts;
  const status = h('p', { class: 'share-status', role: 'status', 'aria-live': 'polite' });
  const countdown = h('span', { class: 'countdown-time' }, formatCountdown(msUntilNextPuzzle(new Date())));
  const timer = setInterval(() => { countdown.textContent = formatCountdown(msUntilNextPuzzle(new Date())); }, 1000);

  const share = async () => {
    const r = await shareResult(shareText(number, score, max));
    status.textContent = r === 'copied' ? 'Gekopieerd!' : r === 'failed' ? 'Kopiëren lukte niet' : '';
  };

  const content = h('div', { class: 'result' },
    h('p', { class: 'result-label' }, `Lichtbreker #${number}`),
    h('p', { class: 'result-score', 'aria-label': `${score} van de ${max} kristallen` },
      h('span', { class: 'result-mine' }, String(score)), h('span', { class: 'result-slash' }, ' / '), h('span', { class: 'result-max' }, String(max))),
    h('p', { class: 'sheet-text' }, verdict(score, max)),
    h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => { sheet.close(); opts.onShowSolution(); } }, 'Bekijk beste oplossing'),
      h('button', { class: 'btn btn-fire', type: 'button', onClick: share }, 'Deel'),
    ),
    status,
    h('p', { class: 'countdown' }, 'Volgende puzzel over ', countdown),
  );
  const sheet = openSheet(content, { label: 'Resultaat', dismissable: true, onClose: () => { clearInterval(timer); opts.onClose?.(); } });
  return sheet;
}
