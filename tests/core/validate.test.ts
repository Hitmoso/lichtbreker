import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import { validatePlacements, validatePuzzle } from '../../src/core/validate';
import type { Puzzle } from '../../src/core/types';

const ok = () => fromAscii(['>.o', '...', '...'], 2);

describe('fromAscii', () => {
  it('builds cells row by row', () => {
    const p = fromAscii(['>#o', 'rRg', '/\\P', 'Bbv'], 3);
    expect(p).toMatchObject({ version: 1, width: 3, height: 4, mirrors: 3 });
    expect(p.cells[0]).toEqual({ kind: 'source', dir: 0 });
    expect(p.cells[1]).toEqual({ kind: 'wall' });
    expect(p.cells[2]).toEqual({ kind: 'crystal', color: 'white' });
    expect(p.cells[3]).toEqual({ kind: 'crystal', color: 'red' });
    expect(p.cells[4]).toEqual({ kind: 'filter', color: 'red' });
    expect(p.cells[6]).toEqual({ kind: 'fixedMirror', mirror: '/' });
    expect(p.cells[7]).toEqual({ kind: 'fixedMirror', mirror: '\\' });
    expect(p.cells[8]).toEqual({ kind: 'prism' });
    expect(p.cells[11]).toEqual({ kind: 'source', dir: 1 });
  });
  it('throws on unknown chars or ragged rows', () => {
    expect(() => fromAscii(['>.x'], 1)).toThrow();
    expect(() => fromAscii(['>..', '..'], 1)).toThrow();
  });
});

describe('validatePuzzle', () => {
  it('accepts a valid puzzle', () => {
    expect(validatePuzzle(ok())).toEqual([]);
  });
  const bad: [string, unknown][] = [
    ['null', null],
    ['string', 'tekst'],
    ['no source', fromAscii(['..o', '...', '...'], 2)],
    ['two sources', fromAscii(['>.o', '>..', '...'], 2)],
    ['source not on edge', fromAscii(['..o', '.>.', '...'], 2)],
    ['source pointing out', fromAscii(['<.o', '...', '...'], 2)],
    ['wrong cell count', { ...ok(), cells: ok().cells.slice(1) }],
    ['width too small', fromAscii(['>o', '..', '..'], 1)],
    ['width too big', fromAscii(['>' + '.'.repeat(12), '.'.repeat(13), '.'.repeat(13)], 1)],
    ['height too big', fromAscii(['>..', ...Array(14).fill('...')], 1)],
    ['mirrors 0', { ...ok(), mirrors: 0 }],
    ['mirrors 9', { ...ok(), mirrors: 9 }],
    ['unknown kind', { ...ok(), cells: ok().cells.map((c, i) => (i === 1 ? { kind: 'lava' } : c)) }],
    ['unknown colour', { ...ok(), cells: ok().cells.map((c, i) => (i === 2 ? { kind: 'crystal', color: 'pink' } : c)) }],
    ['version 2', { ...ok(), version: 2 }],
  ];
  for (const [name, p] of bad) {
    it(`rejects: ${name}`, () => {
      expect(validatePuzzle(p).length).toBeGreaterThan(0);
    });
  }
});

describe('validatePlacements', () => {
  const p: Puzzle = ok();
  it('accepts valid placements', () => {
    expect(validatePlacements(p, [{ x: 1, y: 1, mirror: '/' }])).toEqual([{ x: 1, y: 1, mirror: '/' }]);
    expect(validatePlacements(p, [])).toEqual([]);
  });
  const bad: [string, unknown][] = [
    ['not empty cell', [{ x: 2, y: 0, mirror: '/' }]],
    ['outside grid', [{ x: 3, y: 0, mirror: '/' }]],
    ['negative', [{ x: -1, y: 0, mirror: '/' }]],
    ['duplicate cell', [{ x: 1, y: 1, mirror: '/' }, { x: 1, y: 1, mirror: '\\' }]],
    ['too many', [{ x: 1, y: 1, mirror: '/' }, { x: 1, y: 2, mirror: '/' }, { x: 2, y: 2, mirror: '/' }]],
    ['bad mirror', [{ x: 1, y: 1, mirror: '|' }]],
    ['not array', 'x'],
    ['fractional', [{ x: 1.5, y: 1, mirror: '/' }]],
  ];
  for (const [name, pl] of bad) {
    it(`rejects: ${name}`, () => {
      expect(validatePlacements(p, pl)).toBeNull();
    });
  }
});
