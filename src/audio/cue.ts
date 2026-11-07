import type { Placement } from '../core/types';

export type TapCue = 'place' | 'rotate' | 'remove';

/** Welk geluid hoort bij een geaccepteerde tik, afgelezen aan de plaatsingen ervoor en erna. */
export function tapCue(before: readonly Placement[], after: readonly Placement[]): TapCue {
  if (after.length > before.length) return 'place';
  if (after.length < before.length) return 'remove';
  return 'rotate';
}
