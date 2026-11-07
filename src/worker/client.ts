import { getDaily, type Daily } from '../core/daily';

const defaultFactory = (): Worker | null => {
  try {
    if (typeof Worker === 'undefined') return null;
    return new Worker(new URL('./puzzle.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
};

/**
 * Berekent de dagpuzzel in een Web Worker zodat de UI niet hapert.
 * Lukt dat niet, dan op de hoofdthread.
 */
export function requestDaily(dateStr: string, opts: { workerFactory?: () => Worker | null } = {}): Promise<Daily> {
  const worker = (opts.workerFactory ?? defaultFactory)();
  if (!worker) return Promise.resolve(getDaily(dateStr));
  return new Promise<Daily>((resolve) => {
    const fallback = () => { worker.terminate(); resolve(getDaily(dateStr)); };
    worker.onerror = fallback;
    worker.onmessage = (e: MessageEvent<{ ok: boolean; daily?: Daily }>) => {
      if (!e.data?.ok || !e.data.daily) return fallback();
      worker.terminate();
      resolve(e.data.daily);
    };
    worker.postMessage({ date: dateStr });
  });
}
