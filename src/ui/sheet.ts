import { h } from './dom';

export interface SheetHandle { close(): void; el: HTMLElement }

let open: SheetHandle | null = null;

/**
 * Paneel dat van onderen omhoog schuift. `dismissable` = sluiten via achtergrond of Escape.
 * Er is altijd maar één paneel tegelijk open.
 */
export function openSheet(content: HTMLElement, opts: { label: string; dismissable?: boolean; onClose?: () => void } = { label: '' }): SheetHandle {
  open?.close();
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label }, content);
  const backdrop = h('div', { class: 'sheet-backdrop' }, panel);
  const prevFocus = document.activeElement as HTMLElement | null;
  let closed = false;
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && opts.dismissable) handle.close(); };
  const handle: SheetHandle = {
    el: panel,
    close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      backdrop.classList.remove('is-open');
      const done = () => backdrop.remove();
      backdrop.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 400);
      if (open === handle) open = null;
      prevFocus?.focus?.();
      opts.onClose?.();
    },
  };
  if (opts.dismissable) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) handle.close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  let shown = false;
  const show = () => {
    if (shown || closed) return;
    shown = true;
    backdrop.classList.add('is-open');
    (panel.querySelector('button') as HTMLElement | null)?.focus();
  };
  requestAnimationFrame(show);
  // Ook als rAF stilstaat (verborgen tabblad).
  setTimeout(show, 50);
  open = handle;
  return handle;
}

export const closeSheet = () => open?.close();
