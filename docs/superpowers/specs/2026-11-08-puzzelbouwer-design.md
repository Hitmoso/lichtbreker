# Lichtbreker — puzzelbouwer

Datum: 2026-11-08
Status: ter review
Bouwt voort op: `2026-11-07-lichtbreker-design.md`, `2026-11-07-oneindige-modus-design.md` en `2026-11-07-polish-geluid-viering-design.md`. Alles wat hier niet staat, blijft zoals daar.

## 1. Doel

De eigenaar (en een paar vrienden) kunnen op elk apparaat, ook op een telefoon, naar de site gaan, een verborgen bouwer openen, inloggen, een puzzel bouwen of een bestaande dagpuzzel aanpassen, die uittesten, en hem met één knop publiceren als dagpuzzel voor een gekozen datum, ook voor vandaag. Daarnaast kan elk gebouwd level als link gedeeld worden om te spelen.

**Succes:** op de telefoon, zonder computer: bouwer openen → inloggen → datum 24 december openen → een kristal van kleur wisselen → Test → Publiceer → binnen enkele minuten "✓ live", en spelers krijgen die dag de nieuwe puzzel. Spelers merken niets van de bouwer (geen knop, geen extra download).

**Uitgangspunten (afgestemd met de gebruiker):**
- Geen betaalde server. De site blijft statisch op GitHub Pages; publiceren gaat via de GitHub-API.
- Er is precies één manier van publiceren: via de bouwer op de site (ook lokaal in dev gaat het via GitHub). Er komt géén aparte lokale "opslaan in `overrides.json`"-route.
- Mooie, rustige UI op telefoon én desktop is belangrijk; animaties volgen de stijl van het spel en respecteren `prefers-reduced-motion`.
- `DAILY` in `src/config.ts` blijft onaangeroerd.

## 2. Ingang en inloggen

### 2.1 Openen
- Via de URL `?bouwer` (bijv. `https://hitmoso.github.io/lichtbreker/?bouwer`), of door **5 keer snel (binnen 2 s) op het logo "Lichtbreker"** in de kop van het spel te tikken. Dat navigeert naar `?bouwer`.
- Er is in het spel geen zichtbare knop of link naar de bouwer. De spelersdocumentatie noemt hem niet; alleen de README-sectie voor beheer.
- De bouwercode is een eigen chunk (dynamische `import()`), werkt ook in productie (niet dev-only zoals `?geluid`) en wordt alleen geladen bij `?bouwer`.

### 2.2 Accounts
- Inloggen met **naam en wachtwoord**. De accounts staan in `public/bouwers.json` (wordt pas bij het inloggen opgehaald als `./bouwers.json`, met `cache: "no-store"`; zo zit het niet in de spelcode en kan de E2E-test het nabootsen):
  ```json
  [{ "name": "max", "salt": "<b64>", "iv": "<b64>", "data": "<b64>" }]
  ```
  `data` is de GitHub-token, versleuteld met AES-GCM (256 bit) met een sleutel afgeleid van het wachtwoord via PBKDF2-SHA-256 (600 000 iteraties, 16-byte zout per account, 12-byte IV). Alleen Web Crypto (`crypto.subtle`), geen extra bibliotheken.
- Accounts beheren gaat met een script op de computer: `npm run bouwer:account` (Node, vraagt interactief naam, wachtwoord (twee keer, verborgen) en token; voegt toe of vervangt op naam). `npm run bouwer:account -- --verwijder <naam>` verwijdert. Elk wachtwoord (niet leeg) is toegestaan; bij minder dan 10 tekens toont het script alleen een waarschuwing. Daarna committen en pushen.
- Meerdere accounts mogen dezelfde token versleutelen (vrienden publiceren via de token van de eigenaar).
- Naam wordt hoofdletterongevoelig vergeleken. Verkeerde naam of wachtwoord geeft dezelfde melding: "Onjuiste naam of wachtwoord" (geen hint welke van de twee).
- Na het ontsleutelen controleert de bouwer de token bij GitHub (`GET /repos/{owner}/{repo}`, `permissions.push` moet `true` zijn). Lukt dat niet: "Je sleutel werkt niet (meer). Vraag de eigenaar om een nieuwe." en de bouwer blijft dicht. Zonder netwerk: melding "Geen verbinding met GitHub", met opnieuw-knop.

### 2.3 Sessie
- Keuze bij inloggen: **"Ingelogd blijven op dit apparaat"** (vinkje). Aan: de ontsleutelde token en naam staan in `localStorage` (`lichtbreker:bouwer`). Uit: in `sessionStorage`.
- **Uitloggen** in het ⋯-menu wist beide.

### 2.4 Beveiliging (bewust geaccepteerd)
- De repo is openbaar: het versleutelde blokje is voor iedereen leesbaar. De veiligheid rust op het wachtwoord en de hoge PBKDF2-factor. Op verzoek van de eigenaar is er geen minimumlengte: een zwak wachtwoord is te raden, en wie het raadt kan publiceren in de repo. Bewust geaccepteerd; schade is via git terug te draaien en de token is in te trekken.
- GitHub-tokens staan nooit leesbaar in de repo of de gebouwde site.
- Alle Pages-sites op `hitmoso.github.io` delen één origin en dus `localStorage`. Daarom: fine-grained token, alleen voor deze repo, met minimale rechten (Contents: read/write, Actions: read, Metadata: read) en een vervaldatum. De README legt dit stap voor stap uit.
- Een account intrekken = account verwijderen en publiceren. Wie de token zelf al heeft opgeslagen, houdt die tot de token verloopt of wordt ingetrokken; de README noemt dat (token vervangen = alle accounts opnieuw aanmaken).

## 3. Het bouwscherm

### 3.1 Indeling (gekozen: "gereedschapsdok onderin")
**Telefoon (staand):**
- Kop: ← (terug naar het spel), titel "Bouwer", datumchip (bijv. "24 dec" of "Nieuw"), knop **Publiceer** (accentkleur).
- Midden: het veld, getekend door dezelfde `BoardView` als het spel (zelfde gloeiende stukken en straal).
- Controleregel: `Max 9 · 3 spiegels · ✓ geldig · 1 tip` (tik opent het controlepaneel als blad).
- Kleur-/richtingrijtje (alleen bij Kristal, Filter, Spiegel, Bron).
- Gereedschapsdok: Muur · Kristal · Spiegel · Prisma · Filter · Bron · Gum.
- Onderste rij: **▶ Test**, **🔗 Deel**, **⋯**, en ongedaan maken/opnieuw (↶ ↷).

**Desktop (breed, vanaf 900 px):** kop met dezelfde knoppen plus Test en Deel; gereedschap als verticale balk links van het veld; rechts een vast controlepaneel (zie 3.4). Geen pagina-scroll; het veld schaalt mee zoals in het spel.

### 3.2 Gereedschap en tekenen
- Eén knop per soort. Bij **Kristal** verschijnt het rijtje wit/rood/groen/blauw, bij **Filter** rood/groen/blauw, bij **Spiegel** ╱/╲, bij **Bron** de vier richtingen. De gekozen variant blijft per gereedschap onthouden.
- **Tik op een vak** plaatst het gekozen stuk (vervangt wat er stond).
- **Tik met hetzelfde gereedschap op een stuk van dezelfde soort** wisselt het: kristal wit → rood → groen → blauw → wit; filter rood → groen → blauw → rood; spiegel ╱ ↔ ╲; bron draait naar de volgende richting die naar binnen wijst (richtingen die naar buiten wijzen worden overgeslagen). Het kleurrijtje volgt de nieuwe waarde.
- **Bron:** er is altijd hoogstens één. Een bron plaatsen verplaatst de bestaande. Een bron kan alleen op een randvak; op een binnenvak schudt het vak kort (zoals in het spel bij een ongeldige tik). Op een hoekvak kiest hij automatisch een richting die naar binnen wijst.
- **Gum** maakt een vak leeg.
- **Slepen** (muis of vinger) met Muur of Gum tekent/wist over meerdere vakken in één beweging (één ongedaan-stap).
- **Ongedaan maken / opnieuw**: knoppen en Ctrl+Z / Ctrl+Shift+Z (Cmd op Mac). Geschiedenis tot 100 stappen.
- Toetsenbord (desktop): pijltjes verplaatsen een cursorvak, Enter/spatie tikt, cijfers 1–7 kiezen gereedschap.

### 3.3 Live straal
- Na elke wijziging wordt de straal direct opnieuw getekend (zonder spelersspiegels), met de bestaande `trace`/`BoardView.update`. Geraakte kristallen lichten op zoals in het spel.
- **Toon oplossing** (in het controlepaneel) zet de spelersspiegels van de beste oplossing op het veld (doorschijnend) en toont die straal; nogmaals tikken of een wijziging verbergt ze.

### 3.4 Controle en kwaliteit
- Berekend in de web worker (nieuw verzoek `analyse` met de puzzel), met 150 ms debounce en "laatste wint": een nieuwe wijziging beëindigt de lopende worker. Tijdens rekenen toont de regel een rustig pulserend "…" bij Max.
- Inhoud:
  - **Geldig**: `validatePuzzle`. Fouten in mensentaal: "Er is nog geen bron", "De bron wijst naar buiten", enz. (vertaaltabel van de bestaande meldingen).
  - **Max** en het aantal spelersspiegels.
  - **Tips** (alleen advies, blokkeren niets), via een nieuwe `qualityReport(p, settings = DAILY)` in `src/core/generator.ts` die per eis rapporteert:
    - "Max ligt buiten 6–12" (bereik uit `DAILY.maxScore`)
    - "Zonder spiegels raak je al de helft"
    - "Gulzig spelen haalt het maximum al"
    - "Je hebt niet alle spiegels nodig"
  - `meetsQuality` blijft ongewijzigd (zodat de dagpuzzels niet verschuiven); een test borgt dat `qualityReport(p).ok === meetsQuality(p).ok`.

### 3.5 ⋯-menu (blad)
- **Raster**: breedte 3–12, hoogte 3–14 (stappers). Kleiner maken knipt rechts/onder af (één ongedaan-stap); een bron die verdwijnt is weg.
- **Spelersspiegels**: 1–8.
- **Begin met**: Leeg (gekozen maat, alleen een bron links in het midden) · Genereer (Makkelijk/Normaal/Moeilijk; nieuwe willekeurige seed, via de worker) · **Datum openen…** (zie 4.1).
- **Verwijder eigen puzzel** (alleen als de geopende datum een eigen puzzel heeft; zie 4.4).
- **Uitloggen**.
- Een andere puzzel laden terwijl er onbewaarde wijzigingen zijn vraagt bevestiging ("Je huidige ontwerp gaat verloren").

### 3.6 Testen
- **▶ Test** opent het level in speelweergave binnen de bouwer, met de bestaande `Round` (spiegeldok, Vuur!, resultaat, viering, geluid). Kop toont "Test" en een knop **Terug naar bouwen**; het ontwerp staat er ongewijzigd als je terugkomt. Een ongeldige puzzel kan niet getest worden (knop uit, met reden in tooltip/aria).
- Testresultaten worden nergens opgeslagen.

### 3.7 Werk bewaren
- Het ontwerp (puzzel, geopende datum, gekozen gereedschap) wordt bij elke wijziging bewaard in `localStorage` (`lichtbreker:bouwer:ontwerp`) en bij openen hersteld.

### 3.8 Animatie en toegankelijkheid
- Geplaatste stukken verschijnen met de veer-easing van het spel (kort schalen), verwijderde stukken krimpen weg; de straal hertekent vloeiend. Kleurwissel van een kristal: korte kleurovergang. Bij `prefers-reduced-motion` gebeurt alles direct.
- Alle knoppen hebben labels; gereedschap is een radiogroep; meldingen gaan via een `aria-live`-regio.

## 4. Publiceren

### 4.1 Datum openen
- Datumkiezer (native `<input type="date">`), met snelknoppen Vandaag en Morgen. Toont het puzzelnummer.
- De bouwer haalt de **actuele** `src/data/overrides.json` uit de repo (GitHub Contents API, met de token), niet de meegebouwde kopie. Heeft de datum een eigen puzzel, dan wordt die geladen met label **"Eigen puzzel"**; anders de gegenereerde dagpuzzel (`getDaily(datum, {})`, via de worker) met label **"Gegenereerd"**.

### 4.2 Publiceer
1. Knop **Publiceer** is uit zolang de puzzel ongeldig is (met reden). Is er nog geen datum gekozen, dan vraagt het venster eerst een datum (standaard: morgen).
2. Bevestigingsvenster: datum, puzzelnummer, max, eventuele tips. Bij **vandaag**: waarschuwing "Spelers die vandaag al begonnen zijn, beginnen opnieuw." Bij een datum in het verleden: waarschuwing "Deze datum is al voorbij".
3. Publiceren:
   - `GET /repos/Hitmoso/lichtbreker/contents/src/data/overrides.json` → inhoud + `sha`.
   - JSON inlezen, de datum toevoegen of vervangen, **stabiel wegschrijven** (datums gesorteerd, 2 spaties inspringing, afsluitende newline). Base64 via `TextEncoder` (UTF-8-veilig).
   - `PUT` met de `sha` en commitbericht `puzzel: 2026-12-24 (door max)` op branch `main`.
   - Bij **409/422 (sha verouderd)**: opnieuw ophalen en alleen de eigen datum opnieuw toepassen; maximaal 3 pogingen.
   - Fouten: 401/403 → "Je sleutel werkt niet (meer)"; netwerk → "Geen verbinding, probeer opnieuw"; overig → melding met statuscode. Het ontwerp gaat nooit verloren.
4. Repo-gegevens staan op één plek: `PUBLISH = { owner: 'Hitmoso', repo: 'lichtbreker', branch: 'main', path: 'src/data/overrides.json', workflow: 'pages.yml' }` in `src/config.ts`.

### 4.3 Bouwstatus volgen
- Na een geslaagde commit pollt de bouwer elke 10 s `GET /repos/{owner}/{repo}/actions/runs?head_sha=<commit-sha>` (maximaal 15 min). Statuschip in de kop: **⏳ Wordt gebouwd…** → **✓ Live** (met de toevoeging "spelers zien hem binnen ±10 minuten") of **✗ Mislukt** (link naar de run op GitHub; de oude site blijft staan).
- Zonder Actions-leesrecht (403): chip "Gepubliceerd — status onbekend". Verlaat je de bouwer, dan stopt het volgen.

### 4.4 Verwijder eigen puzzel
- Haalt de datum uit `overrides.json` via dezelfde route (commit `puzzel: 2026-12-24 verwijderd (door max)`), na bevestiging. Die dag krijgt weer de gegenereerde puzzel.

### 4.5 Vangnet in CI
- Nieuwe test: elke sleutel in `overrides.json` is een geldige datum `YYYY-MM-DD` en elke waarde slaagt voor `validatePuzzle`. Faalt die, dan publiceert de workflow niet (bestaand gedrag: tests vóór build).

## 5. Deelbare link (eigen level)

### 5.1 Code
- `src/core/levelcode.ts`: `encodeLevel(p: Puzzle): string` en `decodeLevel(s: string): Puzzle | null`.
- Formaat: `1.<b>.<h>.<spiegels>.<data>`, waarbij `<data>` = base64url van de cellen in de `toAscii`-tekens, rij na rij aan elkaar, met reeksen van lege vakken (`.`) ingekort tot `.<aantal>` waar dat korter is. Het voorvoegsel `1` is de formaatversie.
- `decodeLevel` geeft `null` bij elke afwijking (onbekende versie, verkeerde lengte, onbekend teken) en controleert het resultaat altijd met `validatePuzzle`.

### 5.2 Delen
- **🔗 Deel** (alleen bij een geldige puzzel) maakt `<site>/?level=<code>`. Met `navigator.share` (telefoon) het deelmenu, anders kopiëren naar het klembord met melding "Link gekopieerd".

### 5.3 Spelen
- `?level=<code>` start het spel in een nieuwe modus **Eigen level** (`ModeName` `'level'`): de kop toont "Eigen level" in plaats van het puzzelnummer, de schakelaar Dagelijks | Oneindig is verborgen, en er is een knop **Naar het spel** (laadt de site zonder parameters).
- Spelen met de bestaande `Round`: plaatsen, Vuur!, resultaat met score/max, viering en geluid. Max en oplossing via de worker (`analyse`). Niets wordt opgeslagen in geschiedenis, reeks of statistieken; de tutorial en tips voor nieuwe elementen werken wel.
- Ongeldige code: in plaats van het veld de melding "Dit level kan niet geladen worden" met de knop **Naar het spel**.
- Levelinhoud komt nooit in `innerHTML`; alles via de bestaande DOM-helpers.

## 6. Dagpuzzel van vandaag aanpassen

- `SavedCurrent` krijgt een optioneel veld `puzzleId?: string`: een korte vingerafdruk (FNV-1a-hash van `JSON.stringify(puzzle)`, 8 hexadecimale tekens) van de dagpuzzel waarop de voortgang slaat.
- Bij laden van de dagmodus: is er een `current` voor hetzelfde nummer **met** een `puzzleId` die niet overeenkomt met de huidige dagpuzzel, dan wordt `current` weggegooid en begint de speler stil opnieuw (leeg veld). Een `current` **zonder** `puzzleId` (oude opslag) blijft gewoon gelden.
- `history` (scores) wordt niet aangepast; een nieuwe inzending overschrijft de score van die dag zoals nu.
- Wie de site open heeft, ziet de nieuwe puzzel pas na herladen of bij de volgende dagwissel.

## 7. Techniek

### 7.1 Nieuwe en gewijzigde bestanden
- `src/editor/` — `index.ts` (opbouw scherm, `mount()`), `tools.ts` (gereedschapslogica: plaatsen, wisselen, bronregels; puur, testbaar), `history.ts` (ongedaan/opnieuw), `analysis.ts` (worker-aansturing met debounce en laatste-wint), `panels.ts` (controlepaneel, ⋯-blad, publiceervenster), `login.ts` (inlogscherm), `editor.css`.
- `src/publish/` — `crypto.ts` (PBKDF2 + AES-GCM ontsleutelen; versleutelen voor het script), `github.ts` (Contents API, Actions-runs; `fetch` injecteerbaar voor tests), `overrides.ts` (puur: datum zetten/verwijderen, stabiel formatteren), `session.ts` (opslag van de sessie).
- `src/core/levelcode.ts` (nieuw), `src/core/generator.ts` (+ `qualityReport`), `src/core/fingerprint.ts` (nieuw).
- `src/worker/` — verzoek `analyse` (puzzel → `{ max, solution, report }`) en `generate` (seed + niveau, bestaat als `endless`; hergebruikt).
- `src/ui/modes/level.ts` (nieuw), `src/ui/modes/types.ts` (`ModeName` + `'level'`), `src/ui/app.ts` (startmodus kiezen uit de URL; logo-gebaar), `src/ui/modes/daily.ts` en `src/state/storage.ts` (vingerafdruk).
- `src/main.ts` — routering: `?bouwer` → `import('./editor')`; `?level=` → app in modus Eigen level; anders zoals nu.
- `src/render/board.ts` — alleen kleine uitbreidingen indien nodig (bijv. een doorschijnende spiegelweergave voor "Toon oplossing", een plop-/krimpanimatie voor celwijzigingen, en pointer-down/move/up voor slepen). Het spelgedrag blijft gelijk.
- `scripts/bouwer-account.mjs` + `package.json`-script `bouwer:account`.
- `public/bouwers.json` (start: `[]`).
- README: sectie "Puzzelbouwer (beheer)": token maken (precieze rechten), account aanmaken, inloggen, publiceren, terugdraaien, `git pull` na publiceren.

### 7.2 Buiten scope
- Lijst met bewaarde ontwerpen in de bouwer (meerdere tegelijk).
- Echte accounts op een server, rechten per vriend, of een goedkeuringsstap.
- Eigen levels in statistieken of een ranglijst.
- Een knop in het spel naar de bouwer.

## 8. Testen

**Unit (Vitest):**
- `levelcode`: heen-en-terug voor alle fallback-puzzels en willekeurige geldige borden; `null` voor kapotte/afgekapte/onbekende-versie codes; resultaat altijd geldig.
- `tools`: plaatsen, wisselen per soort, bron verplaatsen, bron op binnenvak geweigerd, hoek-richting, gum, raster verkleinen.
- `history`: ongedaan/opnieuw, sleepbeweging als één stap, limiet 100.
- `overrides`: zetten, vervangen, verwijderen, sortering, stabiele opmaak, UTF-8-base64.
- `github`: met nep-`fetch`: geslaagde publicatie, 409 → opnieuw met alleen de eigen datum, 401 → sleutelfout, Actions-status (in uitvoering / gelukt / mislukt / 403).
- `crypto`: versleutelen → ontsleutelen met juist wachtwoord; fout wachtwoord → mislukt; script-uitvoer is leesbaar voor de browsercode.
- `qualityReport`: gelijk aan `meetsQuality.ok` over 200 gegenereerde puzzels; elke tip afzonderlijk aantoonbaar.
- `fingerprint` + dagmodus: andere puzzel → `current` weg; zonder `puzzleId` → behouden; `history` ongemoeid.
- `overrides.json`-vangnet (4.5).
- Bestaande tests (o.a. "daily puzzles do not shift") blijven groen; `DAILY` ongewijzigd.

**E2E (Playwright, GitHub nagebootst via route-interceptie; nooit echt publiceren):**
- `?bouwer`: inlogscherm; fout wachtwoord → melding; goed (testaccount) → bouwscherm.
- 5× tik op logo → inlogscherm.
- Tekenen: muur, kristal + kleurwissel, bron; straal en Max werken bij; ongedaan maken.
- Test → Vuur! → resultaat → Terug naar bouwen met ontwerp intact.
- Publiceer naar morgen → juiste PUT-body (alleen die datum gewijzigd) → statuschip naar ✓ Live.
- Deel → `?level=` openen in nieuwe pagina → "Eigen level" speelbaar; kapotte code → melding.
- Telefoonmaat (375×812) en desktop: geen horizontale scroll, alles bereikbaar; reduced motion zonder animaties.

Het testaccount voor E2E wordt in de test aangemaakt (vaste nep-token, geen echte sleutel) en geleverd door `./bouwers.json` in Playwright te onderscheppen; het staat niet in `public/bouwers.json`.
