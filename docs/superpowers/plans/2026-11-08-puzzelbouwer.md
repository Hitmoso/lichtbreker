# Puzzelbouwer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een verborgen, ingelogde puzzelbouwer op de site waarmee je levels bouwt, test, deelt als `?level=`-link en publiceert als dagpuzzel via de GitHub-API.

**Architecture:** Pure kernmodules (`levelcode`, `fingerprint`, `qualityReport`, `editor/tools`, `editor/history`, `publish/overrides`) met unittests; dunne I/O-lagen (`publish/github` met injecteerbare `fetch`, `publish/crypto` op Web Crypto, worker-verzoek `analyse`); UI hergebruikt `BoardView`, `Round`, `openSheet`, `showResult`. De bouwer is een eigen dynamisch geladen chunk achter `?bouwer`; `?level=` is een nieuwe spelmodus.

**Tech Stack:** Vite 5, TypeScript 5 (strict), PixiJS 8, Vitest 2, Playwright, Web Crypto, GitHub REST API.

**Spec:** `docs/superpowers/specs/2026-11-08-puzzelbouwer-design.md`

## Global Constraints

- `DAILY` in `src/config.ts` en `meetsQuality` in `src/core/generator.ts` NIET wijzigen (test "daily puzzles do not shift").
- Alle UI-tekst Nederlands, toon als in het spel. Levelinhoud nooit via `innerHTML` / `h(..., { html })`.
- `prefers-reduced-motion`: alle nieuwe animaties direct (gebruik `board.reducedMotion` / `tweens.reduced`).
- Geen nieuwe npm-dependencies (vite-node is al aanwezig via vitest).
- PBKDF2-SHA-256, 600 000 iteraties (standaard), 16-byte zout, 12-byte IV, AES-GCM 256. Geen minimumlengte wachtwoord; script waarschuwt bij < 10 tekens.
- `PUBLISH = { owner: 'Hitmoso', repo: 'lichtbreker', branch: 'main', path: 'src/data/overrides.json', workflow: 'pages.yml' }` in `src/config.ts`.
- Opslagsleutels: sessie `lichtbreker:bouwer`, ontwerp `lichtbreker:bouwer:ontwerp`.
- Telefoon 375×812 en desktop: geen pagina-scroll, geen horizontale scroll. Desktopindeling vanaf 900 px breed.
- Bestanden met backslashes (`'\\'`) schrijf je met de Write-tool, niet via Bash-heredoc.
- Tests: `npm test`, `npm run build`, `npm run e2e` (poort 4173, workers: 2). E2E publiceert nooit echt: GitHub en `bouwers.json` worden onderschept.
- Commits eindigen met `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Publiceren op een datum die al een eigen puzzel heeft, terwijl het bestand intussen door iemand anders is gewijzigd (409/422):** alleen de eigen datum wordt opnieuw toegepast; andere datums blijven intact. → test in Task 5.
2. **Oude opslag zonder `puzzleId`:** voortgang blijft behouden; alleen een afwijkende `puzzleId` reset. → test in Task 4.
3. **`?level=` met een code die wel decodeert maar ongeldig is (bijv. twee bronnen, bron binnenin):** melding, geen crash. → test in Task 1 en E2E in Task 13.
4. **Raster verkleinen waardoor de bron verdwijnt / bron op een hoekvak:** puzzel wordt ongeldig met heldere melding resp. bron wijst naar binnen. → tests in Task 7.
5. **Inloggen met verkeerd wachtwoord of onbekende naam:** dezelfde melding, geen exceptie; ontsleutelen met fout wachtwoord geeft `null`. → tests in Task 6.

---

### Task 1: Levelcode en vingerafdruk

**Files:**
- Create: `src/core/levelcode.ts`, `src/core/fingerprint.ts`
- Test: `tests/core/levelcode.test.ts`

**Interfaces:**
- Consumes: `toAscii`, `fromAscii` (`src/core/ascii.ts`), `validatePuzzle`.
- Produces: `encodeLevel(p: Puzzle): string`, `decodeLevel(s: string): Puzzle | null`, `puzzleId(p: Puzzle): string` (8 hex-tekens, FNV-1a 32-bit over `JSON.stringify(p)`).

- [ ] **Step 1: Write failing tests** in `tests/core/levelcode.test.ts`:
  - `round-trips the fallback puzzles`: voor `FALLBACK`, `FALLBACKS.easy`, `FALLBACKS.hard`: `decodeLevel(encodeLevel(p))` `toEqual(p)`.
  - `round-trips 50 generated puzzles`: `generate(seed, DAILY).puzzle` voor seeds 1..50.
  - `is URL-safe`: `encodeLevel(FALLBACK)` matcht `/^[A-Za-z0-9._-]+$/` en begint met `'1.7.9.'`.
  - `compresses empty runs`: een 12×14 puzzel met alleen een bron geeft een code korter dan 40 tekens.
  - `rejects broken codes`: `decodeLevel` geeft `null` voor `''`, `'2.7.9.3.AAAA'`, `'1.7.9.3.!!!'`, een afgekapte geldige code (laatste 4 tekens weg), en `encodeLevel(fromAscii(['....', '>..<', '....'], 1))` (twee bronnen; `encodeLevel` valideert niet, `decodeLevel` wel).
  - `puzzleId is stable and sensitive`: `puzzleId(FALLBACK)` matcht `/^[0-9a-f]{8}$/`, is gelijk bij herhaling, en verschilt na het wijzigen van één cel.

- [ ] **Step 2: Run** `npx vitest run tests/core/levelcode.test.ts` → FAIL (module bestaat niet).

- [ ] **Step 3: Implement.** Formaat `1.<b>.<h>.<spiegels>.<data>`; `data` = base64url (zonder `=`) van de `toAscii`-rijen aan elkaar, waarbij een reeks van ≥ 3 lege vakken `.` wordt geschreven als `.` + aantal in decimalen (cellen bevatten nooit cijfers, dus ondubbelzinnig). `decodeLevel`: elke parse-fout → `null` (try/catch rond `atob`/`fromAscii`), lengtecontrole `b*h`, daarna `validatePuzzle(...).length === 0` anders `null`. `encodeLevel` valideert niet.

- [ ] **Step 4: Run** dezelfde test → PASS.

- [ ] **Step 5: Commit** `feat(core): levelcode en puzzel-vingerafdruk`.

---

### Task 2: Kwaliteitsrapport en overrides-vangnet

**Files:**
- Modify: `src/core/generator.ts` (alleen toevoegen; `meetsQuality` onaangeroerd)
- Test: `tests/core/quality.test.ts`, `tests/core/overrides.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface QualityReport {
    errors: string[];            // validatePuzzle
    max: number; solution: Placement[];
    maxInRange: boolean;         // max binnen settings.maxScore
    tooEasyWithout: boolean;     // score zonder spiegels * 2 >= max
    greedyReachesMax: boolean;   // greedy(p).score >= max
    fewerMirrorsSuffice: boolean;// solve(p, p.mirrors - 1).max >= max
    ok: boolean;                 // geldig en geen van de vier problemen
  }
  export function qualityReport(p: Puzzle, settings?: GenSettings): QualityReport  // default DAILY
  ```
  Bij ongeldige puzzel: `errors` gevuld, `max 0`, `solution []`, alle vlaggen `false`, `ok false`.

- [ ] **Step 1: Failing tests** (`quality.test.ts`):
  - `agrees with meetsQuality`: voor seeds 1..200 `generate(seed, DAILY).puzzle` én voor seeds 1..50 een licht verstoorde variant (eerste `empty`-cel → `wall`): `qualityReport(p).ok === meetsQuality(p).ok` en `max` gelijk.
  - `flags each problem`: met `fromAscii` handgebouwde borden: (a) `['>ooo.']`, 1 spiegel → `tooEasyWithout` true; (b) een bord waar max 2 is → `maxInRange` false; (c) invalid (geen bron) → `errors.length > 0`, `ok` false.
- [ ] **Step 2: Failing test** (`overrides.test.ts`) `every override is a valid dated puzzle`: importeer `src/data/overrides.json`; elke sleutel matcht `/^\d{4}-\d{2}-\d{2}$/` en is een echte datum (`new Date(k+'T00:00:00Z').toISOString().slice(0,10) === k`); `validatePuzzle(v)` is leeg. (Slaagt nu al met `{}` — controleer dat het faalt door tijdelijk een kapotte entry in een kopie te testen: schrijf de check als functie `checkOverrides(obj): string[]` in de test en test hem ook met `{ 'x': {} }` → niet leeg.)
- [ ] **Step 3: Run** `npx vitest run tests/core/quality.test.ts tests/core/overrides.test.ts` → FAIL.
- [ ] **Step 4: Implement** `qualityReport` in `src/core/generator.ts`, met dezelfde berekeningen als `meetsQuality` maar alle vier altijd uitgerekend (geen vroege return na geldigheid).
- [ ] **Step 5: Run** → PASS; `npm test` volledig groen.
- [ ] **Step 6: Commit** `feat(core): qualityReport en vangnettest voor overrides`.

---

### Task 3: Worker-verzoeken `analyse` en `generatedDaily`, annuleerbaar

**Files:**
- Modify: `src/worker/client.ts`, `src/worker/puzzle.worker.ts`
- Test: `tests/worker/client.test.ts` (uitbreiden)

**Interfaces:**
- Produces:
  ```ts
  export type WorkerRequest = ... | { kind: 'analyse'; puzzle: Puzzle } | { kind: 'generatedDaily'; date: string };
  export interface Analysis { max: number; solution: Placement[]; report: QualityReport }
  export interface Cancelable<T> { result: Promise<T | null>; cancel(): void }   // cancel → result resolvet null, worker.terminate()
  export function requestAnalyse(p: Puzzle, opts?: WorkerOptions): Cancelable<Analysis>
  export function requestGeneratedDaily(date: string, opts?: WorkerOptions): Promise<Daily> // getDaily(date, {})
  ```
  `requestDaily`/`requestEndless` blijven met dezelfde signatuur.
- [ ] **Step 1: Failing tests** (met de bestaande nep-`workerFactory`-aanpak in het testbestand): `analyse returns max and report` (FALLBACK, zonder worker → lokaal; `max` = `solve(FALLBACK).max`); `cancel resolves null and terminates` (nep-worker die nooit antwoordt; `cancel()` → `result` null, `terminate` aangeroepen); `generatedDaily ignores overrides` (`source !== 'override'`).
- [ ] **Step 2: Run** `npx vitest run tests/worker` → FAIL.
- [ ] **Step 3: Implement**: herschrijf intern `run` naar een variant die `{ promise, cancel }` geeft; worker-switch uitbreiden (`analyse` → `{ ...solve-resultaat via qualityReport }`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(worker): analyse- en generatedDaily-verzoeken met annuleren`.

---

### Task 4: Vandaag aangepast → stil opnieuw beginnen

**Files:**
- Modify: `src/state/storage.ts` (`SavedCurrent.puzzleId?: string`, `parseCurrent` leest optioneel string), `src/state/game.ts` (`startGame`, `toSaved`)
- Test: `tests/state/state.test.ts` (uitbreiden)

**Interfaces:**
- Consumes: `puzzleId` (Task 1).
- Produces: `toSaved` schrijft `puzzleId: puzzleId(g.puzzle)`; `startGame` geeft een lege ronde als `cur.puzzleId` bestaat en afwijkt.
- [ ] **Step 1: Failing tests**: `resets progress when the day's puzzle changed` (current met `puzzleId: 'deadbeef'` en geldige plaatsingen → lege, niet-ingediende ronde; `history` ongewijzigd); `keeps legacy progress without puzzleId`; `toSaved stores puzzleId`; `loadState keeps a string puzzleId and drops a non-string one`.
- [ ] **Step 2: Run** `npx vitest run tests/state` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS, plus `npm test`.
- [ ] **Step 5: Commit** `feat(state): vingerafdruk bij dagvoortgang`.

---

### Task 5: Publiceren via GitHub (puur + API)

**Files:**
- Modify: `src/config.ts` (voeg `PUBLISH` toe, zie Global Constraints)
- Create: `src/publish/overrides.ts`, `src/publish/github.ts`
- Test: `tests/publish/overrides.test.ts`, `tests/publish/github.test.ts`

**Interfaces:**
- Produces (`overrides.ts`):
  ```ts
  export function setOverride(data: Record<string, unknown>, date: string, puzzle: Puzzle | null): Record<string, unknown> // null = verwijderen; nieuw object
  export function formatOverrides(data: Record<string, unknown>): string // sleutels gesorteerd, JSON.stringify(…, null, 2) + '\n'
  export function toBase64Utf8(s: string): string
  export function fromBase64Utf8(b64: string): string  // negeert newlines (GitHub levert base64 met \n)
  ```
- Produces (`github.ts`):
  ```ts
  export type GithubErrorKind = 'auth' | 'conflict' | 'network' | 'other';
  export class GithubError extends Error { kind: GithubErrorKind; status: number }
  export interface Github {
    checkAccess(): Promise<'ok' | 'denied' | 'offline'>;           // GET /repos/{o}/{r} → permissions.push
    getOverrides(): Promise<{ data: Record<string, unknown>; sha: string }>;
    publish(date: string, puzzle: Puzzle | null, author: string): Promise<{ commitSha: string }>; // max 3 pogingen bij conflict
    runStatus(commitSha: string): Promise<{ state: 'pending' | 'success' | 'failure' | 'unknown'; url?: string }>;
  }
  export function createGithub(token: string, fetchFn?: typeof fetch): Github
  ```
  Headers: `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`. GET/PUT `…/contents/{path}?ref={branch}`; PUT-body `{ message, content, sha, branch }`. Commitbericht: `puzzel: {date} (door {author})` of `puzzel: {date} verwijderd (door {author})`. Status 401/403 → `auth`; 409/422 → `conflict`; `fetch` gooit → `network`. `runStatus`: GET `…/actions/runs?head_sha={sha}`; geen run → `pending`; `status !== 'completed'` → `pending`; `conclusion === 'success'` → `success`, anders `failure`; 403/404 → `unknown`. `url` = `html_url` van de run.
- [ ] **Step 1: Failing tests** `overrides.test.ts`: sorteert sleutels; verwijderen; opmaak eindigt op `'}\n'` met 2 spaties; base64 heen-en-terug met `'é💎'`; `fromBase64Utf8` met ingevoegde `\n`.
- [ ] **Step 2: Failing tests** `github.test.ts` met een nep-`fetch` (registreert verzoeken, geeft vaste antwoorden):
  - `publish writes only the given date` (bestaand bestand met `'2026-01-01'`; PUT-body gedecodeerd bevat beide datums, juiste `sha`, juist bericht).
  - `publish retries on conflict and keeps the other's change`: eerste PUT → 409; tweede GET levert extra datum `'2026-02-02'`; tweede PUT bevat alle drie; derde conflict-reeks → na 3 pogingen `GithubError` `conflict`.
  - `auth errors`: 401 → `GithubError` `auth`.
  - `network errors`: `fetch` gooit → `network`.
  - `checkAccess`: push true → `'ok'`; false/401 → `'denied'`; gooit → `'offline'`.
  - `runStatus`: lege lijst → pending; in_progress → pending; completed/success → success + url; completed/failure → failure; 403 → unknown.
- [ ] **Step 3: Run** `npx vitest run tests/publish` → FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `feat(publish): overrides bijwerken via de GitHub-API`.

---

### Task 6: Accounts, versleuteling en sessie

**Files:**
- Create: `src/publish/crypto.ts`, `src/publish/session.ts`, `scripts/bouwer-account.ts`, `public/bouwers.json` (inhoud `[]\n`)
- Modify: `package.json` (script `"bouwer:account": "vite-node scripts/bouwer-account.ts --"`)
- Test: `tests/publish/crypto.test.ts`, `tests/publish/session.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Account { name: string; salt: string; iv: string; data: string; iter?: number } // base64; iter default 600000
  export const PBKDF2_ITERATIONS = 600_000;
  export function encryptToken(name: string, token: string, password: string, iter?: number): Promise<Account>
  export function decryptToken(acc: Account, password: string): Promise<string | null> // fout wachtwoord → null
  export function login(accounts: unknown, name: string, password: string): Promise<{ name: string; token: string } | null>
     // accounts ongeldig → null; naam hoofdletterongevoelig; geeft de opgeslagen naam terug
  export function fetchAccounts(fetchFn?: typeof fetch): Promise<Account[]> // GET './bouwers.json', cache 'no-store'; fout → []
  ```
  `session.ts`: `interface Session { name: string; token: string }`; `loadSession(): Session | null` (eerst `localStorage`, dan `sessionStorage`); `saveSession(s: Session, remember: boolean)`; `clearSession()` (beide). Alle storage-toegang in try/catch; functies krijgen optioneel `{ local, session }: { local: Storage | null; session: Storage | null }` voor tests.
  Script `scripts/bouwer-account.ts`: zonder argumenten interactief (naam, wachtwoord 2× verborgen via readline met gedempte uitvoer, token); bij wachtwoord < 10 tekens een gele waarschuwing; leeg wachtwoord geweigerd; schrijft `public/bouwers.json` (array, gesorteerd op naam, 2 spaties, newline), vervangt bestaand account met dezelfde naam (hoofdletterongevoelig). `--verwijder <naam>` verwijdert. Na afloop: "Klaar. Commit en push public/bouwers.json."
- [ ] **Step 1: Failing tests** `crypto.test.ts` (gebruik `iter: 1000` voor snelheid): heen-en-terug; fout wachtwoord → `null`; `login` met `'MAX'` vindt `'max'`; onbekende naam → `null`; `login('kapot', …)` → `null`; standaard-`iter` van `encryptToken` is `600000` (controleer `acc.iter ?? PBKDF2_ITERATIONS`). `session.test.ts` met een in-memory `Storage`-nep: remember true → in local; false → in session; `clearSession` wist beide; kapotte JSON → `null`.
- [ ] **Step 2: Run** `npx vitest run tests/publish` → FAIL.
- [ ] **Step 3: Implement** (alleen `globalThis.crypto.subtle`; base64 via `btoa`/`atob` op bytes).
- [ ] **Step 4: Run** → PASS. Handmatig: `npm run bouwer:account -- --verwijder niemand` draait zonder fout en laat `[]` staan.
- [ ] **Step 5: Commit** `feat(publish): accounts met versleutelde sleutel en sessie`.

---

### Task 7: Bouwgereedschap en geschiedenis (puur)

**Files:**
- Create: `src/editor/tools.ts`, `src/editor/history.ts`, `src/editor/messages.ts`
- Test: `tests/editor/tools.test.ts`, `tests/editor/history.test.ts`

**Interfaces:**
- Produces (`tools.ts`):
  ```ts
  export type Tool = 'wall' | 'crystal' | 'mirror' | 'prism' | 'filter' | 'source' | 'eraser';
  export const TOOLS: readonly Tool[]; // in deze volgorde (toetsen 1–7)
  export interface Variants { crystal: BeamColor; filter: FilterColor; mirror: MirrorKind; source: Dir }
  export const DEFAULT_VARIANTS: Variants; // white, red, '/', 0
  export interface ApplyResult { puzzle: Puzzle; changed: boolean; rejected: boolean; variants: Variants }
  export function applyTool(p: Puzzle, x: number, y: number, tool: Tool, v: Variants): ApplyResult
  export function inwardDirs(w: number, h: number, x: number, y: number): Dir[] // volgorde 0,1,2,3
  export function emptyPuzzle(w: number, h: number, mirrors: number): Puzzle // bron op (0, floor(h/2)) richting 0
  export function resizePuzzle(p: Puzzle, w: number, h: number): Puzzle       // knipt rechts/onder, vult met empty
  ```
  Regels (spec 3.2): zelfde gereedschap op zelfde soort → wisselen (kristal white→red→green→blue→white; filter red→green→blue→red; spiegel `/`↔`\`; bron → volgende richting uit `inwardDirs`) en `variants` volgt de nieuwe waarde. Anders plaatsen met de huidige variant (vervangt). Bron: niet op de rand → `rejected`; bestaande bron elders wordt `empty`; richting = `v.source` als die naar binnen wijst, anders eerste uit `inwardDirs`. Muur op muur / prisma op prisma / gum op leeg → `changed: false`. Puzzel nooit muteren.
- Produces (`history.ts`): `class History<T> { constructor(initial: T, limit = 100); get current(): T; push(s: T): void; replace(s: T): void; undo(): T | null; redo(): T | null; get canUndo(): boolean; get canRedo(): boolean }` (`push` wist redo; oudste valt weg boven limiet).
- Produces (`messages.ts`): `humanError(err: string): string` — `'precies één bron nodig, gevonden: 0'` → `'Er is nog geen bron'`; `…gevonden: N>1` → `'Er zijn meerdere bronnen'`; `'bron wijst naar buiten'` → `'De bron wijst naar buiten'`; `'bron staat niet op de rand'` → `'De bron staat niet op de rand'`; overig → ongewijzigd met hoofdletter.
- [ ] **Step 1: Failing tests** voor alle regels hierboven, plus Review Focus 4: `resizePuzzle` die de bron afknipt → `validatePuzzle` meldt 0 bronnen; bron op hoek `(0,0)` met `v.source = 2` → richting 0 of 1; history: undo/redo, `replace` maakt geen stap, limiet 100.
- [ ] **Step 2: Run** `npx vitest run tests/editor` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(editor): gereedschapslogica en geschiedenis`.

---

### Task 8: BoardView-uitbreidingen voor de bouwer

**Files:**
- Modify: `src/render/board.ts`
- Test: handmatig in de browser + E2E (Task 13); geen unit (Pixi).

**Interfaces:**
- Produces:
  - `setPaintMode(on: boolean): void` — aan: muisklikken roepen niet meer `onTap` aan; in plaats daarvan `onPaint`. Toetsenbord (Enter/spatie) roept nog wel `onTap`.
  - `onPaint(cb: (x: number, y: number, phase: 'start' | 'move' | 'end') => void): void` — `pointerdown` in het veld → `start`; tijdens ingedrukt bij betreden van een nieuw vak → `move`; `pointerup`/`pointerupoutside` → `end` (x,y = laatste vak).
  - `setPuzzle(p: Puzzle, opts?: { changed?: number[] })` — bestaand gedrag; met `changed` en zonder reduced motion: per index een zachte accentring die uitzet en vervaagt (zoals `pulse`, 220 ms) en, als het een kristal is, het kristal-node van 0.6 → 1 schalen met de bestaande `spring`-easing (260 ms).
  - `setMirrorAlpha(a: number): void` — doorzichtigheid van `mirrorLayer` (voor "Toon oplossing": 0.55; normaal 1).
- [ ] **Step 1: Implement** zonder bestaand spelgedrag te wijzigen (paint mode standaard uit).
- [ ] **Step 2: Run** `npm test` en `npm run e2e` → bestaande tests groen.
- [ ] **Step 3: Commit** `feat(render): tekenmodus, wijzigingsanimatie en doorzichtige spiegels`.

---

### Task 9: Eigen level (`?level=`) en geheime ingang

**Files:**
- Create: `src/ui/modes/level.ts`
- Modify: `src/ui/modes/types.ts` (`ModeName` + `'level'`), `src/ui/app.ts`, `src/main.ts`, `src/ui/app.css`
- Test: `e2e/level.spec.ts` (deels hier, rest in Task 13)

**Interfaces:**
- Consumes: `decodeLevel` (Task 1), `requestAnalyse` (Task 3), `Round`, `showResult`.
- Produces:
  - `createLevelMode(ctx: ModeContext, puzzle: Puzzle): Mode` — label `'Eigen level'`; analyse via worker (`setBusy` tot klaar); `Round`-hooks: `persist` no-op, `afterFire` → `showResult({ title: 'Eigen level', score, max, primary: { label: 'Naar het spel', onClick: goHome }, secondary: { label: 'Bekijk beste oplossing', onClick: () => round.showSolution() } })`, `doneButtons` → knop Resultaat.
  - `startApp(root, hooks, opts?: { level?: Puzzle | 'invalid' })`: bij `level` start de app in modus `'level'`, verbergt de schakelaar Dagelijks | Oneindig (`hidden`), toont in de kop een knop **Naar het spel** (`location.href = location.pathname`). Bij `'invalid'`: geen veld, maar een paneel in de stage met "Dit level kan niet geladen worden" + knop **Naar het spel**. Dagmodus wordt dan niet geladen (geen worker-werk). `onStats` blijft werken.
  - Logo-gebaar in `app.ts`: 5 `click`s op `.brand` binnen 2000 ms → `location.search = '?bouwer'`.
  - `main.ts`: `?bouwer` → `import('./editor').then(m => m.mount(document.getElementById('app')!))` (ook in productie); `?level=` → `startApp(..., { level: decodeLevel(code) ?? 'invalid' })`; `?geluid` ongewijzigd.
- [ ] **Step 1: Failing E2E** `e2e/level.spec.ts`: `plays a shared level` — bouw in de test de code via `encodeLevel(FALLBACK)` (import uit `src`), open `/?level=<code>`, verwacht tekst "Eigen level", geen radio "Oneindig", plaats een spiegel, Vuur! → dialoog Resultaat met `result-label` "Eigen level"; `localStorage['lichtbreker:v1'].history` leeg. `broken code shows a message`: `/?level=kapot` → tekst "Dit level kan niet geladen worden" en knop "Naar het spel". `logo gesture opens the builder`: 5× klik op `.brand` → URL bevat `?bouwer`.
- [ ] **Step 2: Run** `npx playwright test e2e/level.spec.ts` → FAIL. (De bouwer-test faalt nog tot Task 10 `mount` exporteert; maak in deze task een minimale `src/editor/index.ts` met `export function mount(root: HTMLElement)` die alleen een lege `.editor` rendert.)
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; `npm run e2e` volledig groen.
- [ ] **Step 5: Commit** `feat: eigen levels via ?level= en geheime ingang naar de bouwer`.

---

### Task 10: Inlogscherm

**Files:**
- Create: `src/editor/login.ts`, `src/editor/editor.css`
- Modify: `src/editor/index.ts`

**Interfaces:**
- Consumes: `fetchAccounts`, `login`, `loadSession`/`saveSession`, `createGithub(...).checkAccess()`.
- Produces: `showLogin(root: HTMLElement): Promise<Session>` — resolvet na geslaagde login (of meteen als een opgeslagen sessie nog `checkAccess() === 'ok'` geeft). Scherm in spelstijl: logo "Lichtbreker" + "Bouwer", velden **Naam** en **Wachtwoord** (`autocomplete="username"`/`"current-password"`), vinkje **Ingelogd blijven op dit apparaat** (standaard aan), knop **Inloggen** (`btn-fire`), link **Terug naar het spel**. Meldingen in een `role="status"`-regel: `'Onjuiste naam of wachtwoord'`, `'Je sleutel werkt niet (meer). Vraag de eigenaar om een nieuwe.'`, `'Geen verbinding met GitHub'` (met knop Opnieuw). Tijdens rekenen knop uit met tekst "Bezig…". Kaart verschijnt met een korte fade/slide (geen animatie bij reduced motion).
  `mount(root)`: `showLogin` → daarna `startEditor(root, session)` (Task 11).
- [ ] **Step 1: Implement**; controleer in de ontwikkelserver (`npm run dev`, `/?bouwer`) op 375×812 en 1280×800 dat het scherm gecentreerd staat zonder scroll.
- [ ] **Step 2: Commit** `feat(editor): inlogscherm`.

---

### Task 11: Bouwscherm — indeling, tekenen, live straal en controle

**Files:**
- Create: `src/editor/screen.ts` (`startEditor`), `src/editor/analysis.ts`, `src/editor/panels.ts` (controlepaneel/-regel), `src/editor/draft.ts`
- Modify: `src/editor/index.ts`, `src/editor/editor.css`
- Test: `tests/editor/draft.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 7, 8; `fitCell`; `h`, `svgIcon`.
- Produces:
  - `startEditor(root: HTMLElement, session: Session): Promise<EditorHandle>` met `interface EditorHandle { load(p: Puzzle, origin: Origin): void; get puzzle(): Puzzle; get origin(): Origin; get dirty(): boolean }` en `type Origin = { kind: 'new' } | { kind: 'date'; date: string; own: boolean }`.
  - `analysis.ts`: `createAnalyser(onResult: (a: Analysis | null, p: Puzzle) => void): { request(p: Puzzle): void; dispose(): void }` — 150 ms debounce, annuleert de vorige (`Cancelable.cancel`), negeert verouderde resultaten. Ongeldige puzzel → meteen `onResult(null, p)` zonder worker.
  - `draft.ts`: `interface Draft { puzzle: Puzzle; origin: Origin; tool: Tool; variants: Variants }`; `saveDraft(d: Draft, storage?)`, `loadDraft(storage?): Draft | null` (puzzel gevalideerd met `validatePuzzle`-vorm: `width/height/cells` aanwezig en `cells.length === w*h`; ongeldige puzzels mogen, kapotte JSON → `null`).
  - Indeling volgens spec 3.1 (klassen: `.editor`, `.ed-top`, `.ed-stage`, `.ed-status`, `.ed-variants`, `.ed-tools` (role radiogroup, label "Gereedschap"), `.ed-actions`, `.ed-panel` (alleen ≥ 900 px)). Knopnamen (aria-label): `Terug naar het spel`, `Publiceer`, `Test`, `Deel`, `Meer`, `Ongedaan maken`, `Opnieuw`; gereedschap: `Muur`, `Kristal`, `Spiegel`, `Prisma`, `Filter`, `Bron`, `Gum`; varianten: `Wit`, `Rood`, `Groen`, `Blauw`, `Spiegel /`, `Spiegel \`, `Naar rechts`, `Naar beneden`, `Naar links`, `Naar boven`. Gereedschapsiconen in spelkleuren (`--beam-*`).
  - Gedrag: `board.setPaintMode(true)`; `onPaint start` → `applyTool` (+ `history.push`), `move` alleen bij Muur/Gum (`history.replace`), `rejected` → `board.shake` + `sfx.reject`-vrij (geen geluid in de bouwer behalve in Test). Na elke wijziging: `board.setPuzzle(p, { changed })`, `board.update([], trace(p, []), { animate: false })` alleen als geldig (anders `hideBeam`), analyser `request`, `saveDraft`. Toetsen: 1–7 gereedschap, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z; `onTap` (toetsenbord) gedraagt zich als `start`+`end`.
  - Controleregel: `Max {n} · {m} spiegels · ✓ geldig · {k} tip(s)` of `✗ {eerste humanError}`; "…" pulseert tijdens rekenen. Tik → op telefoon een `openSheet` met het volledige controlepaneel; op desktop staat hetzelfde paneel rechts. Paneel: geldigheid (alle `humanError`s), Max, vier tips met de spec-teksten (`Max ligt buiten 6–12` met waarden uit `DAILY.maxScore`, `Zonder spiegels raak je al de helft`, `Gulzig spelen haalt het maximum al`, `Je hebt niet alle spiegels nodig`), knop **Toon oplossing** / **Verberg oplossing** (`board.setMirrorAlpha(0.55)` + `update(solution, trace)`; elke wijziging verbergt).
  - Bij start: `loadDraft()` of anders `emptyPuzzle(7, 9, 3)` met origin `new`.
- [ ] **Step 1: Failing tests** `draft.test.ts`: heen-en-terug; kapotte JSON → `null`; verkeerde `cells`-lengte → `null`.
- [ ] **Step 2: Run** `npx vitest run tests/editor` → FAIL; implementeer `draft.ts`; → PASS.
- [ ] **Step 3: Implement** scherm, analyser en paneel.
- [ ] **Step 4: Verify** in `npm run dev` op `/?bouwer` (na login met een lokaal testaccount via `npm run bouwer:account`; niet committen): tekenen, kleurwissel, slepen met muur, ongedaan maken, Max werkt bij zonder haperen op een 12×14-bord; 375×812 en 1280×800 zonder scroll; reduced motion (DevTools-emulatie) zonder animaties.
- [ ] **Step 5: Commit** `feat(editor): bouwscherm met live straal en controle` (zonder testaccount in `public/bouwers.json`).

---

### Task 12: Meer-blad, Test, Deel en Publiceren

**Files:**
- Create: `src/editor/menu.ts`, `src/editor/testplay.ts`, `src/editor/publish.ts`
- Modify: `src/editor/screen.ts`, `src/editor/editor.css`

**Interfaces:**
- Consumes: `createGithub`, `setOverride`, `requestGeneratedDaily`, `requestEndless`, `newSeed` (uit `src/ui/modes/endless.ts`), `encodeLevel`, `puzzleNumber`, `amsterdamDate`, `Round`, `showResult`, `openSheet`, `clearSession`.
- Produces:
  - **Meer-blad** (`openMenu(editor, github, session)`): stappers Breedte 3–12, Hoogte 3–14 (via `resizePuzzle`, één history-stap), Spelersspiegels 1–8; **Begin met**: Leeg · Genereer (segmented Makkelijk/Normaal/Moeilijk → `requestEndless(newSeed(), d)`) · **Datum openen…**; **Verwijder eigen puzzel** (alleen bij `origin.own`); **Uitloggen** (`clearSession()` + herladen). Laden met `dirty` → bevestiging `'Je huidige ontwerp gaat verloren'` (knoppen "Annuleren" / "Doorgaan").
  - **Datum openen**: `<input type="date">` + knoppen Vandaag/Morgen, toont `#{puzzleNumber}`; laadt via `github.getOverrides()`: eigen puzzel → origin `{ kind:'date', own:true }`, label "Eigen puzzel"; anders `requestGeneratedDaily(date)` → `own:false`, label "Gegenereerd". Datumchip in de kop toont `"24 dec"` (nl-NL, dag + korte maand) of `"Nieuw"`.
  - **Test** (`startTest(editor)`): gebruikt een `new Sound({ storage })` (zelfde aan/uit-voorkeur als het spel) als `sfx`; verbergt bouwdok, toont `Round`-dok met `GameState { number: 0, puzzle, max, solution, placements: [], submitted: false, score: null }`, kop "Test" + knop **Terug naar bouwen**; `afterFire` → `showResult({ title: 'Test', score, max, primary: { label: 'Terug naar bouwen', … }, secondary: { label: 'Bekijk beste oplossing', … } })`. Uit bij ongeldige puzzel (aria-disabled + `title` met reden). Paint mode uit tijdens test, daarna weer aan; ontwerp ongewijzigd.
  - **Deel**: `url = location.origin + location.pathname + '?level=' + encodeLevel(p)`; `navigator.share?.({ url, title: 'Lichtbreker – eigen level' })`, anders `navigator.clipboard.writeText(url)` → status "Link gekopieerd" (of "Kopiëren lukte niet").
  - **Publiceer** (`openPublish(editor, github, session)`): zonder datum eerst datumkeuze (standaard morgen = `amsterdamDate(now + 1 dag)`); paneel met datum, `#{nummer}`, Max, tips; waarschuwing vandaag `'Spelers die vandaag al begonnen zijn, beginnen opnieuw.'`, verleden `'Deze datum is al voorbij'`; knop **Publiceer** → `github.publish(date, puzzle, session.name)`; fouten naar tekst: auth `'Je sleutel werkt niet (meer)'`, network `'Geen verbinding, probeer opnieuw'`, conflict `'Iemand anders publiceerde tegelijk; probeer opnieuw'`, other `'Publiceren mislukt ({status})'`. Bij succes: origin `own: true`, statuschip.
  - **Statuschip** in de kop: poll `runStatus` elke 10 s, max 15 min: `⏳ Wordt gebouwd…` → `✓ Live` (tooltip "Spelers zien hem binnen ±10 minuten") / `✗ Mislukt` (link naar `url`, `target="_blank" rel="noopener"`) / `Gepubliceerd — status onbekend`. Stopt bij verlaten.
  - **Verwijder eigen puzzel**: bevestigen → `github.publish(date, null, name)` → origin `own:false`, status-chip zoals bij publiceren.
  - Het Publiceer-knop is uit (met reden) bij een ongeldige puzzel.
- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify** in `npm run dev` met DevTools-netwerkoverrides of een tijdelijke nep-`fetch` (niet committen): publiceer-PUT-body bevat alleen de gekozen datum; status-chip doorloopt de toestanden; Test → Vuur! → Terug naar bouwen; Deel kopieert een werkende link.
- [ ] **Step 3: Commit** `feat(editor): menu, testen, delen en publiceren`.

---

### Task 13: E2E-tests voor de bouwer en README

**Files:**
- Create: `e2e/builder.spec.ts`, `e2e/builder-helpers.ts`
- Modify: `e2e/level.spec.ts` (ongeldige-maar-decodeerbare code, Review Focus 3), `README.md`

**Interfaces:**
- Consumes: `encryptToken` (met `iter: 1000`), `encodeLevel`, `FALLBACK`.
- Produces `e2e/builder-helpers.ts`: `mockAccounts(page, password = 'geheim')` (route `**/bouwers.json` → account `tester` met token `'test-token'`); `mockGithub(page): Promise<{ puts: unknown[] }>` (route `https://api.github.com/**`: repo → `{ permissions: { push: true } }`; contents GET → base64 van `'{}\n'` + sha `'abc'`; PUT → registreert body, antwoordt `{ commit: { sha: 'c1' } }`; actions runs → eerst `in_progress`, daarna `completed/success`); `loginAs(page)`.
- [ ] **Step 1: Write** `e2e/builder.spec.ts` (viewport 390×844, één test ook 1280×800):
  - `wrong password shows a message` → tekst "Onjuiste naam of wachtwoord".
  - `draws and checks live`: na login, kies Muur en tik een vak, kies Kristal → Rood, tik een vak, tik nogmaals → wordt groen (controleer via `aria-checked` van variant **Groen**); controleregel bevat `Max`; **Ongedaan maken** → **Rood** weer aangevinkt.
  - `test play returns to the design`: Test → spiegel plaatsen → Vuur! (bevestigen) → Resultaat "Test" → Terug naar bouwen → gereedschap zichtbaar.
  - `publishes tomorrow`: Publiceer → kies Morgen → Publiceer; `puts[0]` gedecodeerd bevat precies één sleutel = morgen (bereken in de test met `amsterdamDate`) en een `message` met `(door tester)`; chip toont `✓ Live` binnen 30 s (gebruik `page.clock` of laat de mock meteen `success` geven bij de tweede poll en verlaag niets in de code).
  - `share link plays`: Deel (stub `navigator.share` weg, clipboard-permissie geven) → open de gekopieerde URL in een nieuwe pagina → "Eigen level".
  - `fits without scrolling`: `noScroll(page)` op 375×812 en 1280×800.
  - Uitbreiding `level.spec.ts`: een zelfgebouwde code van een puzzel met twee bronnen (via `encodeLevel`) → melding.
- [ ] **Step 2: Run** `npm run e2e` → alles groen (fix wat faalt in de betreffende code).
- [ ] **Step 3: README**: sectie "Puzzelbouwer (beheer)": openen (`?bouwer` of 5× op het logo), token maken (fine-grained, alleen deze repo, Contents read/write, Actions read, met vervaldatum; let op: alle Pages-sites op `hitmoso.github.io` delen opslag), account aanmaken/verwijderen met `npm run bouwer:account`, publiceren en "Verwijder eigen puzzel", live na ±2–3 min (+ caching ±10 min), daarna lokaal `git pull`; token vervangen = alle accounts opnieuw aanmaken; deellinks `?level=`.
- [ ] **Step 4: Commit** `test(e2e): bouwer en eigen levels; docs: README puzzelbouwer`.

---

### Task 14: Eindcontrole

- [ ] **Step 1:** `npm test` → alle tests groen (inclusief "daily puzzles do not shift").
- [ ] **Step 2:** `npm run build` → geen typefouten; controleer in `dist/assets` dat de bouwer een aparte chunk is en dat `index-*.js` geen `bouwers.json`/`encryptToken` bevat (`grep -L`).
- [ ] **Step 3:** `npm run e2e` → groen.
- [ ] **Step 4:** `git diff main -- src/config.ts` toont alleen de toegevoegde `PUBLISH`; `public/bouwers.json` is `[]`.
- [ ] **Step 5:** Commit eventuele restfixes; niet pushen of mergen zonder akkoord van de gebruiker.
