import { describe, expect, it } from 'vitest';
import { DAILY } from '../../src/config';
import { fromAscii } from '../../src/core/ascii';
import { puzzleId } from '../../src/core/fingerprint';
import { FALLBACK, FALLBACKS, generate } from '../../src/core/generator';
import { decodeLevel, encodeLevel } from '../../src/core/levelcode';
import type { Puzzle } from '../../src/core/types';

describe('levelcode', () => {
  it('round-trips the fallback puzzles', () => {
    for (const p of [FALLBACK, FALLBACKS.easy, FALLBACKS.hard]) expect(decodeLevel(encodeLevel(p))).toEqual(p);
  });

  it('round-trips 50 generated puzzles', () => {
    for (let s = 1; s <= 50; s++) {
      const p = generate(s, DAILY).puzzle;
      expect(decodeLevel(encodeLevel(p))).toEqual(p);
    }
  });

  it('is URL-safe', () => {
    const code = encodeLevel(FALLBACK);
    expect(code).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(code.startsWith('1.7.9.')).toBe(true);
  });

  it('compresses empty runs', () => {
    const rows = Array.from({ length: 14 }, (_, y) => (y === 7 ? '>' : '.') + '.'.repeat(11));
    const p = fromAscii(rows, 3);
    expect(encodeLevel(p).length).toBeLessThan(40);
    expect(decodeLevel(encodeLevel(p))).toEqual(p);
  });

  it('rejects broken codes', () => {
    const good = encodeLevel(FALLBACK);
    for (const bad of ['', '2.7.9.3.AAAA', '1.7.9.3.!!!', good.slice(0, -4), 'kapot', '1.7.9.3']) {
      expect(decodeLevel(bad)).toBeNull();
    }
    expect(decodeLevel(encodeLevel(fromAscii(['....', '>..<', '....'], 1)))).toBeNull();
  });
});

describe('puzzleId', () => {
  it('is stable and sensitive', () => {
    const id = puzzleId(FALLBACK);
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    expect(puzzleId(structuredClone(FALLBACK))).toBe(id);
    const changed: Puzzle = { ...FALLBACK, cells: FALLBACK.cells.map((c, i) => (i === 0 ? { kind: 'wall' } : c)) };
    if (FALLBACK.cells[0].kind === 'wall') changed.cells[0] = { kind: 'empty' };
    expect(puzzleId(changed)).not.toBe(id);
  });
});
