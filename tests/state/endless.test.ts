import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import { puzzleId } from '../../src/core/fingerprint';
import { FALLBACK } from '../../src/core/generator';
import { defaultEndless, parseEndless, recordEndlessResult, savedProgress } from '../../src/state/endless';
import { resumeGame } from '../../src/state/game';
import { defaultState, loadState, STORAGE_KEY } from '../../src/state/storage';

const mem = (v: unknown) => {
  const data = new Map([[STORAGE_KEY, JSON.stringify(v)]]);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: () => {} } as unknown as Storage;
};

describe('savedProgress', () => {
  const placements = [{ x: 1, y: 1, mirror: '/' as const }];
  it('keeps placements for the same puzzle', () => {
    const cur = { difficulty: 'normal' as const, seed: 3, placements, submitted: true, puzzleId: puzzleId(FALLBACK) };
    expect(savedProgress(cur, FALLBACK)).toEqual({ placements, submitted: true });
  });
  it('starts fresh when the generator made a different puzzle for the seed', () => {
    const cur = { difficulty: 'normal' as const, seed: 3, placements, submitted: true, puzzleId: 'deadbeef' };
    expect(savedProgress(cur, FALLBACK)).toEqual({ placements: [], submitted: false });
  });
  it('starts fresh for an old save without puzzleId', () => {
    expect(savedProgress({ difficulty: 'normal', seed: 3, placements, submitted: false }, FALLBACK)).toEqual({ placements: [], submitted: false });
  });
  it('parseEndless keeps puzzleId', () => {
    expect(parseEndless({ current: { difficulty: 'hard', seed: 12, placements: [], submitted: false, puzzleId: 'abc12345' } }).current?.puzzleId).toBe('abc12345');
  });
});

describe('endless storage', () => {
  it('old saved state without endless still loads', () => {
    const st = loadState(mem({ version: 1, tutorialSeen: true, seenElements: [], current: null, history: { '1': { score: 3, max: 5 } } }));
    expect(st.endless).toEqual(defaultEndless());
    expect(st.history).toEqual({ '1': { score: 3, max: 5 } });
    expect(st.tutorialSeen).toBe(true);
    expect(defaultState().endless).toEqual(defaultEndless());
  });

  it('parseEndless falls back per field', () => {
    expect(parseEndless({ difficulty: 'insane' }).difficulty).toBe('normal');
    expect(parseEndless({ difficulty: 'hard', current: { difficulty: 'hard', seed: 1.5, placements: [], submitted: false } }).current).toBeNull();
    expect(parseEndless({ current: { difficulty: 'hard', seed: 12, placements: [], submitted: true } }).current)
      .toEqual({ difficulty: 'hard', seed: 12, placements: [], submitted: true });
    const st = parseEndless({ stats: { easy: { played: -2, perfect: 1, run: 'x', bestRun: 3 } } });
    expect(st.stats.easy).toEqual({ played: 0, perfect: 1, run: 0, bestRun: 3 });
    expect(st.stats.hard).toEqual({ played: 0, perfect: 0, run: 0, bestRun: 0 });
    expect(parseEndless(null)).toEqual(defaultEndless());
  });

  it('records results with runs per difficulty, without mutating', () => {
    const start = defaultEndless();
    let e = recordEndlessResult(start, 'hard', 9, 9);
    e = recordEndlessResult(e, 'hard', 9, 9);
    e = recordEndlessResult(e, 'hard', 5, 9);
    expect(e.stats.hard).toEqual({ played: 3, perfect: 2, run: 0, bestRun: 2 });
    expect(e.stats.easy).toEqual({ played: 0, perfect: 0, run: 0, bestRun: 0 });
    expect(start.stats.hard.played).toBe(0);
  });
});

describe('resumeGame', () => {
  const puzzle = fromAscii(['>..', '...', '.o.'], 2);
  const input = { number: 0, puzzle, max: 1, solution: [{ x: 1, y: 0, mirror: '\\' as const }] };
  it('drops invalid placements and un-submits', () => {
    const g = resumeGame(input, [{ x: 0, y: 0, mirror: '/' }], true);
    expect(g.placements).toEqual([]);
    expect(g.submitted).toBe(false);
  });
  it('recomputes the score of a submitted round', () => {
    const g = resumeGame(input, [{ x: 1, y: 0, mirror: '\\' }], true);
    expect(g.submitted).toBe(true);
    expect(g.score).toBe(1);
  });
});
