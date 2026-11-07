import { msUntilNextPuzzle } from '../../core/daily';
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

export interface ResultOptions {
  title: string;
  score: number;
  max: number;
  /** Deeltekst: maakt "Deel" de primaire knop. Anders `primary`. */
  share?: string;
  primary?: { label: string; onClick: () => void };
  secondary: { label: string; onClick: () => void };
  /** Extra knoppen onder de twee hoofdknoppen. */
  extra?: { label: string; onClick: () => void }[];
  countdown?: boolean;
  onClose?: () => void;
}

export function showResult(opts: ResultOptions): SheetHandle {
  const { score, max } = opts;
  const status = h('p', { class: 'share-status', role: 'status', 'aria-live': 'polite' });
  let timer: ReturnType<typeof setInterval> | undefined;

  const btn = (cls: string, b: { label: string; onClick: () => void }, close = true) =>
    h('button', { class: `btn ${cls}`, type: 'button', onClick: () => { if (close) sheet.close(); b.onClick(); } }, b.label);

  const share = async () => {
    const r = await shareResult(opts.share!);
    status.textContent = r === 'copied' ? 'Gekopieerd!' : r === 'failed' ? 'Kopiëren lukte niet' : '';
  };
  const primary = opts.share !== undefined
    ? h('button', { class: 'btn btn-fire', type: 'button', onClick: share }, 'Deel')
    : btn('btn-fire', opts.primary!);

  let countdown: HTMLElement | null = null;
  if (opts.countdown) {
    const time = h('span', { class: 'countdown-time' }, formatCountdown(msUntilNextPuzzle(new Date())));
    timer = setInterval(() => { time.textContent = formatCountdown(msUntilNextPuzzle(new Date())); }, 1000);
    countdown = h('p', { class: 'countdown' }, 'Volgende puzzel over ', time);
  }

  const content = h('div', { class: 'result' },
    h('p', { class: 'result-label' }, opts.title),
    h('p', { class: 'result-score', 'aria-label': `${score} van de ${max} kristallen` },
      h('span', { class: 'result-mine' }, String(score)), h('span', { class: 'result-slash' }, ' / '), h('span', { class: 'result-max' }, String(max))),
    h('p', { class: 'sheet-text' }, verdict(score, max)),
    h('div', { class: 'sheet-actions' }, btn('btn-ghost', opts.secondary), primary),
    ...(opts.extra ?? []).map((b) => btn('btn-ghost btn-wide', b)),
    opts.share !== undefined ? status : null,
    countdown,
  );
  const sheet = openSheet(content, { label: 'Resultaat', dismissable: true, onClose: () => { clearInterval(timer); opts.onClose?.(); } });
  return sheet;
}
