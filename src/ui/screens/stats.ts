import { DIFFICULTY_LEVELS, DIFFICULTY_NAMES } from '../../config';
import type { EndlessState } from '../../state/endless';
import type { Stats } from '../../state/stats';
import { h } from '../dom';
import { openSheet } from '../sheet';

const LABELS = ['100%', '90–99%', '75–89%', '50–74%', '<50%'];

/** Blok met per gespeeld niveau: gespeeld, keer maximaal, beste reeks maximaal op rij. Null als er niets gespeeld is. */
function endlessBlock(stats: EndlessState['stats']): HTMLElement | null {
  const levels = DIFFICULTY_LEVELS.filter((d) => stats[d].played > 0);
  if (!levels.length) return null;
  return h('section', { class: 'endless-stats' },
    h('h3', { class: 'stats-sub' }, 'Oneindig'),
    h('table', { class: 'es-table' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, h('span', { class: 'sr-only' }, 'Niveau')),
        h('th', { scope: 'col' }, 'Gespeeld'), h('th', { scope: 'col' }, 'Maximaal'), h('th', { scope: 'col' }, 'Beste reeks'))),
      h('tbody', {}, ...levels.map((d) => h('tr', {},
        h('th', { scope: 'row' }, DIFFICULTY_NAMES[d]),
        h('td', { class: 'es-played' }, String(stats[d].played)),
        h('td', { class: 'es-perfect' }, String(stats[d].perfect)),
        h('td', { class: 'es-run' }, String(stats[d].bestRun)),
      ))),
    ),
  );
}

export function showStats(s: Stats, endless?: EndlessState['stats']): void {
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
    endless ? endlessBlock(endless) : null,
    h('button', { class: 'btn btn-ghost btn-wide', type: 'button', onClick: () => sheet.close() }, 'Sluiten'),
  );
  const sheet = openSheet(content, { label: 'Statistieken', dismissable: true });
}
