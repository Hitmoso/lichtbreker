import type { Stats } from '../../state/stats';
import { h } from '../dom';
import { openSheet } from '../sheet';

const LABELS = ['100%', '90–99%', '75–89%', '50–74%', '<50%'];

export function showStats(s: Stats): void {
  const top = Math.max(1, ...s.buckets);
  const stat = (n: number, label: string) => h('div', { class: 'stat' }, h('span', { class: 'stat-num' }, String(n)), h('span', { class: 'stat-label' }, label));
  const content = h('div', { class: 'stats' },
    h('h2', { class: 'sheet-title' }, 'Statistieken'),
    h('div', { class: 'stat-row' }, stat(s.played, 'Gespeeld'), stat(s.currentStreak, 'Huidige reeks'), stat(s.bestStreak, 'Beste reeks')),
    h('h3', { class: 'stats-sub' }, 'Hoe dicht bij het maximum'),
    s.played === 0
      ? h('p', { class: 'sheet-text' }, 'Vuur je eerste puzzel af, dan verschijnt hier je verdeling.')
      : h('ul', { class: 'dist' }, ...s.buckets.map((n, i) => h('li', {},
        h('span', { class: 'dist-label' }, LABELS[i]),
        h('span', { class: 'dist-bar', style: `--w:${Math.max(6, (n / top) * 100)}%` }, h('span', {}, String(n))),
      ))),
    h('button', { class: 'btn btn-ghost btn-wide', type: 'button', onClick: () => sheet.close() }, 'Sluiten'),
  );
  const sheet = openSheet(content, { label: 'Statistieken', dismissable: true });
}
