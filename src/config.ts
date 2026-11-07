/** Datum van puzzel #1 (Europe/Amsterdam). Stel in vóór publicatie. */
export const EPOCH = '2026-11-07';
export const DEFAULT_WIDTH = 7;
export const DEFAULT_HEIGHT = 9;

/** Instellingen voor de dagpuzzelgenerator (bereiken zijn inclusief). */
export const GEN = {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  mirrors: [3, 6],
  walls: [4, 8],
  crystals: [10, 16],
  extrasPerDay: [0, 3],
  fixedMirrors: [1, 3],
  prisms: [1, 2],
  filters: [1, 2],
  coloredCrystalShare: [0.3, 0.5],
  maxScore: [6, 12],
  attempts: 200,
} as const;
