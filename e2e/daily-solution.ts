// Draait via vite-node (dat JSON-imports aankan): drukt de dagpuzzel van vandaag af als JSON.
import { amsterdamDate, getDaily } from '../src/core/daily';

const d = getDaily(amsterdamDate(new Date()));
console.log(JSON.stringify({ number: d.number, solution: d.solution }));
