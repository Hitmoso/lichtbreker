/** Grondtoon D5. Alle getoonde klanken komen uit dezelfde pentatonische ladder, dus overlap klinkt altijd welluidend. */
export const ROOT_HZ = 587.33;
/** D-groot pentatonisch, in halve tonen boven de grondtoon: D E F# A B. */
export const PENTA = [0, 2, 4, 7, 9] as const;
/** D6/9-arpeggio (D F# A B E' F#' A'), voor de viering bij het maximum. */
export const CHORD_STEPS: readonly number[] = [0, 2, 3, 4, 6, 7, 8];

/** Stap op de ladder → frequentie. Stap 5 is een octaaf hoger; negatief gaat omlaag. */
export function noteFreq(step: number): number {
  const oct = Math.floor(step / PENTA.length);
  const deg = step - oct * PENTA.length;
  return ROOT_HZ * 2 ** (oct + PENTA[deg] / 12);
}

/** Stap voor het n-de geraakte kristal: oplopend, en na twee octaven pendelend in het bovenste octaaf. */
export function hitStep(n: number): number {
  if (n <= 11) return Math.max(0, n - 1);
  const t = (n - 11) % 10;
  return t <= 5 ? 10 - t : t;
}
