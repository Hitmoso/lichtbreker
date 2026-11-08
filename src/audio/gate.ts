/**
 * Een gepauzeerde AudioContext (iOS na een telefoontje, of nog niet vrijgegeven door een tik) laat de tijd
 * stilstaan: alles wat je dan inplant, klinkt bij hervatten in één klap. Daarom mag er tijdens een pauze
 * hooguit één geluid wachten; de rest vervalt.
 */
export class SuspendGate {
  private queued = false;

  allow(state: string): boolean {
    if (state === 'running') { this.queued = false; return true; }
    if (this.queued) return false;
    this.queued = true;
    return true;
  }
}
