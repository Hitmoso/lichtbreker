import { fromAscii, toAscii } from './ascii';
import type { Puzzle } from './types';
import { validatePuzzle } from './validate';

const VERSION = '1';

const toB64Url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s: string) => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('geen base64url');
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b + '='.repeat((4 - (b.length % 4)) % 4));
};

/**
 * Codeert een puzzel voor in een URL: `1.<b>.<h>.<spiegels>.<data>`.
 * `data` is base64url van de ASCII-cellen; reeksen van 3+ lege vakken worden `.<aantal>`.
 * Valideert niet (zie decodeLevel).
 */
export function encodeLevel(p: Puzzle): string {
  const flat = toAscii(p).join('').replace(/\.{3,}/g, (run) => `.${run.length}`);
  return [VERSION, p.width, p.height, p.mirrors, toB64Url(flat)].join('.');
}

/** Omgekeerde van encodeLevel. Elke afwijking of ongeldige puzzel geeft null. */
export function decodeLevel(s: string): Puzzle | null {
  try {
    const parts = s.split('.');
    if (parts.length !== 5 || parts[0] !== VERSION) return null;
    const [w, h, m] = parts.slice(1, 4).map((x) => (/^\d{1,3}$/.test(x) ? Number(x) : NaN));
    if (!Number.isInteger(w) || !Number.isInteger(h) || !Number.isInteger(m)) return null;
    const flat = fromB64Url(parts[4]).replace(/\.(\d+)/g, (_, n: string) => '.'.repeat(Number(n)));
    if (flat.length !== w * h || w < 1) return null;
    const rows = Array.from({ length: h }, (_, y) => flat.slice(y * w, (y + 1) * w));
    const p = fromAscii(rows, m);
    return validatePuzzle(p).length === 0 ? p : null;
  } catch {
    return null;
  }
}
