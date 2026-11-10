import { describe, expect, it } from 'vitest';
import { DAILY, DIFFICULTIES, GEN_V3, type Difficulty } from '../../src/config';
import { trace } from '../../src/core/beam';
import { meetsQuality } from '../../src/core/generator';
import { withoutFilters } from '../../src/core/generator2';
import { generateV3, THEMES } from '../../src/core/generator3';
import { greedy } from '../../src/core/greedy';
import { hashSeed } from '../../src/core/rng';
import { solve } from '../../src/core/solver';
import type { Cell, Puzzle } from '../../src/core/types';

const SEEDS = Array.from({ length: 60 }, (_, i) => hashSeed('lichtbreker', i + 18));
const swap = (p: Puzzle, i: number, c: Cell): Puzzle => ({ ...p, cells: p.cells.map((x, j) => (j === i ? c : x)) });
const indices = (p: Puzzle, kind: Cell['kind']) => p.cells.flatMap((c, i) => (c.kind === kind ? [i] : []));

describe('generateV3 (dagpuzzel)', () => {
  const results = SEEDS.map((s) => generateV3(s));
  const own = results.filter((r) => r.theme !== null);

  it('is deterministic per seed', () => {
    expect(JSON.stringify(generateV3(SEEDS[0]))).toBe(JSON.stringify(results[0]));
  });

  it('nearly always builds its own puzzle, and every puzzle is good', () => {
    expect(own.length).toBeGreaterThanOrEqual(54);
    for (const r of results) {
      expect(r.puzzle.width).toBe(DAILY.width);
      expect(r.puzzle.height).toBe(DAILY.height);
      expect(meetsQuality(r.puzzle).ok).toBe(true);
      expect(r.max).toBe(solve(r.puzzle).max);
      expect(trace(r.puzzle, r.solution).score).toBe(r.max);
    }
  });

  it('every prism and fixed mirror takes part in the best solution', () => {
    for (const r of own) {
      for (const kind of ['prism', 'fixedMirror'] as const) {
        for (const i of indices(r.puzzle, kind)) {
          expect(trace(swap(r.puzzle, i, { kind: 'wall' }), r.solution).score, `${kind} doet niet mee`).toBeLessThan(r.max);
        }
      }
    }
  });

  it('the element of the theme is needed for the maximum', () => {
    for (const r of own) {
      const kind = r.theme === 'prisma' ? 'prism' : r.theme === 'kaats' ? 'fixedMirror' : null;
      if (!kind) continue;
      for (const i of indices(r.puzzle, kind)) expect(solve(swap(r.puzzle, i, { kind: 'wall' })).max).toBeLessThan(r.max);
    }
  });

  it('every filter is needed for the maximum', () => {
    for (const r of own) {
      if (!r.puzzle.cells.some((c) => c.kind === 'filter')) continue;
      expect(solve(withoutFilters(r.puzzle)).max).toBeLessThan(r.max);
    }
  });

  it('walls are terrain around the route: none lies far from every good route', () => {
    let walls = 0, near = 0;
    for (const r of own) {
      const w = r.puzzle.width;
      // Vakken waar de beste straal komt (segmenten lopen van vakmidden naar vakmidden of vakrand).
      const beam = new Set<number>();
      for (const s of trace(r.puzzle, r.solution).segments) {
        const dx = Math.sign(s.to.x - s.from.x), dy = Math.sign(s.to.y - s.from.y);
        const len = Math.floor(Math.abs(s.to.x - s.from.x) + Math.abs(s.to.y - s.from.y));
        for (let k = 0; k <= len; k++) beam.add(Math.floor(s.from.y + dy * k) * w + Math.floor(s.from.x + dx * k));
      }
      for (const i of indices(r.puzzle, 'wall')) {
        walls++;
        const x = i % w, y = Math.floor(i / w);
        const touches = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([ax, ay]) => beam.has((y + ay) * w + x + ax));
        if (touches || solve(swap(r.puzzle, i, { kind: 'empty' })).max !== r.max) near++;
      }
    }
    expect(walls / own.length).toBeGreaterThanOrEqual(2);
    expect(near / walls).toBeGreaterThanOrEqual(0.8);
  });

  it('crystals are spread: rarely more than 3 in one row or column', () => {
    let crowded = 0;
    for (const r of own) {
      const w = r.puzzle.width;
      const rows = new Map<number, number>(), cols = new Map<number, number>();
      r.puzzle.cells.forEach((c, i) => {
        if (c.kind !== 'crystal') return;
        rows.set(Math.floor(i / w), (rows.get(Math.floor(i / w)) ?? 0) + 1);
        cols.set(i % w, (cols.get(i % w) ?? 0) + 1);
      });
      if (Math.max(...rows.values(), ...cols.values()) > 3) crowded++;
    }
    expect(crowded / own.length).toBeLessThanOrEqual(0.25);
  });

  it('is tidy: at most 5 crystals outside the best solution', () => {
    for (const r of own) {
      const { hit } = trace(r.puzzle, r.solution);
      const unhit = r.puzzle.cells.filter((c, i) => c.kind === 'crystal' && !hit.has(i)).length;
      expect(unhit).toBeLessThanOrEqual(GEN_V3.lures[1]);
    }
  });

  it('is not solved by greedy play', () => {
    for (const r of own) expect(r.max - greedy(r.puzzle).score).toBeGreaterThanOrEqual(GEN_V3.minGap);
  });

  it('uses every theme, and each theme shows its element', () => {
    const seen = new Set(own.map((r) => r.theme));
    for (const t of THEMES) expect(seen.has(t), `thema ${t} komt niet voor`).toBe(true);
    for (const r of own) {
      const has = (k: Cell['kind']) => r.puzzle.cells.some((c) => c.kind === k);
      if (r.theme === 'prisma') expect(has('prism')).toBe(true);
      if (r.theme === 'kleur') expect(has('filter')).toBe(true);
      if (r.theme === 'kaats') expect(has('fixedMirror')).toBe(true);
    }
  });

  it('daily v3 puzzles do not shift', () => {
    const prints = SEEDS.slice(0, 5).map((s) => hashSeed(JSON.stringify(generateV3(s).puzzle)));
    expect(prints).toMatchInlineSnapshot(`
      [
        2730363418,
        2624024532,
        1841991199,
        4285913084,
        4163670049,
      ]
    `);
  });
});

describe('generateV3 (oneindig, per niveau)', () => {
  const LEVELS: Difficulty[] = ['easy', 'normal', 'hard'];
  for (const d of LEVELS) {
    it(`${d}: good puzzles of the right size`, () => {
      const s = DIFFICULTIES[d];
      for (let seed = 1; seed <= 20; seed++) {
        const r = generateV3(seed, s);
        expect(r.puzzle.width).toBe(s.width);
        expect(r.puzzle.height).toBe(s.height);
        expect(meetsQuality(r.puzzle, s).ok, `${d} seed ${seed}`).toBe(true);
        if (d === 'easy') expect(r.puzzle.cells.some((c) => c.kind === 'prism' || c.kind === 'filter' || c.kind === 'fixedMirror')).toBe(false);
      }
    }, 300_000);
  }
});
