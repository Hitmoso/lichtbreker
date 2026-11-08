import { createGithub } from '../publish/github';
import { fetchAccounts, login } from '../publish/crypto';
import { loadSession, saveSession, type Session } from '../publish/session';
import { h } from '../ui/dom';

const MSG = {
  wrong: 'Onjuiste naam of wachtwoord',
  denied: 'Je sleutel werkt niet (meer). Vraag de eigenaar om een nieuwe.',
  offline: 'Geen verbinding met GitHub',
} as const;

/**
 * Inlogscherm van de bouwer. Resolvet met een sessie waarvan de sleutel bij GitHub
 * schrijfrechten heeft. Een opgeslagen sessie die nog werkt, slaat het scherm over.
 */
export async function showLogin(root: HTMLElement): Promise<Session> {
  const saved = loadSession();
  if (saved && (await createGithub(saved.token).checkAccess()) === 'ok') return saved;

  return new Promise((resolve) => {
    const name = h('input', { class: 'field-input', id: 'lb-name', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
    const pw = h('input', { class: 'field-input', id: 'lb-pw', name: 'password', type: 'password', autocomplete: 'current-password', required: true });
    const remember = h('input', { type: 'checkbox', id: 'lb-remember', checked: true });
    const status = h('p', { class: 'login-status', role: 'status', 'aria-live': 'polite' });
    const submit = h('button', { class: 'btn btn-fire login-submit', type: 'submit' }, 'Inloggen');
    const retry = h('button', { class: 'btn btn-ghost login-retry', type: 'button', hidden: true, onClick: () => form.requestSubmit() }, 'Opnieuw');

    const busy = (on: boolean) => {
      submit.disabled = on;
      submit.textContent = on ? 'Bezig…' : 'Inloggen';
      card.classList.toggle('is-busy', on);
    };
    const fail = (msg: string, canRetry = false) => {
      status.textContent = msg;
      retry.hidden = !canRetry;
      card.classList.remove('is-shake');
      void card.offsetWidth; // animatie opnieuw starten
      card.classList.add('is-shake');
    };

    const form = h('form', { class: 'login-form', novalidate: true },
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Naam'), name),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Wachtwoord'), pw),
      h('label', { class: 'check' }, remember, h('span', {}, 'Ingelogd blijven op dit apparaat')),
      submit, status, retry,
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!name.value.trim() || !pw.value) return fail(MSG.wrong);
      busy(true);
      status.textContent = '';
      retry.hidden = true;
      const who = await login(await fetchAccounts(), name.value, pw.value);
      if (!who) { busy(false); return fail(MSG.wrong); }
      const access = await createGithub(who.token).checkAccess();
      busy(false);
      if (access !== 'ok') return fail(MSG[access], access === 'offline');
      saveSession(who, remember.checked);
      card.classList.add('is-leaving');
      setTimeout(() => resolve(who), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
    });

    const card = h('section', { class: 'login-card', 'aria-labelledby': 'lb-login-title' },
      h('p', { class: 'brand login-brand' }, 'Lichtbreker'),
      h('h1', { class: 'login-title', id: 'lb-login-title' }, 'Bouwer'),
      h('p', { class: 'login-sub' }, 'Log in om puzzels te bouwen en te publiceren.'),
      form,
      h('a', { class: 'login-back', href: location.pathname }, 'Terug naar het spel'),
    );
    root.replaceChildren(h('main', { class: 'login' }, card));
    name.focus();
  });
}
