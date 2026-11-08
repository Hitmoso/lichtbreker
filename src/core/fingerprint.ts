import type { Puzzle } from './types';

/** Korte vingerafdruk van een puzzel: FNV-1a (32 bit) over de JSON, 8 hexadecimale tekens. */
export function puzzleId(p: Puzzle): string {
  const s = JSON.stringify(p);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
