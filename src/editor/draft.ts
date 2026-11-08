import type { Puzzle } from '../core/types';
import { TOOLS, type Tool, type Variants } from './tools';

/** Waar het ontwerp vandaan komt: nieuw, of een datum (met of zonder eigen puzzel in de repo). */
export type Origin = { kind: 'new' } | { kind: 'date'; date: string; own: boolean };

export interface Draft { puzzle: Puzzle; origin: Origin; tool: Tool; variants: Variants }

export const DRAFT_KEY = 'lichtbreker:bouwer:ontwerp';

const safeLocal = (): Storage | null => { try { return localStorage; } catch { return null; } };

export function saveDraft(d: Draft, storage: Storage | null = safeLocal()): void {
  try { storage?.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* vol of geblokkeerd */ }
}

const isOrigin = (o: unknown): o is Origin => {
  const v = o as Record<string, unknown> | null;
  if (!v) return false;
  if (v.kind === 'new') return true;
  return v.kind === 'date' && typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && typeof v.own === 'boolean';
};

/** Het bewaarde ontwerp, of null. De puzzel hoeft niet geldig te zijn, wel goed gevormd. */
export function loadDraft(storage: Storage | null = safeLocal()): Draft | null {
  try {
    const raw = storage?.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    const p = d.puzzle as Puzzle | undefined;
    if (!p || typeof p.width !== 'number' || typeof p.height !== 'number' || typeof p.mirrors !== 'number') return null;
    if (!Array.isArray(p.cells) || p.cells.length !== p.width * p.height) return null;
    if (!p.cells.every((c) => c && typeof (c as { kind?: unknown }).kind === 'string')) return null;
    if (!isOrigin(d.origin) || !TOOLS.includes(d.tool as Tool) || typeof d.variants !== 'object' || !d.variants) return null;
    return { puzzle: p, origin: d.origin, tool: d.tool as Tool, variants: d.variants };
  } catch {
    return null;
  }
}
