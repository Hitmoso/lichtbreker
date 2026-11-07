import { h } from '../dom';
import { openSheet } from '../sheet';

/** "Zeker weten?" vóór het indienen. Resolvet true bij "Ja, vuur!". */
export function confirmFire(): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const answer = (v: boolean) => { if (answered) return; answered = true; resolve(v); sheet.close(); };
    const content = h('div', { class: 'confirm' },
      h('h2', { class: 'sheet-title' }, 'Zeker weten?'),
      h('p', { class: 'sheet-text' }, 'Na het vuren liggen je spiegels vast en zie je hoeveel er maximaal in zat.'),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => answer(false) }, 'Nog even niet'),
        h('button', { class: 'btn btn-fire', type: 'button', onClick: () => answer(true) }, 'Ja, vuur!'),
      ),
    );
    const sheet = openSheet(content, { label: 'Bevestig vuren', dismissable: true, onClose: () => answer(false) });
  });
}
