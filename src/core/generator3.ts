import { DAILY, GEN_V3, type GenSettings } from '../config';
import { score, trace } from './beam';
import type { Generated } from './generator';
import { generateV2, withoutFilters } from './generator2';
import { greedy } from './greedy';
import { createRng, hashSeed, type Rng } from './rng';
import { solveWithin } from './solver';
import { validatePuzzle } from './validate';
import { DX, DY, FILTER_COLORS, REFLECT } from './types';
import type { BeamColor, Cell, Dir, FilterColor, MirrorKind, Placement, Puzzle } from './types';

/**
 * Generator versie 3 (zie GEN_V3): eerst de route, dan de puzzel.
 *
 * v1 en v2 strooien stukken en kijken achteraf of het een goede puzzel is. Daardoor doen veel
 * stukken niet mee. v3 draait het om:
 * 1. kies een thema (lange schoten, slinger, kruising, prisma, kleur, kaatsbaan);
 * 2. leg een route: bron, spiegels en eventueel prisma/vaste spiegels, zo dat elk stuk geraakt wordt;
 * 3. zet kristallen op de route (bij een filter: daarachter in de filterkleur);
 * 4. laat de solver zoeken naar iets beters en zet daar een muur neer (elke muur heeft dus een reden);
 * 5. leg een paar lokkertjes op verleidelijke plekken naast de route;
 * 6. keur: de gewone kwaliteitseisen, plus "elk prisma, filter en elke vaste spiegel is nodig".
 * Lukt het niet binnen GEN_V3.attempts pogingen, dan valt v3 terug op generator v2.
 */
export type Theme = 'schoten' | 'slinger' | 'kruising' | 'prisma' | 'kleur' | 'kaats';
export const THEMES: readonly Theme[] = ['schoten', 'slinger', 'kruising', 'prisma', 'kleur', 'kaats'];
/** Namen voor in de bouwer. */
export const THEME_NAMES: Record<Theme, string> = {
  schoten: 'Lange schoten', slinger: 'Slinger', kruising: 'Kruising', prisma: 'Prisma', kleur: 'Kleur', kaats: 'Kaatsbaan',
};
const PLAIN: readonly Theme[] = ['schoten', 'slinger', 'kruising'];

export interface GeneratedV3 extends Generated {
  /** Het thema; null als v3 niets vond en generator v2 de puzzel leverde. */
  theme: Theme | null;
  /** Celindex van een lokstuk (prisma, vaste spiegel of filter dat verleidt maar niet nodig is), anders null. */
  decoy: number | null;
}

interface Features {
  /** Kortste stuk straal na een bocht. */
  minLeg: number;
  /** Spelersspiegels. */
  mirrors: number;
  fixed: number;
  prism: boolean;
  filter: boolean;
  /** De route moet zichzelf kruisen. */
  cross: boolean;
  /** Kristallen in rijtjes op één lijn. */
  runs: boolean;
  /** Hoogste aantal kristallen in één rij of kolom. */
  lineCap: number;
}

const range = (rng: Rng, r: readonly [number, number]) => rng.int(r[0], r[1]);
const withCells = (p: Puzzle, cells: Cell[]): Puzzle => ({ ...p, cells });
const swap = (p: Puzzle, i: number, c: Cell): Puzzle => withCells(p, p.cells.map((x, j) => (j === i ? c : x)));
const WALL: Cell = { kind: 'wall' };
const EMPTY: Cell = { kind: 'empty' };

interface Pass { colors: Set<BeamColor>; dirs: Set<Dir> }

/** Elk vak waar de straal doorheen gaat (in straalvolgorde), met de kleuren en richtingen waarin dat gebeurt. */
function beamMap(p: Puzzle, placements: readonly Placement[]): Map<number, Pass> {
  const out = new Map<number, Pass>();
  for (const s of trace(p, placements).segments) {
    const dx = Math.sign(s.to.x - s.from.x), dy = Math.sign(s.to.y - s.from.y);
    const dir = (dx === 1 ? 0 : dy === 1 ? 1 : dx === -1 ? 2 : 3) as Dir;
    const len = Math.floor(Math.abs(s.to.x - s.from.x) + Math.abs(s.to.y - s.from.y));
    for (let k = 0; k <= len; k++) {
      const x = Math.floor(s.from.x + dx * k), y = Math.floor(s.from.y + dy * k);
      if (x < 0 || y < 0 || x >= p.width || y >= p.height) continue;
      const i = y * p.width + x;
      let pass = out.get(i);
      if (!pass) out.set(i, (pass = { colors: new Set(), dirs: new Set() }));
      pass.colors.add(s.color);
      pass.dirs.add(dir);
    }
  }
  return out;
}

type Extra = 'prism' | 'filter' | 'fixed';
const THEME_EXTRA: Partial<Record<Theme, Extra>> = { prisma: 'prism', kleur: 'filter', kaats: 'fixed' };

/** `skip`: een soort die niet als gewoon stuk mag meedoen (omdat die straks als lokstuk komt). */
function featuresFor(theme: Theme, rng: Rng, S: GenSettings, skip: Extra | null): Features {
  const [lo, hi] = S.mirrors;
  const mid = Math.floor((lo + hi) / 2);
  const f: Features = { minLeg: 1, mirrors: range(rng, S.mirrors), fixed: 0, prism: false, filter: false, cross: false, runs: false, lineCap: 2 };
  if (theme === 'schoten') { f.minLeg = Math.min(3, Math.floor(Math.min(S.width, S.height) / 2)); f.mirrors = rng.int(lo, mid); f.runs = true; }
  if (theme === 'slinger') f.mirrors = rng.int(Math.max(lo, mid), hi);
  if (theme === 'kruising') { f.cross = true; f.minLeg = 2; }
  if (theme === 'prisma') f.prism = true;
  if (theme === 'kleur') f.filter = true;
  if (theme === 'kaats') { f.fixed = rng.int(Math.min(2, S.fixedMirrors[1]), S.fixedMirrors[1]); f.mirrors = rng.int(lo, Math.max(lo, mid)); }
  // Daarnaast, net als in v2, een aantal extra elementsoorten (S.extras); het thema-element telt mee.
  const has = { prism: f.prism, filter: f.filter, fixed: f.fixed > 0 };
  const want = S.extras[1] === 0 ? 0 : range(rng, S.extras);
  for (const k of rng.shuffle<Extra>(['prism', 'filter', 'fixed'])) {
    if (Object.values(has).filter(Boolean).length >= want) break;
    if (has[k] || k === skip) continue;
    has[k] = true;
    if (k === 'prism') f.prism = true;
    else if (k === 'filter') f.filter = true;
    else f.fixed = rng.int(1, Math.min(2, S.fixedMirrors[1]));
  }
  // Hoeveel kristallen er hooguit in één rij of kolom liggen: meestal 2, soms 3; bij lange schoten meer.
  f.lineCap = f.runs ? rng.int(3, 4) : rng.next() < 0.3 ? 3 : 2;
  return f;
}

interface Route { puzzle: Puzzle; mirrors: Placement[] }

/** Legt de bron en daarna bocht voor bocht de route. Geeft null als het niet past. */
function layRoute(rng: Rng, S: GenSettings, F: Features): Route | null {
  const { width: w, height: h } = S;
  const cells: Cell[] = Array.from({ length: w * h }, () => EMPTY);
  const side = rng.int(0, 3);
  let sx: number, sy: number, dir: Dir;
  if (side === 0) { sx = 0; sy = rng.int(1, h - 2); dir = 0; }
  else if (side === 1) { sx = rng.int(1, w - 2); sy = 0; dir = 1; }
  else if (side === 2) { sx = w - 1; sy = rng.int(1, h - 2); dir = 2; }
  else { sx = rng.int(1, w - 2); sy = h - 1; dir = 3; }
  cells[sy * w + sx] = { kind: 'source', dir };

  // Muren vooraf, als terrein: de route buigt eromheen of stopt ertegen. Wat ver van alles ligt, gaat later weer weg.
  const front = new Set([1, 2].map((k) => (sy + DY[dir] * k) * w + sx + DX[dir] * k));
  const free = rng.shuffle(cells.flatMap((c, i) => (c.kind === 'empty' && !front.has(i) ? [i] : [])));
  for (let k = range(rng, S.walls) + GEN_V3.extraWalls; k > 0; k--) cells[free.pop()!] = WALL;

  let p: Puzzle = { version: 1, width: w, height: h, mirrors: F.mirrors, cells };
  const mirrors: Placement[] = [];
  const turns: number[] = [];
  const taken = () => new Set(mirrors.map((m) => m.y * w + m.x));

  /** Aantal vrije vakken vanaf vak `i` in richting `d`. */
  const freeRun = (i: number, d: Dir): number => {
    const block = taken();
    let x = i % w, y = Math.floor(i / w), n = 0;
    for (;;) {
      x += DX[d]; y += DY[d];
      if (x < 0 || y < 0 || x >= w || y >= h) return n;
      const j = y * w + x;
      if (p.cells[j].kind !== 'empty' || block.has(j)) return n;
      n++;
    }
  };

  const kinds: ('m' | 'f' | 'p')[] = rng.shuffle([...Array(F.mirrors).fill('m'), ...Array(F.fixed).fill('f')]);
  if (F.prism) kinds.splice(rng.int(0, Math.max(0, Math.min(2, kinds.length - 2))), 0, 'p');

  for (const kind of kinds) {
    const map = beamMap(p, mirrors);
    const block = taken();
    const spots = rng.shuffle([...map].filter(([i, pass]) => p.cells[i].kind === 'empty' && !block.has(i) && pass.dirs.size === 1).map(([i, pass]) => ({ i, d: [...pass.dirs][0] })));
    let placed = false;
    for (const { i, d } of spots) {
      const tries: { p: Puzzle; mirrors: Placement[] }[] = [];
      if (kind === 'p') {
        if (freeRun(i, ((d + 1) % 4) as Dir) >= 2 && freeRun(i, ((d + 3) % 4) as Dir) >= 2) tries.push({ p: swap(p, i, { kind: 'prism' }), mirrors });
      } else {
        for (const m of rng.shuffle<MirrorKind>(['/', '\\'])) {
          if (freeRun(i, REFLECT[m][d]) < F.minLeg) continue;
          if (kind === 'f') tries.push({ p: swap(p, i, { kind: 'fixedMirror', mirror: m }), mirrors });
          else tries.push({ p, mirrors: [...mirrors, { x: i % w, y: Math.floor(i / w), mirror: m }] });
        }
      }
      for (const t of tries) {
        // Elke eerdere bocht moet nog steeds geraakt worden.
        const next = beamMap(t.p, t.mirrors);
        if (!turns.every((c) => next.has(c))) continue;
        p = t.p;
        mirrors.splice(0, mirrors.length, ...t.mirrors);
        turns.push(i);
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed) return null;
  }
  // De route moet het veld gebruiken, niet in één hoek blijven hangen.
  const xs = [...beamMap(p, mirrors).keys()].map((i) => i % w), ys = [...beamMap(p, mirrors).keys()].map((i) => Math.floor(i / w));
  if (Math.max(...xs) - Math.min(...xs) + 1 < Math.ceil(w * GEN_V3.spread) || Math.max(...ys) - Math.min(...ys) + 1 < Math.ceil(h * GEN_V3.spread)) return null;
  if (F.cross && ![...beamMap(p, mirrors)].some(([i, pass]) => pass.dirs.size > 1 && p.cells[i].kind === 'empty' && !taken().has(i))) return null;
  return { puzzle: p, mirrors };
}

/** Zet (bij een kleurthema) het filter en daarna de kristallen op de route. */
function addCrystals(route: Route, rng: Rng, S: GenSettings, F: Features): Puzzle | null {
  let p = route.puzzle;
  const taken = new Set(route.mirrors.map((m) => m.y * p.width + m.x));
  const spotsOf = (q: Puzzle) => [...beamMap(q, route.mirrors)].filter(([i]) => q.cells[i].kind === 'empty' && !taken.has(i));

  if (F.filter) {
    const before = spotsOf(p).filter(([, pass]) => pass.dirs.size === 1).map(([i]) => i);
    // Niet vooraan (er moet eerst wit te halen zijn) en niet achteraan (er moet nog kleur te halen zijn).
    const options = rng.shuffle(before.slice(2, Math.max(2, before.length - 3)));
    const color = rng.pick<FilterColor>(FILTER_COLORS);
    let done = false;
    for (const i of options.slice(0, 6)) {
      const q = swap(p, i, { kind: 'filter', color });
      const s = spotsOf(q);
      const coloured = s.filter(([, pass]) => pass.colors.has(color)).length;
      if (coloured >= 3 && s.length - coloured >= 2) { p = q; done = true; break; }
    }
    if (!done) return null;
  }

  const spots = spotsOf(p);
  const w = p.width;
  const want = range(rng, [S.maxScore[0] + 1, S.maxScore[1]]);
  const rows = new Map<number, number>(), cols = new Map<number, number>();
  const chosen = new Set<number>();
  const take = (k: number, cap: number): boolean => {
    if (chosen.has(k) || chosen.size >= want) return false;
    const x = spots[k][0] % w, y = Math.floor(spots[k][0] / w);
    if ((rows.get(y) ?? 0) >= cap || (cols.get(x) ?? 0) >= cap) return false;
    rows.set(y, (rows.get(y) ?? 0) + 1);
    cols.set(x, (cols.get(x) ?? 0) + 1);
    chosen.add(k);
    return true;
  };
  if (F.runs) {
    // Een of twee rijtjes van 3-4 op elkaar volgende routevakken.
    for (let n = rng.int(1, 2); n > 0; n--) {
      const start = rng.int(0, Math.max(0, spots.length - 4));
      for (let k = 0, len = rng.int(3, 4); k < len && start + k < spots.length; k++) take(start + k, F.lineCap);
    }
  }
  // De rest gespreid over de route, met hooguit een paar per rij en kolom.
  const spread = F.runs ? 2 : F.lineCap;
  for (const k of rng.shuffle(spots.map((_, n) => n))) take(k, spread);
  if (chosen.size < S.maxScore[0]) return null;

  const cells = [...p.cells];
  let whiteTrap = F.filter ? 1 : 0;
  spots.forEach(([i, pass], k) => {
    const colors = [...pass.colors];
    if (chosen.has(k)) cells[i] = { kind: 'crystal', color: colors[rng.int(0, colors.length - 1)] };
    // Een wit kristal op het gekleurde stuk: de straal gaat erdoorheen, maar het telt niet.
    else if (whiteTrap > 0 && !pass.colors.has('white') && (rows.get(Math.floor(i / w)) ?? 0) < spread && (cols.get(i % w) ?? 0) < spread) {
      cells[i] = { kind: 'crystal', color: 'white' };
      whiteTrap--;
    }
  });
  return withCells(p, cells);
}

interface Candidate { puzzle: Puzzle; max: number; solution: Placement[]; decoy: number | null }

/**
 * Lokstuk: een prisma, vaste spiegel of filter op een voor de hand liggende (maar mindere) route,
 * met een paar eigen kristallen erachter. Verleidelijk: via het lokstuk haal je bijna het maximum.
 * Niet nodig: de echte route raakt het niet en het maximum blijft gelijk.
 */
function addDecoy(
  p: Puzzle, plan: readonly Placement[], alts: readonly (readonly Placement[])[], kind: Extra, rng: Rng, designed: number,
  freeOff: (q: Puzzle, i: number) => boolean, search: (q: Puzzle) => { max: number; exact: boolean },
): { puzzle: Puzzle; cell: number } | null {
  const w = p.width;
  let searches = 0;
  for (const alt of alts) {
    const altBeam = beamMap(p, alt);
    const altKeep = new Set(alt.map((m) => m.y * w + m.x));
    const open = (q: Puzzle, i: number) => freeOff(q, i) && !altKeep.has(i);
    const spots = rng.shuffle([...altBeam].filter(([i, pass]) => open(p, i) && pass.dirs.size === 1).map(([i]) => i)).slice(0, 8);
    for (const i of spots) {
      const variants: Cell[] = kind === 'prism' ? [{ kind: 'prism' }]
        : kind === 'fixed' ? rng.shuffle<Cell>([{ kind: 'fixedMirror', mirror: '/' }, { kind: 'fixedMirror', mirror: '\\' }])
        : [{ kind: 'filter', color: rng.pick<FilterColor>(FILTER_COLORS) }];
      for (const v of variants) {
        const q = swap(p, i, v);
        const color = v.kind === 'filter' ? v.color : null;
        // Vakken die de lokroute door het lokstuk erbij krijgt (bij een filter: het gekleurde stuk erachter).
        const gained = [...beamMap(q, alt)]
          .filter(([j, pass]) => j !== i && open(q, j) && (color ? pass.colors.has(color) : !altBeam.has(j)))
          .map(([j, pass]) => ({ j, color: color ?? [...pass.colors][0] }));
        if (gained.length < 2) continue;
        const picks = rng.shuffle(gained).slice(0, rng.int(2, 3));
        let made = q;
        for (const g of picks) made = swap(made, g.j, { kind: 'crystal', color: g.color });
        if (trace(made, plan).score !== designed) continue;
        const lure = trace(made, alt);
        if (lure.score < designed - GEN_V3.decoyGap || !picks.some((g) => lure.hit.has(g.j))) continue;
        // Oplossen is het dure deel: na een paar mislukte kandidaten geen lokstuk.
        if (++searches > 5) return null;
        const best = search(made);
        if (!best.exact || best.max !== designed) continue;
        return { puzzle: made, cell: i };
      }
    }
  }
  return null;
}

/** Gulzig spelen blijft genoeg achter, en zonder spiegels raak je nog niet de helft. */
function hardEnough(p: Puzzle, S: GenSettings, max: number, withDecoy = false): boolean {
  if (score(p, new Map()) * 2 >= max) return false;
  // Met een lokstuk mag gulzig spelen dichterbij komen: de lokroute is juist bijna goed.
  return max - greedy(p).score >= (S.extras[1] === 0 || withDecoy ? 1 : GEN_V3.minGap);
}

function attempt(rng: Rng, S: GenSettings, theme: Theme): Candidate | null {
  // Soms komt er een lokstuk bij; nooit van de soort van het thema.
  const decoyKind: Extra | null = S.extras[1] > 0 && rng.next() < (S.width * S.height > 63 ? GEN_V3.decoyChanceLarge : GEN_V3.decoyChance)
    ? rng.pick((['prism', 'filter', 'fixed'] as Extra[]).filter((k) => k !== THEME_EXTRA[theme]))
    : null;
  const F = featuresFor(theme, rng, S, decoyKind);
  // Routes leggen is goedkoop (geen solver), dus een paar keer proberen voor het dure werk begint.
  let route: Route | null = null;
  let p: Puzzle | null = null;
  for (let k = 0; k < 40 && !p; k++) {
    route = layRoute(rng, S, F);
    p = route && addCrystals(route, rng, S, F);
  }
  if (!p || !route) return null;
  const plan = route.mirrors;
  const designed = trace(p, plan).score;
  if (designed < S.maxScore[0] || designed > S.maxScore[1]) return null;

  // Terreinmuren die nergens aan de route grenzen, doen niets en gaan weg.
  {
    const beam = beamMap(p, plan);
    const w = p.width, h = p.height;
    const nearRoute = (i: number) => {
      const x = i % w, y = Math.floor(i / w);
      // Ook schuin ernaast telt: zo'n muur staat nog in de weg van een spiegel naast de route.
      for (let ny = y - 1; ny <= y + 1; ny++) {
        for (let nx = x - 1; nx <= x + 1; nx++) {
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && beam.has(ny * w + nx)) return true;
        }
      }
      return false;
    };
    p = withCells(p, p.cells.map((c, i) => (c.kind === 'wall' && !nearRoute(i) ? EMPTY : c)));
  }
  if (!hardEnough(p, S, designed)) return null;

  const onRoute = beamMap(p, plan);
  const keep = new Set(plan.map((m) => m.y * p!.width + m.x));
  const freeOff = (q: Puzzle, i: number) => q.cells[i].kind === 'empty' && !onRoute.has(i) && !keep.has(i);
  // Zoeken met een grens: een veld waar de solver eindeloos op zoekt, is ook voor de telefoon te zwaar.
  const search = (q: Puzzle, mirrors = q.mirrors) => solveWithin(q, mirrors, q.cells.length > 63 ? GEN_V3.budgetLarge : GEN_V3.budget);

  // Vindt de solver iets beters dan de route? Zet daar een muur. Zo heeft elke muur een reden.
  let best = search(p);
  for (let k = 0; k < 6 && best.exact && best.max > designed; k++) {
    const q: Puzzle = p;
    const theirs = best.solution.map((m) => m.y * q.width + m.x).filter((i) => freeOff(q, i));
    const beam = [...beamMap(q, best.solution).keys()].filter((i) => freeOff(q, i));
    const options = theirs.length ? theirs : beam;
    if (!options.length) return null;
    p = swap(q, rng.pick(options), WALL);
    best = search(p);
  }
  if (!best.exact || best.max !== designed) return null;
  // Alle spiegels moeten nodig zijn. (Lokkertjes kunnen dit nog veranderen; daarom straks nog eens.)
  const fewer = search(p, p.mirrors - 1);
  if (!fewer.exact || fewer.max >= designed) return null;

  // Het slot (lokkertjes en keuring) als functie: mislukt het mét lokstuk, dan nog eens zonder.
  const finish = (start: Puzzle, decoy: number | null): Candidate | null => {
  let p: Puzzle = start;
  // Lokkertjes op plekken waar een voor de hand liggende (maar mindere) speelwijze langskomt.
  const tempting = new Set<number>();
  for (const pl of [greedy(p).placements, fewer.solution, [] as Placement[]]) {
    for (const i of beamMap(p, pl).keys()) if (freeOff(p, i)) tempting.add(i);
  }
  const planHit = trace(p, plan).hit;
  const already = p.cells.filter((c, i) => c.kind === 'crystal' && !planHit.has(i)).length;
  const lureCount = Math.max(0, range(rng, GEN_V3.lures) - already);
  const others = p.cells.flatMap((_, i) => (freeOff(p!, i) && !tempting.has(i) ? [i] : []));
  const rowN = new Map<number, number>(), colN = new Map<number, number>();
  p.cells.forEach((c, i) => {
    if (c.kind !== 'crystal') return;
    rowN.set(Math.floor(i / p!.width), (rowN.get(Math.floor(i / p!.width)) ?? 0) + 1);
    colN.set(i % p!.width, (colN.get(i % p!.width) ?? 0) + 1);
  });
  const picks: number[] = [];
  for (const i of [...rng.shuffle([...tempting]), ...rng.shuffle(others)]) {
    if (picks.length >= lureCount) break;
    const x = i % p.width, y = Math.floor(i / p.width);
    // Lokkertjes maken een rij of kolom niet voller dan de kristallen op de route.
    if ((rowN.get(y) ?? 0) >= Math.max(2, F.lineCap) || (colN.get(x) ?? 0) >= Math.max(2, F.lineCap)) continue;
    rowN.set(y, (rowN.get(y) ?? 0) + 1);
    colN.set(x, (colN.get(x) ?? 0) + 1);
    picks.push(i);
  }
  const lureColors: BeamColor[] = ['white', ...p.cells.flatMap((c) => (c.kind === 'filter' ? [c.color] : []))];
  let lures = new Set(picks);
  const base: Puzzle = p;
  const withLures = () => withCells(base, base.cells.map((c, i) => (lures.has(i) ? ({ kind: 'crystal', color: lureColors[i % lureColors.length] } as Cell) : c)));
  p = withLures();
  best = search(p);
  for (let k = 0; k < 3 && best.exact && best.max > designed; k++) {
    // Een lokkertje maakte een betere route mogelijk: haal weg wat die route raakt.
    const hit = trace(p, best.solution).hit;
    lures = new Set([...lures].filter((i) => !hit.has(i)));
    p = withLures();
    best = search(p);
  }
  if (!best.exact || best.max !== designed) return null;
  if (!hardEnough(p, S, designed, decoy !== null)) return null;
  if (lures.size > 0 || decoy !== null) {
    const again = search(p, p.mirrors - 1);
    if (!again.exact || again.max >= designed) return null;
  }

  // Het element van het thema moet nodig zijn voor het maximum; een bijkomend stuk moet in elk geval
  // meedoen in de beste oplossing (zonder dat stuk raakt die oplossing minder).
  const needed = (q: Puzzle) => { const r = search(q); return r.exact && r.max < designed; };
  const used = (q: Puzzle) => trace(q, best.solution).score < designed;
  for (let i = 0; i < p.cells.length; i++) {
    const kind = p.cells[i].kind;
    if ((kind !== 'prism' && kind !== 'fixedMirror') || i === decoy) continue;
    const strict = kind === 'prism' ? theme === 'prisma' : theme === 'kaats';
    if (!(strict ? needed : used)(swap(p, i, WALL))) return null;
  }
  if (p.cells.some((c, i) => c.kind === 'filter' && i !== decoy) && !needed(withoutFilters(p))) return null;
  // Het lokstuk mag door de lokkertjes niet alsnog nodig zijn geworden.
  if (decoy !== null) { const r = search(swap(p, decoy, WALL)); if (!r.exact || r.max !== designed) return null; }
  if (validatePuzzle(p).length) return null;
  return { puzzle: p, max: best.max, solution: best.solution, decoy };
  };

  if (decoyKind) {
    // Lokroutes: de echte route met één spiegel minder (je slaat een bocht over), en de beste route met een spiegel minder.
    const shorter = rng.shuffle(plan.map((_, k) => plan.filter((__, n) => n !== k)));
    const made = addDecoy(p, plan, [...shorter, fewer.solution, greedy(p).placements], decoyKind, rng, designed, freeOff, search);
    const c = made && finish(made.puzzle, made.cell);
    if (c) return c;
  }
  return finish(p, null);
}

/** Het thema van een seed. Niveaus zonder extra's (Makkelijk) krijgen alleen de kale thema's. */
export function themeFor(seed: number, S: GenSettings): Theme {
  const r = createRng(hashSeed(seed, 'v3-thema'));
  return r.pick(S.extras[1] === 0 ? PLAIN : THEMES);
}

/**
 * Voorspelbare v3-puzzel voor een seed (standaard: dagpuzzel-instellingen).
 * Met `chosen` (de bouwer) wordt dat thema gebouwd in plaats van het thema van de seed.
 */
export function generateV3(seed: number, settings: GenSettings = DAILY, chosen?: Theme): GeneratedV3 {
  const theme = chosen ?? themeFor(seed, settings);
  for (let a = 0; a < GEN_V3.attempts; a++) {
    const c = attempt(createRng(hashSeed(seed, 'v3', theme, a)), settings, theme);
    if (c) return { puzzle: c.puzzle, max: c.max, solution: c.solution, source: 'generated', theme, decoy: c.decoy };
  }
  const g = generateV2(seed, settings);
  return { puzzle: g.puzzle, max: g.max, solution: g.solution, source: g.source, theme: null, decoy: null };
}
