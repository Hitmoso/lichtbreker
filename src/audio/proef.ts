/** Geluidsproef (alleen in dev, via ?geluid): elk geluid beluisteren, klank bijstemmen en controleren. */
import { h } from '../ui/dom';
import { FIRE_SOUNDS, Sound, type FireSound, type Sfx } from './sound';
import { TONE } from './voices';

type Run = (s: Sfx) => void;

const SOUNDS: [string, Run][] = [
  ['Spiegel plaatsen', (s) => s.place()],
  ['Spiegel draaien', (s) => s.rotate()],
  ['Spiegel weghalen', (s) => s.remove()],
  ['Geweigerd', (s) => s.reject()],
  ['Opnieuw', (s) => s.reset()],
  ['Vuur! (opladen)', (s) => s.charge()],
  ['Kristal 1', (s) => s.hit(1)],
  ['Kristal 6', (s) => s.hit(6)],
  ['Kristal 1 (zacht)', (s) => s.hit(1, { soft: true })],
  ['Viering: noot 1', (s) => s.perfectNote(0)],
  ['Viering: akkoord', (s) => s.bloom()],
  ['Replay: spiegel', (s) => s.solutionMirror(1)],
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SEQUENCES: [string, (s: Sfx) => Promise<void>][] = [
  ['8 tinkels', async (s) => { for (let n = 1; n <= 8; n++) { s.hit(n); await wait(140); } }],
  ['14 tinkels', async (s) => { for (let n = 1; n <= 14; n++) { s.hit(n); await wait(120); } }],
  ['Hele ronde', async (s) => {
    s.place(); await wait(500); s.rotate(); await wait(400); s.place(); await wait(700);
    s.charge(); await wait(800);
    for (let n = 1; n <= 6; n++) { s.hit(n); await wait(260); }
  }],
  ['Viering', async (s) => {
    for (let n = 1; n <= 6; n++) { s.hit(n); await wait(200); }
    await wait(350);
    for (let i = 0; i < 6; i++) { s.perfectNote(i); await wait(120); }
    s.bloom();
  }],
];

const FIRE_NAMES = Object.keys(FIRE_SOUNDS) as FireSound[];

const RATE = 44100;
const SECONDS = 6;

/** Rendert één geluid offline door de echte keten; geeft piek en het niveau van het laatste 10 % terug. */
async function measure(run: Run): Promise<{ peak: number; tail: number }> {
  const off = new OfflineAudioContext(2, RATE * SECONDS, RATE);
  const s = new Sound({ storage: null, createContext: () => off });
  run(s);
  const buf = await off.startRendering();
  let peak = 0, tailSq = 0, tailN = 0;
  const from = Math.floor(buf.length * 0.9);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      if (i >= from) { tailSq += d[i] * d[i]; tailN++; }
    }
  }
  return { peak, tail: Math.sqrt(tailSq / tailN) };
}

export function mount(): void {
  const sound = new Sound({ storage: null });
  const btn = (label: string, onClick: () => void) => h('button', { class: 'btn btn-ghost', type: 'button', onClick }, label);

  const sliders = h('div', { class: 'proef-sliders' });
  const out = h('pre', { class: 'proef-out' });
  const showTone = () => { out.textContent = `TONE = ${JSON.stringify(TONE, null, 2)}`; };
  const slider = (label: string, key: keyof typeof TONE, min: number, max: number, step: number) => {
    const val = h('span', {}, String(TONE[key]));
    const input = h('input', { type: 'range', min, max, step, value: TONE[key] }) as HTMLInputElement;
    input.addEventListener('input', () => {
      TONE[key] = Number(input.value);
      val.textContent = input.value;
      sound.applyTone();
      showTone();
    });
    sliders.append(h('label', {}, h('span', {}, label), input, val));
  };
  slider('Volume', 'master', 0, 1, 0.01);
  slider('Galm', 'wet', 0, 0.6, 0.01);
  slider('Helderheid (Hz)', 'bright', 2000, 18000, 100);
  slider('Uitsterving ×', 'decay', 0.4, 2, 0.05);
  showTone();

  const table = h('table', { class: 'proef-table' });
  const check = async () => {
    table.replaceChildren(h('tr', {}, h('th', {}, 'Geluid'), h('th', {}, 'Piek (≤ 0,9)'), h('th', {}, 'Eind (< 0,01)')));
    const all: { name: string; peak: number; tail: number; ok: boolean }[] = [];
    const cases: [string, Run][] = [
      ...SOUNDS,
      ...FIRE_NAMES.map((n): [string, Run] => [`Vuur: ${n}`, (snd) => (snd as Sound).chargeWith(n)]),
      ['Stress: 7 noten + akkoord tegelijk', (s) => { for (let i = 0; i < 7; i++) s.perfectNote(i); s.bloom(); }],
      ['Stress: 30× plaatsen', (s) => { for (let i = 0; i < 30; i++) s.place(); }],
    ];
    for (const [name, run] of cases) {
      const r = await measure(run);
      const ok = r.peak <= 0.9 && r.tail < 0.01;
      all.push({ name, ...r, ok });
      table.append(h('tr', { class: ok ? '' : 'is-bad' }, h('td', {}, name), h('td', {}, r.peak.toFixed(3)), h('td', {}, r.tail.toFixed(4))));
    }
    Object.assign(window, { __proefResult: all });
  };

  const style = h('style', {}, `
    .proef { max-width: 720px; margin: 0 auto; padding: 24px 16px; display: grid; gap: 20px; color: var(--text); }
    .proef h1 { font-family: var(--font-display); margin: 0; }
    .proef-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
    .proef-sliders { display: grid; gap: 10px; }
    .proef h2 { font-family: var(--font-display); font-size: 18px; margin: 8px 0 0; }
    .proef-fire { display: grid; gap: 8px; }
    .proef-fire-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .proef-sliders label { display: grid; grid-template-columns: 140px 1fr 64px; gap: 10px; align-items: center; }
    .proef-out { background: var(--surface); padding: 12px; border-radius: 10px; font-size: 13px; }
    .proef-table { border-collapse: collapse; font-size: 14px; }
    .proef-table td, .proef-table th { padding: 4px 10px; text-align: left; border-bottom: 1px solid #ffffff1a; }
    .proef-table .is-bad { color: #ff5470; }
  `);

  document.getElementById('app')!.replaceChildren(style, h('div', { class: 'proef' },
    h('h1', {}, 'Geluidsproef'),
    h('p', {}, 'Tik een geluid aan. Schuif aan de klank en kopieer de waarden hieronder als het goed klinkt.'),
    h('div', { class: 'proef-grid' }, ...SOUNDS.map(([label, run]) => btn(label, () => run(sound)))),
    h('div', { class: 'proef-grid' }, ...SEQUENCES.map(([label, run]) => btn(label, () => void run(sound)))),
    h('h2', {}, 'Vuurgeluid kiezen'),
    h('p', {}, 'Links alleen het vuurgeluid, rechts met de eerste kristallen erachteraan (zoals in het spel). "Hele ronde" gebruikt het gekozen geluid.'),
    h('div', { class: 'proef-fire' }, ...FIRE_NAMES.map((n) => h('div', { class: 'proef-fire-row' },
      btn(n, () => { sound.fireSound = n; sound.chargeWith(n); }),
      btn('+ kristallen', async () => {
        sound.fireSound = n;
        sound.chargeWith(n);
        await wait(700);
        for (let i = 1; i <= 4; i++) { sound.hit(i); await wait(240); }
      }),
    ))),
    sliders,
    out,
    h('div', {}, btn('Controleer', () => void check())),
    table,
  ));
}
