import type { ElementKind } from '../core/types';
import type { BoardView } from '../render/board';
import { h } from './dom';
import { tipTop } from './layout';
import { TIP } from './screens/help';

/** Wordt verstuurd als de speler iets anders gaat doen (paneel openen, vuren): tips stoppen dan. */
export const QUIET_EVENT = 'lichtbreker:quiet';
export const quiet = () => document.dispatchEvent(new Event(QUIET_EVENT));

/** Toont per nieuw element één keer een puls op het veld en een korte tip. */
export async function showFirstSeenTips(board: BoardView, stage: HTMLElement, kinds: ElementKind[]): Promise<void> {
  let stopped = false;
  let current: HTMLElement | null = null;
  const hide = (el: HTMLElement) => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 400); };
  const stop = () => { stopped = true; if (current) hide(current); };
  document.addEventListener(QUIET_EVENT, stop, { once: true });
  for (const kind of kinds) {
    if (stopped) break;
    board.pulse(kind);
    const tip = h('p', { class: 'tip', role: 'status' }, TIP[kind]);
    current = tip;
    stage.append(tip);
    // Naast het veld, niet eroverheen: in de vrije strook erboven of eronder.
    const canvas = stage.querySelector('canvas');
    if (canvas) {
      const s = stage.getBoundingClientRect(), b = canvas.getBoundingClientRect();
      // Is er geen vrije strook, dan in elk geval niet over het element dat de tip uitlegt.
      const p = board.currentPuzzle;
      const nearTop = !!p && p.cells.some((c, i) => c.kind === kind && Math.floor(i / p.width) < 2);
      tip.style.top = `${tipTop(s.height, b.top - s.top, b.bottom - s.top, tip.offsetHeight, nearTop)}px`;
    }
    setTimeout(() => tip.classList.add('is-on'), 30);
    await new Promise((r) => setTimeout(r, 3800));
    if (stopped) break;
    hide(tip);
    current = null;
    await new Promise((r) => setTimeout(r, 300));
  }
  document.removeEventListener(QUIET_EVENT, stop);
}
