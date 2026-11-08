import { amsterdamDate, puzzleNumber } from '../core/daily';
import { validatePuzzle } from '../core/validate';
import { GithubError, type Github } from '../publish/github';
import { h } from '../ui/dom';
import { closeSheet, openSheet } from '../ui/sheet';
import type { Origin } from './draft';
import { humanError, qualityTips } from './messages';
import type { EditorApi } from './screen';
import { toast } from './share';

const DAY = 86_400_000;
export const todayStr = () => amsterdamDate(new Date());
export const tomorrowStr = () => amsterdamDate(new Date(Date.now() + DAY));

/** "24 dec" */
export function shortDate(date: string): string {
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`)).replace(/\.$/, '');
}

export function originLabel(o: Origin): string {
  return o.kind === 'new' ? 'Nieuw' : `${shortDate(o.date)} · ${o.own ? 'Eigen puzzel' : 'Gegenereerd'}`;
}

export function errorText(e: unknown): string {
  if (!(e instanceof GithubError)) return 'Publiceren mislukt';
  switch (e.kind) {
    case 'auth': return 'Je sleutel werkt niet (meer)';
    case 'network': return 'Geen verbinding, probeer opnieuw';
    case 'conflict': return 'Iemand anders publiceerde tegelijk; probeer opnieuw';
    default: return `Publiceren mislukt (${e.status})`;
  }
}

// ---------- bouwstatus ----------
const POLL_MS = 10_000;
const POLL_MAX_MS = 15 * 60_000;
let watchId = 0;

/** Volgt de GitHub-bouw van een commit en toont de status als chip in de kop. */
export function watchRun(api: Pick<EditorApi, 'setChip' | 'announce'>, github: Github, commitSha: string): void {
  const id = ++watchId;
  const chip = h('span', { class: 'chip ed-run is-pending', role: 'status' }, '⏳ Wordt gebouwd…');
  api.setChip(chip);
  const started = Date.now();
  const set = (cls: string, text: string, title = '') => {
    chip.className = `chip ed-run ${cls}`;
    chip.textContent = text;
    chip.title = title;
  };
  const tick = async () => {
    if (id !== watchId) return;
    let state: Awaited<ReturnType<Github['runStatus']>>;
    try { state = await github.runStatus(commitSha); } catch { state = { state: 'pending' }; }
    if (id !== watchId) return;
    if (state.state === 'success') {
      set('is-live', '✓ Live', 'Spelers zien hem binnen ±10 minuten');
      api.announce('De puzzel staat live. Spelers zien hem binnen ongeveer tien minuten.');
    } else if (state.state === 'failure') {
      chip.replaceChildren(h('a', { href: state.url ?? '#', target: '_blank', rel: 'noopener' }, '✗ Mislukt'));
      chip.className = 'chip ed-run is-failed';
      api.announce('Het bouwen is mislukt. De oude site blijft staan.');
    } else if (state.state === 'unknown') {
      set('is-unknown', 'Gepubliceerd — status onbekend');
    } else if (Date.now() - started > POLL_MAX_MS) {
      set('is-unknown', 'Gepubliceerd — status onbekend');
    } else setTimeout(() => void tick(), POLL_MS);
  };
  setTimeout(() => void tick(), POLL_MS / 2);
}

// ---------- publiceren ----------
export function openPublish(api: EditorApi): void {
  const errs = validatePuzzle(api.puzzle);
  if (errs.length) { toast(`Nog niet te publiceren: ${humanError(errs[0])}`); return; }

  const date = h('input', { class: 'field-input', type: 'date', value: api.origin.kind === 'date' ? api.origin.date : tomorrowStr(), 'aria-label': 'Datum' });
  const info = h('div', { class: 'pub-info' });
  const status = h('p', { class: 'login-status', role: 'status', 'aria-live': 'polite' });
  const go = h('button', { class: 'btn btn-fire', type: 'button' }, 'Publiceer');
  const quick = (label: string, value: () => string) =>
    h('button', { class: 'btn btn-ghost btn-chip', type: 'button', onClick: () => { date.value = value(); render(); } }, label);

  const render = () => {
    const d = date.value;
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(d);
    go.disabled = !valid;
    if (!valid) { info.replaceChildren(h('p', { class: 'pn-muted' }, 'Kies een datum')); return; }
    const a = api.analysis;
    const tips = a ? qualityTips(a.report) : [];
    const warn: string[] = [];
    if (d === todayStr()) warn.push('Spelers die vandaag al begonnen zijn, beginnen opnieuw.');
    else if (d < todayStr()) warn.push('Deze datum is al voorbij.');
    info.replaceChildren(
      h('p', { class: 'pub-line' }, h('b', {}, `Puzzel #${puzzleNumber(d)}`), ` · ${shortDate(d)} · Max ${a ? a.max : '…'}`),
      ...warn.map((w) => h('p', { class: 'pub-warn' }, `⚠ ${w}`)),
      ...tips.map((t) => h('p', { class: 'st-tip pub-tip' }, `! ${t}`)),
    );
  };
  date.addEventListener('input', render);
  render();
  const stopListening = api.onAnalysis(render);

  go.addEventListener('click', async () => {
    const d = date.value;
    go.disabled = true;
    go.textContent = 'Bezig…';
    status.textContent = '';
    try {
      const { commitSha } = await api.github.publish(d, api.puzzle, api.session.name);
      closeSheet();
      api.setOrigin({ kind: 'date', date: d, own: true }, true);
      toast(`Gepubliceerd voor ${shortDate(d)}`);
      watchRun(api, api.github, commitSha);
    } catch (e) {
      status.textContent = errorText(e);
      go.disabled = false;
      go.textContent = 'Publiceer';
    }
  });

  openSheet(h('div', { class: 'ed-sheet' },
    h('h2', { class: 'sheet-title' }, 'Publiceren als dagpuzzel'),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Datum'), date),
    h('div', { class: 'chip-row' }, quick('Vandaag', todayStr), quick('Morgen', tomorrowStr)),
    info,
    status,
    h('div', { class: 'sheet-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => closeSheet() }, 'Annuleren'), go),
  ), { label: 'Publiceren', dismissable: true, onClose: stopListening });
}

/** Haalt de eigen puzzel van de geopende datum weg (die dag wordt weer gegenereerd). */
export async function removeOwn(api: EditorApi): Promise<void> {
  if (api.origin.kind !== 'date' || !api.origin.own) return;
  const d = api.origin.date;
  try {
    const { commitSha } = await api.github.publish(d, null, api.session.name);
    api.setOrigin({ kind: 'date', date: d, own: false });
    toast(`Eigen puzzel van ${shortDate(d)} verwijderd`);
    watchRun(api, api.github, commitSha);
  } catch (e) {
    toast(errorText(e));
  }
}
