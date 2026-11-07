import { VoicePool } from './pool';
import { readSoundOn, writeSoundOn } from './pref';
import { CHORD_STEPS, hitStep, noteFreq } from './scale';
import { bell, breath, chordCloud, glass, impulse, noiseBuffer, pling, slideDown, tick, tok, TONE, type Kit, type VoiceOut } from './voices';

/** Alle geluiden van het spel, als namen. De ronde kent alleen dit. */
export interface Sfx {
  place(): void;
  rotate(): void;
  remove(): void;
  reject(): void;
  reset(): void;
  charge(): void;
  hit(n: number, opts?: { soft?: boolean }): void;
  perfectNote(i: number): void;
  bloom(): void;
  solutionMirror(k: number): void;
}

const noop = () => {};
export const silentSfx: Sfx = {
  place: noop, rotate: noop, remove: noop, reject: noop, reset: noop, charge: noop,
  hit: noop, perfectNote: noop, bloom: noop, solutionMirror: noop,
};

const SOFT = 0.5; // −6 dB
const PERFECT_MAX_STEP = 10;

const defaultContext = (): BaseAudioContext | null =>
  typeof AudioContext !== 'undefined' ? new AudioContext() : null;

/** Kleine willekeur zodat herhaling niet mechanisch klinkt: ±8 cent, ±1,5 dB. */
const vary = (freq: number, gain: number) => ({
  freq: freq * 2 ** (((Math.random() * 2 - 1) * 8) / 1200),
  gain: gain * 10 ** (((Math.random() * 2 - 1) * 1.5) / 20),
});

/**
 * Geluidsmotor: stem → master → (droog + galm) → zacht filter → limiter → uit.
 * De context ontstaat pas bij het eerste geluid. Zonder Web Audio is alles stil; gooit nooit.
 */
export class Sound implements Sfx {
  private storage: Storage | null;
  private createContext: () => BaseAudioContext | null;
  private enabled: boolean;
  private failed = false;
  private ctx: BaseAudioContext | null = null;
  private kit: Kit | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private pool = new VoicePool();

  constructor(opts: { storage: Storage | null; createContext?: () => BaseAudioContext | null }) {
    this.storage = opts.storage;
    this.createContext = opts.createContext ?? defaultContext;
    this.enabled = readSoundOn(this.storage);
  }

  get on(): boolean { return this.enabled; }
  get activeVoices(): number { return this.pool.size; }
  /** De context (na het eerste geluid), voor de geluidsproef. */
  get context(): BaseAudioContext | null { return this.ctx; }

  setOn(on: boolean): void {
    this.enabled = on;
    writeSoundOn(this.storage, on);
    try {
      if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? TONE.master : 0, this.ctx.currentTime, 0.02);
    } catch { /* stil */ }
  }

  /** TONE opnieuw toepassen op de keten (geluidsproef). */
  applyTone(): void {
    if (!this.ctx || !this.master || !this.wet || !this.lowpass) return;
    const t = this.ctx.currentTime;
    if (this.enabled) this.master.gain.setTargetAtTime(TONE.master, t, 0.02);
    this.wet.gain.setTargetAtTime(TONE.wet, t, 0.02);
    this.lowpass.frequency.setTargetAtTime(TONE.bright, t, 0.02);
  }

  place() { this.play((k, at) => pling(k, at, vary(noteFreq(4), 0.5))); }
  rotate() { this.play((k, at) => tick(k, at, vary(noteFreq(6), 0.45))); }
  remove() { this.play((k, at) => slideDown(k, at, vary(noteFreq(4), 0.4))); }
  reject() { this.play((k, at) => tok(k, at, vary(180, 0.5))); }
  reset() {
    this.play((k, at) => [6, 4, 2].map((s, i) => tick(k, at + i * 0.06, vary(noteFreq(s), 0.25))));
  }
  charge() { this.play((k, at) => breath(k, at, { freq: noteFreq(-5), gain: 0.35 })); }
  hit(n: number, opts: { soft?: boolean } = {}) {
    this.play((k, at) => glass(k, at, vary(noteFreq(hitStep(n)), 0.55 * (opts.soft ? SOFT : 1))));
  }
  perfectNote(i: number) {
    const step = Math.min(PERFECT_MAX_STEP, CHORD_STEPS[i % CHORD_STEPS.length] + 5 * Math.floor(i / CHORD_STEPS.length));
    this.play((k, at) => bell(k, at, vary(noteFreq(step), 0.5)));
  }
  bloom() {
    this.play((k, at) => [
      chordCloud(k, at, { freq: 0, gain: 0.6, freqs: CHORD_STEPS.map((s) => noteFreq(s - 5)) }),
      // Glinstering bovenop.
      glass(k, at + 0.12, vary(noteFreq(10), 0.18)),
      glass(k, at + 0.26, vary(noteFreq(8), 0.14)),
    ]);
  }
  solutionMirror(k: number) { this.play((kit, at) => tick(kit, at, vary(noteFreq(Math.min(9, 3 + k)), 0.7 * SOFT))); }

  // --- intern ---

  private play(make: (k: Kit, at: number) => VoiceOut | VoiceOut[]) {
    if (!this.enabled) return;
    try {
      const kit = this.ensure();
      if (!kit) return;
      const now = kit.ctx.currentTime;
      const out = make(kit, now + 0.005);
      for (const v of Array.isArray(out) ? out : [out]) {
        this.pool.add(v.end, () => {
          try { v.gain.gain.setTargetAtTime(0, kit.ctx.currentTime, 0.01); } catch { /* al klaar */ }
        }, now);
      }
    } catch (err) {
      console.warn('Lichtbreker: geluid overgeslagen', err);
    }
  }

  private ensure(): Kit | null {
    if (this.kit) return this.kit;
    if (this.failed) return null;
    let ctx: BaseAudioContext | null = null;
    try { ctx = this.createContext(); } catch { ctx = null; }
    if (!ctx) { this.failed = true; return null; }
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.enabled ? TONE.master : 0;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = TONE.bright;
    lowpass.Q.value = 0.5;
    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    const pre = ctx.createDelay(0.1);
    pre.delayTime.value = 0.015;
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = TONE.wet;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.25;

    master.connect(lowpass);
    lowpass.connect(dry).connect(limiter);
    lowpass.connect(pre).connect(verb).connect(wet).connect(limiter);
    limiter.connect(ctx.destination);

    this.master = master; this.wet = wet; this.lowpass = lowpass;
    this.kit = { ctx, out: master, noise: noiseBuffer(ctx) };
    this.listen(ctx);
    return this.kit;
  }

  /** Echte (niet-offline) context: hervatten na een gebaar, pauzeren als het tabblad verborgen is. */
  private listen(ctx: BaseAudioContext) {
    if (typeof document === 'undefined' || 'startRendering' in ctx) return;
    const live = ctx as AudioContext;
    if (typeof live.resume !== 'function') return;
    const resume = () => { if (live.state !== 'running' && !document.hidden) void live.resume().catch(noop); };
    resume();
    // Blijvend, niet "once": iOS kan na een tabwissel op "interrupted" blijven staan.
    document.addEventListener('pointerdown', resume, true);
    document.addEventListener('keydown', resume, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void live.suspend().catch(noop);
      else resume();
    });
  }
}
