/**
 * Accounts voor de bouwer: de GitHub-sleutel staat versleuteld in public/bouwers.json
 * (AES-GCM 256, sleutel via PBKDF2-SHA-256 uit het wachtwoord). Alleen Web Crypto.
 */

export interface Account { name: string; salt: string; iv: string; data: string; iter?: number }

export const PBKDF2_ITERATIONS = 600_000;

const enc = new TextEncoder();
const toB64 = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function encryptToken(name: string, token: string, password: string, iter = PBKDF2_ITERATIONS): Promise<Account> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iter);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token)));
  return { name, salt: toB64(salt), iv: toB64(iv), data: toB64(data), iter };
}

/** Ontsleutelt de sleutel; fout wachtwoord of kapot account → null. */
export async function decryptToken(acc: Account, password: string): Promise<string | null> {
  try {
    const key = await deriveKey(password, fromB64(acc.salt), acc.iter ?? PBKDF2_ITERATIONS);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(acc.iv) }, key, fromB64(acc.data));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

const isAccount = (a: unknown): a is Account => {
  const o = a as Record<string, unknown> | null;
  return !!o && ['name', 'salt', 'iv', 'data'].every((k) => typeof o[k] === 'string')
    && (o.iter === undefined || (typeof o.iter === 'number' && o.iter > 0));
};

/** Naam (hoofdletterongevoelig) + wachtwoord → de opgeslagen naam en de sleutel, of null. */
export async function login(accounts: unknown, name: string, password: string): Promise<{ name: string; token: string } | null> {
  if (!Array.isArray(accounts)) return null;
  const wanted = name.trim().toLowerCase();
  const acc = accounts.filter(isAccount).find((a) => a.name.toLowerCase() === wanted);
  if (!acc) return null;
  const token = await decryptToken(acc, password);
  return token === null ? null : { name: acc.name, token };
}

/** Haalt ./bouwers.json op (niet uit de cache). Fout of onzin → []. */
export async function fetchAccounts(fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<Account[]> {
  try {
    const r = await fetchFn('./bouwers.json', { cache: 'no-store' });
    if (!r.ok) return [];
    const list: unknown = await r.json();
    return Array.isArray(list) ? list.filter(isAccount) : [];
  } catch {
    return [];
  }
}
