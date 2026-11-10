import type { BeamColor, Cell, ElementKind, Puzzle } from '../../core/types';
import { innerPoints, outlinePath, pathOf } from '../../render/shapes';
import { h } from '../dom';
import { openSheet } from '../sheet';

type HelpKind = 'mirror' | 'crystal' | 'coloredCrystal' | 'wall' | ElementKind;

const HEX = { white: '#cff4ff', red: '#ff5470', green: '#3df5a0', blue: '#4fa8ff' } as const;
/** Kristal zoals in het veld: omtrek met een helder middenvlak. */
const gem = (color: BeamColor, cx: number, cy: number, r: number) =>
  `<path d="${outlinePath(color, cx, cy, r)}" fill="${HEX[color]}" fill-opacity=".2" stroke="${HEX[color]}" stroke-width="1.5" stroke-linejoin="round"/>`
  + `<path d="${pathOf(innerPoints(color, cx, cy, r))}" fill="${HEX[color]}" fill-opacity=".5" stroke="#fff" stroke-opacity=".75" stroke-width=".7" stroke-linejoin="round"/>`;

const ICON: Record<HelpKind, string> = {
  mirror: '<path d="M6 18 18 6" stroke="#eef2ff" stroke-width="3" stroke-linecap="round"/>',
  crystal: gem('white', 12, 12, 9.5),
  coloredCrystal: gem('red', 6.5, 12, 6.5) + gem('blue', 17.5, 12, 6.5),
  wall: '<rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="#1c2756" stroke="#5a6db3" stroke-width="1.5"/><path d="M4 12h16M12 6.5V12M7.5 12v5.5M16.5 12v5.5" stroke="#5a6db3" stroke-opacity=".6" stroke-width="1"/>',
  fixedMirror: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="#1c2756" stroke="#5a6db3" stroke-width="1.3"/><path d="M6.5 17.5 17.5 6.5" stroke="#aab6e8" stroke-width="2.6" stroke-linecap="round"/><circle cx="6.5" cy="17.5" r="1.6" fill="#5a6db3"/><circle cx="17.5" cy="6.5" r="1.6" fill="#5a6db3"/>',
  prism: '<defs><linearGradient id="help-spectrum" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5470"/><stop offset=".35" stop-color="#ffb938"/><stop offset=".65" stop-color="#3df5a0"/><stop offset="1" stop-color="#4fa8ff"/></linearGradient></defs>'
    + '<path d="M12 4 20 18.5H4Z" fill="rgba(255,255,255,.1)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9.6 16.6 18H7.4Z" fill="url(#help-spectrum)" fill-opacity=".85"/>',
  filter: `<rect x="3" y="3" width="18" height="18" rx="4" fill="rgba(61,245,160,.16)" stroke="#3df5a0" stroke-width="1.6"/><path d="${outlinePath('green', 12, 12, 5.4)}" fill="rgba(61,245,160,.25)" stroke="#3df5a0" stroke-width="1.6" stroke-linejoin="round"/>`,
};

const TEXT: Record<HelpKind, [string, string]> = {
  mirror: ['Spiegel', 'Tik op een leeg vak: eerst ╱, dan ╲, dan weer leeg.'],
  crystal: ['Kristal', 'Licht op als een witte straal erdoorheen gaat. Telt één keer, ook als de straal er vaker langskomt.'],
  coloredCrystal: ['Gekleurd kristal', 'Licht alleen op bij een straal in dezelfde kleur.'],
  wall: ['Muur', 'Houdt de straal tegen.'],
  fixedMirror: ['Vaste spiegel', 'Kaatst de straal, maar zit vast.'],
  prism: ['Prisma', 'Splitst de straal in twee: haaks naar links en naar rechts.'],
  filter: ['Kleurfilter', 'Geeft de straal de kleur van het filter. Daarna lichten alleen kristallen in die kleur op, witte niet meer.'],
};

export const TIP: Record<ElementKind, string> = {
  fixedMirror: 'Vaste spiegel: kaatst de straal, maar zit vast.',
  prism: 'Prisma: splitst de straal in twee.',
  filter: 'Kleurfilter: kleurt de straal. Daarna tellen alleen kristallen in die kleur.',
};

export const elementKinds = (p: Puzzle): ElementKind[] =>
  (['fixedMirror', 'prism', 'filter'] as const).filter((k) => p.cells.some((c) => c.kind === k));

const has = (p: Puzzle, f: (c: Cell) => boolean) => p.cells.some(f);

const icon = (k: HelpKind) => h('span', { class: 'help-icon', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" width="28" height="28">${ICON[k]}</svg>` });

/** Uitleg met alleen de elementen die in deze puzzel zitten. */
export function showHelp(p: Puzzle): void {
  const kinds: HelpKind[] = ['mirror', 'crystal'];
  if (has(p, (c) => c.kind === 'crystal' && c.color !== 'white')) kinds.push('coloredCrystal');
  if (has(p, (c) => c.kind === 'wall')) kinds.push('wall');
  kinds.push(...elementKinds(p));
  const content = h('div', { class: 'help' },
    h('h2', { class: 'sheet-title' }, 'Zo werkt het'),
    h('p', { class: 'sheet-text' }, `Zet tot ${p.mirrors} spiegels zo dat de laser zoveel mogelijk kristallen raakt. Je ziet de straal meteen. Tevreden? Druk op Vuur! Pas daarna zie je hoeveel er maximaal in zat.`),
    h('ul', { class: 'help-list' }, ...kinds.map((k) => h('li', {}, icon(k), h('div', {}, h('strong', {}, TEXT[k][0]), h('span', {}, TEXT[k][1]))))),
    h('p', { class: 'sheet-text help-foot' }, 'Elke dag om middernacht staat er een nieuwe puzzel klaar.'),
    h('button', { class: 'btn btn-ghost btn-wide', type: 'button', onClick: () => sheet.close() }, 'Sluiten'),
  );
  const sheet = openSheet(content, { label: 'Uitleg', dismissable: true });
}
