# Lichtbreker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een statische, mobiel-eerst dagpuzzelsite waarop je spiegels plaatst om een laserstraal langs zoveel mogelijk kristallen te leiden, met gloeiende WebGL-animaties.

**Architecture:** Pure TypeScript-kern (`src/core`: straal, solver, generator, dagpuzzel) zonder DOM, die in een Web Worker draait. Het speelveld wordt getekend met PixiJS (`src/render`), de rest van de UI is HTML/CSS (`src/ui`). Spelstatus en statistieken staan in `localStorage` (`src/state`).

**Tech Stack:** Vite 5, TypeScript 5 (strict), PixiJS 8, pixi-filters 6, Vitest 2, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-lichtbreker-design.md` — lees die naast dit plan.

## Global Constraints

- Statische site, geen server; Vite `base: './'`; hosting op GitHub Pages.
- Alle tekst in de UI is Nederlands.
- Op telefoon (360×640 t/m 430×932) en desktop: **geen scrollbalk, geen zoom**, veld volledig zichtbaar. `html, body { overflow: hidden; overscroll-behavior: none }`, `touch-action: manipulation`, hoogte via `100dvh`.
- Alleen donker thema.
- Dag wisselt om middernacht `Europe/Amsterdam`; puzzel #1 = `EPOCH` uit `src/config.ts` (`'2026-11-07'`); datums vóór `EPOCH` → #1.
- Standaard raster 7 breed × 9 hoog (`DEFAULT_WIDTH = 7`, `DEFAULT_HEIGHT = 9`); de code mag nergens anders van een vaste rastermaat uitgaan.
- `src/core` importeert nooit iets uit DOM, Pixi of `src/ui`/`src/render`.
- Geen `Math.random` in `src/core`; altijd `createRng(seed)`.
- Het maximum is nooit zichtbaar vóór indienen.
- Geen "Vandaag: …"-tekst over de elementen van de dag.
- `prefers-reduced-motion: reduce` → geen deeltjes, geen schudden, korte fades.
- Doel 60 fps op een gemiddelde telefoon.

## Review Focus

1. Telefoon draaien of venster verkleinen midden in een spel → veld schaalt mee, nog steeds geen scroll, spiegels blijven staan. (Task 10 layout-test, Task 14 e2e.)
2. Middernacht verstrijkt terwijl het tabblad open of op de achtergrond staat → bij terugkeer de nieuwe puzzel; het resultaat van gisteren blijft in de historie en wordt niet op vandaag geplakt. (Task 7 + Task 13.)
3. Opgeslagen tussenstand hoort bij een ouder puzzelnummer → vandaag begint leeg, historie en reeks blijven. (Task 7.)
4. Twee keer snel op "Ja, vuur!" of tikken op het veld tijdens de vuur-animatie → precies één inzending, geen wijzigingen meer. (Task 7 + Task 12.)
5. Klembord/`navigator.share` niet beschikbaar of geweigerd → nette melding, geen crash. (Task 12.)

---

## Bestandsstructuur

```
Lichtbreker/
  index.html                     viewport-meta, #app, laadt src/main.ts
  vite.config.ts  tsconfig.json  package.json  playwright.config.ts
  .github/workflows/pages.yml
  src/main.ts                    bootstrapt app (ui/app.ts)
  src/config.ts                  EPOCH, rastermaat, generatorinstellingen
  src/core/types.ts              alle kerntypes + richtingtabellen
  src/core/rng.ts                createRng, hashSeed
  src/core/ascii.ts              fromAscii (tests, fallback, later portal)
  src/core/validate.ts           validatePuzzle, validatePlacements
  src/core/beam.ts               trace
  src/core/solver.ts             solve
  src/core/greedy.ts             greedy
  src/core/generator.ts          generate
  src/core/daily.ts              amsterdamDate, puzzleNumber, msUntilNextPuzzle, getDaily
  src/core/share.ts              shareText
  src/data/overrides.json  src/data/fallback.json
  src/state/storage.ts           SavedState laden/opslaan/valideren
  src/state/game.ts              GameState-overgangen (tik, reset, submit)
  src/state/stats.ts             computeStats
  src/worker/puzzle.worker.ts  src/worker/client.ts
  src/render/board.ts            BoardView (Pixi-app, veld, invoer)
  src/render/beamFx.ts           straal tekenen + gloed
  src/render/fire.ts             vuur-animatie, oplossing afspelen
  src/render/particles.ts        deeltjes/scherven
  src/ui/theme.css               design tokens + basis
  src/ui/layout.ts               computeCellSize
  src/ui/app.ts                  schermen + bedrading
  src/ui/screens/*.ts            tutorial, help, result, stats, confirm
  tests/**                       Vitest (unit)  e2e/** Playwright
```

---

### Task 1: Scaffold, config en seeded RNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/config.ts`, `src/core/rng.ts`, `.gitignore` (`node_modules`, `dist`, `test-results`, `playwright-report`), `.gitattributes` (`* text=auto eol=lf`)
- Test: `tests/core/rng.test.ts`

**Interfaces:**
- Produces: `createRng(seed: number): Rng` met `Rng = { next(): number /* [0,1) */; int(min: number, max: number): number /* inclusief */; pick<T>(arr: readonly T[]): T; shuffle<T>(arr: T[]): T[] }`; `hashSeed(...parts: (string|number)[]): number` (32-bit unsigned).
- Produces `src/config.ts`: `EPOCH = '2026-11-07'`, `DEFAULT_WIDTH = 7`, `DEFAULT_HEIGHT = 9`, `GEN` (zie Task 6).

- [ ] **Step 1:** `npm init -y`; installeer `vite typescript vitest @playwright/test` (dev) en `pixi.js@^8 pixi-filters@^6`. Scripts: `dev: vite`, `build: tsc --noEmit && vite build`, `test: vitest run`, `e2e: playwright test`. `tsconfig` strict, `"lib": ["ES2022","DOM","WebWorker"]`, `"resolveJsonModule": true`. `vite.config.ts`: `base: './'`, vitest `environment: 'node'`, `include: ['tests/**/*.test.ts']`.
- [ ] **Step 2: Failing test** `tests/core/rng.test.ts`:
  - zelfde seed → zelfde reeks van 10 `next()`-waarden; andere seed → andere reeks;
  - 10 000 × `int(3, 6)` geeft alleen 3..6 en elk komt voor;
  - `hashSeed('a', 1) === hashSeed('a', 1)` en `!== hashSeed('a', 2)`.
- [ ] **Step 3:** `npx vitest run tests/core/rng.test.ts` → FAIL (module ontbreekt).
- [ ] **Step 4:** Implementeer `rng.ts` met mulberry32; `hashSeed` met FNV-1a over `parts.join('|')`.
- [ ] **Step 5:** Test → PASS. `npm run build` slaagt (index.html toont tijdelijk "Lichtbreker").
- [ ] **Step 6:** Commit `chore: scaffold, config, seeded rng`.

### Task 2: Types, ASCII-bouwer en validatie

**Files:**
- Create: `src/core/types.ts`, `src/core/ascii.ts`, `src/core/validate.ts`
- Test: `tests/core/validate.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type Dir = 0 | 1 | 2 | 3;            // 0 rechts, 1 omlaag, 2 links, 3 omhoog
  export const DX = [1, 0, -1, 0] as const;
  export const DY = [0, 1, 0, -1] as const;
  export type MirrorKind = '/' | '\\';
  export const REFLECT: Record<MirrorKind, readonly Dir[]> = { '/': [3, 2, 1, 0], '\\': [1, 0, 3, 2] };
  export type FilterColor = 'red' | 'green' | 'blue';
  export type BeamColor = 'white' | FilterColor;
  export type Cell =
    | { kind: 'empty' } | { kind: 'wall' }
    | { kind: 'crystal'; color: BeamColor }          // 'white' = elke straal
    | { kind: 'fixedMirror'; mirror: MirrorKind }
    | { kind: 'prism' } | { kind: 'filter'; color: FilterColor }
    | { kind: 'source'; dir: Dir };
  export type ElementKind = 'fixedMirror' | 'prism' | 'filter';
  export interface Puzzle { version: 1; width: number; height: number; mirrors: number; cells: Cell[] } // rij-voor-rij, index = y*width+x
  export interface Placement { x: number; y: number; mirror: MirrorKind }
  ```
- Produces: `fromAscii(rows: string[], mirrors: number): Puzzle` — tekens: `.` leeg, `#` muur, `o` wit kristal, `r g b` gekleurd kristal, `R G B` filter, `/` `\` vaste spiegel, `P` prisma, `> v < ^` bron (richting 0/1/2/3).
- Produces: `validatePuzzle(p: unknown): string[]` (leeg = geldig); `validatePlacements(p: Puzzle, pl: unknown): Placement[] | null`.

- [ ] **Step 1: Failing tests** `tests/core/validate.test.ts`:
  - `validatePuzzle(fromAscii(['>.o','...','...'], 2))` → `[]`;
  - fout bij: geen bron, twee bronnen, bron niet op de rand, bron die naar buiten wijst (`['<..', ...]` met `<` op x=0), `cells.length !== width*height`, `width` buiten 3..12, `height` buiten 3..14, `mirrors` buiten 1..8, onbekende `kind`/kleur, `version !== 1`, `null`, `'tekst'`;
  - `validatePlacements(p, [{x:1,y:1,mirror:'/'}])` → die lijst; `null` bij: plaatsing op niet-leeg vak, buiten raster, dubbel vak, meer dan `mirrors`, onbekende `mirror`, niet-array.
- [ ] **Step 2:** `npx vitest run tests/core/validate.test.ts` → FAIL.
- [ ] **Step 3:** Implementeer `types.ts`, `ascii.ts` (gooit `Error` bij onbekend teken of ongelijke rijlengtes), `validate.ts`.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit `feat(core): types, ascii builder, validation`.

### Task 3: Straal volgen (`trace`)

**Files:**
- Create: `src/core/beam.ts`
- Test: `tests/core/beam.test.ts`, `tests/helpers/randomBoard.ts`

**Interfaces:**
- Consumes: Task 2-types, `createRng`.
- Produces:
  ```ts
  export interface Point { x: number; y: number }      // in vakeenheden; midden van vak (x,y) = (x+0.5, y+0.5)
  export interface Segment { from: Point; to: Point; color: BeamColor; startDist: number; endDist: number }
  export interface TraceResult { segments: Segment[]; hit: Set<number>; score: number }  // hit = celindices
  export function trace(p: Puzzle, placements: readonly Placement[]): TraceResult;
  ```
- Produces (test-helper): `randomBoard(rng: Rng, w: number, h: number, mirrors: number): Puzzle` — geldige puzzel met willekeurige muren, kristallen (ook gekleurd), filters, prisma's en vaste spiegels.

Regels (spec 3.3): start bij het midden van de bron, kleur `white`. Een segment eindigt in het midden van een vak waar de straal draait, splitst of van kleur wisselt; bij een muur of de bron op het grensvlak (midden + 0,5 in de looprichting); buiten het raster op de rand. Prisma: tak stopt, nieuwe takken met richting `(d+3)%4` en `(d+1)%4` vanaf het prismamidden. Bezocht-sleutel `(celindex, richting, kleur)` over alle takken → tak stopt. Takken in BFS-volgorde. `startDist`/`endDist` = afgelegde weg vanaf de bron langs die tak.

- [ ] **Step 1: Failing tests** `tests/core/beam.test.ts`:
  - `['>..o']`, geen spiegels → `score 1`, `hit` bevat `3`, `segments` = `[{from:{x:0.5,y:0.5}, to:{x:4,y:0.5}, color:'white', startDist:0, endDist:3.5}]`;
  - `['>..','...','.o.']` + `{x:1,y:0,mirror:'\\'}` → `score 1`; met `'/'` → `score 0`;
  - `['>.#o']` → `score 0`, laatste segment eindigt op `x: 2`;
  - `['>RrB.b']`: rood filter, rood kristal geraakt, blauw filter, blauw kristal geraakt → `score 2`; `['>.r']` → `score 0`; `['>Bo']` → `score 1` (wit kristal telt bij elke kleur);
  - `['...', '>P.', '...']` met `o` op (1,0) en (1,2) (`['.o.','>P.','.o.']`) → `score 2`, twee takken;
  - kristal twee keer gepasseerd telt één keer;
  - vaste spiegel kaatst als spelersspiegel;
  - fuzz: 500 × `randomBoard(createRng(i), 6, 6, 3)` zonder plaatsingen → `trace` eindigt, `segments.length < 6*6*4*4*2`.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementeer `trace` en `randomBoard`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(core): beam tracing`.

### Task 4: Solver

**Files:**
- Create: `src/core/solver.ts`
- Test: `tests/core/solver.test.ts`

**Interfaces:**
- Consumes: `trace`, types.
- Produces: `solve(p: Puzzle, mirrorLimit = p.mirrors): { max: number; solution: Placement[] }`.

Algoritme (spec 4.3): diepte-eerst met beslissingen `Map<celindex, 'none' | MirrorKind>`. Volg de straal in BFS-volgorde en stop bij het eerste lege, onbesliste vak waar een tak binnenkomt; vertak naar `'none'`, `'/'`, `'\\'` (spiegels alleen als er nog over zijn). Geen onbeslist vak meer → blad, score = `trace`-score. Snoei: score van het voorvoegsel + aantal nog niet geraakte kristallen ≤ beste → stop. Hervat het volgen vanaf het vertakpunt in plaats van opnieuw vanaf de bron als de snelheidstest anders faalt.

- [ ] **Step 1: Failing tests:**
  - `fromAscii(['>..','...','.o.'], 1)` → `max 1`; `trace(p, solution).score === 1`; `solution.length <= 1`;
  - brute force: voor 200 × `randomBoard(createRng(1000+i), 4, 4, k)` met `k = 1 + (i % 3)`: `solve(p).max` === maximum over **alle** combinaties van ≤ k plaatsingen op lege vakken (testhelper `bruteForceMax`); en `trace(p, solve(p).solution).score === max`;
  - `solve(p, 0).max === trace(p, []).score`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementeer. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(core): optimal solver`.

### Task 5: Gretige strategie

**Files:**
- Create: `src/core/greedy.ts`
- Test: `tests/core/greedy.test.ts`

**Interfaces:**
- Produces: `greedy(p: Puzzle): { score: number; placements: Placement[] }` (spec 4.4: telkens beste vak+oriëntatie, gelijkspel → eerste in leesvolgorde, `'/'` vóór `'\\'`; stop bij geen verbetering).

- [ ] **Step 1: Failing tests:** `greedy(fromAscii(['>..','...','.o.'],1)).score === 1`; op 50 `randomBoard`s geldt `greedy(p).score <= solve(p).max` en `trace(p, greedy(p).placements).score === greedy(p).score`; deterministisch (twee keer zelfde uitkomst).
- [ ] **Step 2–4:** FAIL → implementeer → PASS.
- [ ] **Step 5:** Commit `feat(core): greedy baseline`.

### Task 6: Generator en reservepuzzel

**Files:**
- Create: `src/core/generator.ts`, `src/data/fallback.json`
- Modify: `src/config.ts` (voeg `GEN` toe)
- Test: `tests/core/generator.test.ts`

**Interfaces:**
- Consumes: `createRng`, `hashSeed`, `trace`, `solve`, `greedy`, `validatePuzzle`.
- Produces: `generate(seed: number): { puzzle: Puzzle; max: number; solution: Placement[]; source: 'generated' | 'fallback' }`; `meetsQuality(p: Puzzle): { ok: boolean; max: number; solution: Placement[] }`; `FALLBACK: Puzzle` (uit `fallback.json`).

`GEN` in `config.ts`:
```ts
export const GEN = {
  width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT,
  mirrors: [3, 6], walls: [4, 8], crystals: [10, 16],
  extrasPerDay: [0, 3],
  fixedMirrors: [1, 3], prisms: [1, 2], filters: [1, 2], coloredCrystalShare: [0.3, 0.5],
  maxScore: [6, 12], attempts: 200,
} as const;
```
Generator (spec 4.2): bij poging `a` → `rng = createRng(hashSeed(seed, a))`. Kies een willekeurige deelverzameling van `['fixedMirror','prism','filter']` met grootte in `extrasPerDay`. Bron op een willekeurig randvak (niet in een hoek), wijzend naar binnen. Plaats de rest op willekeurige lege vakken. Gekleurde kristallen alleen als er een filter is, alleen in kleuren van aanwezige filters. Kwaliteit (`meetsQuality`, in deze volgorde): (1) `validatePuzzle` leeg, (2) `max` in `maxScore`, (3) `trace(p,[]).score * 2 < max`, (4) `greedy(p).score < max`, (5) `solve(p, p.mirrors - 1).max < max`. Na `attempts` pogingen → `FALLBACK` (handgemaakt via `fromAscii`, 7×9, voldoet zelf aan `meetsQuality`).

- [ ] **Step 1: Failing tests:**
  - `generate(42)` twee keer → `JSON.stringify` gelijk;
  - voor seeds `1..365`: `source === 'generated'` in minstens 360 gevallen en elk resultaat (ook fallback) heeft `meetsQuality(puzzle).ok`, `max` gelijk aan `solve(puzzle).max`, afmetingen 7×9;
  - `meetsQuality(FALLBACK).ok === true`;
  - minstens één van de 365 heeft respectievelijk een prisma, een filter, een vaste spiegel, en minstens één heeft geen extra's;
  - snelheid: gemiddelde `generate`-tijd over seeds 1..60 < 400 ms, maximum < 2000 ms (Node).
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementeer. Als snelheid of het 360-criterium faalt: stem eerst `GEN`-bereiken af (bijv. `mirrors: [3,5]`), daarna pas de solver (incrementeel volgen, zie Task 4).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(core): daily puzzle generator with quality gates`.

### Task 7: Dagpuzzel, deeltekst en spelstatus

**Files:**
- Create: `src/core/daily.ts`, `src/core/share.ts`, `src/data/overrides.json` (`{}`), `src/state/storage.ts`, `src/state/game.ts`, `src/state/stats.ts`
- Test: `tests/core/daily.test.ts`, `tests/core/share.test.ts`, `tests/state/storage.test.ts`, `tests/state/game.test.ts`, `tests/state/stats.test.ts`

**Interfaces:**
- Produces (`daily.ts`): `amsterdamDate(now: Date): string` (`'YYYY-MM-DD'` via `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' })`); `puzzleNumber(dateStr: string): number` (≥ 1); `msUntilNextPuzzle(now: Date): number`; `getDaily(dateStr: string, overrides?: Record<string, unknown>): { number: number; puzzle: Puzzle; max: number; solution: Placement[]; source: 'override' | 'generated' | 'fallback' }` — seed = `hashSeed('lichtbreker', number)`; een ongeldige override → `console.warn` en genereren.
- Produces (`share.ts`): `shareText(number: number, score: number, max: number): string`.
- Produces (`storage.ts`):
  ```ts
  export interface SavedState {
    version: 1; tutorialSeen: boolean; seenElements: ElementKind[];
    current: { number: number; placements: Placement[]; submitted: boolean; score: number | null } | null;
    history: Record<string, { score: number; max: number }>;   // sleutel = puzzelnummer
  }
  export function loadState(storage: Storage | null): SavedState;      // ongeldig → standaardwaarden per veld
  export function saveState(storage: Storage | null, s: SavedState): void;  // gooit nooit
  ```
  Sleutel `'lichtbreker:v1'`.
- Produces (`game.ts`):
  ```ts
  export interface GameState { number: number; puzzle: Puzzle; max: number; solution: Placement[]; placements: Placement[]; submitted: boolean; score: number | null }
  export function startGame(saved: SavedState, daily: ReturnType<typeof getDaily>): GameState; // hergebruikt current alleen bij zelfde nummer en geldige plaatsingen
  export function tapCell(g: GameState, x: number, y: number): { state: GameState; rejected: boolean };
  export function resetPlacements(g: GameState): GameState;
  export function submit(g: GameState): GameState;   // idempotent: tweede keer = zelfde object
  export function toSaved(saved: SavedState, g: GameState): SavedState;  // schrijft current + history bij submit
  ```
- Produces (`stats.ts`): `computeStats(history: SavedState['history'], today: number): { played: number; currentStreak: number; bestStreak: number; buckets: [number, number, number, number, number] }` — buckets 100%, 90–99%, 75–89%, 50–74%, <50%; huidige reeks loopt door tot `today` of `today - 1`, anders 0.

- [ ] **Step 1: Failing tests:**
  - `amsterdamDate(new Date('2026-11-07T23:30:00Z')) === '2026-11-08'`; zomertijd: `amsterdamDate(new Date('2026-07-01T21:59:00Z')) === '2026-07-01'` en `'2026-07-01T22:00:00Z'` → `'2026-07-02'`;
  - `puzzleNumber('2026-11-07') === 1`, `('2026-11-08') === 2`, `('2025-01-01') === 1`, over 29 maart 2027 (zomertijd) telt precies 1 per dag;
  - `msUntilNextPuzzle(new Date('2026-11-07T22:59:00Z')) === 60_000`;
  - (`FALLBACK` uit `src/core/generator.ts`) `getDaily('2026-11-09', { '2026-11-09': FALLBACK }).source === 'override'`; met `{ '2026-11-09': { kapot: true } }` → `'generated'`;
  - `shareText(12, 7, 9) === 'Lichtbreker #12 💎 7/9\n🟨🟨🟨🟨🟨🟨🟨⬛⬛'`; `shareText(3, 9, 9) === 'Lichtbreker #3 💎 9/9\n🟨🟨🟨🟨🟨🟨🟨🟨🟨✨'`;
  - `loadState(null)`, kapotte JSON, verkeerde versie, `history` met negatieve score → standaardwaarden zonder throw; `saveState` met een `Storage` die gooit → geen throw;
  - `startGame` met `current.number` van gisteren → lege plaatsingen, `submitted false`, historie intact (Review Focus 3);
  - `tapCell`: leeg → `/` → `\` → leeg; bij 0 spiegels over op leeg vak → `rejected: true`; op muur → `rejected: true`; na `submit` → `rejected: true` en ongewijzigd (Review Focus 4);
  - `submit` twee keer → tweede geeft zelfde object; `toSaved` schrijft `history[number]` één keer;
  - `computeStats`: history op 1,2,3,5,6 met `today 6` → `played 5`, `currentStreak 2`, `bestStreak 3`; `today 8` → `currentStreak 0`; bucket-indeling van `10/10, 9/10, 8/10, 5/10, 4/10` → `[1,1,1,1,1]`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementeer. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat: daily selection, share text, game state, stats`.

### Task 8: Web Worker

**Files:**
- Create: `src/worker/puzzle.worker.ts`, `src/worker/client.ts`
- Test: `tests/worker/client.test.ts`

**Interfaces:**
- Consumes: `getDaily`, `overrides.json`.
- Produces: `requestDaily(dateStr: string, opts?: { workerFactory?: () => Worker | null }): Promise<ReturnType<typeof getDaily>>`. Worker via `new Worker(new URL('./puzzle.worker.ts', import.meta.url), { type: 'module' })`. Faalt het maken of geeft de worker een fout → `getDaily` op de hoofdthread. Placements en Set/Map moeten structured-clone-veilig zijn (alleen gewone objecten/arrays).

- [ ] **Step 1: Failing test:** met `workerFactory: () => null` geeft `requestDaily('2026-11-07')` hetzelfde `JSON` als `getDaily('2026-11-07')`; met een factory die een nep-worker teruggeeft die `error` vuurt → zelfde resultaat.
- [ ] **Step 2–4:** FAIL → implementeer → PASS.
- [ ] **Step 5:** Commit `feat: puzzle web worker with main-thread fallback`.

### Task 9: Visuele richting, thema en layout

**Files:**
- Create: `src/ui/theme.css`, `src/ui/layout.ts`
- Modify: `index.html`, `src/main.ts`
- Test: `tests/ui/layout.test.ts`

**Interfaces:**
- Produces: `computeCellSize(viewW: number, viewH: number, gridW: number, gridH: number, chromeH: number): number` — `floor(min((viewW - 2*16) / gridW, (viewH - chromeH - 16) / gridH, 64))`, minimaal 24.
- Produces: CSS-tokens op `:root` (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--beam-white`, `--beam-red`, `--beam-green`, `--beam-blue`, `--radius`, `--font-display`, `--font-body`), ook als JS-constanten in `src/ui/tokens.ts` voor Pixi.

- [ ] **Step 1:** Roep de skill **`frontend-design`** aan met de spec (sectie 5–6) als brief: donker nachtblauw, neon, speels-premium; kies typografie (Google Fonts), kleuren en de vorm van kristallen per kleur (vorm-onderscheid voor kleurenblinden). Leg de uitkomst vast in `theme.css` en `tokens.ts`.
- [ ] **Step 2: Failing test** `layout.test.ts`: `computeCellSize(360, 640, 7, 9, 200)` → `46`; `(1920, 1080, 7, 9, 200)` → `64`; `(390, 844, 12, 14, 200)` → `29`; nooit < 24; resultaat × grid + chrome ≤ viewport voor alle combinaties uit Global Constraints.
- [ ] **Step 3:** → FAIL. **Step 4:** Implementeer; `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `lang="nl"`, `<title>Lichtbreker</title>`; basis-CSS uit Global Constraints. **Step 5:** → PASS.
- [ ] **Step 6:** Commit `feat(ui): visual direction, theme tokens, responsive layout`.

### Task 10: Speelveld in PixiJS met live straal

**Files:**
- Create: `src/render/board.ts`, `src/render/beamFx.ts`
- Modify: `src/main.ts` (tijdelijke demo: puzzel #1, tikken werkt)

**Interfaces:**
- Consumes: `Puzzle`, `Placement`, `TraceResult`, `tokens.ts`, `computeCellSize`.
- Produces:
  ```ts
  export class BoardView {
    static create(host: HTMLElement): Promise<BoardView>;
    setPuzzle(p: Puzzle): void;
    update(placements: readonly Placement[], t: TraceResult): void;   // live straal + geraakte kristallen
    onTap(cb: (x: number, y: number) => void): void;
    setInteractive(on: boolean): void;
    shake(x: number, y: number): void;
    pulse(kind: ElementKind): void;          // eerste-keer-tip
    resize(cellSize: number): void;
    setReducedMotion(on: boolean): void;
    readonly fire: FireFx;                   // Task 11
    destroy(): void;
  }
  ```
- Visueel (spec 6): spiegel ploft in met veer; `/`→`\` draait een kwartslag (~180 ms); straal = kern + zachte gloed (`AdvancedBloomFilter` uit pixi-filters) met glinstering in looprichting; bij wijziging groeit de straal opnieuw vanaf de bron (~150 ms); geraakt kristal gloeit zacht.

- [ ] **Step 1:** Implementeer `BoardView` en `beamFx` (`drawBeam(g: Graphics, segments: Segment[], progress: number)` — `progress` in afstandseenheden, tekent alleen tot `progress`, zodat Task 11 hem hergebruikt).
- [ ] **Step 2:** Verifieer met de `run`-skill: `npm run dev`, telefoonformaat 390×844 en desktop; tik plaatst/draait/verwijdert spiegels, straal klopt met `trace`, geen console-fouten, vloeiend. Screenshot.
- [ ] **Step 3:** Commit `feat(render): pixi board with live glowing beam`.

### Task 11: Vuur-animatie en oplossing afspelen

**Files:**
- Create: `src/render/fire.ts`, `src/render/particles.ts`

**Interfaces:**
- Produces: `interface FireFx { play(t: TraceResult, opts: { perfect: boolean; onHit: (count: number) => void }): Promise<void>; playSolution(solution: Placement[], t: TraceResult): Promise<void>; }`
- Gedrag (spec 6): veld dimt; felle straal met lichtende kop loopt `drawBeam` af in `startDist`-volgorde (~6 vakken/s, max 3 s totaal); elk geraakt kristal barst in deeltjes en roept `onHit(n)` aan; bij `perfect` regen van scherven. Reduced motion: straal verschijnt in één fade, geen deeltjes, `onHit` direct voor alle kristallen. `playSolution`: spiegels verschijnen één voor één, daarna dezelfde straalanimatie zonder deeltjes.

- [ ] **Step 1:** Implementeer.
- [ ] **Step 2:** Verifieer met de `run`-skill: tijdelijke knop in de demo start `fire.play`; 60 fps (Performance-tab of `app.ticker.FPS` loggen) op 4× CPU-throttling ≥ 50 fps; `play` resolvet; reduced-motion via devtools-emulatie. Screenshot/korte GIF.
- [ ] **Step 3:** Commit `feat(render): fire animation and solution replay`.

### Task 12: Speelscherm, bevestigen en resultaat

**Files:**
- Create: `src/ui/app.ts`, `src/ui/screens/confirm.ts`, `src/ui/screens/result.ts`, `src/ui/share.ts`
- Modify: `src/main.ts` (vervang demo door `startApp(document.getElementById('app')!)`)
- Test: `tests/ui/share.test.ts`

**Interfaces:**
- Consumes: `requestDaily`, `loadState/saveState`, `startGame/tapCell/resetPlacements/submit/toSaved`, `trace`, `BoardView`, `shareText`, `msUntilNextPuzzle`, `computeCellSize`.
- Produces: `startApp(root: HTMLElement): Promise<void>`; `shareResult(text: string, nav?: Pick<Navigator, 'share' | 'clipboard'>): Promise<'shared' | 'copied' | 'failed'>`.
- Teksten (exact): knoppen `Opnieuw`, `Vuur!`; bevestiging `Zeker weten?` met `Ja, vuur!` / `Nog even niet`; resultaat `Deel`, `Gekopieerd!`, `Kopiëren lukte niet`, `Bekijk beste oplossing`, `Volgende puzzel over HH:MM:SS`; laden `Licht wordt gebroken…`.
- Bedrading: kop (titel, `#nummer`, ?-knop, statistieken-knop); spiegelvoorraad als icoontjes; elke tik → `tapCell` → bij `rejected` `board.shake` → anders `board.update` + `saveState`. Vuur → bevestiging → `submit` (knoppen meteen uit, `board.setInteractive(false)`) → `board.fire.play` (teller tikt op via `onHit`) → resultaatscherm met "score / max". Bij heropenen van een ingediende puzzel: direct resultaatscherm, veld toont de ingediende straal. `resize`/`orientationchange` → `computeCellSize` → `board.resize`.

- [ ] **Step 1: Failing test** `share.test.ts`: met `share` aanwezig → `'shared'`; zonder `share`, met `clipboard.writeText` → `'copied'`; `share` gooit `AbortError` → `'failed'` zonder throw; `clipboard.writeText` rejects → `'failed'` (Review Focus 5).
- [ ] **Step 2:** → FAIL. **Step 3:** Implementeer `share.ts`, daarna `app.ts` en schermen. **Step 4:** → PASS.
- [ ] **Step 5:** Verifieer met de `run`-skill op 390×844: volledige ronde (plaatsen, Opnieuw, Vuur!, bevestigen, animatie, resultaat, delen, herladen → resultaat blijft); dubbelklik op `Ja, vuur!` → één inzending (Review Focus 4).
- [ ] **Step 6:** Commit `feat(ui): game screen, confirm, result and sharing`.

### Task 13: Tutorial, uitleg, eerste-keer-tips, statistieken en dagwissel

**Files:**
- Create: `src/ui/screens/tutorial.ts`, `src/ui/screens/help.ts`, `src/ui/screens/stats.ts`
- Modify: `src/ui/app.ts`

**Interfaces:**
- Consumes: `SavedState.tutorialSeen`, `seenElements`, `computeStats`, `BoardView.pulse`.
- Gedrag:
  - Tutorial (alleen als `!tutorialSeen`): 3 stappen met een kleine, zichzelf spelende `BoardView` op `fromAscii(['>..','...','.o.'],1)` (spiegel verschijnt, straal buigt, kristal licht op). Knoppen `Volgende` / `Spelen`.
  - ?-knop: uitleg van basisregels + **alleen** de elementsoorten in de huidige puzzel.
  - Eerste keer dat een `ElementKind` in een puzzel zit en niet in `seenElements`: `board.pulse(kind)` + korte tip-bubbel, daarna toevoegen aan `seenElements`.
  - Statistieken: `Gespeeld`, `Huidige reeks`, `Beste reeks`, verdeling als staafjes met labels `100%`, `90–99%`, `75–89%`, `50–74%`, `<50%`.
  - `visibilitychange` naar zichtbaar of `msUntilNextPuzzle`-timer verlopen → als `amsterdamDate(new Date())` veranderd is: nieuwe puzzel laden via `startGame` (Review Focus 2).

- [ ] **Step 1:** Implementeer.
- [ ] **Step 2:** Verifieer met de `run`-skill: tutorial alleen bij leeg `localStorage`; ?-uitleg toont alleen aanwezige elementen; tip verschijnt één keer; stats kloppen na een ronde; met een nepdatum (`?date=YYYY-MM-DD`, alleen in dev-build via `import.meta.env.DEV`) een dagwissel nabootsen → nieuwe puzzel, historie blijft.
- [ ] **Step 3:** Commit `feat(ui): tutorial, help, first-seen tips, stats, day change`.

### Task 14: End-to-end, design-review en publicatie

**Files:**
- Create: `playwright.config.ts`, `e2e/layout.spec.ts`, `e2e/play.spec.ts`, `.github/workflows/pages.yml`, `README.md`

**Interfaces:**
- Consumes: alles. Playwright `webServer: npm run build && npx vite preview --port 4173`.

- [ ] **Step 1: Tests:**
  - `layout.spec.ts`: voor viewports 360×640, 390×844, 430×932, 1280×800 en 1920×1080: `document.documentElement.scrollHeight <= innerHeight` en `scrollWidth <= innerWidth`; het canvas ligt volledig binnen de viewport; na `setViewportSize` van 390×844 naar 844×390 en terug: geplaatste spiegel staat er nog en geen scroll (Review Focus 1).
  - `play.spec.ts` (met `localStorage` tutorialSeen = true): tik op een vak → spiegelvoorraad 1 lager; `Vuur!` → `Ja, vuur!` → resultaattekst matcht `/\d+ \/ \d+/`; herladen → resultaat nog zichtbaar.
- [ ] **Step 2:** `npx playwright install chromium` en `npm run e2e` → PASS (fix wat faalt).
- [ ] **Step 3:** Draai de skills **`design:design-critique`**, **`design:accessibility-review`** (contrast, tikvlakken ≥ 44 px, kleurenblindheid) en **`design:ux-copy`** (alle Nederlandse teksten) op de draaiende app; verwerk bevindingen die binnen de spec vallen.
- [ ] **Step 4:** `pages.yml`: op push naar `main` → `npm ci`, `npm test`, `npm run build`, upload `dist` met `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`. `README.md`: starten, testen, `EPOCH` instellen vóór publicatie, overrides in `src/data/overrides.json`.
- [ ] **Step 5:** `npm test && npm run build && npm run e2e` → alles groen.
- [ ] **Step 6:** Commit `chore: e2e tests, design review fixes, pages deploy`.
