# Oneindige modus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Naast de dagpuzzel een oneindige modus met zelfgekozen moeilijkheid (Makkelijk/Normaal/Moeilijk), bereikbaar via een schakelaar Dagelijks | Oneindig.

**Architecture:** Generatorinstellingen worden een parameter (`DAILY` vast, `DIFFICULTIES` per niveau). De speelronde verhuist uit `app.ts` naar een herbruikbare `Round`; twee modi (`modes/daily.ts`, `modes/endless.ts`) leveren puzzels en knoppen, `app.ts` wisselt tussen ze en deelt één `BoardView`.

**Tech Stack:** Vite 5, TypeScript 5, PixiJS 8, Vitest 2, Playwright (ongewijzigd).

**Spec:** `docs/superpowers/specs/2026-11-07-oneindige-modus-design.md` (bouwt op `docs/superpowers/specs/2026-11-07-lichtbreker-design.md`).

## Global Constraints

- Dagpuzzels mogen niet verschuiven: `generate(seed)` zonder settings geeft byte-voor-byte dezelfde uitkomst als vóór dit plan.
- `DIFFICULTIES.normal` is een eigen object, niet `DAILY`.
- Geen `Math.random`/`crypto` in `src/core`; seeds voor oneindig worden in de UI-laag gemaakt.
- Opslagsleutel en `version: 1` blijven; oude opslag zonder `endless` blijft geldig.
- Oneindige puzzels raken nooit `history`, reeks of dagverdeling.
- Geen scroll/zoom op 360×640, 390×844, 430×932, 844×390, 1280×800, in beide modi.
- Alle UI-tekst Nederlands; exacte teksten: `Dagelijks`, `Oneindig`, `Makkelijk`, `Normaal`, `Moeilijk`, `Overslaan`, `Volgende puzzel`, `Meer spelen`, `Deze puzzel overslaan?`, `Blijven`.
- Bestaande e2e-tests blijven groen (met alleen aanpassingen voor de extra schakelaar).

## Review Focus

1. Wisselen van modus tijdens een open paneel of animatie → schakelaar is uit tijdens animatie; een open paneel sluit bij wisselen; geen dubbele `Round`-acties. (Task 5 e2e)
2. Dagwissel terwijl Oneindig actief is → dagmodus herlaadt onzichtbaar; het veld toont nog steeds de oneindige puzzel. (Task 4 + 5)
3. Herladen met een ingediende oneindige puzzel → zelfde puzzel, resultaat-dok met "Volgende puzzel", geen paneel. (Task 5 e2e)
4. Dubbel tikken op "Volgende puzzel" of "Overslaan" → precies één nieuwe puzzel. (Task 5)
5. Kleiner raster (Makkelijk 5×7) → `fitCell`, toetsenbordcursor en tik-naar-vak rekenen met de juiste breedte. (Task 5 e2e)

---

### Task 1: Instellingen per niveau en generator met parameter

**Files:**
- Modify: `src/config.ts`, `src/core/generator.ts`, `tests/core/generator.test.ts`
- Create: `src/data/fallback-easy.json`, `src/data/fallback-hard.json`, `tests/core/difficulties.test.ts`

**Interfaces:**
- Produces (`config.ts`):
  ```ts
  export type Difficulty = 'easy' | 'normal' | 'hard';
  export interface GenSettings {
    width: number; height: number;
    mirrors: readonly [number, number]; walls: readonly [number, number]; crystals: readonly [number, number];
    extras: readonly [number, number];            // was: extrasPerDay
    fixedMirrors: readonly [number, number]; prisms: readonly [number, number]; filters: readonly [number, number];
    coloredCrystalShare: readonly [number, number]; maxScore: readonly [number, number]; attempts: number;
  }
  export const DAILY: GenSettings;                // exact de huidige GEN-waarden
  export const GEN = DAILY;                       // alias, bestaande imports blijven werken
  export const DIFFICULTIES: Record<Difficulty, GenSettings>;
  ```
  Waarden: `easy` = `{ ...DAILY, width: 5, height: 7, mirrors: [2,3], extras: [0,0], walls: [2,4], crystals: [6,9], maxScore: [4,7] }`; `normal` = `{ ...DAILY }`; `hard` = `{ ...DAILY, width: 8, height: 10, mirrors: [5,7], extras: [2,3], walls: [6,10], crystals: [14,20], maxScore: [9,14] }`.
- Produces (`generator.ts`): `generate(seed: number, settings: GenSettings = DAILY): Generated`; `meetsQuality(p: Puzzle, settings: GenSettings = DAILY)`; `FALLBACKS: Record<Difficulty, Puzzle>` (`normal` = bestaande `FALLBACK`); `generate` met niet-DAILY settings valt terug op de reserve van het niveau waarvan `settings` het object is (`fallbackFor(settings)`: zoek in `DIFFICULTIES`, anders `FALLBACK`).

- [ ] **Step 1: Golden test vóór de wijziging.** In `tests/core/generator.test.ts`: test `daily puzzles do not shift` met `JSON.stringify(generate(s).puzzle)` voor `s` in `[1, 2, 3, 42, 365]`, vergeleken met vastgelegde strings. Leg ze vast door de test eerst met `toMatchInlineSnapshot()` te draaien op de huidige code (`npx vitest run tests/core/generator.test.ts -u`), en commit de snapshot apart: `test: pin daily generator output`.
- [ ] **Step 2: Failing tests** `tests/core/difficulties.test.ts`:
  - `DIFFICULTIES.normal !== DAILY` en `toEqual(DAILY)`;
  - per niveau voor seeds `1..100`: `generate(s, DIFFICULTIES[d])` heeft `width/height` uit de settings, `meetsQuality(puzzle, settings).ok`, `max` binnen `maxScore`; `easy` bevat nooit `prism`/`filter`/`fixedMirror`; minstens 95 van 100 `source === 'generated'`;
  - snelheid per niveau over seeds `1..30`: gemiddeld < 400 ms, max < 2000 ms;
  - `meetsQuality(FALLBACKS[d], DIFFICULTIES[d]).ok` voor alle niveaus.
- [ ] **Step 3:** `npx vitest run tests/core/difficulties.test.ts` → FAIL (`DIFFICULTIES` ontbreekt).
- [ ] **Step 4:** Implementeer: `GEN.*` in `build`/`meetsQuality`/`generate` → `settings.*`; `extrasPerDay` → `extras`. Maak `fallback-easy.json` en `fallback-hard.json` zoals de bestaande reserve (een gegenereerde puzzel met vaste seed `20261107`, eenmalig weggeschreven via een tijdelijke test).
- [ ] **Step 5:** `npx vitest run` → alle tests PASS, inclusief de golden test zonder `-u`. Faalt een niveau op kwaliteit of snelheid: stel alleen dat niveau in `DIFFICULTIES` bij (nooit `DAILY`) en ledger het als ruling.
- [ ] **Step 6:** Commit `feat(core): generator settings per difficulty, fixed DAILY`.

### Task 2: Worker-verzoeken voor oneindig

**Files:**
- Modify: `src/worker/puzzle.worker.ts`, `src/worker/client.ts`, `tests/worker/client.test.ts`

**Interfaces:**
- Consumes: `generate`, `DIFFICULTIES`.
- Produces: `requestEndless(seed: number, difficulty: Difficulty, opts?: { workerFactory?: () => Worker | null }): Promise<Generated>`; workerberichten `{ kind: 'daily', date } | { kind: 'endless', seed, difficulty }`; antwoord `{ ok: true, result }`. `requestDaily` blijft gelijk van buiten.

- [ ] **Step 1: Failing test:** `requestEndless(7, 'easy', { workerFactory: () => null })` geeft `JSON` gelijk aan `generate(7, DIFFICULTIES.easy)`; met een nep-worker die `error` vuurt → zelfde; bestaande `requestDaily`-tests blijven.
- [ ] **Step 2–4:** FAIL → implementeer (één gedeelde `run<T>(msg, fallback: () => T)`) → PASS.
- [ ] **Step 5:** Commit `feat(worker): endless puzzle requests`.

### Task 3: Opslag en statistieken voor oneindig

**Files:**
- Create: `src/state/endless.ts`, `tests/state/endless.test.ts`
- Modify: `src/state/storage.ts`, `src/state/game.ts`, `tests/state/state.test.ts`

**Interfaces:**
- Produces (`endless.ts`):
  ```ts
  export interface EndlessStat { played: number; perfect: number; run: number; bestRun: number }
  export interface EndlessCurrent { difficulty: Difficulty; seed: number; placements: Placement[]; submitted: boolean }
  export interface EndlessState { difficulty: Difficulty; current: EndlessCurrent | null; stats: Record<Difficulty, EndlessStat> }
  export function defaultEndless(): EndlessState;            // difficulty 'normal', current null, alle stats 0
  export function parseEndless(v: unknown): EndlessState;    // ongeldige delen → standaard
  export function recordEndlessResult(e: EndlessState, d: Difficulty, score: number, max: number): EndlessState;
  ```
- Produces (`storage.ts`): `SavedState.endless: EndlessState` (altijd aanwezig na `loadState`; `defaultState()` vult `defaultEndless()`).
- Produces (`game.ts`): `resumeGame(input: DailyInput, placements: unknown, submitted: boolean): GameState` — valideert plaatsingen (ongeldig → leeg, niet ingediend), herberekent de score bij `submitted`. `startGame` gebruikt `resumeGame`. Oneindige rondes gebruiken `number: 0`.

- [ ] **Step 1: Failing tests:**
  - `loadState` op opslag zonder `endless` → `endless` gelijk aan `defaultEndless()`, rest intact;
  - `parseEndless`: onbekend niveau → `'normal'`; `current` met niet-integer seed → `null`; negatieve stats → 0; ontbrekend niveau in `stats` → 0-stat;
  - `recordEndlessResult`: `9/9` dan `9/9` dan `5/9` op `'hard'` → `{ played: 3, perfect: 2, run: 0, bestRun: 2 }`; andere niveaus ongewijzigd; geen mutatie van de invoer;
  - `resumeGame` met plaatsing op een muur → lege plaatsingen en `submitted: false`; met geldige plaatsingen en `submitted: true` → score = `trace`-score;
  - bestaande state-tests blijven groen.
- [ ] **Step 2–4:** FAIL → implementeer → PASS.
- [ ] **Step 5:** Commit `feat(state): endless state, stats and resumeGame`.

### Task 4: Speelronde uit app.ts halen (`Round`) en dagmodus erop zetten

Pure refactor: na deze taak gedraagt de site zich exact als nu.

**Files:**
- Create: `src/ui/round.ts`, `src/ui/modes/daily.ts`
- Modify: `src/ui/app.ts`, `src/ui/screens/result.ts`, `src/main.ts`

**Interfaces:**
- Produces (`round.ts`):
  ```ts
  export interface RoundHooks {
    persist(g: GameState): void;
    afterFire(g: GameState): void;            // bv. resultaatpaneel openen
    idleButtons(): HTMLElement[];             // extra knoppen vóór Opnieuw/Vuur! (dag: [], oneindig: [Overslaan])
    doneButtons(viewingSolution: boolean): HTMLElement[];   // na indienen (dag: Resultaat [+ Jouw straal])
  }
  export class Round {
    constructor(board: BoardView, dock: HTMLElement, announce: (msg: string) => void, hooks: RoundHooks);
    readonly dock: HTMLElement;               // bevat voorraad, teller, acties
    get game(): GameState;
    get busy(): boolean;
    activate(g: GameState): void;             // neemt het gedeelde veld over: setPuzzle, plaatsingen, straal, dok
    deactivate(): void;
    tap(x: number, y: number): void;
    fire(): Promise<void>;                    // bevestiging, submit, animatie, hooks.afterFire
    showSolution(): Promise<void>;
    showMine(): void;
    refresh(): void;                          // dok opnieuw tekenen
  }
  ```
- Produces (`result.ts`): `showResult(opts: { title: string; score: number; max: number; primary: { label: string; onClick: () => void }; secondary: { label: string; onClick: () => void }; extra?: HTMLElement[]; countdown?: boolean; onClose?: () => void })`. De dagmodus geeft `primary: Deel` (+ status via `extra`), `secondary: Bekijk beste oplossing`, `countdown: true`.
- Produces (`modes/daily.ts`): `createDailyMode(ctx: ModeContext): Mode` met
  ```ts
  export interface ModeContext { board: BoardView; storage: Storage | null; getSaved(): SavedState; setSaved(s: SavedState): void; announce(m: string): void; stage: HTMLElement }
  export interface Mode { readonly round: Round; readonly controls: HTMLElement | null; load(): Promise<void>; enter(): void; leave(): void; onPuzzle?: () => void }
  ```
  `controls` = extra balk onder de schakelaar (dag: `null`). Dagwissel-logica (`checkDay`, timer, visibilitychange) verhuist naar `daily.ts`; `load()` herlaadt alleen deze modus.
- `app.ts` houdt: kop, `BoardView`, `live`, routering `board.onTap/onCursor` naar de actieve `Round`, `fit()` (nu op basis van de stage), hooks voor help/stats/onPuzzle.

- [ ] **Step 1:** Draai `npm test` en `npm run e2e` als nulmeting → alles groen (noteer aantallen).
- [ ] **Step 2:** Implementeer `round.ts`, `modes/daily.ts`, pas `app.ts`/`result.ts`/`main.ts` aan. Geen gedragswijziging.
- [ ] **Step 3:** `npx tsc --noEmit`, `npm test`, `npm run e2e` → zelfde aantallen groen.
- [ ] **Step 4:** Commit `refactor(ui): extract Round and daily mode`.

### Task 5: Schakelaar, oneindige modus en niveaukeuze

**Files:**
- Create: `src/ui/modes/endless.ts`, `src/ui/segmented.ts`, `e2e/endless.spec.ts`
- Modify: `src/ui/app.ts`, `src/ui/modes/daily.ts`, `src/ui/app.css`, `src/main.ts`, `src/ui/screens/confirm.ts`, `e2e/helpers.ts`

**Interfaces:**
- Consumes: `requestEndless`, `EndlessState`, `recordEndlessResult`, `resumeGame`, `Round`, `showResult`.
- Produces (`segmented.ts`): `segmented<T extends string>(opts: { label: string; options: { value: T; text: string }[]; value: T; onChange: (v: T) => void }): { el: HTMLElement; set(v: T): void; setDisabled(on: boolean): void }` — `role="radiogroup"`, knoppen `role="radio"` met `aria-checked`, pijltjestoetsen wisselen.
- Produces (`confirm.ts`): `confirmSkip(): Promise<boolean>` — titel `Deze puzzel overslaan?`, knoppen `Blijven` / `Overslaan`.
- Produces (`modes/endless.ts`): `createEndlessMode(ctx: ModeContext): Mode`:
  - `controls` = niveaukeuze (`Makkelijk | Normaal | Moeilijk`);
  - nieuwe seed: `crypto.getRandomValues(new Uint32Array(1))[0]` (terugval `Math.floor(Math.random() * 2 ** 32)`);
  - `idleButtons` = `[Overslaan]`; `doneButtons` = `[Volgende puzzel]` (+ `Jouw straal` bij beste oplossing);
  - `afterFire` → `recordEndlessResult` + `showResult({ title: \`Oneindig, ${niveaunaam}\`, primary: Volgende puzzel, secondary: Bekijk beste oplossing })`;
  - na elke nieuwe puzzel `onPuzzle` → eerste-keer-tips (`main.ts` hook geldt voor beide modi); ?-uitleg gebruikt de puzzel van de actieve ronde;
  - overslaan / niveau wisselen met spiegels → `confirmSkip()`; zonder spiegels direct;
  - `next()` is herintreding-veilig (tweede aanroep tijdens laden doet niets).
- `app.ts`: schakelaar `Dagelijks | Oneindig` onder de titel, start op Dagelijks; wisselen: `closeSheet()`, oude modus `leave()`, nieuwe `enter()` (laadt bij eerste keer), `controls` en `dock` van de actieve modus zichtbaar; schakelaar uit zolang `round.busy`.
- `daily.ts`: resultaatpaneel krijgt `extra` knop `Meer spelen` → `app.switchTo('endless')` (via een callback in `ModeContext`: `switchTo(mode: 'daily' | 'endless'): void`).

- [ ] **Step 1: Failing e2e** `e2e/endless.spec.ts` (390×844, tutorial overgeslagen):
  - klik `Oneindig` → niveaukeuze zichtbaar, `Normaal` gekozen, veld zichtbaar;
  - plaats spiegel, `Vuur!`, `Ja, vuur!` → resultaatpaneel met `/^\d+ \/ \d+$/` en knop `Volgende puzzel`; klik → paneel weg, voorraad leeg, `endless.stats.normal.played === 1` in opslag;
  - `Overslaan` zonder spiegels → nieuwe seed in opslag (`endless.current.seed` verandert), `played` gelijk;
  - `Overslaan` met een spiegel → paneel `Deze puzzel overslaan?`; `Blijven` → spiegel staat er nog;
  - `Makkelijk` → canvas-breedte / canvas-hoogte ≈ 5/7 (± 0,02); tik-helper werkt (spiegel plaatsen lukt);
  - herladen na een ingediende oneindige puzzel en terug naar `Oneindig` → zelfde `seed`, dok toont `Volgende puzzel`, geen paneel;
  - `Dagelijks` ↔ `Oneindig` heen en weer → dag-plaatsingen en oneindige plaatsingen blijven; `history` blijft `{}`;
  - resultaatpaneel dagpuzzel → `Meer spelen` → Oneindig actief.
  - Pas `e2e/helpers.ts` `placeOneMirror` aan: kolommen/rijen uit `canvas`-maat en vakgrootte afleiden (`size = box.width / cols` met `cols` uit `data-cols` op het canvas, door `BoardView` gezet).
- [ ] **Step 2:** `npm run e2e` → nieuwe tests FAIL (geen schakelaar).
- [ ] **Step 3:** Implementeer; `BoardView.setPuzzle` zet `data-cols`/`data-rows` op het canvas.
- [ ] **Step 4:** `npm test` en `npm run e2e` → alles PASS, inclusief layout-tests (no-scroll op alle maten in beide modi: voeg in `e2e/layout.spec.ts` per maat ook een run met `Oneindig` actief toe).
- [ ] **Step 5:** Commit `feat(ui): endless mode with difficulty picker and mode switch`.

### Task 6: Statistieken, uitleg en afronding

**Files:**
- Modify: `src/ui/screens/stats.ts`, `src/main.ts`, `src/ui/app.css`, `README.md`, `e2e/endless.spec.ts`

**Interfaces:**
- Produces: `showStats(day: Stats, endless: EndlessState['stats'])` — onder de dagstatistieken een blok met kop `Oneindig` en per niveau met `played > 0` een rij: niveaunaam, `Gespeeld`, `Maximaal`, `Beste reeks`. Geen niveaus gespeeld → blok weg.

- [ ] **Step 1: Failing e2e:** na één oneindige ronde op Normaal toont `Statistieken` een blok `Oneindig` met `Normaal` en `1`; zonder oneindige rondes geen `Oneindig`-kop.
- [ ] **Step 2–4:** FAIL → implementeer → PASS.
- [ ] **Step 5:** README: sectie "Moeilijkheid aanpassen" (`DIFFICULTIES` in `src/config.ts`, `DAILY` nooit aanpassen na lancering, tests vangen onwerkbare combinaties).
- [ ] **Step 6:** `npx tsc --noEmit && npm test && npm run build && npm run e2e` → alles groen. Commit `feat(ui): endless stats, docs`.
