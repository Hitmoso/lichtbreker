import type { ElementKind } from '../core/types';
import type { BoardView } from '../render/board';
import { h } from './dom';
import { TIP } from './screens/help';

/** Toont per nieuw element één keer een puls op het veld en een korte tip. */
export async function showFirstSeenTips(board: BoardView, stage: HTMLElement, kinds: ElementKind[]): Promise<void> {
  for (const kind of kinds) {
    board.pulse(kind);
    const tip = h('p', { class: 'tip', role: 'status' }, TIP[kind]);
    stage.append(tip);
    setTimeout(() => tip.classList.add('is-on'), 30);
    await new Promise((r) => setTimeout(r, 3800));
    tip.classList.remove('is-on');
    setTimeout(() => tip.remove(), 400);
    await new Promise((r) => setTimeout(r, 300));
  }
}
