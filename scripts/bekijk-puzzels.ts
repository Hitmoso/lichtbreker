/**
 * Laat v2-puzzels zien met hun beste oplossing en meet kenmerken die iets zeggen over "leuk".
 * Alleen lezen; verandert niets. Gebruik: npx vite-node scripts/bekijk-puzzels.ts -- 100 6
 * (100 puzzels meten, de eerste 6 tekenen)
 */
import { DIFFICULTIES, type GenSettings, DAILY } from '../src/config';
import { toAscii } from '../src/core/ascii';
import { trace, walk } from '../src/core/beam';
import { generateV2 } from '../src/core/generator2';
import { greedy } from '../src/core/greedy';
import { hashSeed } from '../src/core/rng';
import { solve } from '../src/core/solver';
import type { Cell, MirrorKind, Placement, Puzzle } from '../src/core/types';

const nums = process.argv.filter((a) => /^\d+$/.test(a)).map(Number);
const N = nums[0] ?? 100, SHOW = nums[1] ?? 6;
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f1 = (n: number) => n.toFixed(1);
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '-');
const swap = (p: Puzzle, i: number, c: Cell): Puzzle => ({ ...p, cells: p.cells.map((x, j) => (j === i ? c : x)) });
const key = (s: Set<number>) => [...s].sort((a, b) => a - b).join(',');

/** Alle spiegelopstellingen die het maximum halen (afgekapt), als verschillende sets geraakte kristallen en verschillende opstellingen. */
function optima(p: Puzzle, max: number, cap = 200_000): { hitSets: number; setups: number; capped: boolean } {
  const mirrors = new Map<number, MirrorKind>();
  const none = new Set<number>();
  const sets = new Set<string>(), setups = new Set<string>();
  let steps = 0;
  const rec = (left: number) => {
    if (++steps > cap) return;
    const { hit, stoppedAt } = walk(p, { mirrors, onEmpty: (c) => left > 0 && !none.has(c) });
    if (stoppedAt < 0) {
      if (hit.size >= max) { sets.add(key(hit)); setups.add([...mirrors].map(([i, m]) => `${i}${m}`).sort().join(' ')); }
      return;
    }
    for (const kind of ['/', '\\'] as const) { mirrors.set(stoppedAt, kind); rec(left - 1); mirrors.delete(stoppedAt); }
    none.add(stoppedAt); rec(left); none.delete(stoppedAt);
  };
  rec(p.mirrors);
  return { hitSets: sets.size, setups: setups.size, capped: steps > cap };
}

/** Tekent de puzzel met de oplossing: spiegels als ╱ ╲, de straal als · op lege vakken, geraakte kristallen als hoofdletter-achtige markering. */
function draw(p: Puzzle, sol: readonly Placement[]): string[] {
  const rows = toAscii(p).map((r) => [...r]);
  const t = trace(p, sol);
  for (const s of t.segments) {
    const steps = Math.round(Math.abs(s.to.x - s.from.x) + Math.abs(s.to.y - s.from.y));
    for (let k = 0; k <= steps; k++) {
      const x = Math.floor(s.from.x + ((s.to.x - s.from.x) * k) / Math.max(steps, 1)), y = Math.floor(s.from.y + ((s.to.y - s.from.y) * k) / Math.max(steps, 1));
      if (rows[y]?.[x] === '.') rows[y][x] = '·';
    }
  }
  for (const i of t.hit) { const x = i % p.width, y = Math.floor(i / p.width); rows[y][x] = rows[y][x] === 'o' ? '◆' : rows[y][x].toUpperCase() === rows[y][x] ? rows[y][x] : '●'; }
  for (const m of sol) rows[m.y][m.x] = m.mirror === '/' ? '╱' : '╲';
  return rows.map((r) => r.join(' '));
}

function study(name: string, S: GenSettings, seeds: number[]) {
  const rows = seeds.map((seed, n) => {
    const g = generateV2(seed, S);
    const p = g.puzzle;
    const t = trace(p, g.solution);
    const base = key(t.hit);
    const idx = (k: Cell['kind']) => p.cells.flatMap((c, i) => (c.kind === k ? [i] : []));
    // Doet een element mee in de beste oplossing? (Vervang het en kijk of de oplossing iets anders raakt.)
    const used = (k: Cell['kind'], by: Cell) => idx(k).filter((i) => key(trace(swap(p, i, by), g.solution).hit) !== base).length;
    const walls = idx('wall');
    const wallsMatter = walls.filter((i) => solve(swap(p, i, { kind: 'empty' })).max !== g.max).length;
    // Langste "schot": meeste kristallen op één recht stuk straal.
    let sweep = 0;
    for (const s of t.segments) {
      let c = 0;
      for (const i of t.hit) {
        const x = (i % p.width) + 0.5, y = Math.floor(i / p.width) + 0.5;
        const onH = s.from.y === s.to.y && y === s.from.y && x >= Math.min(s.from.x, s.to.x) && x <= Math.max(s.from.x, s.to.x);
        const onV = s.from.x === s.to.x && x === s.from.x && y >= Math.min(s.from.y, s.to.y) && y <= Math.max(s.from.y, s.to.y);
        if (onH || onV) c++;
      }
      sweep = Math.max(sweep, c);
    }
    const o = optima(p, g.max);
    const gr = greedy(p);
    // Eerste gulzige zet: zit die ook in de beste oplossing? (Zo niet, dan begint de puzzel met een valkuil.)
    const first = gr.placements[0];
    const firstInSol = !!first && g.solution.some((m) => m.x === first.x && m.y === first.y && m.mirror === first.mirror);
    if (n < SHOW) {
      console.log(`\n#${n + 1}  max ${g.max} met ${p.mirrors} spiegels | gulzig ${gr.score} | ${o.setups} beste opstellingen, ${o.hitSets} verschillende uitkomsten | filterplan ${g.filter}`);
      console.log(draw(p, g.solution).join('\n'));
    }
    return {
      perMirror: g.max / p.mirrors, sweep, hitSets: o.hitSets, setups: o.setups, capped: o.capped, firstInSol,
      nPrism: idx('prism').length, prismUsed: used('prism', { kind: 'wall' }),
      nFixed: idx('fixedMirror').length, fixedUsed: used('fixedMirror', { kind: 'wall' }),
      nWalls: walls.length, wallsMatter, wallsTouched: used('wall', { kind: 'empty' }),
      empty: idx('empty').length / p.cells.length,
    };
  });
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  console.log(`\n=== ${name}: ${rows.length} puzzels ===`);
  console.log(`kristallen per spiegel: gem ${f1(avg(rows.map((r) => r.perMirror)))} | langste schot (kristallen op één recht stuk): gem ${f1(avg(rows.map((r) => r.sweep)))}; puzzels met een schot van 3+: ${pct(rows.filter((r) => r.sweep >= 3).length, rows.length)}`);
  console.log(`beste opstellingen: precies 1: ${pct(rows.filter((r) => r.setups === 1).length, rows.length)}, 2-4: ${pct(rows.filter((r) => r.setups >= 2 && r.setups <= 4).length, rows.length)}, 5+: ${pct(rows.filter((r) => r.setups >= 5).length, rows.length)} (afgekapt: ${rows.filter((r) => r.capped).length})`);
  console.log(`verschillende beste uitkomsten (welke kristallen): precies 1: ${pct(rows.filter((r) => r.hitSets === 1).length, rows.length)}`);
  console.log(`eerste gulzige zet zit in de beste oplossing: ${pct(rows.filter((r) => r.firstInSol).length, rows.length)}`);
  console.log(`prisma's die meedoen in de oplossing: ${pct(sum((r) => r.prismUsed), sum((r) => r.nPrism))} | vaste spiegels: ${pct(sum((r) => r.fixedUsed), sum((r) => r.nFixed))}`);
  console.log(`muren die de oplossingsstraal raken: ${pct(sum((r) => r.wallsTouched), sum((r) => r.nWalls))} | muren die het maximum bepalen: ${pct(sum((r) => r.wallsMatter), sum((r) => r.nWalls))}`);
  console.log(`leeg deel van het veld: gem ${pct(avg(rows.map((r) => r.empty)) * 100, 100)}`);
}

study('Dagpuzzel v2', DAILY, Array.from({ length: N }, (_, i) => hashSeed('lichtbreker', i + 4)));
study('Oneindig Moeilijk', DIFFICULTIES.hard, Array.from({ length: Math.min(N, 40) }, (_, i) => hashSeed('meting', i)));
