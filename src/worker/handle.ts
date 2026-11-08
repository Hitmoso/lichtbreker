import { DIFFICULTIES } from '../config';
import { getDaily } from '../core/daily';
import { ANALYSE_BUDGET, generate, qualityReport } from '../core/generator';
import type { WorkerRequest } from './client';

/** Voert een verzoek uit (in de worker, of als terugval op de hoofdthread). */
export function handleRequest(msg: WorkerRequest): unknown {
  switch (msg.kind) {
    case 'daily': return getDaily(msg.date);
    case 'generatedDaily': return getDaily(msg.date, {});
    case 'endless': return generate(msg.seed, DIFFICULTIES[msg.difficulty]);
    case 'analyse': {
      const report = qualityReport(msg.puzzle, undefined, ANALYSE_BUDGET);
      return { max: report.max, solution: report.solution, report };
    }
  }
}
