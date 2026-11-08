import { DAILY, GEN_V2, type GenSettings } from '../config';
import { trace } from './beam';
import { fallbackFor, meetsQuality, type Generated } from './generator';
import { greedy } from './greedy';
import { createRng, hashSeed, type Rng } from './rng';
import { solve } from './solver';
import type { Cell, Dir, ElementKind, FilterColor, MirrorKind, Placement, Puzzle } from './types';
import { FILTER_COLORS } from './types';

/**
 * Generator versie 2 (zie GEN_V2). De oude `generate` blijft ongewijzigd voor eerdere dagen.
 *
 * Per puzzel:
 * 1. een plan: geen filter, filter nodig, of lokfilter;
 * 2. bouwen zoals v1 (nog zonder filter), oplossen, en opvulkristallen weghalen op 3-5 lokkertjes na;
 * 3. bij een filterplan: het filter op de route van de beste oplossing zetten (of, bij een lokfilter,
 *    op de route van een bijna-goede oplossing) en de kristallen daarachter in de filterkleur kleuren;
 * 4. opnieuw keuren. Uit een paar goede kandidaten wint de puzzel waar gulzig spelen het verst achterblijft.
 */
export type FilterPlan = 'none' | 'needed' | 'decoy';

export interface GeneratedV2 extends Generated {
  filter: FilterPlan;
}

const range = (rng: Rng, r: readonly [number, number]) => rng.int(r[0], r[1]);
const hitBy = (p: Puzzle, placements: readonly Placement[]) => trace(p, placements).hit;
const withCells = (p: Puzzle, cells: Cell[]): Puzzle => ({ ...p, cells });

/** Dezelfde puzzel met elk kleurfilter vervangen door een muur. */
export function withoutFilters(p: Puzzle): Puzzle {
  return withCells(p, p.cells.map((c) => (c.kind === 'filter' ? ({ kind: 'wall' } as Cell) : c)));
}

function planFor(seed: number, S: GenSettings): FilterPlan {
  if (S.extras[1] === 0) return 'none';
  const r = createRng(hashSeed(seed, 'v2-plan'));
  if (r.next() >= GEN_V2.filterChance) return 'none';
  return r.next() < GEN_V2.decoyShare ? 'decoy' : 'needed';
}

/** Zoals v1, maar zonder filters en met alleen witte kristallen; het filter komt later. */
function build(rng: Rng, S: GenSettings, withFilter: boolean): Puzzle {
  const { width: w, height: h } = S;
  const cells: Cell[] = Array.from({ length: w * h }, () => ({ kind: 'empty' }) as Cell);

  const side = rng.int(0, 3);
  let x: number, y: number, dir: Dir;
  if (side === 0) { x = 0; y = rng.int(1, h - 2); dir = 0; }
  else if (side === 1) { x = rng.int(1, w - 2); y = 0; dir = 1; }
  else if (side === 2) { x = w - 1; y = rng.int(1, h - 2); dir = 2; }
  else { x = rng.int(1, w - 2); y = h - 1; dir = 3; }
  cells[y * w + x] = { kind: 'source', dir };

  const free = rng.shuffle(cells.flatMap((c, i) => (c.kind === 'empty' ? [i] : [])));
  const put = (c: Cell) => { const i = free.pop(); if (i !== undefined) cells[i] = c; };

  // Het filter telt mee als een van de extra's; de overige (vaste spiegel, prisma) blijven willekeurig.
  const n = range(rng, S.extras);
  const others = rng.shuffle<ElementKind>(['fixedMirror', 'prism']).slice(0, withFilter ? Math.max(0, n - 1) : Math.min(n, 2));
  for (const kind of others) {
    if (kind === 'fixedMirror') {
      for (let k = range(rng, S.fixedMirrors); k > 0; k--) put({ kind: 'fixedMirror', mirror: rng.pick<MirrorKind>(['/', '\\']) });
    } else {
      for (let k = range(rng, S.prisms); k > 0; k--) put({ kind: 'prism' });
    }
  }
  for (let k = range(rng, S.walls); k > 0; k--) put({ kind: 'wall' });
  for (let k = range(rng, S.crystals); k > 0; k--) put({ kind: 'crystal', color: 'white' });
  return { version: 1, width: w, height: h, mirrors: range(rng, S.mirrors), cells };
}

/** Haalt ongeraakte kristallen weg en houdt `lures` lokkertjes, bij voorkeur verleidelijke. */
function prune(p: Puzzle, solution: readonly Placement[], rng: Rng, lures: number): Puzzle {
  const hit = hitBy(p, solution);
  const unhit = p.cells.flatMap((c, i) => (c.kind === 'crystal' && !hit.has(i) ? [i] : []));
  if (unhit.length <= lures) return p;

  // Verleidelijk: wat gulzig spelen, spelen met een spiegel minder, of spelen zonder spiegels raakt.
  const tempting = new Set<number>([
    ...hitBy(p, greedy(p).placements),
    ...hitBy(p, solve(p, p.mirrors - 1).solution),
    ...hitBy(p, []),
  ]);
  const nice = rng.shuffle(unhit.filter((i) => tempting.has(i)));
  const rest = rng.shuffle(unhit.filter((i) => !tempting.has(i)));
  const kept = new Set([...nice, ...rest].slice(0, lures));
  return withCells(p, p.cells.map((c, i) => (c.kind === 'crystal' && !hit.has(i) && !kept.has(i) ? ({ kind: 'empty' } as Cell) : c)));
}

/**
 * Zet een filter op een leeg vak van de route en kleurt de kristallen die de route daarna raakt.
 * `untouchable`: kristallen die niet gekleurd mogen worden (bij een lokfilter: die van de beste oplossing).
 */
function placeFilter(p: Puzzle, route: readonly Placement[], rng: Rng, untouchable: ReadonlySet<number>, minAfter: number): Puzzle | null {
  const all = hitBy(p, route);
  const onRoute = new Set(route.map((m) => m.y * p.width + m.x));
  const spots: { at: number; after: number[] }[] = [];
  p.cells.forEach((c, i) => {
    if (c.kind !== 'empty' || onRoute.has(i)) return;
    const blocked = hitBy(withCells(p, p.cells.map((x, j) => (j === i ? ({ kind: 'wall' } as Cell) : x))), route);
    const after = [...all].filter((k) => !blocked.has(k));
    // Genoeg gekleurde kristallen achter het filter, en er blijft vóór het filter iets wits te halen.
    if (after.length >= minAfter && blocked.size >= 1 && after.every((k) => !untouchable.has(k))) spots.push({ at: i, after });
  });
  if (!spots.length) return null;
  const { at, after } = rng.pick(spots);
  const color = rng.pick<FilterColor>(FILTER_COLORS);
  const recolor = new Set(after);
  // Soms ook een lokkertje in de filterkleur, zodat niet elk gekleurd kristal "de" route verraadt.
  const lures = p.cells.flatMap((c, i) => (c.kind === 'crystal' && !all.has(i) && !untouchable.has(i) ? [i] : []));
  for (const i of rng.shuffle(lures).slice(0, Math.max(rng.int(0, 2), 2 - after.length))) recolor.add(i);
  if (recolor.size < 2) return null;
  return withCells(p, p.cells.map((c, i) => {
    if (i === at) return { kind: 'filter', color } as Cell;
    if (recolor.has(i)) return { kind: 'crystal', color } as Cell;
    return c;
  }));
}

/**
 * Beste score van een route die op de gekleurde kristallen mikt (de verleiding van een lokfilter).
 * Witte kristallen krijgen een kleur die geen filter maakt: de straal gaat er nog doorheen en er
 * kan nog steeds geen spiegel op, maar ze tellen niet mee.
 */
function colouredRouteScore(p: Puzzle): number {
  const used = new Set(p.cells.flatMap((c) => (c.kind === 'filter' ? [c.color] : [])));
  const unused = FILTER_COLORS.find((c) => !used.has(c));
  if (!unused) return 0;
  const onlyColoured = withCells(p, p.cells.map((c) => (c.kind === 'crystal' && c.color === 'white' ? ({ kind: 'crystal', color: unused } as Cell) : c)));
  return hitBy(p, solve(onlyColoured).solution).size;
}

interface Candidate { puzzle: Puzzle; max: number; solution: Placement[]; gap: number }

function attempt(rng: Rng, S: GenSettings, plan: FilterPlan): Candidate | null {
  let p = build(rng, S, plan !== 'none');
  const lures = range(rng, GEN_V2.lures);

  let best = solve(p);
  // Snel afwijzen: opruimen verandert het maximum hooguit een beetje, dus te laag blijft te laag.
  if (best.max < S.maxScore[0]) return null;
  // Weghalen kan nieuwe spiegelplekken vrijmaken; daarom opnieuw oplossen en zo nodig nog eens snoeien.
  for (let round = 0; round < 3; round++) {
    const next = prune(p, best.solution, rng, lures);
    if (next === p) break;
    p = next;
    best = solve(p);
  }

  if (plan === 'needed') {
    const next = placeFilter(p, best.solution, rng, new Set(), 2);
    if (!next) return null;
    p = next;
  } else if (plan === 'decoy') {
    // Op de route van een bijna-goede oplossing, zonder de beste oplossing te raken.
    const bestHit = hitBy(p, best.solution);
    const routes = [greedy(p).placements, solve(p, p.mirrors - 1).solution, []];
    let next: Puzzle | null = null;
    for (const r of routes) if (!next) next = placeFilter(p, r, rng, bestHit, 1);
    if (!next || hitBy(next, best.solution).size < best.max) return null;
    p = next;
  }

  const q = meetsQuality(p, S);
  if (!q.ok) return null;
  const finalHit = hitBy(p, q.solution);
  const unhit = p.cells.filter((c, i) => c.kind === 'crystal' && !finalHit.has(i)).length;
  if (unhit > GEN_V2.lures[1]) return null;

  if (plan !== 'none') {
    const blocked = solve(withoutFilters(p)).max;
    if (plan === 'needed') {
      if (blocked >= q.max) return null;
      const colouredHit = p.cells.filter((c, i) => c.kind === 'crystal' && c.color !== 'white' && finalHit.has(i)).length;
      if (colouredHit < 2) return null;
    } else {
      if (blocked < q.max) return null;
      // Verleidelijk: via het filter haal je bijna het maximum.
      if (colouredRouteScore(p) < q.max - 2) return null;
    }
  }
  return { puzzle: p, max: q.max, solution: q.solution, gap: q.max - greedy(p).score };
}

function search(seed: number, S: GenSettings, plan: FilterPlan): Candidate | null {
  let best: Candidate | null = null;
  let found = 0;
  // Een lokfilter is een extraatje: niet eindeloos zoeken, anders wordt het gewoon een puzzel zonder filter.
  const attempts = plan === 'decoy' ? Math.min(S.attempts, S.decoyAttempts ?? GEN_V2.decoyAttempts) : S.attempts;
  const wanted = plan === 'decoy' ? 1 : (S.candidates ?? GEN_V2.candidates);
  for (let a = 0; a < attempts && found < wanted; a++) {
    const c = attempt(createRng(hashSeed(seed, 'v2', plan, a)), S, plan);
    if (!c) continue;
    found++;
    if (!best || c.gap > best.gap) best = c;
  }
  return best;
}

/** Voorspelbare v2-puzzel voor een seed (standaard: dagpuzzel-instellingen). */
export function generateV2(seed: number, settings: GenSettings = DAILY): GeneratedV2 {
  // Lukt een lokfilter niet, dan een filter dat nodig is; lukt dat niet, dan zonder filter.
  const order: FilterPlan[] = { none: ['none'], needed: ['needed', 'none'], decoy: ['decoy', 'needed', 'none'] }[planFor(seed, settings)] as FilterPlan[];
  for (const plan of order) {
    const c = search(seed, settings, plan);
    if (c) return { puzzle: c.puzzle, max: c.max, solution: c.solution, source: 'generated', filter: plan };
  }
  const puzzle = fallbackFor(settings);
  const { max, solution } = solve(puzzle);
  const filter: FilterPlan = !puzzle.cells.some((x) => x.kind === 'filter') ? 'none' : solve(withoutFilters(puzzle)).max < max ? 'needed' : 'decoy';
  return { puzzle, max, solution, source: 'fallback', filter };
}
