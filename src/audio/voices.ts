/**
 * Klankrecepten. Elk recept plant nodes in op een (Offline)AudioContext vanaf tijdstip `at`
 * en geeft de stem terug: de gain waarmee hij afgedempt kan worden en wanneer hij klaar is.
 */

/** Instelbare klankkleur; de geluidsproef past dit live aan. */
export const TONE = {
  /** Masterniveau (enkele geluiden pieken rond −14 dBFS; de limiter vangt stapels op). */
  master: 0.6,
  /** Aandeel galm. */
  wet: 0.22,
  /** Kantelfrequentie van het zachte laagdoorlaatfilter op de master (Hz). */
  bright: 11000,
  /** Vermenigvuldiger voor alle uitstervingen. */
  decay: 1,
};

export interface Kit {
  ctx: BaseAudioContext;
  out: AudioNode;
  noise: AudioBuffer;
}

export interface VoiceOut { gain: GainNode; end: number }

export interface VoiceOpts { freq: number; gain: number }

const MAX_PARTIAL_HZ = 9500;

/** Witte ruis van 1 s, één keer per context. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/** Zelf opgewekte nagalm: stereo ruis met exponentiële uitsterving en wat minder hoog naarmate hij wegsterft. */
export function impulse(ctx: BaseAudioContext, seconds = 1.6): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      // Eenvoudig laagdoorlaatfilter dat dichter gaat naarmate de galm uitsterft.
      const k = 0.55 - 0.45 * t;
      lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - t, 2.2) * Math.exp(-3 * t);
    }
  }
  return b;
}

/** Kanaal voor één stem: eigen gain (om af te dempen) en een kleine willekeurige stereopositie. */
function voiceBus(k: Kit): GainNode {
  const g = k.ctx.createGain();
  const pan = (k.ctx as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode }).createStereoPanner?.();
  if (pan) {
    pan.pan.value = (Math.random() - 0.5) * 0.5;
    g.connect(pan).connect(k.out);
  } else {
    g.connect(k.out);
  }
  return g;
}

/** Sinus met snelle aanzet en exponentiële uitsterving. */
function partial(k: Kit, dest: AudioNode, freq: number, at: number, peak: number, attack: number, decay: number, type: OscillatorType = 'sine', detuneCents = 0) {
  const o = k.ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  if (detuneCents) o.detune.value = detuneCents;
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + attack + decay + 0.05);
  return at + attack + decay;
}

/** Kort ruistikje door een banddoorlaat: de "aanslag" van glas. */
function click(k: Kit, dest: AudioNode, at: number, peak: number, centre: number, dur = 0.006, q = 1.2) {
  const src = k.ctx.createBufferSource();
  src.buffer = k.noise;
  const bp = k.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = centre;
  bp.Q.value = q;
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(peak, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(bp).connect(g).connect(dest);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
  return at + dur;
}

/** Hoge tonen zachter, zodat het nooit schel wordt. */
const tilt = (freq: number) => Math.min(1, Math.sqrt(587 / freq));

interface BellShape { ratios: number[]; gains: number[]; decay: number; attack?: number; click?: number }

function bellLike(k: Kit, at: number, o: VoiceOpts, s: BellShape): VoiceOut {
  const bus = voiceBus(k);
  const peak = o.gain * tilt(o.freq);
  let end = at;
  s.ratios.forEach((r, i) => {
    const f = o.freq * r;
    if (f > MAX_PARTIAL_HZ) return;
    // Hogere partialen sterven sneller uit; zo blijft de grondtoon het langst hangen.
    const d = (s.decay * TONE.decay) / Math.pow(i + 1, 0.7);
    end = Math.max(end, partial(k, bus, f, at, peak * s.gains[i], s.attack ?? 0.003, d));
  });
  if (s.click) end = Math.max(end, click(k, bus, at, peak * s.click, Math.min(6000, o.freq * 3)));
  return { gain: bus, end };
}

const GLASS: BellShape = { ratios: [1, 2.76, 5.4, 8.93], gains: [1, 0.45, 0.22, 0.1], decay: 1.2, click: 0.35 };

/** Glastinkel: kristal geraakt. */
export const glass = (k: Kit, at: number, o: VoiceOpts) => bellLike(k, at, o, GLASS);

/** Heldere, kortere glastik: spiegel geplaatst. */
export const pling = (k: Kit, at: number, o: VoiceOpts) => bellLike(k, at, o, { ...GLASS, decay: 0.55, click: 0.5 });

/** Zachte, korte tik: spiegel gedraaid, replay. */
export const tick = (k: Kit, at: number, o: VoiceOpts) =>
  bellLike(k, at, o, { ratios: [1, 2.76], gains: [1, 0.3], decay: 0.22, click: 0.6 });

/** Klokje met warmere boventonen: noten van de viering. */
export const bell = (k: Kit, at: number, o: VoiceOpts) =>
  bellLike(k, at, o, { ratios: [1, 2, 2.76, 5.4], gains: [1, 0.28, 0.3, 0.1], decay: 1.9, attack: 0.004, click: 0.2 });

/** Tik die een kwart omlaag glijdt: spiegel weggehaald. */
export function slideDown(k: Kit, at: number, o: VoiceOpts): VoiceOut {
  const bus = voiceBus(k);
  const peak = o.gain * tilt(o.freq);
  const dur = 0.35 * TONE.decay;
  for (const [r, gr] of [[1, 1], [2.76, 0.25]] as const) {
    const osc = k.ctx.createOscillator();
    osc.frequency.setValueAtTime(o.freq * r, at);
    osc.frequency.exponentialRampToValueAtTime(o.freq * r * 0.749, at + 0.12);
    const g = k.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak * gr, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(bus);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
  click(k, bus, at, peak * 0.4, 2500);
  return { gain: bus, end: at + dur };
}

/** Dof, laag "tok": geweigerde tik. */
export function tok(k: Kit, at: number, o: VoiceOpts): VoiceOut {
  const bus = voiceBus(k);
  let end = partial(k, bus, 180, at, o.gain, 0.002, 0.14);
  end = Math.max(end, partial(k, bus, 360, at, o.gain * 0.25, 0.002, 0.06, 'triangle'));
  click(k, bus, at, o.gain * 0.5, 700, 0.01, 0.8);
  return { gain: bus, end };
}

/** Opzwellende adem die oplaadt: Vuur!. */
export function breath(k: Kit, at: number, o: VoiceOpts): VoiceOut {
  const bus = voiceBus(k);
  const src = k.ctx.createBufferSource();
  src.buffer = k.noise;
  src.loop = true;
  const bp = k.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 3.5;
  bp.frequency.setValueAtTime(400, at);
  bp.frequency.exponentialRampToValueAtTime(2400, at + 0.45);
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(o.gain * 0.9, at + 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.75);
  src.connect(bp).connect(g).connect(bus);
  src.start(at);
  src.stop(at + 0.8);
  // Zachte grondtoon (D4) die meezwelt.
  const osc = k.ctx.createOscillator();
  osc.frequency.value = o.freq;
  const og = k.ctx.createGain();
  og.gain.setValueAtTime(0.0001, at);
  og.gain.linearRampToValueAtTime(o.gain * 0.35, at + 0.38);
  og.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
  osc.connect(og).connect(bus);
  osc.start(at);
  osc.stop(at + 0.95);
  return { gain: bus, end: at + 0.9 };
}

/**
 * Warme akkoordwolk: de schokgolf van de viering. Bijna-harmonische tonen (geen bel-boventonen,
 * die botsen als ze gestapeld worden), elk als licht ontstemd paar voor glans, plus een lage D.
 */
export function chordCloud(k: Kit, at: number, o: VoiceOpts & { freqs: number[] }): VoiceOut {
  const bus = voiceBus(k);
  const decay = 2.5 * TONE.decay;
  const each = o.gain / Math.sqrt(o.freqs.length);
  let end = at;
  o.freqs.forEach((f, i) => {
    const t = at + i * 0.025;
    const p = each * tilt(f * 2);
    end = Math.max(end, partial(k, bus, f, t, p * 0.55, 0.06, decay, 'sine', -5));
    end = Math.max(end, partial(k, bus, f, t, p * 0.55, 0.06, decay, 'sine', 5));
    end = Math.max(end, partial(k, bus, f * 2, t, p * 0.12, 0.08, decay * 0.6));
  });
  end = Math.max(end, partial(k, bus, o.freqs[0] / 2, at, o.gain * 0.35, 0.08, decay * 1.1));
  return { gain: bus, end };
}

/** Oplaadzoem: een zuivere toon die van laag naar hoog glijdt, met een zachte octaaf eronder. */
export function laserCharge(k: Kit, at: number, o: VoiceOpts): VoiceOut {
  const bus = voiceBus(k);
  const lp = k.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  lp.connect(bus);
  for (const [type, mul, gr] of [['sine', 1, 1], ['triangle', 0.5, 0.35]] as const) {
    const osc = k.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(o.freq * 0.35 * mul, at);
    osc.frequency.exponentialRampToValueAtTime(o.freq * 2 * mul, at + 0.42);
    const g = k.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(o.gain * gr, at + 0.38);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
    osc.connect(g).connect(lp);
    osc.start(at);
    osc.stop(at + 0.65);
  }
  return { gain: bus, end: at + 0.6 };
}

/** Omgekeerde bel: glasklank die aanzwelt en dan loslaat, als licht dat wordt ingeademd. */
export function glassSwell(k: Kit, at: number, o: VoiceOpts): VoiceOut {
  const bus = voiceBus(k);
  const rise = 0.4, fall = 0.35;
  [1, 2.76, 5.4].forEach((r, i) => {
    const f = o.freq * r;
    if (f > MAX_PARTIAL_HZ) return;
    const osc = k.ctx.createOscillator();
    osc.frequency.value = f;
    const g = k.ctx.createGain();
    const peak = o.gain * tilt(o.freq) * [1, 0.4, 0.18][i];
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, at + rise + fall);
    osc.connect(g).connect(bus);
    osc.start(at);
    osc.stop(at + rise + fall + 0.05);
  });
  click(k, bus, at + rise, o.gain * 0.3, 4000);
  return { gain: bus, end: at + rise + fall };
}

/** Kristallen die zich opladen: een snelle, oplopende reeks glastikjes. */
export function strum(k: Kit, at: number, o: VoiceOpts & { freqs: number[] }): VoiceOut {
  const bus = voiceBus(k);
  let end = at;
  o.freqs.forEach((f, i) => {
    const t = at + i * 0.045;
    const p = o.gain * tilt(f) * (0.6 + 0.4 * (i / o.freqs.length));
    end = Math.max(end, partial(k, bus, f, t, p, 0.003, 0.5 * TONE.decay));
    if (f * 2.76 < MAX_PARTIAL_HZ) end = Math.max(end, partial(k, bus, f * 2.76, t, p * 0.3, 0.003, 0.2 * TONE.decay));
    click(k, bus, t, p * 0.4, Math.min(6000, f * 3));
  });
  return { gain: bus, end };
}

/** Lancering: zachte, lage dreun met een heldere tik en een korte glinstering erachteraan. */
export function launch(k: Kit, at: number, o: VoiceOpts): VoiceOut {
  const bus = voiceBus(k);
  const osc = k.ctx.createOscillator();
  osc.frequency.setValueAtTime(o.freq, at);
  osc.frequency.exponentialRampToValueAtTime(o.freq * 0.5, at + 0.25);
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(o.gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
  osc.connect(g).connect(bus);
  osc.start(at);
  osc.stop(at + 0.5);
  click(k, bus, at, o.gain * 0.6, 3500, 0.008);
  // Glinstering: hoge ruis die wegsterft.
  const src = k.ctx.createBufferSource();
  src.buffer = k.noise;
  const hp = k.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5000;
  const ng = k.ctx.createGain();
  ng.gain.setValueAtTime(0.0001, at + 0.02);
  ng.gain.linearRampToValueAtTime(o.gain * 0.12, at + 0.06);
  ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
  src.connect(hp).connect(ng).connect(bus);
  src.start(at, Math.random() * 0.4);
  src.stop(at + 0.55);
  return { gain: bus, end: at + 0.5 };
}
