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

- Spec: `docs/superpowers/specs/2026-11-07-lichtbreker-design.md`
- Plan: `docs/superpowers/plans/2026-11-07-lichtbreker.md`
