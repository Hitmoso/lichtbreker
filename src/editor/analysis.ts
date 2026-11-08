import type { Puzzle } from '../core/types';
import { validatePuzzle } from '../core/validate';
import { requestAnalyse, type Analysis, type Cancelable } from '../worker/client';

const DEBOUNCE_MS = 150;

/**
 * Rekent max en kwaliteit uit in de worker: 150 ms na de laatste wijziging, en alleen
 * voor de nieuwste puzzel (een lopende berekening wordt afgebroken).
 * Een ongeldige puzzel geeft meteen null, zonder worker.
 */
export function createAnalyser(onResult: (a: Analysis | null, p: Puzzle) => void): { request(p: Puzzle): void; dispose(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Cancelable<Analysis> | null = null;
  let latest = 0;

  const stop = () => { clearTimeout(timer); running?.cancel(); running = null; };

  return {
    request(p) {
      stop();
      const id = ++latest;
      if (validatePuzzle(p).length) { onResult(null, p); return; }
      timer = setTimeout(() => {
        running = requestAnalyse(p);
        void running.result.then((a) => { if (a && id === latest) onResult(a, p); });
      }, DEBOUNCE_MS);
    },
    dispose() { stop(); latest++; },
  };
}
