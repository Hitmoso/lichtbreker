import '../app.css';
import { h } from '../dom';
import { goHome } from '../modes/level';

/** Een ?level=-link die niet te lezen is of geen geldige puzzel geeft. */
export function showLevelError(root: HTMLElement): void {
  root.replaceChildren(
    h('header', { class: 'top' }, h('h1', { class: 'brand' }, 'Lichtbreker')),
    h('main', { class: 'stage' },
      h('div', { class: 'level-error', role: 'alert' },
        h('p', { class: 'level-error-title' }, 'Dit level kan niet geladen worden'),
        h('p', { class: 'sheet-text' }, 'De link is misschien niet helemaal meegekopieerd.'),
        h('button', { class: 'btn btn-fire', type: 'button', onClick: goHome }, 'Naar het spel'),
      ),
    ),
  );
}
