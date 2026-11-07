# Polish: geluid en viering — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Glazige, zelf opgewekte geluidseffecten met een aan/uit-knop, en een spectaculaire viering bij het maximum.

**Architecture:** De nieuwe map `src/audio/` bevat pure helpers (`scale.ts`, `cue.ts`, `pref.ts`), klankrecepten (`voices.ts`) en de motor (`sound.ts`). `Round` krijgt een `Sfx`-object en roept het aan. De render-laag (`fire.ts`, het nieuwe `celebrate.ts`) kent geen audio en meldt momenten via callbacks.

**Tech Stack:** TypeScript, Web Audio API, PixiJS 8, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-polish-geluid-viering-design.md`

## Global Constraints

- `DAILY` in `src/config.ts` en de puzzelgeneratie niet aanraken.
- Geen nieuwe dependencies en geen geluidsbestanden.
- Voorkeur: `localStorage['lichtbreker:sound']` = `'on'` | `'off'`, standaard aan, altijd in try/catch.
- Toonladder: D-groot pentatonisch, grondtoon D5 = 587,33 Hz.
- Max. 12 gelijktijdige stemmen. Elke offline-render: piek ≤ 0,9 en het laatste 10 % < 0,01.
- `prefers-reduced-motion`: geen puls, golf, ademing of regen. Het geluid speelt wel.
- UI-teksten zijn Nederlands. Geluidsknop: `aria-label="Geluid"`, `aria-pressed`.
- De geluidsproef (`?geluid`) bestaat alleen in dev, via een dynamische import achter `import.meta.env.DEV`.
- Playwright draait op poort 4173. Ruim een achtergebleven `vite preview` eerst op. Schrijf bestanden met backslashes met de Write-tool.

## Review Focus

1. **Geluid vóór het eerste gebaar of in een browser zonder Web Audio.** Geen fouten en geen console-errors: zie de Sound-test zonder AudioContext in Task 2 en de e2e-consolecheck in Task 4.
2. **Modus wisselen of een nieuwe puzzel tijdens de viering.** Geen hangende nodes, de knoppen komen terug en `is-perfect` hoort niet bij de nieuwe ronde (Task 5, step "set() wist is-perfect").
3. **Resize tijdens de viering** laat het spel niet bevriezen (e2e in Task 6).
4. **Heel lange reeksen kristallen.** De tinkels blijven welluidend en worden niet schel (`hitStep`-test tot n = 50 in Task 1).
5. **Snel tikken / spammen** stapelt geen kakofonie op (12-stemmenlimiet, getest in Task 2).

---

### Task 1: Pure audio-helpers (`scale`, `cue`)

**Files:**
- Create: `src/audio/scale.ts`, `src/audio/cue.ts`
- Test: `tests/audio/scale.test.ts`, `tests/audio/cue.test.ts`

**Interfaces:**
- Produces:
  - `ROOT_HZ = 587.33`
  - `PENTA = [0, 2, 4, 7, 9]` (halve tonen)
  - `noteFreq(step: number): number`: stap 0 = grondtoon, stap 5 = octaaf hoger; negatieve stappen gaan omlaag
  - `hitStep(n: number): number` (n ≥ 1)
  - `CHORD_STEPS: readonly number[]`: D6/9-arpeggio uit de pentatonische ladder: `[0, 2, 3, 4, 6, 7, 8]` → D F# A B E' F#' A'
  - `tapCue(before: readonly Placement[], after: readonly Placement[]): 'place' | 'rotate' | 'remove'`

- [ ] **Step 1: Schrijf de falende tests**
  - `noteFreq(0)` ≈ 587.33, `noteFreq(5)` ≈ 1174.66, `noteFreq(1)` ≈ 587.33·2^(2/12), `noteFreq(-5)` ≈ 293.67 (toCloseTo, 1).
  - `hitStep(1..10)` is strikt stijgend. Voor n in 1..50 geldt `0 ≤ hitStep(n) ≤ 10` en `noteFreq(hitStep(n)) ≤ noteFreq(10)`. Na stap 10 pendelt het tussen 5 en 10 (geen twee keer dezelfde stap achter elkaar).
  - `tapCue`: `[]→[p]` = place. `[p(x1,y1,'/')]→[p(x1,y1,'\\')]` = rotate. `[p]→[]` = remove.
- [ ] **Step 2:** `npx vitest run tests/audio`. Verwacht: FAIL (module bestaat niet).
- [ ] **Step 3:** Implementeer. `hitStep(n)`: `n-1` voor n ≤ 11. Daarna pendelen: `10 - ((n - 11) % 10 < 5 ? (n-11)%10 + 1 : 9 - (n-11)%10)` of gelijkwaardig, zolang de test slaagt. `tapCue` vergelijkt de lengte; bij gelijke lengte is het rotate.
- [ ] **Step 4:** `npx vitest run tests/audio`. Verwacht: PASS.
- [ ] **Step 5:** Commit `feat(audio): toonladder en tik-cues`.

### Task 2: Geluidsmotor (`pref`, `voices`, `sound`)

**Files:**
- Create: `src/audio/pref.ts`, `src/audio/voices.ts`, `src/audio/sound.ts`
- Test: `tests/audio/pref.test.ts`, `tests/audio/sound.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `pref.ts`: `SOUND_KEY = 'lichtbreker:sound'`, `readSoundOn(storage: Storage | null): boolean`, `writeSoundOn(storage: Storage | null, on: boolean): void`.
  - `sound.ts`:
    ```ts
    export interface Sfx {
      place(): void; rotate(): void; remove(): void; reject(): void; reset(): void;
      charge(): void; hit(n: number, opts?: { soft?: boolean }): void;
      perfectNote(i: number): void; bloom(): void; solutionMirror(k: number): void;
    }
    export const silentSfx: Sfx;
    export class Sound implements Sfx {
      constructor(opts: { storage: Storage | null; createContext?: () => AudioContext | null });
      get on(): boolean; setOn(on: boolean): void;
      /** Test/proef: bouw de keten op een andere context (OfflineAudioContext). */
      static chain(ctx: BaseAudioContext): { input: AudioNode; voices: number };
      readonly activeVoices: number;
    }
    ```
    `createContext` is standaard `() => (typeof AudioContext !== 'undefined' ? new AudioContext() : null)` en wordt pas bij het eerste geluid aangeroepen. Daarbij wordt ook een `pointerdown`/`keydown`-listener (`once`) geregistreerd die `resume()` doet, plus een `visibilitychange`-listener voor suspend/resume.
  - `voices.ts`: `type Voice = (ctx: BaseAudioContext, out: AudioNode, at: number, o: VoiceOpts) => number` (geeft de duur in s terug). `VoiceOpts = { freq?: number; gain?: number; detuneCents?: number }`. Recepten: `glass`, `tick`, `slideDown`, `tok`, `breath`, `bell`, `chordCloud`. Plus `impulse(ctx, seconds = 1.6): AudioBuffer`.

- [ ] **Step 1: Schrijf de falende tests**
  - pref: `readSoundOn(null)` = true. Opslag zonder sleutel geeft true. `'off'` geeft false. Een `getItem` die een fout gooit geeft true. `writeSoundOn` met een `setItem` die een fout gooit gooit zelf niets. Na write(false) leest het false terug.
  - sound: `new Sound({ storage: null, createContext: () => null })`: alle `Sfx`-methoden aanroepen gooit niets.
  - sound: `createContext` die een fout gooit geeft ook geen fout.
  - sound: `setOn(false)` schrijft `'off'` naar de opslag.
  - Stemmenlimiet: gebruik een nep-context (een minimaal object met `createOscillator`/`createGain`/… dat nodes registreert en `currentTime` geeft). Roep 30× `place()` aan; dan geldt `activeVoices ≤ 12`. Houd de nep klein, als helper `tests/helpers/fakeAudio.ts`.
- [ ] **Step 2:** `npx vitest run tests/audio`. Verwacht: FAIL.
- [ ] **Step 3: Implementeer `pref.ts` en `voices.ts`.** Glas = sinussen op ×[1, 2.76, 5.40, 8.93] met gains [1, 0.45, 0.22, 0.1], aanzet 3 ms, uitsterving ≈ 1.2 s / partiaalindex^0.7, plus een band-pass-ruisklik van 5 ms (≈ 3 kHz). De overige recepten volgen de tabel in de spec. Elke stem eindigt op `gain → 0.0001` via `exponentialRampToValueAtTime` en `osc.stop(at + dur)`.
- [ ] **Step 4: Implementeer `sound.ts`.**
  - Keten: master `GainNode` (0.25) → droog (0.8) + convolver(impulse) → nat (0.22) → `DynamicsCompressor` (threshold −10, ratio 12, attack 0.003, release 0.25) → destination.
  - Per aanroep ±8 cent detune en ±1.5 dB variatie.
  - Stemmen worden bijgehouden in een array met eindtijd. Boven de 12 krijgt de oudste in 30 ms een ramp naar 0.
  - `hit(n, {soft})` = glass op `noteFreq(hitStep(n))`, met soft op −6 dB.
  - `perfectNote(i)` = bell op `noteFreq(CHORD_STEPS[i % 7] + 5 * Math.floor(i / 7))`, begrensd op stap 15.
  - `bloom()` = chordCloud op `CHORD_STEPS`.
  - `solutionMirror(k)` = tick op stap `3 + k` (max 9), −6 dB.
  - Alle publieke methoden zijn in try/catch gewikkeld.
- [ ] **Step 5:** `npx vitest run tests/audio` en `npx tsc --noEmit`. Verwacht: PASS en geen fouten.
- [ ] **Step 6:** Commit `feat(audio): glazige geluidsmotor met galm en limiter`.

### Task 3: Geluidsproef-pagina (dev) met render-check

**Files:**
- Create: `src/audio/proef.ts`
- Modify: `src/main.ts` (bovenaan: `if (import.meta.env.DEV && new URLSearchParams(location.search).has('geluid')) { void import('./audio/proef').then((m) => m.mount()); }`, en dan de rest van de app niet starten)

**Interfaces:**
- Consumes: `Sound`, `Sound.chain`, de recepten uit Task 2.
- Produces: `mount(): void` (vervangt `#app` door het proefpaneel).

- [ ] **Step 1: Implementeer `mount()`.**
  - Eén knop per `Sfx`-methode (Nederlandse labels).
  - "8 tinkels": `hit(1..8)` om de 140 ms.
  - "Viering": `perfectNote(0..7)` om de 110 ms, daarna `bloom()`.
  - Volumeschuif op de master.
  - Knop **Controleer**: rendert elk geluid in een `OfflineAudioContext(2, 44100*4, 44100)` via `Sound.chain` en toont een tabel met piek en eindniveau (RMS van het laatste 10 %), rood boven de grenzen uit de Global Constraints. De tabel staat ook in `window.__proefResult`, zodat de browser-pane hem kan lezen.
- [ ] **Step 2:** Start vite op een vrije poort (bijv. `npx vite --port 5199`), open `http://localhost:5199/?geluid` in de browser-pane, klik op Controleer en lees `window.__proefResult`. Verwacht: alle pieken ≤ 0,9 en alle eindniveaus < 0,01. Pas bij afwijking de gains en uitsterving aan.
- [ ] **Step 3:** `npm run build` en controleer dat `proef` niet in `dist/assets/*.js` staat (`grep -l "Controleer" dist/assets/*.js` geeft niets). Verwacht: geen treffer.
- [ ] **Step 4:** Commit `feat(audio): geluidsproef-pagina voor bijstemmen`.

### Task 4: Geluid inbouwen in ronde, modi en kop

**Files:**
- Modify: `src/ui/round.ts`, `src/ui/modes/types.ts` (`sfx: Sfx` in `ModeContext`), `src/ui/modes/daily.ts`, `src/ui/modes/endless.ts` (`new Round(ctx.board, ctx.announce, ctx.sfx, {...})`), `src/ui/app.ts`, `src/render/fire.ts` (`playSolution` krijgt `opts?: { onMirror?(k: number): void; onHit?(n: number): void }`)
- Test: `e2e/sound.spec.ts`

**Interfaces:**
- Consumes: `Sfx`, `Sound`, `tapCue`.
- Produces: `Round` constructor `(board, announce, sfx: Sfx, hooks)`. Een knop `button.icon-btn[aria-label="Geluid"]` in `header.top`, vóór Uitleg.

- [ ] **Step 1: Schrijf de falende e2e-tests** in `e2e/sound.spec.ts`:
  - `'sound toggle persists across reloads'`: de knop Geluid heeft `aria-pressed="true"`. Na een klik is het `"false"` en is `localStorage['lichtbreker:sound']` gelijk aan `'off'`. Na herladen is het nog steeds `"false"`.
  - `'a round with sound on logs no errors'`: verzamel `page.on('console')` (type error) en `pageerror`, plaats een spiegel, draai hem (dezelfde cel nog eens tikken), vuur, wacht op dialoog Resultaat. Verwacht: lijst leeg.
- [ ] **Step 2:** `npx playwright test e2e/sound.spec.ts`. Verwacht: FAIL (geen knop Geluid).
- [ ] **Step 3: Implementeer.**
  - `app.ts` maakt `new Sound({ storage })` en de knop. De knop gebruikt `svgIcon`: een luidspreker met golfjes bij aan, met een kruis bij uit. Hij wisselt `aria-pressed` en roept `setOn` aan. `sfx` gaat in `modeCtx`.
  - `round.ts`:
    - `tap` geaccepteerd → `sfx[tapCue(oldPlacements, r.state.placements)]()`; geweigerd → `sfx.reject()`
    - `reset` (alleen als er plaatsingen waren) → `sfx.reset()`
    - in `fire` na `yes` → `sfx.charge()`
    - in `onHit` → `sfx.hit(n)`
    - `showSolution` → `playSolution(..., { onMirror: (k) => sfx.solutionMirror(k), onHit: (n) => sfx.hit(n, { soft: true }) })`
- [ ] **Step 4:** `npm test`, `npm run build` en `npx playwright test e2e/sound.spec.ts e2e/play.spec.ts`. Verwacht: alles PASS.
- [ ] **Step 5:** Commit `feat: geluid bij spelen met aan/uit-knop`.

### Task 5: Viering bij het maximum

**Files:**
- Create: `src/render/celebrate.ts`
- Modify: `src/render/fire.ts` (`play`-opts uitbreiden; de oude `shardRain`-aanroep gaat weg), `src/render/particles.ts` (`shardRain` vernieuwen: golf van links naar rechts, twinkle, `count = 36`), `src/ui/round.ts`, `src/ui/app.css`
- Test: `tests/ui/celebrate.test.ts`

**Interfaces:**
- Consumes: `beamLength`, `hitDistances`, `drawBeam`, `pointsAt` (beamFx), `Sfx.perfectNote`, `Sfx.bloom`.
- Produces:
  - `celebrationTimeline(t: TraceResult, width: number): { pulseMs: number; pulses: { cell: number; at: number }[]; waveFrom: number | null }`. De tijden `at` zijn in ms vanaf de start van de puls (na de flits van 250 ms). `pulseMs = clamp(len / 18 * 1000, 500, 900)`. `waveFrom` is de cel van het laatste getelde kristal (of null als er geen is).
  - `celebrate(board: BoardView, t: TraceResult, opts: { onNote(i: number): void; onBloom(): void; onPerfect(): void }): Promise<void>`. Resolvet na de teller (stap 5); de regen loopt door.
  - `FireFx.play(t, { perfect, onHit, onNote?, onBloom?, onPerfect? })`.

- [ ] **Step 1: Schrijf de falende tests** (`celebrationTimeline` met een kleine trace via `fromAscii` + `trace` uit core):
  - `pulses` heeft dezelfde volgorde als de oplopende `hitDistances`, en alle `at` liggen binnen `[0, pulseMs]`.
  - `pulseMs` ligt binnen 500..900.
  - `waveFrom` is gelijk aan de laatste pulse-cel.
  - Lege trace geeft `pulses: []` en `waveFrom: null`.
- [ ] **Step 2:** `npx vitest run tests/ui/celebrate.test.ts`. Verwacht: FAIL.
- [ ] **Step 3: Implementeer `celebrate.ts`** volgens de tijdlijn in spec §2:
  - een eigen additieve Graphics-laag in `board.fxLayer` voor flits en komeet (staart 1,2 vak)
  - kristalpuls (scale 1→1,35→1 met `spring`) + ring via de bestaande `burst`-stijl ring
  - schokgolf vanuit `board.center(waveFrom)` met een straal tot de diagonaal van het veld, in 700 ms
  - ademing: `root.pivot`/`position` op het midden, schaal 1→1,02→1 in 500 ms, en daarna pivot en position terugzetten
  - reduced motion: alleen een gouden rand (`rect` stroke in `COLORS.accent`, 300 ms in en 300 ms uit), `onNote(i)` om de 80 ms, dan `onBloom()` en `onPerfect()`

  Ruim alle Graphics op met `.destroy()` na afloop.
- [ ] **Step 4: Wijzig `fire.ts` en `round.ts`.**
  - `play` roept bij `perfect` `await celebrate(...)` aan vóór het wegdimmen.
  - `round.fire` geeft `onNote: (i) => sfx.perfectNote(i)`, `onBloom: () => sfx.bloom()` en `onPerfect: () => counter.classList.add('is-perfect')` mee.
  - `renderCounter` zet `is-perfect` alleen als `g.submitted && !viewing && g.score >= g.max`.
  - `set()` (nieuwe ronde) wist hem.
- [ ] **Step 5: CSS** in `app.css`: `.counter.is-perfect { color: var(--accent); text-shadow: 0 0 12px …accent…, 0 0 28px …; animation: counter-pop 0.4s var(--ease-out); }` met keyframes 1 → 1.35 → 1, en `@media (prefers-reduced-motion: reduce) { .counter.is-perfect { animation: none; } }`. Controleer of `--accent` in `theme.css` bestaat; zo niet, gebruik de bestaande accentvariabele.
- [ ] **Step 6:** `npm test` en `npm run build`. Verwacht: PASS.
- [ ] **Step 7:** Bekijk het in de dev-server (browser-pane). Vuur met de beste oplossing via `__lb` in dev: zet de plaatsingen gelijk aan `__lb.game.solution` door localStorage `current.placements` te zetten en te herladen. Maak een screenshot midden in de viering. Verwacht: zichtbare puls, golf en gouden teller.
- [ ] **Step 8:** Commit `feat(render): spectaculaire viering bij het maximum`.

### Task 6: E2E voor de perfecte ronde

**Files:**
- Create: `e2e/perfect.spec.ts`
- Modify: `e2e/helpers.ts` (`seedPerfect(page)`)

**Interfaces:**
- Consumes: `getDaily`, `amsterdamDate` uit `src/core/daily.ts` (draait in Node).
- Produces: `seedPerfect(page: Page): Promise<void>`: een addInitScript die `lichtbreker:v1` zet op `{ version: 1, tutorialSeen: true, seenElements: [alle soorten], current: { number, placements: solution, submitted: false, score: null }, history: {} }`.

- [ ] **Step 1: Schrijf de tests:**
  - `'a perfect round celebrates'`: na seedPerfect, ready en vuren + bevestigen is de dialoog Resultaat zichtbaar (timeout 15 s), heeft `.counter` de klasse `is-perfect` en toont `.result-score` "max / max". Sluit de dialoog en klik "Beste oplossing": daarna zijn "Jouw straal" zichtbaar en `is-perfect` weg. Klik "Jouw straal": `is-perfect` is terug.
  - `'perfect round with reduced motion'`: `page.emulateMedia({ reducedMotion: 'reduce' })`, en dezelfde controles tot de dialoog en `is-perfect`.
  - `'resizing during the celebration does not freeze'`: na het bevestigen 3 resizes om de 250 ms, daarna is de dialoog Resultaat zichtbaar.
- [ ] **Step 2:** `npx playwright test e2e/perfect.spec.ts`. Verwacht: PASS. Faalt het, debug dan met systematic-debugging en niet door timeouts op te rekken.
- [ ] **Step 3:** Commit `test(e2e): perfecte ronde en viering`.

### Task 7: Eindcontrole en bijstemmen met de gebruiker

- [ ] **Step 1:** `npm test`, `npm run build` en `npm run e2e` (eerst controleren dat poort 4173 vrij is). Verwacht: alles groen.
- [ ] **Step 2:** Start een dev-server op een vrije poort en laat de gebruiker `?geluid` en een echte ronde beluisteren. Verwerk de feedback in `voices.ts`/`sound.ts` en herhaal de render-check.
- [ ] **Step 3:** README: korte alinea "Geluid" (aan/uit-knop, `?geluid`-proef in dev). Commit.
- [ ] **Step 4:** Eindreview van de hele branch (requesting-code-review), feedback verwerken en weer alles groen.
- [ ] **Step 5:** Na akkoord van de gebruiker: merge naar `main` en pushen.
