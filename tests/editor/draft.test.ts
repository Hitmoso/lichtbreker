import { describe, expect, it } from 'vitest';
import { generate } from '../../src/core/generator';
import { DRAFT_KEY, loadDraft, saveDraft, type Draft } from '../../src/editor/draft';
import { qualityTips } from '../../src/editor/messages';
import { DEFAULT_VARIANTS, emptyPuzzle } from '../../src/editor/tools';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const mem = () => new MemStorage() as unknown as Storage;

describe('draft', () => {
  it('round-trips', () => {
    const s = mem();
    const d: Draft = { puzzle: emptyPuzzle(5, 6, 2), origin: { kind: 'date', date: '2026-12-24', own: true }, tool: 'crystal', variants: { ...DEFAULT_VARIANTS, crystal: 'blue' } };
    saveDraft(d, s);
    expect(loadDraft(s)).toEqual(d);
    expect(s.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it('remembers whether the design had unsaved changes', () => {
    const s = mem();
    saveDraft({ puzzle: emptyPuzzle(5, 6, 2), origin: { kind: 'new' }, tool: 'wall', variants: DEFAULT_VARIANTS, dirty: true }, s);
    expect(loadDraft(s)?.dirty).toBe(true);
  });

  it('keeps an invalid but well-formed puzzle', () => {
    const s = mem();
    const p = emptyPuzzle(4, 4, 1);
    p.cells = p.cells.map(() => ({ kind: 'empty' }));
    saveDraft({ puzzle: p, origin: { kind: 'new' }, tool: 'wall', variants: DEFAULT_VARIANTS }, s);
    expect(loadDraft(s)?.puzzle.cells).toHaveLength(16);
  });

  it('rejects broken JSON, wrong cell counts and unknown tools', () => {
    const s = mem();
    s.setItem(DRAFT_KEY, '{kapot');
    expect(loadDraft(s)).toBeNull();
    const p = emptyPuzzle(4, 4, 1);
    s.setItem(DRAFT_KEY, JSON.stringify({ puzzle: { ...p, cells: p.cells.slice(1) }, origin: { kind: 'new' }, tool: 'wall', variants: DEFAULT_VARIANTS }));
    expect(loadDraft(s)).toBeNull();
    s.setItem(DRAFT_KEY, JSON.stringify({ puzzle: p, origin: { kind: 'new' }, tool: 'hamer', variants: DEFAULT_VARIANTS }));
    expect(loadDraft(s)).toBeNull();
    expect(loadDraft(null)).toBeNull();
  });
});

describe('qualityTips', () => {
  it('lists the problems in plain Dutch', () => {
    const report = { errors: [], max: 3, solution: [], exact: true, maxInRange: false, tooEasyWithout: true, greedyReachesMax: true, fewerMirrorsSuffice: true, ok: false };
    expect(qualityTips(report)).toEqual([
      'Max ligt buiten 6–12',
      'Zonder spiegels raak je al de helft',
      'Gulzig spelen haalt het maximum al',
      'Je hebt niet alle spiegels nodig',
    ]);
  });

  it('only says the board is too big when the search was cut off', () => {
    const report = { errors: [], max: 6, solution: [], exact: false, maxInRange: true, tooEasyWithout: true, greedyReachesMax: false, fewerMirrorsSuffice: false, ok: false };
    expect(qualityTips(report)).toEqual(['Te groot om exact te rekenen; max is minstens 6']);
  });

  it('is empty for a good puzzle', () => {
    for (let s = 1; s <= 5; s++) {
      const g = generate(s);
      expect(qualityTips({ errors: [], max: g.max, solution: [], exact: true, maxInRange: true, tooEasyWithout: false, greedyReachesMax: false, fewerMirrorsSuffice: false, ok: true })).toEqual([]);
    }
  });
});
