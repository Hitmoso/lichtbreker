import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import type { Cell, Puzzle } from '../../src/core/types';
import { validatePuzzle } from '../../src/core/validate';
import { humanError } from '../../src/editor/messages';
import { applyTool, DEFAULT_VARIANTS, emptyPuzzle, inwardDirs, resizePuzzle, TOOLS } from '../../src/editor/tools';

const at = (p: Puzzle, x: number, y: number): Cell => p.cells[y * p.width + x];
const base = () => fromAscii(['.....', '>....', '.....', '.....'], 2);

describe('applyTool', () => {
  it('lists the tools in key order', () => {
    expect(TOOLS).toEqual(['wall', 'crystal', 'mirror', 'prism', 'filter', 'source', 'eraser']);
  });

  it('places with the current variant without mutating', () => {
    const p = base();
    const r = applyTool(p, 2, 2, 'crystal', { ...DEFAULT_VARIANTS, crystal: 'red' });
    expect(at(r.puzzle, 2, 2)).toEqual({ kind: 'crystal', color: 'red' });
    expect(at(p, 2, 2)).toEqual({ kind: 'empty' });
    expect(r).toMatchObject({ changed: true, rejected: false });
  });

  it('cycles crystal colours and the variant follows', () => {
    let p = applyTool(base(), 2, 2, 'crystal', DEFAULT_VARIANTS).puzzle;
    const seen: string[] = [];
    let v = DEFAULT_VARIANTS;
    for (let i = 0; i < 4; i++) {
      const r = applyTool(p, 2, 2, 'crystal', v);
      p = r.puzzle; v = r.variants;
      seen.push((at(p, 2, 2) as { color: string }).color);
      expect(v.crystal).toBe(seen[i]);
    }
    expect(seen).toEqual(['red', 'green', 'blue', 'white']);
  });

  it('cycles filters and flips mirrors', () => {
    let r = applyTool(base(), 2, 2, 'filter', DEFAULT_VARIANTS);
    r = applyTool(r.puzzle, 2, 2, 'filter', r.variants);
    expect(at(r.puzzle, 2, 2)).toEqual({ kind: 'filter', color: 'green' });
    let m = applyTool(base(), 3, 3, 'mirror', DEFAULT_VARIANTS);
    expect(at(m.puzzle, 3, 3)).toEqual({ kind: 'fixedMirror', mirror: '/' });
    m = applyTool(m.puzzle, 3, 3, 'mirror', m.variants);
    expect(at(m.puzzle, 3, 3)).toEqual({ kind: 'fixedMirror', mirror: '\\' });
    expect(m.variants.mirror).toBe('\\');
  });

  it('replaces another kind', () => {
    const p = applyTool(base(), 2, 2, 'wall', DEFAULT_VARIANTS).puzzle;
    expect(at(applyTool(p, 2, 2, 'prism', DEFAULT_VARIANTS).puzzle, 2, 2)).toEqual({ kind: 'prism' });
  });

  it('reports no change for wall on wall, prism on prism and eraser on empty', () => {
    const p = applyTool(applyTool(base(), 2, 2, 'wall', DEFAULT_VARIANTS).puzzle, 3, 2, 'prism', DEFAULT_VARIANTS).puzzle;
    expect(applyTool(p, 2, 2, 'wall', DEFAULT_VARIANTS).changed).toBe(false);
    expect(applyTool(p, 3, 2, 'prism', DEFAULT_VARIANTS).changed).toBe(false);
    expect(applyTool(p, 0, 0, 'eraser', DEFAULT_VARIANTS).changed).toBe(false);
    expect(at(applyTool(p, 2, 2, 'eraser', DEFAULT_VARIANTS).puzzle, 2, 2)).toEqual({ kind: 'empty' });
  });

  it('moves the single source and rejects inner cells', () => {
    const r = applyTool(base(), 4, 2, 'source', DEFAULT_VARIANTS);
    expect(at(r.puzzle, 0, 1)).toEqual({ kind: 'empty' });
    expect(at(r.puzzle, 4, 2)).toEqual({ kind: 'source', dir: 2 });
    expect(validatePuzzle(r.puzzle)).toEqual([]);
    const inner = applyTool(base(), 2, 2, 'source', DEFAULT_VARIANTS);
    expect(inner).toMatchObject({ rejected: true, changed: false });
  });

  it('rotates a source through inward directions only', () => {
    let r = applyTool(base(), 2, 0, 'source', { ...DEFAULT_VARIANTS, source: 1 });
    expect(at(r.puzzle, 2, 0)).toEqual({ kind: 'source', dir: 1 });
    const dirs: number[] = [];
    for (let i = 0; i < 3; i++) {
      r = applyTool(r.puzzle, 2, 0, 'source', r.variants);
      dirs.push((at(r.puzzle, 2, 0) as { dir: number }).dir);
    }
    expect(dirs).toEqual([2, 0, 1]);
  });

  it('points a corner source inward', () => {
    const r = applyTool(base(), 0, 0, 'source', { ...DEFAULT_VARIANTS, source: 2 });
    const dir = (at(r.puzzle, 0, 0) as { dir: number }).dir;
    expect([0, 1]).toContain(dir);
    expect(validatePuzzle(r.puzzle)).toEqual([]);
  });

  it('removing the source by overwriting makes the puzzle invalid', () => {
    const p = applyTool(base(), 0, 1, 'wall', DEFAULT_VARIANTS).puzzle;
    expect(validatePuzzle(p).map(humanError)).toContain('Er is nog geen bron');
  });
});

describe('helpers', () => {
  it('inwardDirs', () => {
    expect(inwardDirs(5, 4, 0, 2)).toEqual([0, 1, 3]);
    expect(inwardDirs(5, 4, 0, 0)).toEqual([0, 1]);
    expect(inwardDirs(5, 4, 2, 2)).toEqual([]);
  });

  it('emptyPuzzle is valid with a source left in the middle', () => {
    const p = emptyPuzzle(7, 9, 3);
    expect(validatePuzzle(p)).toEqual([]);
    expect(at(p, 0, 4)).toEqual({ kind: 'source', dir: 0 });
    expect(p.mirrors).toBe(3);
  });

  it('resizePuzzle crops and pads; cropping the source makes it invalid', () => {
    const p = fromAscii(['....>', '.o...', '.....'].map((r) => r.replace('>', '<')), 2);
    const big = resizePuzzle(p, 6, 4);
    expect(big.cells).toHaveLength(24);
    expect(at(big, 4, 0)).toEqual({ kind: 'source', dir: 2 });
    expect(at(big, 5, 3)).toEqual({ kind: 'empty' });
    const small = resizePuzzle(p, 3, 3);
    expect(at(small, 1, 1)).toEqual({ kind: 'crystal', color: 'white' });
    expect(validatePuzzle(small).map(humanError)).toContain('Er is nog geen bron');
  });
});

describe('humanError', () => {
  it('translates validation messages', () => {
    expect(humanError('precies één bron nodig, gevonden: 0')).toBe('Er is nog geen bron');
    expect(humanError('precies één bron nodig, gevonden: 2')).toBe('Er zijn meerdere bronnen');
    expect(humanError('bron wijst naar buiten')).toBe('De bron wijst naar buiten');
    expect(humanError('bron staat niet op de rand')).toBe('De bron staat niet op de rand');
    expect(humanError('iets anders')).toBe('Iets anders');
  });
});
