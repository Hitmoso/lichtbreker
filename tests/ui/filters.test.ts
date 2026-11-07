import { describe, expect, it, vi } from 'vitest';

let created = 0;
vi.mock('pixi.js', () => ({
  BlurFilter: class {
    constructor(public opts: unknown) { created++; }
  },
}));

describe('sharedBlur', () => {
  it('reuses one BlurFilter per strength instead of creating one per cell', async () => {
    const { sharedBlur } = await import('../../src/render/filters');
    const a = sharedBlur(7);
    for (let i = 0; i < 50; i++) expect(sharedBlur(7)).toBe(a);
    expect(sharedBlur(8)).not.toBe(a);
    expect(created).toBe(2);
  });
});
