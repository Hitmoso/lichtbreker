import type { BeamColor, Dir, FilterColor, MirrorKind } from '../core/types';
import { facetLines, innerPoints, outlinePath, pathOf } from '../render/shapes';
import type { Tool, Variants } from './tools';

/** Kleuren als in het spel (theme.css / tokens.ts). */
export const HEX: Record<BeamColor, string> = { white: '#cff4ff', red: '#ff5470', green: '#3df5a0', blue: '#4fa8ff' };
export const COLOR_NAMES: Record<BeamColor, string> = { white: 'Wit', red: 'Rood', green: 'Groen', blue: 'Blauw' };
export const DIR_NAMES: Record<Dir, string> = { 0: 'Naar rechts', 1: 'Naar beneden', 2: 'Naar links', 3: 'Naar boven' };
export const TOOL_NAMES: Record<Tool, string> = {
  wall: 'Muur', crystal: 'Kristal', mirror: 'Spiegel', prism: 'Prisma', filter: 'Filter', source: 'Bron', eraser: 'Gum',
};

const svg = (inner: string, size = 26) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

/** Kristal zoals in het veld (shapes.ts): omtrek, facetlijnen en een helder middenvlak. */
function gem(color: BeamColor, cx: number, cy: number, r: number, emblem = false): string {
  const c = HEX[color];
  if (emblem) return `<path d="${outlinePath(color, cx, cy, r)}" fill="${c}" fill-opacity="0.25" stroke="${c}" stroke-width="1.6"/>`;
  const lines = facetLines(color, cx, cy, r).map(([x1, y1, x2, y2]) => `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`).join('');
  return `<path d="${outlinePath(color, cx, cy, r)}" fill="${c}" fill-opacity="0.2" stroke="${c}" stroke-width="1.5"/>`
    + `<path d="${lines}" stroke="${c}" stroke-opacity="0.6" stroke-width="0.7"/>`
    + `<path d="${pathOf(innerPoints(color, cx, cy, r))}" fill="${c}" fill-opacity="0.5" stroke="#fff" stroke-opacity="0.75" stroke-width="0.7"/>`;
}

export function crystalSvg(color: BeamColor, size = 26): string {
  return svg(gem(color, 12, 12, 9.5), size);
}

/** Filter: gekleurd ruitje met de kristalvorm van die kleur in het midden. */
export function filterSvg(color: FilterColor, size = 26): string {
  const c = HEX[color];
  return svg(`<rect x="3" y="3" width="18" height="18" rx="4" fill="${c}" fill-opacity="0.16" stroke="${c}" stroke-width="1.6"/>${gem(color, 12, 12, 5.4, true)}`, size);
}

/** Vaste spiegel: op een plaatje met boutjes. */
export function mirrorSvg(m: MirrorKind, size = 26): string {
  const y1 = m === '/' ? 17.5 : 6.5, y2 = m === '/' ? 6.5 : 17.5;
  return svg(`<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="#1c2756" stroke="#5a6db3" stroke-width="1.3"/>`
    + `<path d="M6.5 ${y1} 17.5 ${y2}" stroke="#aab6e8" stroke-width="2.6"/>`
    + `<circle cx="6.5" cy="${y1}" r="1.6" fill="#5a6db3"/><circle cx="17.5" cy="${y2}" r="1.6" fill="#5a6db3"/>`, size);
}

/** Bron: lampje met een loop in de schietrichting. */
export function sourceSvg(dir: Dir, size = 26): string {
  const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir];
  const bx = 12 - dx * 1.5, by = 12 - dy * 1.5;
  const nw = dx ? 6.5 : 5.5, nh = dx ? 5.5 : 6.5;
  return svg(`<rect x="${12 + dx * 6.2 - nw / 2}" y="${12 + dy * 6.2 - nh / 2}" width="${nw}" height="${nh}" rx="1.2" fill="#141e48" stroke="#ffb938" stroke-width="1.3"/>`
    + `<circle cx="${bx}" cy="${by}" r="7" fill="#141e48" stroke="#ffb938" stroke-width="1.6"/><circle cx="${bx}" cy="${by}" r="3" fill="#ffe8b0"/>`, size);
}

const WALL = svg('<rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="#1c2756" stroke="#5a6db3" stroke-width="1.5"/><path d="M4 12h16M12 6.5V12M7.5 12v5.5M16.5 12v5.5" stroke="#5a6db3" stroke-opacity="0.6" stroke-width="1"/>');
const PRISM = svg('<defs><linearGradient id="ico-spectrum" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5470"/><stop offset=".35" stop-color="#ffb938"/><stop offset=".65" stop-color="#3df5a0"/><stop offset="1" stop-color="#4fa8ff"/></linearGradient></defs>'
  + '<path d="M12 4 20 18.5H4Z" fill="#fff" fill-opacity="0.1" stroke="#fff" stroke-width="1.6"/><path d="M12 9.6 16.6 18H7.4Z" fill="url(#ico-spectrum)" fill-opacity="0.85"/>');
const ERASER = svg('<path d="M14.5 5.5 19 10l-8 8H6.5L5 16.5a1.5 1.5 0 0 1 0-2.1Z" fill="#141e48" stroke="#8d97c8" stroke-width="2"/><path d="m10 9 5 5M11 18h8" stroke="#8d97c8" stroke-width="2"/>');

/** Icoon van een gereedschap, in de gekozen kleur/stand. */
export function toolSvg(tool: Tool, v: Variants): string {
  switch (tool) {
    case 'wall': return WALL;
    case 'crystal': return crystalSvg(v.crystal);
    case 'mirror': return mirrorSvg(v.mirror);
    case 'prism': return PRISM;
    case 'filter': return filterSvg(v.filter);
    case 'source': return sourceSvg(v.source);
    case 'eraser': return ERASER;
  }
}

export const ICON = {
  back: svg('<path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2.2"/>', 22),
  undo: svg('<path d="M9 7 4.5 11.5 9 16" stroke="currentColor" stroke-width="2"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" stroke="currentColor" stroke-width="2"/>', 22),
  redo: svg('<path d="m15 7 4.5 4.5L15 16" stroke="currentColor" stroke-width="2"/><path d="M19 11.5h-9a5 5 0 0 0 0 10h2" stroke="currentColor" stroke-width="2"/>', 22),
  play: svg('<path d="M8 5.5v13l10.5-6.5Z" fill="currentColor"/>', 20),
  share: svg('<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" stroke="currentColor" stroke-width="2"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" stroke="currentColor" stroke-width="2"/>', 20),
  more: svg('<circle cx="6" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="18" cy="12" r="1.8" fill="currentColor"/>', 22),
} as const;
