/**
 * Meet de generator over N puzzels per soort (alleen lezen; verandert niets).
 * Gebruik: npx vite-node scripts/meet-generator.ts -- 100
 */
import { DAILY, DIFFICULTIES, type GenSettings } from '../src/config';
import { trace } from '../src/core/beam';
import { generate } from '../src/core/generator';
import { generateV2 } from '../src/core/generator2';
import { greedy } from '../src/core/greedy';
import { hashSeed } from '../src/core/rng';
import { solve } from '../src/core/solver';
import type { Cell, Placement, Puzzle } from '../src/core/types';

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 100);
const wallAt = (p: Puzzle, kind: Cell['kind']): Puzzle => ({ ...p, cells: p.cells.map((c) => (c.kind === kind ? ({ kind: 'wall' } as Cell) : c)) });
const count = (p: Puzzle, f: (c: Cell) => boolean) => p.cells.filter(f).length;
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '-');
const f1 = (n: number) => n.toFixed(1);
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;

/** Aantal verschillende beste oplossingen (als set geraakte kristallen), afgekapt. */
function hitSets(p: Puzzle, max: number): number {
  // Goedkope benadering: probeer elke spiegel van de oplossing weg te laten/om te draaien is te duur; we tellen alleen
  // of de beste oplossing uniek is qua spiegelvakken door elk oplossingsvak te blokkeren en opnieuw op te lossen.
  const { solution } = solve(p);
  let alternatives = 0;
  for (const m of solution) {
    const i = m.y * p.width + m.x;
    const blocked: Puzzle = { ...p, cells: p.cells.map((c, j) => (j === i ? ({ kind: 'crystal', color: 'white' } as Cell) : c)) };
    // een (nep)kristal laat de straal door maar staat geen spiegel toe; het telt wel mee, dus trek 1 af als het geraakt wordt
    const s = solve(blocked);
    const hit = trace(blocked, s.solution).hit.has(i) ? 1 : 0;
    if (s.max - hit >= max) alternatives++;
  }
  return alternatives;
}

function measure(name: string, gen: (seed: number) => { puzzle: Puzzle; max: number; solution: Placement[]; source: string; filter?: string }, seeds: number[], S: GenSettings) {
  const rows = seeds.map((seed) => {
    const t0 = performance.now();
    const g = gen(seed);
    const ms = performance.now() - t0;
    const p = g.puzzle;
    const hit = trace(p, g.solution).hit;
    const gr = greedy(p).score;
    const crystals = count(p, (c) => c.kind === 'crystal');
    const hasFilter = p.cells.some((c) => c.kind === 'filter');
    const hasPrism = p.cells.some((c) => c.kind === 'prism');
    const hasFixed = p.cells.some((c) => c.kind === 'fixedMirror');
    return {
      ms, fallback: g.source === 'fallback', max: g.max, mirrors: p.mirrors, crystals, lures: crystals - hit.size,
      greedy: gr, gap: g.max - gr, zero: trace(p, []).score,
      hasFilter, filterMatters: hasFilter && solve(wallAt(p, 'filter')).max < g.max,
      hasPrism, prismMatters: hasPrism && solve(wallAt(p, 'prism')).max < g.max,
      hasFixed, fixedMatters: hasFixed && solve(wallAt(p, 'fixedMirror')).max < g.max,
      walls: count(p, (c) => c.kind === 'wall'), coloured: count(p, (c) => c.kind === 'crystal' && c.color !== 'white'),
      plain: !hasFilter && !hasPrism && !hasFixed,
      alt: hitSets(p, g.max), plan: g.filter ?? '-',
    };
  });
  const n = rows.length;
  const times = rows.map((r) => r.ms);
  const gapHist = [1, 2, 3].map((k) => `${k === 3 ? '3+' : k}: ${pct(rows.filter((r) => (k === 3 ? r.gap >= 3 : r.gap === k)).length, n)}`).join(', ');
  const nF = rows.filter((r) => r.hasFilter).length, nP = rows.filter((r) => r.hasPrism).length, nM = rows.filter((r) => r.hasFixed).length;
  console.log(`\n=== ${name} (${n} puzzels, ${S.width}x${S.height}) ===`);
  console.log(`tijd: gem ${f1(avg(times))} ms, mediaan ${f1(med(times))} ms, max ${f1(Math.max(...times))} ms`);
  console.log(`reservepuzzel: ${rows.filter((r) => r.fallback).length}`);
  console.log(`maximum: gem ${f1(avg(rows.map((r) => r.max)))} | spiegels: gem ${f1(avg(rows.map((r) => r.mirrors)))} | muren: gem ${f1(avg(rows.map((r) => r.walls)))}`);
  console.log(`kristallen: gem ${f1(avg(rows.map((r) => r.crystals)))} | lokkertjes (niet in beste oplossing): gem ${f1(avg(rows.map((r) => r.lures)))} (min ${Math.min(...rows.map((r) => r.lures))}, max ${Math.max(...rows.map((r) => r.lures))})`);
  console.log(`zonder spiegels al geraakt: gem ${f1(avg(rows.map((r) => r.zero)))}`);
  console.log(`gulzig haalt max: ${pct(rows.filter((r) => r.gap <= 0).length, n)} | gulzig gem ${f1(avg(rows.map((r) => r.greedy)))} | achterstand ${gapHist}`);
  console.log(`filter aanwezig: ${pct(nF, n)}; daarvan nodig: ${pct(rows.filter((r) => r.filterMatters).length, nF)} | plannen: ${['none', 'needed', 'decoy'].map((k) => `${k} ${rows.filter((r) => r.plan === k).length}`).join(', ')}`);
  console.log(`prisma aanwezig: ${pct(nP, n)}; daarvan nodig: ${pct(rows.filter((r) => r.prismMatters).length, nP)}`);
  console.log(`vaste spiegel aanwezig: ${pct(nM, n)}; daarvan nodig: ${pct(rows.filter((r) => r.fixedMatters).length, nM)}`);
  console.log(`kaal (alleen muren+kristallen): ${pct(rows.filter((r) => r.plain).length, n)} | gekleurde kristallen gem ${f1(avg(rows.map((r) => r.coloured)))}`);
  console.log(`oplossingsspiegels die vervangbaar zijn (max ook haalbaar zonder dat vak): gem ${f1(avg(rows.map((r) => r.alt)))} van ${f1(avg(rows.map((r) => r.mirrors)))}`);
}

const dailySeeds = Array.from({ length: N }, (_, i) => hashSeed('lichtbreker', i + 4));
const anySeeds = Array.from({ length: N }, (_, i) => hashSeed('meting', i));
measure('Dagpuzzel v1 (oud)', (s) => generate(s), dailySeeds, DAILY);
measure('Dagpuzzel v2 (vanaf 10 nov)', (s) => generateV2(s), dailySeeds, DAILY);
measure('Oneindig Makkelijk (v2)', (s) => generateV2(s, DIFFICULTIES.easy), anySeeds, DIFFICULTIES.easy);
measure('Oneindig Moeilijk (v2)', (s) => generateV2(s, DIFFICULTIES.hard), anySeeds, DIFFICULTIES.hard);
