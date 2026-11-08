import '../ui/app.css';
import { h } from '../ui/dom';

/** Start de puzzelbouwer (?bouwer). */
export function mount(root: HTMLElement): void {
  root.replaceChildren(h('div', { class: 'editor' }));
}
