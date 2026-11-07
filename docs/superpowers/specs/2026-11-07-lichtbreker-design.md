# Lichtbreker — ontwerp

Datum: 2026-11-07
Status: ter review

## 1. Doel

Lichtbreker is een dagelijkse ruimtelijke puzzel op een website. De speler plaatst spiegels om een laserstraal langs zoveel mogelijk kristallen te leiden. Iedereen krijgt per dag dezelfde puzzel.

**Succes:** iemand opent het spel op de telefoon, snapt het binnen 10 seconden, vindt het er prachtig uit zien en komt morgen terug.

**Hoofdeis:** een mooie UI met leuke animaties. Bij twijfel wint de beleving.

Het project staat volledig los van andere projecten: eigen map (`Desktop/Lichtbreker`), eigen git-repo.

## 2. Randvoorwaarden

- Statische site zonder server; hosting op GitHub Pages (Vite met relatieve `base`).
- Interface in het Nederlands.
- Mobiel eerst, staand. Op telefoon past alles in één scherm: **geen scrollen, geen zoomen** (ook niet per ongeluk via dubbeltik). Op desktop staat het spel gecentreerd op een passende maat; niets rekt uit.
- Alleen donker thema in deze versie.
- Nieuwe puzzel om middernacht in `Europe/Amsterdam`. Puzzel #1 valt op `EPOCH` (config). Datums vóór `EPOCH` tonen puzzel #1.
- Geen accounts. Voortgang en statistieken staan in `localStorage`.

## 3. Spelregels

### 3.1 Speelveld

- Rechthoekig raster. De maat hoort bij elke puzzel (`width`, `height`); de standaard voor gegenereerde puzzels is **7 breed × 9 hoog** en staat in `src/config.ts`. De layout berekent de vakgrootte uit de beschikbare schermruimte, zodat andere maten zonder codewijziging werken.
- Coördinaten: `x` naar rechts, `y` naar beneden, `(0,0)` linksboven.
- Precies één **laserbron** op een randvak, gericht naar binnen. De straal begint wit en vertrekt vanaf het aangrenzende vak.
- De speler heeft per puzzel `mirrors` spiegels (3–6).

### 3.2 Elementen

| Element | Gedrag |
|---|---|
| Leeg vak | Straal gaat rechtdoor. Hier mag de speler een spiegel zetten. |
| Kristal (wit) | Straal gaat erdoorheen. Telt alleen als geraakt door een **witte** straal (strikte kleuren, sinds 2026-11-07). |
| Gekleurd kristal (rood/groen/blauw) | Straal gaat erdoorheen. Telt alleen als geraakt door een straal van dezelfde kleur. Elk kleur heeft ook een eigen vorm/symbool (kleurenblind-vriendelijk). |
| Muur | Straal stopt. |
| Spelersspiegel `╱` / `╲` | Kaatst de straal (zie 3.3). |
| Vaste spiegel `╱` / `╲` | Als spelersspiegel, maar staat vast en is niet aan te passen. |
| Prisma | Inkomende straal stopt; er vertrekken twee stralen haaks naar links en naar rechts ten opzichte van de looprichting, met dezelfde kleur. |
| Kleurfilter (rood/groen/blauw) | Straal gaat erdoorheen en krijgt de kleur van het filter. |
| Laserbron | Blokkeert een straal die erop terugkomt. |

Spelersspiegels kunnen alleen op lege vakken.

### 3.3 Straal volgen

- Richtingen: rechts `(1,0)`, links `(-1,0)`, omhoog `(0,-1)`, omlaag `(0,1)`.
- `╱`: rechts→omhoog, omhoog→rechts, links→omlaag, omlaag→links.
- `╲`: rechts→omlaag, omlaag→rechts, links→omhoog, omhoog→links.
- Een straal stopt bij een muur, de bron, of buiten het raster.
- **Lussen:** komt een straal een vak binnen met dezelfde richting én kleur als eerder (over alle straaltakken heen), dan stopt die tak.
- Uitkomst van `trace`: lijst segmenten (van–naar, kleur, volgorde/afstand vanaf de bron, voor de animatie) en de set geraakte kristallen.

### 3.4 Score

- Score = aantal **verschillende** kristallen dat geraakt is (volgens 3.2).
- Maximum = hoogste score die met maximaal `mirrors` spelersspiegels haalbaar is, berekend door de solver.
- Het maximum is **niet** zichtbaar vóór het indienen.

### 3.5 Bediening

- Tik op een leeg vak: leeg → `╱` → `╲` → leeg. Van leeg naar `╱` kan alleen als er spiegels over zijn; anders een kort schudje.
- De straal wordt na elke tik live opnieuw berekend en getekend.
- **Opnieuw:** wist alle spelersspiegels.
- **Vuur!:** korte bevestiging ("Zeker weten?"), daarna is de inzending definitief.
- Tussenstand (geplaatste spiegels) blijft bewaard bij herladen.

## 4. Dagpuzzel

### 4.1 Bron van de puzzel

`daily.ts`: datum → puzzelnummer → puzzel.

1. Staat er voor die datum een puzzel in `src/data/overrides.json`, gebruik die.
2. Anders: generator met seed afgeleid van het puzzelnummer.

Een override heeft hetzelfde `Puzzle`-formaat als een gegenereerde puzzel. Het latere developer portal schrijft naar dit bestand.

### 4.2 Generator

Per seed, voorspelbaar (eigen seeded RNG, geen `Math.random`):

1. Kies 0–3 extra elementsoorten uit {vaste spiegel, prisma, kleurfilter} (willekeurig, geen vast weekritme). Gekleurde kristallen komen alleen voor als er een kleurfilter is.
2. Kies het aantal spelersspiegels (3–6), bronpositie, muren, kristallen en de gekozen extra's.
3. Los op met de solver en toets de kwaliteitseisen:
   - maximum ligt tussen 6 en 12;
   - de gretige strategie (zie 4.4) haalt het maximum niet;
   - met één spiegel minder is het maximum strikt lager (alle spiegels doen ertoe);
   - de lege puzzel (zonder spelersspiegels) scoort minder dan de helft van het maximum.
4. Voldoet de puzzel niet, probeer een afgeleide seed (`seed, poging`). Na 200 pogingen: val terug op een vaste reservepuzzel uit `src/data/fallback.json`.

### 4.3 Solver

Diepte-eerst zoeken over de straal:

- Alleen vakken waar een straal daadwerkelijk langskomt doen ertoe. Wanneer de straal (in BFS-volgorde over alle takken) voor het eerst een leeg, nog onbeslist vak binnenkomt, wordt daar vertakt: leeg laten, `╱` of `╲` (die laatste twee alleen als er spiegels over zijn). Een eenmaal beslist vak blijft zo bij latere passages.
- Snoeien: huidige score + aantal nog niet geraakte kristallen ≤ beste score → stoppen.
- Geeft het maximum én een bijbehorende oplossing (voor "bekijk beste oplossing").
- Correctheid wordt getest tegen brute force over alle plaatsingen op kleine rasters.

### 4.4 Gretige strategie (voor de kwaliteitscheck)

Plaats spiegels één voor één; kies telkens de plaatsing (vak + oriëntatie) die de score het meest verhoogt, bij gelijkspel de eerste in leesvolgorde. Stop als er geen verbetering is of de spiegels op zijn.

### 4.5 Uitvoering

Generator en solver draaien in een **Web Worker**, zodat de UI nooit hapert. Bij openen: laad-animatie tot de puzzel er is. Doel: puzzel klaar binnen 1 seconde op een gemiddelde telefoon.

## 5. Schermen

1. **Eerste bezoek:** uitleg in drie stapjes met een zichzelf spelende mini-demo (spiegel verschijnt, straal buigt, kristal licht op). Terugkerende spelers gaan direct naar het spel.
2. **Speelscherm:**
   - Boven: titel, puzzelnummer, ?-knop, statistieken-knop.
   - Midden: het veld.
   - Onder: spiegelvoorraad als icoontjes die verdwijnen bij plaatsen, **Opnieuw**, opvallende **Vuur!**-knop.
   - Er staat **geen** tekst als "Vandaag: prisma + filters". De ?-knop toont uitleg van alleen de elementen in deze puzzel. Ziet een speler een elementsoort voor het eerst, dan pulseert die één keer subtiel met een korte tip; daarna nooit meer (bijgehouden in `localStorage`).
3. **Resultaat:** score telt op naar "7 / 9", deelknop, "bekijk beste oplossing" (afgespeelde animatie), aftelklok tot de volgende puzzel. Na indienen is het veld niet meer aan te passen; heropenen toont direct het resultaat.
4. **Statistieken:** gespeeld, huidige reeks, beste reeks, verdeling van score als percentage van het maximum (100%, 90–99%, 75–89%, 50–74%, <50%).

Reeks: aantal opeenvolgende puzzeldagen waarop is ingediend, ongeacht score. Een gemiste dag zet de huidige reeks op 0.

### 5.1 Deeltekst

Zonder spoilers, gekopieerd naar het klembord (of via `navigator.share` op mobiel):

```
Lichtbreker #12 💎 7/9
🟨🟨🟨🟨🟨🟨🟨⬛⬛
```

Eén blokje per kristal tot het maximum: geraakt = 🟨, gemist = ⬛. Bij het maximum: 🟨-reeks gevolgd door ✨.

## 6. Stijl en animaties

- Diep nachtblauw/bijna zwart, neon-lichtstralen. De exacte visuele richting (kleuren, typografie) wordt bij de bouw vastgelegd met de `frontend-design`-skill.
- **Spiegel plaatsen:** ploft in met een kleine veer; `╱`→`╲` draait soepel een kwartslag.
- **Live straal:** zachte gloed (bloom), glinstering die in looprichting meestroomt; bij wijziging schiet de straal snel opnieuw uit vanaf de bron.
- **Kristal live geraakt:** zachte gloed.
- **Vuur!:** veld dimt, felle straal met lichtende kop schiet vanaf de bron langs de segmenten in volgorde; elk geraakt kristal barst open in deeltjes en de teller tikt op. Bij het maximum: extra regen van glinsterende scherven.
- **Fout:** kort schudje.
- `prefers-reduced-motion`: rustige overgangen, geen deeltjes of schudden.
- Doel: 60 fps op een gemiddelde telefoon.

## 7. Techniek en opbouw

Vite + TypeScript. Speelveld in **PixiJS** (WebGL); overige UI in HTML/CSS.

```
Lichtbreker/
  src/config.ts       EPOCH, standaardrastermaat, generatorinstellingen
  src/core/           pure TypeScript, geen DOM/Pixi
    types.ts          Puzzle, Cell, Element, Placement, Direction, Color
    beam.ts           trace(puzzle, placements) → segmenten + geraakte kristallen
    solver.ts         solve(puzzle) → { max, solution }
    greedy.ts         gretige strategie (4.4)
    generator.ts      generate(seed) → Puzzle
    daily.ts          datum ↔ puzzelnummer, override-lookup
    rng.ts            seeded RNG
    share.ts          deeltekst
  src/worker/         Web Worker rond generator + solver
  src/render/         PixiJS: veld, straal, deeltjes, vuur-animatie
  src/ui/             schermen, knoppen, uitleg, resultaat, statistieken
  src/state/          spelstatus, opslaan/laden met validatie
  src/data/overrides.json
  src/data/fallback.json
  tests/
```

**Gegevensstroom:** datum → `daily` (worker) → `Puzzle` + max + oplossing → status. Tik → status → `trace` → renderer. Vuur! → status definitief → vuur-animatie → resultaatscherm → statistieken bijgewerkt.

`core` kent geen weergave, zodat het later in het developer portal hergebruikt kan worden.

## 8. Foutafhandeling

- Opgeslagen data wordt bij laden gevalideerd (versie, vorm, puzzelnummer, plaatsingen binnen het raster en op lege vakken, aantal ≤ `mirrors`). Ongeldig → dat deel resetten, spel blijft werken.
- `localStorage` niet beschikbaar → spel werkt, alleen zonder opslag.
- Ongeldige override (faalt dezelfde validatie als een puzzel) → genereren alsof er geen override is, met waarschuwing in de console.
- Generator vindt niets → reservepuzzel.
- Dagwissel terwijl de pagina open is → bij terugkeer naar het tabblad nieuwe puzzel laden.

## 9. Testen

- **Vitest, `core`:** losse straalgevallen (beide spiegels in alle richtingen, muur, rand, bron, prisma, filters en gekleurde kristallen, lussen, kristal meerdere keren geraakt telt één keer).
- **Solver vs. brute force** op kleine rasters (bijv. 4×4, ≤3 spiegels, willekeurige seeds).
- **Generator:** dezelfde seed → dezelfde puzzel; 365 opeenvolgende dagen voldoen aan de kwaliteitseisen; snelheid per puzzel binnen budget.
- **Daily:** dagwissel in `Europe/Amsterdam` (incl. zomertijd), datums vóór `EPOCH`, overrides.
- **State:** validatie van beschadigde/gemanipuleerde opslag; reeksberekening.
- **Share:** exacte deeltekst.
- **Playwright:** op telefoonformaten (bijv. 360×640, 390×844, 430×932) en desktop: geen scrollbalk, veld volledig zichtbaar, tikken plaatst spiegels, Vuur! toont resultaat.

## 10. Buiten scope (later)

- **Developer portal** (apart deelproject): puzzels bekijken, aanpassen, testen en als override publiceren. Dit ontwerp bereidt dat voor via het `Puzzle`-formaat, `overrides.json` en een weergave-vrije `core`.
- Portalen, eenrichtingsvakken, draaibare vaste spiegels.
- Geluid.
- Licht thema.
- Vergelijken met andere spelers (vereist server).
