import { DIFFICULTIES, type Difficulty } from '../config';
import { getDaily, type Daily } from '../core/daily';
import { generate, type Generated } from '../core/generator';

export type WorkerRequest =
  | { kind: 'daily'; date: string }
  | { kind: 'endless'; seed: number; difficulty: Difficulty };

export interface WorkerOptions { workerFactory?: () => Worker | null }

const defaultFactory = (): Worker | null => {
  try {
    if (typeof Worker === 'undefined') return null;
    return new Worker(new URL('./puzzle.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
};

/** Voert het verzoek uit in een Web Worker; lukt dat niet, dan op de hoofdthread. */
function run<T>(msg: WorkerRequest, local: () => T, opts: WorkerOptions): Promise<T> {
  const worker = (opts.workerFactory ?? defaultFactory)();
  if (!worker) return Promise.resolve(local());
  return new Promise<T>((resolve) => {
    let done = false;
    const finish = (v: T) => { if (done) return; done = true; worker.terminate(); resolve(v); };
    worker.onerror = () => finish(local());
    worker.onmessage = (e: MessageEvent<{ ok: boolean; result?: T }>) => {
      if (!e.data?.ok || e.data.result === undefined) return finish(local());
      finish(e.data.result);
    };
    worker.postMessage(msg);
  });
}

/** De dagpuzzel voor een datum ('YYYY-MM-DD'). */
export function requestDaily(dateStr: string, opts: WorkerOptions = {}): Promise<Daily> {
  return run({ kind: 'daily', date: dateStr }, () => getDaily(dateStr), opts);
}

/** Een oneindige puzzel voor een seed en niveau. */
export function requestEndless(seed: number, difficulty: Difficulty, opts: WorkerOptions = {}): Promise<Generated> {
  return run({ kind: 'endless', seed, difficulty }, () => generate(seed, DIFFICULTIES[difficulty]), opts);
}
