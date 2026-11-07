export const MAX_VOICES = 12;

interface Entry { end: number; fade: () => void }

/** Houdt klinkende stemmen bij; boven de 12 wordt de oudste snel afgedempt. Puur, dus los te testen. */
export class VoicePool {
  private list: Entry[] = [];

  get size(): number { return this.list.length; }

  /** Nieuwe stem die tot `end` klinkt (in contexttijd). `now` is de huidige contexttijd. */
  add(end: number, fade: () => void, now: number): void {
    this.list = this.list.filter((e) => e.end > now);
    this.list.push({ end, fade });
    while (this.list.length > MAX_VOICES) this.list.shift()!.fade();
  }
}
