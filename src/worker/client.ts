import type { Difficulty } from '../config';
import type { Daily } from '../core/daily';
import type { Generated, QualityReport } from '../core/generator';
import type { Placement, Puzzle } from '../core/types';
import { handleRequest } from './handle';

export type WorkerRequest =
  | { kind: 'daily'; date: string }
  | { kind: 'generatedDaily'; date: string }
  | { kind: 'endless'; seed: number; difficulty: Difficulty }
  | { kind: 'analyse'; puzzle: Puzzle };

export interface WorkerOptions { workerFactory?: () => Worker | null }

export interface Analysis { max: number; solution: Placement[]; report: QualityReport }

/** Een verzoek dat je kunt afbreken; afgebroken → result wordt null. */
export interface Cancelable<T> { result: Promise<T | null>; cancel(): void }

const defaultFactory = (): Worker | null => {
  try {
    if (typeof Worker === 'undefined') return null;
    return new Worker(new URL('./puzzle.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
};

/** Voert het verzoek uit in een Web Worker; lukt dat niet, dan op de hoofdthread. */
function run<T>(msg: WorkerRequest, opts: WorkerOptions): Cancelable<T> {
  const local = () => handleRequest(msg) as T;
  const worker = (opts.workerFactory ?? defaultFactory)();
  if (!worker) {
    let cancelled = false;
    return { result: Promise.resolve().then(() => (cancelled ? null : local())), cancel: () => { cancelled = true; } };
  }
  let finish: (v: T | null) => void = () => {};
  const result = new Promise<T | null>((resolve) => {
    let done = false;
    finish = (v) => { if (done) return; done = true; worker.terminate(); resolve(v); };
    worker.onerror = () => finish(local());
    worker.onmessage = (e: MessageEvent<{ ok: boolean; result?: T }>) => {
      if (!e.data?.ok || e.data.result === undefined) return finish(local());
      finish(e.data.result);
    };
    worker.postMessage(msg);
  });
  return { result, cancel: () => finish(null) };
}

const once = <T>(msg: WorkerRequest, opts: WorkerOptions) => run<T>(msg, opts).result as Promise<T>;

/** De dagpuzzel voor een datum ('YYYY-MM-DD'). */
export function requestDaily(dateStr: string, opts: WorkerOptions = {}): Promise<Daily> {
  return once({ kind: 'daily', date: dateStr }, opts);
}

/** De gegenereerde dagpuzzel voor een datum, zonder overrides (voor de bouwer). */
export function requestGeneratedDaily(dateStr: string, opts: WorkerOptions = {}): Promise<Daily> {
  return once({ kind: 'generatedDaily', date: dateStr }, opts);
}

/** Een oneindige puzzel voor een seed en niveau. */
export function requestEndless(seed: number, difficulty: Difficulty, opts: WorkerOptions = {}): Promise<Generated> {
  return once({ kind: 'endless', seed, difficulty }, opts);
}

/** Maximum, beste oplossing en kwaliteitsrapport van een puzzel. */
export function requestAnalyse(puzzle: Puzzle, opts: WorkerOptions = {}): Cancelable<Analysis> {
  return run({ kind: 'analyse', puzzle }, opts);
}
