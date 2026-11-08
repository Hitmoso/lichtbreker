export interface Session { name: string; token: string }

export const SESSION_KEY = 'lichtbreker:bouwer';

interface Stores { local: Storage | null; session: Storage | null }

const safe = (get: () => Storage): Storage | null => { try { return get(); } catch { return null; } };
const browserStores = (): Stores => ({ local: safe(() => localStorage), session: safe(() => sessionStorage) });

function read(s: Storage | null): Session | null {
  try {
    const raw = s?.getItem(SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    return typeof o.name === 'string' && typeof o.token === 'string' ? { name: o.name, token: o.token } : null;
  } catch {
    return null;
  }
}

/** Ingelogd op dit apparaat (localStorage) of in deze sessie (sessionStorage). */
export function loadSession(stores: Stores = browserStores()): Session | null {
  return read(stores.local) ?? read(stores.session);
}

export function saveSession(s: Session, remember: boolean, stores: Stores = browserStores()): void {
  clearSession(stores);
  try { (remember ? stores.local : stores.session)?.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* geen opslag */ }
}

export function clearSession(stores: Stores = browserStores()): void {
  for (const s of [stores.local, stores.session]) { try { s?.removeItem(SESSION_KEY); } catch { /* geen opslag */ } }
}
