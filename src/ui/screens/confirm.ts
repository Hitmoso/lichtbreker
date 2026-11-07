import { h } from '../dom';
import { openSheet } from '../sheet';

/** Ja/nee-paneel. Resolvet true bij de rechterknop; sluiten telt als nee. */
function ask(opts: { label: string; title: string; text: string; no: string; yes: string; yesClass?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const answer = (v: boolean) => { if (answered) return; answered = true; resolve(v); sheet.close(); };
    const content = h('div', { class: 'confirm' },
      h('h2', { class: 'sheet-title' }, opts.title),
      h('p', { class: 'sheet-text' }, opts.text),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => answer(false) }, opts.no),
        h('button', { class: `btn ${opts.yesClass ?? 'btn-fire'}`, type: 'button', onClick: () => answer(true) }, opts.yes),
      ),
    );
    const sheet = openSheet(content, { label: opts.label, dismissable: true, onClose: () => answer(false) });
  });
}

/** "Zeker weten?" vóór het indienen. Resolvet true bij "Ja, vuur!". */
export const confirmFire = () => ask({
  label: 'Bevestig vuren', title: 'Zeker weten?',
  text: 'Na het vuren liggen je spiegels vast en zie je hoeveel er maximaal in zat.',
  no: 'Nog even niet', yes: 'Ja, vuur!',
});

/** Oneindige puzzel met spiegels verlaten? Resolvet true bij "Overslaan". */
export const confirmSkip = () => ask({
  label: 'Deze puzzel overslaan?', title: 'Deze puzzel overslaan?',
  text: 'Je spiegels gaan verloren en deze puzzel telt niet mee.',
  no: 'Blijven', yes: 'Overslaan', yesClass: 'btn-ghost',
});
