import { BlurFilter } from 'pixi.js';

const blurs = new Map<number, BlurFilter>();

/**
 * Eén gedeelde BlurFilter per sterkte. Filters worden bij het opruimen van een node niet vernietigd,
 * dus een nieuwe filter per kristal zou bij elke nieuwe puzzel geheugen lekken.
 */
export function sharedBlur(strength: number, quality = 3): BlurFilter {
  let f = blurs.get(strength);
  if (!f) {
    f = new BlurFilter({ strength, quality });
    blurs.set(strength, f);
  }
  return f;
}
