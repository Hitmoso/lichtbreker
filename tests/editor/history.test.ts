import { describe, expect, it } from 'vitest';
import { History } from '../../src/editor/history';

describe('History', () => {
  it('undoes and redoes', () => {
    const h = new History('a');
    h.push('b'); h.push('c');
    expect(h.undo()).toBe('b');
    expect(h.undo()).toBe('a');
    expect(h.undo()).toBeNull();
    expect(h.canUndo).toBe(false);
    expect(h.redo()).toBe('b');
    expect(h.current).toBe('b');
  });

  it('push clears redo', () => {
    const h = new History('a');
    h.push('b'); h.undo(); h.push('x');
    expect(h.canRedo).toBe(false);
    expect(h.redo()).toBeNull();
  });

  it('replace does not add a step (a drag is one step)', () => {
    const h = new History(0);
    h.push(1); h.replace(2); h.replace(3);
    expect(h.current).toBe(3);
    expect(h.undo()).toBe(0);
  });

  it('keeps at most the limit', () => {
    const h = new History(0, 100);
    for (let i = 1; i <= 150; i++) h.push(i);
    let n = 0;
    while (h.undo() !== null) n++;
    expect(n).toBe(100);
    expect(h.current).toBe(50);
  });

  it('reset starts a fresh history', () => {
    const h = new History('a');
    h.push('b'); h.push('c'); h.undo();
    h.reset('x');
    expect(h.current).toBe('x');
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });
});
