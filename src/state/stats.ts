import type { SavedState } from './storage';

export interface Stats {
  played: number;
  currentStreak: number;
  bestStreak: number;
  /** 100%, 90–99%, 75–89%, 50–74%, <50%. */
  buckets: [number, number, number, number, number];
}

export function computeStats(history: SavedState['history'], today: number): Stats {
  const nums = Object.keys(history).map(Number).sort((a, b) => a - b);
  const buckets: Stats['buckets'] = [0, 0, 0, 0, 0];
  for (const n of nums) {
    const { score, max } = history[String(n)];
    const pct = (score / max) * 100;
    buckets[pct >= 100 ? 0 : pct >= 90 ? 1 : pct >= 75 ? 2 : pct >= 50 ? 3 : 4]++;
  }
  let best = 0, run = 0, prev = -Infinity;
  for (const n of nums) {
    run = n === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = n;
  }
  const last = nums.at(-1);
  const current = last !== undefined && last >= today - 1 ? run : 0;
  return { played: nums.length, currentStreak: current, bestStreak: best, buckets };
}
