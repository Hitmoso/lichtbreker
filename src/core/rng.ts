export interface Rng {
  /** Getal in [0, 1). */
  next(): number;
  /** Geheel getal in [min, max], inclusief. */
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  /** Schudt in place en geeft dezelfde array terug. */
  shuffle<T>(arr: T[]): T[];
}

/** mulberry32: klein, snel en voorspelbaar. */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (arr) => arr[int(0, arr.length - 1)],
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = int(0, i);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

/** FNV-1a (32-bit) over de onderdelen, gescheiden door '|'. */
export function hashSeed(...parts: (string | number)[]): number {
  const str = parts.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
