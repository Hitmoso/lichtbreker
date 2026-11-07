import { trace } from '../core/beam';
import type { Placement, Puzzle } from '../core/types';
import { validatePlacements } from '../core/validate';
import type { SavedState } from './storage';

/** Wat startGame nodig heeft van de dagpuzzel (deelverzameling van Daily). */
export interface DailyInput { number: number; puzzle: Puzzle; max: number; solution: Placement[] }

export interface GameState extends DailyInput {
  placements: Placement[];
  submitted: boolean;
  score: number | null;
}

export function startGame(saved: SavedState, daily: DailyInput): GameState {
  const base: GameState = { ...daily, placements: [], submitted: false, score: null };
  const cur = saved.current;
  if (!cur || cur.number !== daily.number) return base;
  const placements = validatePlacements(daily.puzzle, cur.placements);
  if (!placements) return base;
  if (cur.submitted) {
    return { ...base, placements, submitted: true, score: trace(daily.puzzle, placements).score };
  }
  return { ...base, placements };
}

/** Leeg → '/' → '\' → leeg. */
export function tapCell(g: GameState, x: number, y: number): { state: GameState; rejected: boolean } {
  const reject = { state: g, rejected: true };
  const { puzzle } = g;
  if (g.submitted || x < 0 || y < 0 || x >= puzzle.width || y >= puzzle.height) return reject;
  if (puzzle.cells[y * puzzle.width + x].kind !== 'empty') return reject;
  const idx = g.placements.findIndex((p) => p.x === x && p.y === y);
  let placements: Placement[];
  if (idx >= 0) {
    const cur = g.placements[idx];
    placements = cur.mirror === '/'
      ? g.placements.map((p, i) => (i === idx ? { x, y, mirror: '\\' } : p))
      : g.placements.filter((_, i) => i !== idx);
  } else {
    if (g.placements.length >= puzzle.mirrors) return reject;
    placements = [...g.placements, { x, y, mirror: '/' }];
  }
  return { state: { ...g, placements }, rejected: false };
}

export function resetPlacements(g: GameState): GameState {
  return g.submitted ? g : { ...g, placements: [] };
}

/** Definitief indienen; een tweede keer verandert niets. */
export function submit(g: GameState): GameState {
  if (g.submitted) return g;
  return { ...g, submitted: true, score: trace(g.puzzle, g.placements).score };
}

export function toSaved(saved: SavedState, g: GameState): SavedState {
  const history = { ...saved.history };
  const key = String(g.number);
  if (g.submitted && g.score !== null && !history[key]) history[key] = { score: g.score, max: g.max };
  return {
    ...saved,
    current: { number: g.number, placements: g.placements, submitted: g.submitted, score: g.score },
    history,
  };
}
