import type { BeamColor, Dir, FilterColor, MirrorKind } from '../core/types';
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

/** Kristalvorm per kleur (zoals crystalShape in het veld: ruit, driehoek, zeshoek, cirkel). */
export function crystalSvg(color: BeamColor, size = 26): string {
  const c = HEX[color];
  const style = `fill="${c}" fill-opacity="0.28" stroke="${c}" stroke-width="2"`;
  switch (color) {
    case 'white': return svg(`<path d="M12 4 18 12 12 20 6 12Z" ${style}/>`, size);
    case 'red': return svg(`<path d="M12 5 19.5 18H4.5Z" ${style}/>`, size);
    case 'green': return svg(`<path d="M12 4.5 18.5 8.25v7.5L12 19.5 5.5 15.75v-7.5Z" ${style}/>`, size);
    case 'blue': return svg(`<circle cx="12" cy="12" r="6.5" ${style}/>`, size);
  }
}

export function filterSvg(color: FilterColor, size = 26): string {
  const c = HEX[color];
  return svg(`<rect x="4" y="4" width="16" height="16" rx="4" fill="${c}" fill-opacity="0.18" stroke="${c}" stroke-width="2"/><circle cx="12" cy="12" r="2.4" fill="${c}"/>`, size);
}

export function mirrorSvg(m: MirrorKind, size = 26): string {
  const d = m === '/' ? 'M6.5 17.5 17.5 6.5' : 'M6.5 6.5 17.5 17.5';
  return svg(`<path d="${d}" stroke="#9aa6d8" stroke-width="3"/><circle cx="${m === '/' ? 6.5 : 6.5}" cy="${m === '/' ? 17.5 : 6.5}" r="1.6" fill="#5a6db3"/><circle cx="17.5" cy="${m === '/' ? 6.5 : 17.5}" r="1.6" fill="#5a6db3"/>`, size);
}

export function sourceSvg(dir: Dir, size = 26): string {
  const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir];
  return svg(`<rect x="5" y="5" width="14" height="14" rx="4.5" fill="#141e48" stroke="#ffb938" stroke-width="2"/><circle cx="${12 + dx * 3}" cy="${12 + dy * 3}" r="2.6" fill="#ffe8b0"/>`, size);
}

const WALL = svg('<rect x="4.5" y="4.5" width="15" height="15" rx="3.5" fill="#1c2756" stroke="#5a6db3" stroke-width="2"/><path d="M8 8.5h8" stroke="#5a6db3" stroke-width="1.5" opacity="0.7"/>');
const PRISM = svg('<path d="M12 4.5 19.5 18H4.5Z" fill="#fff" fill-opacity="0.08" stroke="#fff" stroke-width="2"/><path d="M9.5 15 13 11" stroke="#ff5470" stroke-width="1.4"/><path d="M10.5 15.5 14.5 12" stroke="#ffb938" stroke-width="1.4"/><path d="M11.5 16 16 13" stroke="#3df5a0" stroke-width="1.4"/>');
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
