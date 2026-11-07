export const SIDE_GUTTER = 16;
export const MIN_CELL = 24;
export const MAX_CELL = 64;

/** Vakgrootte (px) zodat het veld plus de UI eromheen in het scherm past. */
export function computeCellSize(viewW: number, viewH: number, gridW: number, gridH: number, chromeH: number): number {
  const byW = (viewW - 2 * SIDE_GUTTER) / gridW;
  const byH = (viewH - chromeH - SIDE_GUTTER) / gridH;
  return Math.max(MIN_CELL, Math.floor(Math.min(byW, byH, MAX_CELL)));
}
