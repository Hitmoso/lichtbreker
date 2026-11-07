export const SOUND_KEY = 'lichtbreker:sound';

/** Staat het geluid aan? Standaard wel; een fout in de opslag telt als "aan". */
export function readSoundOn(storage: Storage | null): boolean {
  try {
    return storage?.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeSoundOn(storage: Storage | null, on: boolean): void {
  try {
    storage?.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* zonder opslag geldt de keuze alleen voor deze sessie */
  }
}
