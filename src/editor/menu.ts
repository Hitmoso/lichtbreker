import { DIFFICULTY_LEVELS, DIFFICULTY_NAMES, type Difficulty } from '../config';
import { puzzleNumber } from '../core/daily';
import { LIMITS } from '../core/validate';
import type { Puzzle } from '../core/types';
import { clearSession } from '../publish/session';
import { h } from '../ui/dom';
import { newSeed } from '../ui/modes/endless';
import { segmented } from '../ui/segmented';
import { closeSheet, openSheet } from '../ui/sheet';
import { THEME_NAMES, THEMES, type Theme } from '../core/generator3';
import { requestEndless, requestGeneratedDaily, requestThemed } from '../worker/client';
import type { Origin } from './draft';
import { errorText, removeOwn, shortDate, todayStr, tomorrowStr } from './publish';
import type { EditorApi } from './screen';
import { toast } from './share';
import { emptyPuzzle, resizePuzzle } from './tools';

/** Ja/nee-paneel. */
function confirmSheet(title: string, text: string, yes: string): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const answer = (v: boolean) => { if (answered) return; answered = true; resolve(v); sheet.close(); };
    const sheet = openSheet(h('div', { class: 'ed-sheet' },
      h('h2', { class: 'sheet-title' }, title),
      h('p', { class: 'sheet-text' }, text),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => answer(false) }, 'Annuleren'),
        h('button', { class: 'btn btn-fire', type: 'button', onClick: () => answer(true) }, yes)),
    ), { label: title, dismissable: true, onClose: () => answer(false) });
  });
}

/** Mag het huidige ontwerp weg? Vraagt het alleen als er iets gewijzigd is. */
async function mayDiscard(api: EditorApi): Promise<boolean> {
  if (!api.dirty) return true;
  return confirmSheet('Huidig ontwerp vervangen?', 'Je huidige ontwerp gaat verloren.', 'Doorgaan');
}

function stepper(label: string, value: number, [lo, hi]: readonly [number, number], onChange: (v: number) => void): HTMLElement {
  const out = h('output', { class: 'step-value', 'aria-live': 'polite' }, String(value));
  const set = (v: number) => {
    value = Math.max(lo, Math.min(hi, v));
    out.textContent = String(value);
    minus.disabled = value <= lo;
    plus.disabled = value >= hi;
    onChange(value);
  };
  const minus = h('button', { class: 'step-btn', type: 'button', 'aria-label': `${label} minder`, onClick: () => set(value - 1) }, '−');
  const plus = h('button', { class: 'step-btn', type: 'button', 'aria-label': `${label} meer`, onClick: () => set(value + 1) }, '+');
  minus.disabled = value <= lo;
  plus.disabled = value >= hi;
  return h('div', { class: 'step', role: 'group', 'aria-label': label }, h('span', { class: 'step-label' }, label), minus, out, plus);
}

/** Het ⋯-blad: raster, spiegels, beginnen, verwijderen, uitloggen. */
export function openMenu(api: EditorApi): void {
  const p = api.puzzle;
  let difficulty: Difficulty = 'normal';
  const diff = segmented<Difficulty>({
    label: 'Moeilijkheid', size: 'small', value: difficulty,
    options: DIFFICULTY_LEVELS.map((d) => ({ value: d, text: DIFFICULTY_NAMES[d] })),
    onChange: (d) => { difficulty = d; },
  });

  const resize = (w: number, hgt: number) => api.edit(resizePuzzle(api.puzzle, w, hgt));

  const start = async (make: () => Promise<{ puzzle: Puzzle; origin: Origin } | null>) => {
    closeSheet();
    if (!(await mayDiscard(api))) return;
    const r = await make();
    if (r) api.load(r.puzzle, r.origin);
  };

  /** Een puzzel met dit thema; lukt het bij deze seed niet, dan een paar andere seeds proberen. */
  const themed = async (theme: Theme) => {
    for (let k = 0; k < 4; k++) {
      const r = await requestThemed(newSeed(), difficulty, theme);
      if (r.theme === theme) { toast(`Thema: ${THEME_NAMES[theme]}`); return { puzzle: r.puzzle, origin: { kind: 'new' } as Origin }; }
    }
    toast(`${THEME_NAMES[theme]} lukt niet op dit niveau`);
    return null;
  };

  const own = api.origin.kind === 'date' && api.origin.own;
  openSheet(h('div', { class: 'ed-sheet ed-menu' },
    h('h2', { class: 'sheet-title' }, 'Meer'),
    h('p', { class: 'pn-label' }, 'Raster'),
    h('div', { class: 'steps' },
      stepper('Breedte', p.width, LIMITS.width, (w) => resize(w, api.puzzle.height)),
      stepper('Hoogte', p.height, LIMITS.height, (hgt) => resize(api.puzzle.width, hgt)),
      stepper('Spelersspiegels', p.mirrors, LIMITS.mirrors, (m) => api.edit({ ...api.puzzle, mirrors: m })),
    ),
    h('p', { class: 'pn-label' }, 'Begin met'),
    h('div', { class: 'menu-grid' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => void start(async () => ({ puzzle: emptyPuzzle(api.puzzle.width, api.puzzle.height, api.puzzle.mirrors), origin: { kind: 'new' } })) }, 'Leeg veld'),
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => { closeSheet(); openDate(api); } }, 'Datum openen…'),
    ),
    h('div', { class: 'menu-gen' }, diff.el,
      h('button', {
        class: 'btn btn-ghost', type: 'button',
        onClick: () => void start(async () => ({ puzzle: (await requestEndless(newSeed(), difficulty)).puzzle, origin: { kind: 'new' } })),
      }, 'Genereer'),
      h('p', { class: 'pn-label menu-theme-label' }, 'Of kies een thema'),
      h('div', { class: 'menu-themes' }, ...THEMES.map((t) =>
        h('button', { class: 'btn btn-ghost btn-chip', type: 'button', onClick: () => void start(() => themed(t)) }, THEME_NAMES[t])))),
    own ? h('button', {
      class: 'btn btn-ghost btn-wide btn-danger', type: 'button',
      onClick: async () => {
        closeSheet();
        const o = api.origin as Extract<Origin, { kind: 'date' }>;
        if (await confirmSheet('Eigen puzzel verwijderen?', `${shortDate(o.date)} krijgt dan weer de gegenereerde puzzel.`, 'Verwijderen')) await removeOwn(api);
      },
    }, 'Verwijder eigen puzzel') : null,
    h('button', { class: 'btn btn-ghost btn-wide', type: 'button', onClick: () => { clearSession(); location.reload(); } }, `Uitloggen (${api.session.name})`),
  ), { label: 'Meer', dismissable: true });
}

/** Datum kiezen en de puzzel van die dag openen (eigen puzzel uit de repo, anders de gegenereerde). */
export function openDate(api: EditorApi): void {
  const initial = api.origin.kind === 'date' ? api.origin.date : tomorrowStr();
  const date = h('input', { class: 'field-input', type: 'date', value: initial, 'aria-label': 'Datum' });
  const num = h('p', { class: 'pub-line' });
  const status = h('p', { class: 'login-status', role: 'status', 'aria-live': 'polite' });
  const go = h('button', { class: 'btn btn-fire', type: 'button' }, 'Openen');
  const render = () => {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(date.value);
    go.disabled = !ok;
    num.textContent = ok ? `Puzzel #${puzzleNumber(date.value)} · ${shortDate(date.value)}` : '';
  };
  const quick = (label: string, value: () => string) =>
    h('button', { class: 'btn btn-ghost btn-chip', type: 'button', onClick: () => { date.value = value(); render(); } }, label);
  date.addEventListener('input', render);
  render();

  go.addEventListener('click', async () => {
    const d = date.value;
    go.disabled = true;
    go.textContent = 'Laden…';
    status.textContent = '';
    try {
      const { data } = await api.github.getOverrides();
      const own = data[d] as Puzzle | undefined;
      const puzzle = own ?? (await requestGeneratedDaily(d)).puzzle;
      closeSheet();
      if (!(await mayDiscard(api))) return;
      api.load(puzzle, { kind: 'date', date: d, own: !!own });
      toast(own ? `Eigen puzzel van ${shortDate(d)} geopend` : `Gegenereerde puzzel van ${shortDate(d)} geopend`);
    } catch (e) {
      status.textContent = errorText(e).replace('Publiceren mislukt', 'Laden mislukt');
      go.disabled = false;
      go.textContent = 'Openen';
    }
  });

  openSheet(h('div', { class: 'ed-sheet' },
    h('h2', { class: 'sheet-title' }, 'Datum openen'),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Datum'), date),
    h('div', { class: 'chip-row' }, quick('Vandaag', todayStr), quick('Morgen', tomorrowStr)),
    num, status,
    h('div', { class: 'sheet-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeSheet() }, 'Annuleren'), go),
  ), { label: 'Datum openen', dismissable: true });
}
