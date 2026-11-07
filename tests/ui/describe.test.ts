import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import { describeCell, moveCursor } from '../../src/ui/describe';

const p = fromAscii(['>.o', '#Pr', 'G\\.'], 2);

describe('describeCell', () => {
  it('names every kind of cell with its row and column', () => {
    expect(describeCell(p, [], 0, 0)).toBe('Rij 1, kolom 1: laserbron');
    expect(describeCell(p, [], 1, 0)).toBe('Rij 1, kolom 2: leeg');
    expect(describeCell(p, [{ x: 1, y: 0, mirror: '/' }], 1, 0)).toBe('Rij 1, kolom 2: jouw spiegel ╱');
    expect(describeCell(p, [{ x: 1, y: 0, mirror: '\\' }], 1, 0)).toBe('Rij 1, kolom 2: jouw spiegel ╲');
    expect(describeCell(p, [], 2, 0)).toBe('Rij 1, kolom 3: wit kristal');
    expect(describeCell(p, [], 0, 1)).toBe('Rij 2, kolom 1: muur');
    expect(describeCell(p, [], 1, 1)).toBe('Rij 2, kolom 2: prisma');
    expect(describeCell(p, [], 2, 1)).toBe('Rij 2, kolom 3: rood kristal');
    expect(describeCell(p, [], 0, 2)).toBe('Rij 3, kolom 1: groen filter');
    expect(describeCell(p, [], 1, 2)).toBe('Rij 3, kolom 2: vaste spiegel ╲');
  });
});

describe('moveCursor', () => {
  it('moves with arrow keys and stays on the board', () => {
    expect(moveCursor({ x: 0, y: 0 }, 'ArrowRight', 3, 3)).toEqual({ x: 1, y: 0 });
    expect(moveCursor({ x: 0, y: 0 }, 'ArrowLeft', 3, 3)).toEqual({ x: 0, y: 0 });
    expect(moveCursor({ x: 2, y: 2 }, 'ArrowDown', 3, 3)).toEqual({ x: 2, y: 2 });
    expect(moveCursor({ x: 1, y: 1 }, 'ArrowUp', 3, 3)).toEqual({ x: 1, y: 0 });
    expect(moveCursor({ x: 1, y: 1 }, 'a', 3, 3)).toBeNull();
  });
});
