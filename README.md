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

## Publiceren

`.github/workflows/pages.yml` test, bouwt en publiceert `dist/` naar GitHub Pages bij elke push naar `main`. Zet in de repo-instellingen Pages op "GitHub Actions".

## Ontwerp

- Spec: `docs/superpowers/specs/2026-11-07-lichtbreker-design.md`
- Plan: `docs/superpowers/plans/2026-11-07-lichtbreker.md`
