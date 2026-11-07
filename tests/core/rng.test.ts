import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '../../src/core/rng';

describe('createRng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(123), b = createRng(123), c = createRng(124);
    const ra = Array.from({ length: 10 }, () => a.next());
    const rb = Array.from({ length: 10 }, () => b.next());
    const rc = Array.from({ length: 10 }, () => c.next());
    expect(ra).toEqual(rb);
    expect(ra).not.toEqual(rc);
    for (const v of ra) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });

  it('int is inclusive and covers the range', () => {
    const r = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 10000; i++) {
      const v = r.int(3, 6);
      expect(v >= 3 && v <= 6 && Number.isInteger(v)).toBe(true);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('shuffle keeps elements, pick returns a member', () => {
    const r = createRng(1);
    const s = r.shuffle([1, 2, 3, 4, 5]);
    expect([...s].sort()).toEqual([1, 2, 3, 4, 5]);
    expect([1, 2, 3]).toContain(r.pick([1, 2, 3]));
  });
});

describe('hashSeed', () => {
  it('is stable and sensitive to parts', () => {
    expect(hashSeed('a', 1)).toBe(hashSeed('a', 1));
    expect(hashSeed('a', 1)).not.toBe(hashSeed('a', 2));
    expect(hashSeed('a', 1)).toBeGreaterThanOrEqual(0);
    expect(hashSeed('a', 1)).toBeLessThan(2 ** 32);
  });
});
