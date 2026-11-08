import { ELEMENT_KINDS, type ElementKind, type Placement } from '../core/types';
import { defaultEndless, parseEndless, type EndlessState } from './endless';

export const STORAGE_KEY = 'lichtbreker:v1';

export interface SavedCurrent {
  number: number;
  placements: Placement[];
  submitted: boolean;
  score: number | null;
  /** Vingerafdruk van de dagpuzzel waar deze voortgang bij hoort (ontbreekt in oude opslag). */
  puzzleId?: string;
}

export interface SavedState {
  version: 1;
  tutorialSeen: boolean;
  seenElements: ElementKind[];
  current: SavedCurrent | null;
  /** Sleutel = puzzelnummer. */
  history: Record<string, { score: number; max: number }>;
  /** Oneindige modus; los van de dagpuzzel. */
  endless: EndlessState;
}

export const defaultState = (): SavedState => ({
  version: 1, tutorialSeen: false, seenElements: [], current: null, history: {}, endless: defaultEndless(),
});

const isNat = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function parseCurrent(v: unknown): SavedCurrent | null {
  if (typeof v !== 'object' || v === null) return null;
  const c = v as Record<string, unknown>;
  if (!isNat(c.number) || c.number < 1 || !Array.isArray(c.placements) || typeof c.submitted !== 'boolean') return null;
  if (!(c.score === null || isNat(c.score))) return null;
  // Plaatsingen worden tegen de puzzel gecontroleerd in startGame.
  const cur: SavedCurrent = { number: c.number, placements: c.placements as Placement[], submitted: c.submitted, score: c.score as number | null };
  if (typeof c.puzzleId === 'string') cur.puzzleId = c.puzzleId;
  return cur;
}

/** Leest de opgeslagen staat; ongeldige delen worden standaardwaarden. Gooit nooit. */
export function loadState(storage: Storage | null): SavedState {
  const def = defaultState();
  let raw: unknown;
  try {
    const s = storage?.getItem(STORAGE_KEY);
    if (!s) return def;
    raw = JSON.parse(s);
  } catch {
    return def;
  }
  if (typeof raw !== 'object' || raw === null || (raw as { version?: unknown }).version !== 1) return def;
  const o = raw as Record<string, unknown>;
  const history: SavedState['history'] = {};
  if (typeof o.history === 'object' && o.history !== null) {
    for (const [k, v] of Object.entries(o.history as Record<string, unknown>)) {
      const e = v as { score?: unknown; max?: unknown } | null;
      if (/^[1-9]\d*$/.test(k) && e && isNat(e.score) && isNat(e.max) && e.max >= 1 && e.score <= e.max) {
        history[k] = { score: e.score, max: e.max };
      }
    }
  }
  return {
    version: 1,
    tutorialSeen: o.tutorialSeen === true,
    seenElements: Array.isArray(o.seenElements)
      ? [...new Set(o.seenElements.filter((k): k is ElementKind => ELEMENT_KINDS.includes(k as ElementKind)))]
      : [],
    current: parseCurrent(o.current),
    endless: parseEndless(o.endless),
    history,
  };
}

/** Slaat op; fouten (geen opslag, quota) worden genegeerd. */
export function saveState(storage: Storage | null, s: SavedState): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* zonder opslag speelt het spel gewoon door */
  }
}
