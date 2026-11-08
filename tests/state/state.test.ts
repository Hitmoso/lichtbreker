import { describe, expect, it } from 'vitest';
import { fromAscii } from '../../src/core/ascii';
import { resetPlacements, startGame, submit, tapCell, toSaved, type DailyInput } from '../../src/state/game';
import { puzzleId } from '../../src/core/fingerprint';
import { computeStats } from '../../src/state/stats';
import { defaultState, loadState, saveState, STORAGE_KEY, type SavedState } from '../../src/state/storage';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
  key() { return null; }
  get length() { return this.data.size; }
}
const mem = () => new MemStorage() as unknown as Storage;

const puzzle = fromAscii(['>..', '...', '.o.'], 2);
const daily = (number = 5): DailyInput => ({ number, puzzle, max: 1, solution: [{ x: 1, y: 0, mirror: '\\' }] });

describe('storage', () => {
  it('returns defaults without storage, with bad JSON or wrong version', () => {
    expect(loadState(null)).toEqual(defaultState());
    const s = mem();
    s.setItem(STORAGE_KEY, '{kapot');
    expect(loadState(s)).toEqual(defaultState());
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 2 }));
    expect(loadState(s)).toEqual(defaultState());
  });
  it('drops invalid fields but keeps valid ones', () => {
    const s = mem();
    s.setItem(STORAGE_KEY, JSON.stringify({
      version: 1, tutorialSeen: true, seenElements: ['prism', 'lava'],
      current: { number: 'x' },
      history: { '1': { score: 3, max: 5 }, '2': { score: -1, max: 5 }, '3': { score: 9, max: 5 } },
    }));
    const st = loadState(s);
    expect(st.tutorialSeen).toBe(true);
    expect(st.seenElements).toEqual(['prism']);
    expect(st.current).toBeNull();
    expect(st.history).toEqual({ '1': { score: 3, max: 5 } });
  });
  it('round-trips and never throws on a broken storage', () => {
    const s = mem();
    const st: SavedState = { ...defaultState(), tutorialSeen: true };
    saveState(s, st);
    expect(loadState(s)).toEqual(st);
    const broken = { setItem() { throw new Error('quota'); }, getItem() { throw new Error('denied'); } } as unknown as Storage;
    expect(() => saveState(broken, st)).not.toThrow();
    expect(loadState(broken)).toEqual(defaultState());
  });
});

describe('game', () => {
  it('starts clean on a new puzzle number but keeps history', () => {
    const saved: SavedState = {
      ...defaultState(),
      current: { number: 4, placements: [{ x: 1, y: 1, mirror: '/' }], submitted: true, score: 1 },
      history: { '4': { score: 1, max: 1 } },
    };
    const g = startGame(saved, daily(5));
    expect(g.placements).toEqual([]);
    expect(g.submitted).toBe(false);
    expect(toSaved(saved, g).history).toEqual({ '4': { score: 1, max: 1 } });
  });
  it('resumes the same puzzle and drops invalid placements', () => {
    const resumed = startGame({ ...defaultState(), current: { number: 5, placements: [{ x: 1, y: 1, mirror: '/' }], submitted: false, score: null } }, daily());
    expect(resumed.placements).toEqual([{ x: 1, y: 1, mirror: '/' }]);
    const bad = startGame({ ...defaultState(), current: { number: 5, placements: [{ x: 0, y: 0, mirror: '/' }], submitted: false, score: null } }, daily());
    expect(bad.placements).toEqual([]);
  });
  it('cycles a cell empty → / → \\ → empty', () => {
    let g = startGame(defaultState(), daily());
    g = tapCell(g, 1, 0).state; expect(g.placements).toEqual([{ x: 1, y: 0, mirror: '/' }]);
    g = tapCell(g, 1, 0).state; expect(g.placements).toEqual([{ x: 1, y: 0, mirror: '\\' }]);
    g = tapCell(g, 1, 0).state; expect(g.placements).toEqual([]);
  });
  it('rejects taps on non-empty cells, when out of mirrors, and after submit', () => {
    let g = startGame(defaultState(), daily());
    expect(tapCell(g, 0, 0).rejected).toBe(true);
    g = tapCell(g, 1, 0).state;
    g = tapCell(g, 2, 0).state;
    const r = tapCell(g, 2, 2);
    expect(r.rejected).toBe(true);
    expect(r.state).toBe(g);
    expect(tapCell(g, 1, 0).rejected).toBe(false); // bestaande spiegel draaien mag
    g = resetPlacements(g);
    expect(g.placements).toEqual([]);
    g = submit(tapCell(tapCell(g, 1, 0).state, 1, 0).state);
    expect(g.score).toBe(1);
    const after = tapCell(g, 2, 2);
    expect(after.rejected).toBe(true);
    expect(after.state).toBe(g);
    expect(resetPlacements(g)).toBe(g);
  });
  it('submit is idempotent and history is written once', () => {
    const g = submit(startGame(defaultState(), daily()));
    expect(submit(g)).toBe(g);
    const s1 = toSaved(defaultState(), g);
    expect(s1.history['5']).toEqual({ score: 0, max: 1 });
    const s2 = toSaved(s1, { ...g, score: 1 });
    expect(s2.history['5']).toEqual({ score: 0, max: 1 });
    expect(s1.current).toEqual({ number: 5, placements: [], submitted: true, score: 0, puzzleId: puzzleId(puzzle) });
  });
  it('restores a submitted game', () => {
    const g = submit(startGame(defaultState(), daily()));
    const back = startGame(toSaved(defaultState(), g), daily());
    expect(back.submitted).toBe(true);
    expect(back.score).toBe(0);
  });
});

describe('puzzle fingerprint', () => {
  const withCurrent = (puzzleIdValue?: string): SavedState => ({
    ...defaultState(),
    history: { 5: { score: 1, max: 1 } },
    current: { number: 5, placements: [{ x: 1, y: 0, mirror: '/' }], submitted: false, score: null, ...(puzzleIdValue ? { puzzleId: puzzleIdValue } : {}) },
  });
  it("resets progress when the day's puzzle changed", () => {
    const saved = withCurrent('deadbeef');
    const g = startGame(saved, daily());
    expect(g.placements).toEqual([]);
    expect(g.submitted).toBe(false);
    expect(saved.history).toEqual({ 5: { score: 1, max: 1 } });
  });
  it('keeps progress when the fingerprint matches', () => {
    expect(startGame(withCurrent(puzzleId(puzzle)), daily()).placements).toHaveLength(1);
  });
  it('keeps legacy progress without puzzleId', () => {
    expect(startGame(withCurrent(), daily()).placements).toHaveLength(1);
  });
  it('toSaved stores puzzleId', () => {
    expect(toSaved(defaultState(), startGame(defaultState(), daily())).current?.puzzleId).toBe(puzzleId(puzzle));
  });
  it('loadState keeps a string puzzleId and drops a non-string one', () => {
    const s = mem();
    s.setItem(STORAGE_KEY, JSON.stringify(withCurrent('abcd1234')));
    expect(loadState(s).current?.puzzleId).toBe('abcd1234');
    s.setItem(STORAGE_KEY, JSON.stringify({ ...withCurrent(), current: { ...withCurrent().current, puzzleId: 42 } }));
    const cur = loadState(s).current;
    expect(cur).not.toBeNull();
    expect(cur?.puzzleId).toBeUndefined();
  });
});

describe('computeStats', () => {
  const h = (nums: number[]) => Object.fromEntries(nums.map((n) => [String(n), { score: 5, max: 10 }]));
  it('counts streaks', () => {
    expect(computeStats(h([1, 2, 3, 5, 6]), 6)).toMatchObject({ played: 5, currentStreak: 2, bestStreak: 3 });
    expect(computeStats(h([1, 2, 3, 5, 6]), 7).currentStreak).toBe(2);
    expect(computeStats(h([1, 2, 3, 5, 6]), 8).currentStreak).toBe(0);
    expect(computeStats({}, 1)).toEqual({ played: 0, currentStreak: 0, bestStreak: 0, buckets: [0, 0, 0, 0, 0] });
  });
  it('buckets by share of the maximum', () => {
    const hist = { '1': { score: 10, max: 10 }, '2': { score: 9, max: 10 }, '3': { score: 8, max: 10 }, '4': { score: 5, max: 10 }, '5': { score: 4, max: 10 } };
    expect(computeStats(hist, 5).buckets).toEqual([1, 1, 1, 1, 1]);
  });
});
