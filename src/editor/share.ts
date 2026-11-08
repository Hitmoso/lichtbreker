import { encodeLevel } from '../core/levelcode';
import { validatePuzzle } from '../core/validate';
import { h } from '../ui/dom';
import { humanError } from './messages';
import type { EditorApi } from './screen';

/** Korte melding onderin het scherm. */
export function toast(msg: string): void {
  document.querySelector('.ed-toast')?.remove();
  const el = h('p', { class: 'ed-toast', role: 'status' }, msg);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-on'));
  setTimeout(() => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 400); }, 2200);
}

export const levelUrl = (code: string) => `${location.origin}${location.pathname}?level=${code}`;

/** Deelt het level als link: deelmenu op een telefoon, anders kopiëren. */
export async function shareLevel(api: EditorApi): Promise<void> {
  const errs = validatePuzzle(api.puzzle);
  if (errs.length) { toast(`Nog niet te delen: ${humanError(errs[0])}`); return; }
  const url = levelUrl(encodeLevel(api.puzzle));
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.share) {
    try {
      await navigator.share({ url, title: 'Lichtbreker – eigen level' });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link gekopieerd');
    api.announce('Link gekopieerd.');
  } catch {
    toast('Kopiëren lukte niet');
  }
}
