# Lichtbreker

Een dagelijkse lichtpuzzel. Zet spiegels zodat de laser zoveel mogelijk kristallen raakt; druk op **Vuur!** en zie hoeveel er maximaal in zat. Statische site (Vite + TypeScript + PixiJS), geen server.

## Aan de slag

```
npm install
npm run dev      # ontwikkelserver
npm test         # unit-tests (Vitest)
npm run e2e      # browsertests (Playwright; eenmalig: npx playwright install chromium)
npm run build    # typecheck + productiebuild naar dist/
```

In de ontwikkelserver kun je een andere dag nabootsen met `?date=YYYY-MM-DD`.

## Vóór publicatie: EPOCH

`EPOCH` in `src/config.ts` (nu `'2026-11-07'`) is de datum van puzzel #1. Zet die op de lanceerdatum. De dag wisselt om middernacht in Europe/Amsterdam.

## Puzzels

- Elke dag wordt de puzzel in de browser gegenereerd uit het puzzelnummer (`src/core/generator.ts`). Een solver berekent het maximum; de generator houdt alleen puzzels die aan de kwaliteitseisen voldoen (zie spec).
- Instellingen staan in `GEN` in `src/config.ts`. **Let op:** na publicatie veranderen aanpassingen daar ook de puzzels van toekomstige dagen en mogelijk die van vandaag.
- Een dag vastzetten of met de hand maken: zet de puzzel in `src/data/overrides.json` onder de datum (`"2026-12-24": { ...Puzzle }`). Een ongeldige override wordt genegeerd (met een waarschuwing in de console). `fromAscii` in `src/core/ascii.ts` maakt het schrijven makkelijk.
- `src/data/fallback.json` wordt gebruikt als de generator geen goede puzzel vindt.
- Makkelijker: gebruik de **puzzelbouwer** (hieronder). Die schrijft `overrides.json` voor je.

## Puzzelbouwer (beheer)

Een verborgen bouwer op de site zelf, ook op je telefoon. Daarmee bouw je puzzels, test je ze, deel je ze als link en publiceer je ze als dagpuzzel.

**Openen:** ga naar `…/lichtbreker/?bouwer`, of tik in het spel 5 keer snel op het logo **Lichtbreker**. Je logt in met naam en wachtwoord.

### Eenmalig: GitHub-sleutel en account

1. Maak op GitHub een *fine-grained personal access token* (Settings → Developer settings → Fine-grained tokens):
   - Repository access: **alleen** `Hitmoso/lichtbreker`
   - Permissions: **Contents: Read and write**, **Actions: Read-only** (Metadata gaat vanzelf mee)
   - Geef hem een vervaldatum (bijvoorbeeld een jaar).
2. Maak een account: `npm run bouwer:account`. Je vult een naam, een wachtwoord en de sleutel in. Het script versleutelt de sleutel met het wachtwoord en zet alleen dat versleutelde blokje in `public/bouwers.json`.
3. Commit en push `public/bouwers.json`. Na het publiceren van de site kun je inloggen.

Voor vrienden maak je net zo een eigen account (dezelfde sleutel, hun eigen wachtwoord). Hun naam komt in de commit. Een account weghalen: `npm run bouwer:account -- --verwijder <naam>`, daarna committen en pushen.

**Veiligheid:** de repo is openbaar, dus het versleutelde blokje is voor iedereen leesbaar. Een kort wachtwoord is te raden, en wie het raadt kan publiceren. Alles is terug te draaien via git, en een sleutel trek je in op GitHub. Alle GitHub Pages-sites op `hitmoso.github.io` delen dezelfde browseropslag. Zet daar dus geen code van anderen op, en geef de sleutel niet meer rechten dan hierboven. Sleutel vervangen (verlopen of ingetrokken)? Maak dan alle accounts opnieuw aan met de nieuwe sleutel.

### Bouwen, testen, delen

- **Gereedschap:** muur, kristal, spiegel, prisma, filter, bron en gum. Kies bij kristal, filter, spiegel en bron de kleur of richting in het rijtje erboven. Tik met hetzelfde gereedschap op een geplaatst stuk om te wisselen (bijvoorbeeld een kristal van wit naar rood, groen of blauw). Met muur en gum kun je slepen.
- De straal, het **maximum** en de **tips** (alleen advies) werken live bij. **Toon oplossing** laat de beste spiegels zien.
- **⋯** bevat de rastermaat, het aantal spelersspiegels, een leeg veld, een gegenereerde puzzel, **Datum openen…** (laadt de eigen puzzel van die dag uit de repo, of anders de gegenereerde), **Verwijder eigen puzzel** en Uitloggen.
- **▶ Test** speelt het level zoals een speler. **🔗 Deel** maakt een link `…/?level=…`. Wie die opent, speelt het als "Eigen level"; dat telt niet mee voor de dagreeks.
- Je ontwerp blijft in je browser bewaard tot je iets anders laadt.

### Publiceren

**Publiceer** → kies een datum (ook vandaag mag) → **Publiceer**. De bouwer zet de puzzel in `src/data/overrides.json` met een commit `puzzel: <datum> (door <naam>)` op `main`. GitHub test en bouwt dan de site. De chip in de kop toont **⏳ Wordt gebouwd…** en daarna **✓ Live**. Na 2 à 3 minuten staat de puzzel live, en door caching zien alle spelers hem binnen ongeveer 10 minuten.

- Pas je **vandaag** aan, dan beginnen spelers die vandaag al bezig waren stil opnieuw. Hun eerdere score blijft staan.
- Foute publicatie? Open de datum en kies **⋯ → Verwijder eigen puzzel**. Die dag krijgt dan weer de gegenereerde puzzel.
- Mislukt de bouw (bijvoorbeeld een falende test), dan blijft de oude site gewoon staan. Een test controleert dat elke puzzel in `overrides.json` geldig is.
- Werk je ook lokaal? Doe na het publiceren `git pull`, want de bouwer commit rechtstreeks op GitHub.

## Oneindige modus en moeilijkheid aanpassen

Met de schakelaar **Dagelijks | Oneindig** speel je naast de dagpuzzel zoveel puzzels als je wilt, op Makkelijk, Normaal of Moeilijk. Oneindige puzzels tellen niet mee voor de dagreeks.

- De niveaus staan in `DIFFICULTIES` in `src/config.ts`: rastermaat, aantal spiegels, muren, kristallen, extra elementen en het toegestane maximum. Pas de getallen aan; er is geen andere code nodig.
- `DAILY` (de dagpuzzel) staat daar los van. **Pas `DAILY` na lancering nooit aan**: dan verschuiven de dagpuzzels. De test "daily puzzles do not shift" bewaakt dat.
- Na een aanpassing: `npm test`. `tests/core/difficulties.test.ts` genereert per niveau 100 puzzels en meldt het als een combinatie geen goede of te trage puzzels oplevert (bijvoorbeeld te veel kristallen voor een klein raster).
- Elk niveau heeft een reservepuzzel in `src/data/fallback-<niveau>.json` (Normaal gebruikt `fallback.json`). Verander je de rastermaat van een niveau, maak dan ook een nieuwe reservepuzzel van die maat.

## Geluid

De geluiden worden in de browser opgewekt (Web Audio, geen bestanden): `src/audio/`. De knop met de luidspreker in de kop zet ze aan of uit; de keuze staat in `localStorage` onder `lichtbreker:sound`.

- Klankrecepten staan in `src/audio/voices.ts`, de algemene klankkleur (volume, galm, helderheid, uitsterving) in `TONE` daarin.
- Bijstemmen: open de ontwikkelserver met `?geluid` (alleen in dev). Daar speel je elk geluid af, schuif je aan de klank (en kopieer je de waarden naar `TONE`), en controleert **Controleer** dat niets oversteurt.

## Publiceren

`.github/workflows/pages.yml` test, bouwt en publiceert `dist/` naar GitHub Pages bij elke push naar `main`. Zet in de repo-instellingen Pages op "GitHub Actions".

## Ontwerp

- Spec: `docs/superpowers/specs/2026-11-07-lichtbreker-design.md` (puzzelbouwer: `2026-11-08-puzzelbouwer-design.md`)
- Plan: `docs/superpowers/plans/2026-11-07-lichtbreker.md`
