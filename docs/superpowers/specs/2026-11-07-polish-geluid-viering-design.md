# Polish: geluid en viering bij het maximum — ontwerp

Datum: 2026-11-07 · Branch: `feat/polish`

## Doel

Lichtbreker moet fijner aanvoelen. Twee onderdelen:

1. **Geluidseffecten** die vooral *mooi en bevredigend* klinken: glazig en zacht, standaard aan, met een aan/uit-knop.
2. **Een spectaculaire viering** wanneer de speler het maximum haalt.

Buiten scope: trillen, PWA/app-icoon, puzzelgeneratie, multiplayer. `DAILY` in `src/config.ts` en de puzzels blijven onaangeroerd.

**Klaar** = groene `npm test`, `npm run build` en `npm run e2e` op `feat/polish`, de gebruiker heeft de geluiden beluisterd op de geluidsproef-pagina en goedgekeurd, eindreview gedaan, en na akkoord gemerged naar `main` en gepusht.

## 1. Geluid

### Techniek

Alle klanken worden in code opgewekt met de Web Audio API. Er zijn geen geluidsbestanden en geen nieuwe dependencies.

- `src/audio/scale.ts`: puur en testbaar. Het bevat de toonladder (D-groot pentatonisch, grondtoon D5 ≈ 587 Hz) en `noteFreq(step)`, die een stap omzet naar een frequentie. `hitStep(n)` geeft de stap voor het n-de geraakte kristal: oplopend, en boven twee octaven pendelt het binnen het bovenste octaaf zodat het nooit schel wordt.
- `src/audio/voices.ts`: de klankrecepten. Elk recept is een functie `(ctx: BaseAudioContext, out: AudioNode, at: number, opts) => number`, die nodes inplant vanaf tijdstip `at` en de duur teruggeeft. Omdat de recepten op een `BaseAudioContext` werken, lopen ze ook in een `OfflineAudioContext` (voor de render-check).
- `src/audio/sound.ts`: de motor (`Sound`). De keten loopt `stem → master-gain → (droog + galm) → limiter (DynamicsCompressor) → destination`.
  - De AudioContext wordt pas aangemaakt bij de eerste aanroep na een gebruikersgebaar. Bij `pointerdown`/`keydown` doet de motor een `resume()`.
  - De galm is een `ConvolverNode` met een zelf opgewekte impulsrespons: stereo ruis met een exponentiële uitsterving van ongeveer 1,6 s en een lichte low-pass. De galm staat op een bescheiden mengniveau.
  - Er klinken hooguit 12 stemmen tegelijk. Daarboven wordt de oudste snel afgedempt.
  - Bij `visibilitychange` naar verborgen volgt `suspend()`, terug zichtbaar `resume()`.
  - Is Web Audio er niet, of faalt iets, dan zijn alle methoden stil. Ze gooien nooit een fout.
  - Aan/uit staat onder `localStorage['lichtbreker:sound']` (`'on'`/`'off'`, standaard aan) en wordt gelezen en geschreven in try/catch. Uit betekent: master-gain naar 0 en geen nieuwe stemmen.

### Klankontwerp (zodat het goed klinkt)

- **Glas/bel.** Een paar sinusstemmen op onharmonische verhoudingen (≈ 1 : 2,76 : 5,40 : 8,93) met dalende amplitudes. De aanzet duurt 2–4 ms en de uitsterving is exponentieel (hogere partialen sterven sneller). Een korte ruisklik van ≈ 5 ms door een band-pass geeft de "tik".
- **Eén toonsoort.** Alle getoonde klanken komen uit dezelfde pentatonische ladder, dus overlappende geluiden klinken welluidend.
- **Variatie.** Per keer wijkt de toonhoogte ±8 cent af en het volume ±1,5 dB.
- **Volume.** De master ligt rond −12 dBFS. Geen enkel geluid mag in de offline-render boven een piek van 0,9 uitkomen.

| Methode | Moment | Klank |
|---|---|---|
| `place()` | spiegel geplaatst | heldere glastik op stap 4 |
| `rotate()` | spiegel gedraaid | zachtere, kortere tik op stap 6 |
| `remove()` | spiegel weggehaald | tik die in 120 ms een kwart omlaag glijdt |
| `reject()` | geweigerde tik | dof "tok": lage sinus van 180 Hz met snelle uitsterving, zacht |
| `reset()` | Opnieuw | korte neergaande reeks van drie zachte tikken |
| `charge()` | na bevestigen van Vuur! | opzwellende adem: band-pass-ruis die in ≈ 450 ms van 400 naar 2400 Hz stijgt, plus een zachte sinus op de grondtoon |
| `hit(n)` | n-de kristal geraakt | glastinkel op `hitStep(n)` |
| `perfectNote(i)` | i-de kristalpuls van de viering | belnoot uit het opbloeiende akkoord (D6/9-arpeggio over twee octaven: D F# A B E F# A, past in de pentatonische ladder) |
| `bloom()` | schokgolf van de viering | volle akkoordwolk: de akkoordtonen samen, zachte aanzet van ≈ 60 ms, lange glinsterende uitsterving van ≈ 2,5 s |
| `solutionMirror(k)` | replay: k-de spiegel verschijnt | zachte tik, oplopend per spiegel, op −6 dB |

In de replay van de beste oplossing klinken de kristaltinkels ook (`hit(n)`), maar 6 dB zachter (optie `soft`).

### Aan/uit-knop

Een icoonknop met een luidspreker in de kop, tussen Uitleg en Statistieken. Hij heeft `aria-pressed="true|false"`, `aria-label="Geluid"` en een icoon dat wisselt (luidspreker met golfjes / doorgestreept). De knop werkt altijd, ook tijdens animaties.

### Geluidsproef-pagina (alleen dev)

`?geluid` in de dev-server laadt via een dynamische import `src/audio/proef.ts`, dat een eenvoudig paneel toont met een knop per geluid. Het paneel heeft ook knoppen voor een reeks van 8 tinkels, een volledige viering (8 noten + bloom) en een volumeschuif. In `main.ts` staat de import achter `import.meta.env.DEV`, zodat het niet in de productiebuild komt. Op deze pagina stemt de gebruiker de klanken goed vóór de merge.

## 2. Viering bij het maximum

Nieuw bestand `src/render/celebrate.ts` met `celebrate(board, trace, opts): Promise<void>`. `FireFx.play` roept het aan na de straal-animatie, alleen als `perfect` waar is. De huidige `shardRain`-aanroep in `play` wordt vervangen. De promise van `play` resolvet na stap 5, en de regen loopt daarna nog door.

Tijdlijn (normale beweging):

1. **Flits, 0–250 ms.** De volledige straal wordt opnieuw getekend in een aparte additieve laag met bredere gloed. De alpha piekt en zakt terug, en de kern is even wit.
2. **Lichtpuls, 250–1100 ms.** Een komeet (heldere kop + vervagende staart van ≈ 1,2 vak) loopt met constante snelheid langs de hele baan. De duur is `clamp(len / 18 vak/s, 500, 900)` ms. De kop en staart worden getekend met de bestaande `drawBeam`/`pointsAt`-helpers op een venster `[d − staart, d]`.
3. **Kristalpulsen.** Wanneer de puls bij een geteld kristal is (via `hitDistances`), veert dat kristal op (schaal 1 → 1,35 → 1, spring) en verschijnt er een ring. Tegelijk klinkt `perfectNote(i)`.
4. **Schokgolf, aan het eind van de puls.** Vanuit het laatste getelde kristal dijt een heldere ring (dikte ≈ 0,24 vak die dunner wordt, additief) uit tot hij het hele veld voorbij is, in ≈ 700 ms. Het veld "ademt" mee: `root` schaalt rond het midden 1 → 1,02 → 1 in 500 ms. Tegelijk klinkt `bloom()`.
5. **Teller.** Via `opts.onPerfect()` krijgt de 💎-teller de klasse `is-perfect`: een veer-sprong (CSS-keyframe, 400 ms) en een blijvende gouden gloed (`text-shadow` in de accentkleur). De klasse blijft staan zolang de ronde ingediend is en de eigen straal getoond wordt. Bij het tonen van de beste oplossing gaat hij eraf.
6. **Scherfregen, strakker.** Een vernieuwde `shardRain`: ≈ 36 scherven die in een golf van links naar rechts starten (vertraging ∝ x, kleine jitter). Ze draaien en flonkeren kort (alpha-twinkle) en hebben de kleuren van de geraakte kristallen plus de accentkleur.

Het resultaatpaneel (`afterFire`) opent na stap 5. Bij een niet-maximale score blijft de vuur-animatie zoals hij is, met geluid erbij.

**Reduced motion.** Geen flits-puls, golf, ademing of regen. Rond het veld komt een gouden gloedrand die in 300 ms opkomt en in 300 ms wegzakt. De teller krijgt `is-perfect` (gloed, zonder sprong via `@media (prefers-reduced-motion)`). Het geluid speelt gewoon: de noten snel na elkaar (80 ms) en dan `bloom()`.

**Opruimen.** Alle Graphics van de viering worden na afloop opgeruimd. Wordt de ronde intussen vervangen, dan blijft de bestaande `if (this.g !== g) return` het vervolg tegenhouden, en de tweens ruimen hun eigen nodes op. Een resize tijdens de viering mag het spel niet bevriezen: dat dekt de bestaande try/catch in `Tweens`, en een e2e-test controleert het.

## 3. Inbouw

- `Round` krijgt een vierde constructor-argument `sfx: Sfx`. Dat is een interface met de methoden uit de tabel, en `Sound` implementeert die. De modi geven het door via `ModeContext.sfx`.
- `src/audio/cue.ts` (puur): `tapCue(before, after): 'place' | 'rotate' | 'remove'` bepaalt het geluid aan de hand van de plaatsingen voor en na een tik.
- `round.ts`:
  - tik geaccepteerd → `sfx[tapCue(...)]()`; geweigerd → `sfx.reject()`
  - Opnieuw → `sfx.reset()`
  - na de bevestiging → `sfx.charge()`
  - `onHit(n)` → `sfx.hit(n)`
  - viering → `perfectNote`/`bloom` via callbacks van `celebrate`
- `FireFx.play` en `playSolution` krijgen optionele callbacks (`onHit`, `onPerfectNote`, `onBloom`, `onPerfect`, `onMirror`). De render-laag kent zo geen audio.
- `app.ts` maakt één `Sound` aan, plaatst de knop in de kop en geeft `sfx` door aan de modi.

## 4. Testen

**Unit (Vitest):**
- `scale`: `noteFreq` volgt de ladder, `hitStep(n)` stijgt voor kleine n en blijft binnen grenzen voor n tot 50.
- `cue`: plaatsen, draaien en weghalen worden goed herkend.
- `sound`-voorkeur: lezen en schrijven met en zonder opslag, ook als opslag een fout gooit, met standaard aan.
- `celebrate`-timing (pure functie `celebrationTimeline(trace, width)`): kristalpulsen in volgorde langs de baan en binnen de pulsduur, en de schokgolf vanuit het laatste kristal.
- `Sound` zonder `AudioContext` (Node): alle methoden zijn stil en gooien niets.

**Offline-render-check (handmatig, dev):** Node heeft geen Web Audio en de e2e draait op de productiebuild, waar de geluidsproef niet in zit. Daarom heeft de geluidsproef-pagina een knop **Controleer**. Die rendert elk recept (via de echte motorketen, dus met galm en limiter) in een `OfflineAudioContext` en toont per geluid de piek en het eindniveau. Eis: piek ≤ 0,9 en het laatste 10 % van de render stil (< 0,01). Ik draai deze check in de dev-server met de browser-pane en rapporteer de uitkomst.

**E2E (Playwright):**
- De geluidsknop wisselt `aria-pressed` en blijft na herladen uit.
- Een volledige ronde met geluid aan geeft geen consolefouten.
- Een perfecte ronde: de test berekent in Node met `getDaily(amsterdamDate(new Date()))` de oplossing en zet die als `current`-plaatsingen in localStorage. Daarna vuren en controleren:
  - de teller krijgt `is-perfect`
  - het resultaatpaneel opent
  - de ronde reageert daarna nog (wisselknop Beste oplossing / Jouw straal)
- Hetzelfde met `reducedMotion: 'reduce'`.
- Resize tijdens de viering laat het spel niet bevriezen.
