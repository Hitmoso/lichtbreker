# Lichtbreker — oneindige modus

Datum: 2026-11-07
Status: ter review
Bouwt voort op: `2026-11-07-lichtbreker-design.md` (hierna: hoofdspec). Alles wat hier niet staat, blijft zoals in de hoofdspec.

## 1. Doel

Naast de dagelijkse puzzel kan de speler zoveel puzzels spelen als hij wil, ontspannen en zonder druk, op een zelfgekozen moeilijkheid. De dagpuzzel blijft het hart van het spel.

**Succes:** een speler die zijn dagpuzzel af heeft, tikt op "Meer spelen", kiest een niveau en speelt puzzel na puzzel zonder wachttijd of gedoe. De dagpuzzel, reeks en dagstatistieken blijven onaangetast.

## 2. Modi en navigatie

- Onder de titel staat altijd een schakelaar **Dagelijks | Oneindig** (segmented control, toetsenbord-bedienbaar, `aria-pressed` of radiogroep).
- Bij openen van de site is **Dagelijks** actief. De gekozen modus wordt niet onthouden over bezoeken heen.
- In het resultaatpaneel van de dagpuzzel staat een extra knop **Meer spelen**, die naar Oneindig schakelt.
- Wisselen van modus behoudt de stand van beide modi: een lopende dagpuzzel of oneindige puzzel staat er nog als je terugkomt.
- Tijdens een animatie (vuren, beste oplossing) is de schakelaar uitgeschakeld.
- De ruimte voor de schakelaar gaat af van het veld; de no-scroll-eisen van de hoofdspec gelden onverkort, ook in liggende stand.

## 3. Moeilijkheid

In Oneindig staat boven het veld een tweede, kleinere keuze **Makkelijk | Normaal | Moeilijk**. De keuze wordt onthouden (`localStorage`). Standaard: Normaal.

| | Makkelijk | Normaal | Moeilijk |
|---|---|---|---|
| Raster (b × h) | 5 × 7 | 7 × 9 | 8 × 10 |
| Spelersspiegels | 2–3 | 3–6 | 5–7 |
| Extra elementsoorten | 0 | 0–3 | 2–3 |
| Muren | 2–4 | 4–8 | 6–10 |
| Kristallen | 6–9 | 10–16 | 14–20 |
| Maximum | 4–7 | 6–12 | 9–14 |

- De dagpuzzel heeft eigen, vaste instellingen `DAILY` (gelijk aan het huidige `GEN`). Die worden nooit door de niveaus beïnvloed, zodat dagpuzzels niet verschuiven.
- **Normaal** begint als kopie van `DAILY`, maar is een eigen object en mag later vrij worden bijgesteld.
- Alle niveau-instellingen staan op één plek (`DIFFICULTIES` in `src/config.ts`) en zijn aan te passen zonder codewijziging; de tests (sectie 9) laten direct zien als een combinatie geen goede puzzels meer oplevert.
- Overige generatorinstellingen (aantal vaste spiegels, prisma's, filters, aandeel gekleurde kristallen, pogingen) zijn per niveau gelijk aan `DAILY`, tenzij de tabel iets anders zegt.
- Alle kwaliteitseisen uit hoofdspec 4.2 gelden per niveau, met het maximum-bereik uit de tabel.
- Wisselen van niveau terwijl er een onaangeroerde puzzel ligt (geen spiegels, niet ingediend): direct een nieuwe puzzel op het nieuwe niveau. Liggen er al spiegels: eerst bevestigen ("Deze puzzel overslaan?" — **Overslaan** / **Blijven**).

## 4. Een oneindige ronde

- Spelen is identiek aan de dagpuzzel: tikken, live straal, **Opnieuw**, **Vuur!** met bevestiging en vuur-animatie.
- In het dok staat daarnaast **Overslaan**: direct een nieuwe puzzel op hetzelfde niveau, zonder in te dienen. Overslaan telt niet als gespeeld en geeft geen bevestiging als er nog geen spiegels liggen; met spiegels wel (zelfde vraag als in 3).
- Na de animatie opent het resultaatpaneel met de score "7 / 9" en de oordeelzin uit de dagmodus, plus de knoppen **Volgende puzzel** (primair) en **Bekijk beste oplossing**. Geen deelknop, geen aftelklok.
- Na sluiten van het paneel toont het dok **Volgende puzzel** (en **Jouw straal** tijdens het bekijken van de beste oplossing), net als **Resultaat** in de dagmodus.
- Eerste-keer-tips (hoofdspec 5) werken ook in Oneindig; de tutorial verschijnt maar één keer in totaal.
- De ?-uitleg toont de elementen van de huidige puzzel.

## 5. Puzzels maken

- Elke nieuwe oneindige puzzel krijgt een willekeurige 32-bit seed (`crypto.getRandomValues`, terugval `Math.random`; alleen in de UI-laag, nooit in `src/core`).
- De puzzel komt uit `generate(seed, DIFFICULTIES[niveau])` in dezelfde Web Worker als de dagpuzzel, met dezelfde terugval op de hoofdthread.
- Faalt de generator na alle pogingen: een reservepuzzel per niveau (`src/data/fallback-<niveau>.json`; Normaal hergebruikt `fallback.json`).
- Oneindige puzzels zijn per speler verschillend en niet deelbaar.

## 6. Opslag en statistieken

`SavedState` krijgt een optioneel veld `endless` (versie blijft 1; ontbreekt het of is het ongeldig, dan standaardwaarden):

```ts
endless: {
  difficulty: 'easy' | 'normal' | 'hard';
  current: { difficulty; seed: number; placements: Placement[]; submitted: boolean } | null;
  stats: Record<'easy' | 'normal' | 'hard', { played: number; perfect: number; run: number; bestRun: number }>;
}
```

- `current` wordt na elke wijziging opgeslagen. Herladen of terugschakelen hervat precies die puzzel (zelfde seed → zelfde puzzel); plaatsingen worden opnieuw gevalideerd, de score wordt herberekend.
- Een ingediende `current` toont bij hervatten het resultaat-dok (**Volgende puzzel**), niet automatisch het paneel.
- Bij indienen: `played + 1`; bij score = maximum ook `perfect + 1` en `run + 1` (en `bestRun = max(bestRun, run)`), anders `run = 0`. Overslaan verandert niets.
- Oneindige puzzels tellen nooit mee voor de dag-`history`, de reeks of de dagverdeling.
- Het statistiekenpaneel toont onder de bestaande dagstatistieken een blok **Oneindig** met per niveau: gespeeld, maximum gehaald (aantal), beste reeks maximaal op rij. Niveaus met 0 gespeeld worden weggelaten; zonder enige oneindige puzzel blijft het blok weg.

## 7. Techniek

```
src/config.ts            DAILY: GenSettings (vast; GEN blijft als alias); DIFFICULTIES: Record<Difficulty, GenSettings> (normal = eigen kopie van DAILY)
src/core/generator.ts    generate(seed, settings = DAILY); meetsQuality(p, settings = DAILY); fallback per niveau
src/worker/*             verzoeken { kind: 'daily', date } | { kind: 'endless', seed, difficulty }
src/state/storage.ts     optioneel veld `endless`, met validatie
src/state/endless.ts     pure functies: recordEndlessResult, defaultEndless
src/ui/round.ts          één speelronde: veld, voorraad, Opnieuw/Vuur!, animatie, resultaat-dok
src/ui/modes/daily.ts    dagbron: puzzel van vandaag, history/reeks, delen, aftelklok, "Meer spelen", dagwissel
src/ui/modes/endless.ts  oneindige bron: niveaukeuze, Overslaan, "Volgende puzzel", stats
src/ui/app.ts            kop, schakelaar, wisselen van modus
```

- `round.ts` kent geen dagen, niveaus of opslagdetails. Een modus geeft hem een puzzel (`puzzle`, `max`, `solution`, eventuele bestaande plaatsingen/ingediend) en de extra dok-knoppen, en krijgt na indienen de score terug.
- Er is één `BoardView` voor beide modi; hij wordt bij wisselen niet opnieuw gemaakt.
- De dagwissel (hoofdspec 8) herlaadt alleen de dagmodus. Is Oneindig actief, dan gebeurt dat onzichtbaar op de achtergrond.

## 8. Foutafhandeling

- Ongeldige of ontbrekende `endless`-opslag → standaardwaarden; de dagstand blijft intact.
- Ongeldige plaatsingen bij hervatten → lege plaatsingen, zelfde puzzel.
- Generator faalt → reservepuzzel van dat niveau.
- Dubbel tikken op **Volgende puzzel** of **Overslaan** → één nieuwe puzzel.

## 9. Testen

- **Vitest:** per niveau 100 seeds voldoen aan `meetsQuality` met het juiste raster en maximum-bereik; snelheid per niveau (gemiddelde < 400 ms, maximum < 2000 ms in Node); reservepuzzels per niveau voldoen; `generate(seed)` zonder settings is ongewijzigd (dagpuzzels verschuiven niet: vaste verwachte uitkomst voor een paar dagen); `DIFFICULTIES.normal` is een ander object dan `DAILY`, zodat aanpassen van Normaal de dagpuzzel niet raakt; opslag zonder `endless` laadt; ongeldige `endless`-velden vallen terug; `recordEndlessResult` (played, perfect, run, bestRun).
- **Playwright:** schakelen Dagelijks ↔ Oneindig behoudt beide standen; een oneindige ronde spelen → resultaat → **Volgende puzzel** geeft een ander veld; **Overslaan** zonder spiegels werkt direct; herladen hervat dezelfde oneindige puzzel; niveau wisselen verandert het raster; dagpuzzel en `history` onaangetast na oneindig spelen; geen scroll op 360×640, 390×844, 844×390 en 1280×800 in beide modi.

## 10. Buiten scope

- Runs met inzet, niveaus/levels, delen van oneindige puzzels, ranglijsten.
- Onthouden van de laatst gekozen modus.
- De openstaande kleine punten uit de eindreview van v1 (die volgen apart).
