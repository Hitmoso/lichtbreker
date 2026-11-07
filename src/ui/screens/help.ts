import type { Cell, ElementKind, Puzzle } from '../../core/types';
import { h } from '../dom';
import { openSheet } from '../sheet';

type HelpKind = 'mirror' | 'crystal' | 'coloredCrystal' | 'wall' | ElementKind;

const ICON: Record<HelpKind, string> = {
  mirror: '<path d="M6 18 18 6" stroke="#dfe6ff" stroke-width="3" stroke-linecap="round"/>',
  crystal: '<path d="M12 4 18 12 12 20 6 12Z" fill="rgba(207,244,255,.25)" stroke="#cff4ff" stroke-width="1.8"/>',
  coloredCrystal: '<path d="M7 5 13 15H1Z" fill="rgba(255,84,112,.3)" stroke="#ff5470" stroke-width="1.6"/><circle cx="18" cy="15" r="4" fill="rgba(79,168,255,.3)" stroke="#4fa8ff" stroke-width="1.6"/>',
  wall: '<rect x="4" y="4" width="16" height="16" rx="3" fill="#1c2756" stroke="#5a6db3" stroke-width="1.6"/>',
  fixedMirror: '<path d="M6 18 18 6" stroke="#9aa6d8" stroke-width="3" stroke-linecap="round"/><circle cx="6" cy="18" r="1.8" fill="#33438a"/><circle cx="18" cy="6" r="1.8" fill="#33438a"/>',
  prism: '<path d="M12 4 20 19H4Z" fill="rgba(255,255,255,.08)" stroke="#fff" stroke-width="1.6"/><path d="M9 15l6-3" stroke="#ff5470"/><path d="M9.5 13.5l5-2.5" stroke="#3df5a0"/>',
  filter: '<rect x="4" y="4" width="16" height="16" rx="4" fill="rgba(61,245,160,.18)" stroke="#3df5a0" stroke-width="1.6"/>',
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
  filter: 'Kleurfilter: kleurt de straal. Daarna lichten alleen kristallen in die kleur op, witte niet meer.',
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
