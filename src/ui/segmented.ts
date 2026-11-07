import { h } from './dom';

export interface Segmented<T extends string> {
  el: HTMLElement;
  set(v: T): void;
  setDisabled(on: boolean): void;
}

/** Keuze uit een paar opties als radiogroep (pijltjestoetsen wisselen). */
export function segmented<T extends string>(opts: {
  label: string;
  options: { value: T; text: string }[];
  value: T;
  size?: 'large' | 'small';
  onChange: (v: T) => void;
}): Segmented<T> {
  let value = opts.value;
  let disabled = false;
  const buttons = opts.options.map((o) =>
    h('button', { type: 'button', role: 'radio', class: 'seg-btn', 'data-value': o.value, onClick: () => choose(o.value, true) }, o.text));
  const el = h('div', { class: `seg seg-${opts.size ?? 'large'}`, role: 'radiogroup', 'aria-label': opts.label }, ...buttons);

  const render = () => {
    buttons.forEach((b, i) => {
      const on = opts.options[i].value === value;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      b.disabled = disabled;
    });
    const i = opts.options.findIndex((o) => o.value === value);
    el.style.setProperty('--seg-i', String(i));
    el.style.setProperty('--seg-n', String(opts.options.length));
  };
  const choose = (v: T, notify: boolean) => {
    if (disabled) return;
    const changed = v !== value;
    value = v;
    render();
    if (notify && changed) opts.onChange(v);
  };

  el.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = opts.options.findIndex((o) => o.value === value);
    const next = opts.options[(i + step + opts.options.length) % opts.options.length].value;
    choose(next, true);
    buttons[opts.options.findIndex((o) => o.value === next)].focus();
  });

  render();
  return {
    el,
    set: (v) => choose(v, false),
    setDisabled: (on) => { disabled = on; render(); },
  };
}
