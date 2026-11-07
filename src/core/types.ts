/** 0 rechts, 1 omlaag, 2 links, 3 omhoog. */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;

export type MirrorKind = '/' | '\\';
/** Nieuwe richting per inkomende richting. */
export const REFLECT: Record<MirrorKind, readonly Dir[]> = {
  '/': [3, 2, 1, 0],
  '\\': [1, 0, 3, 2],
};

export type FilterColor = 'red' | 'green' | 'blue';
export type BeamColor = 'white' | FilterColor;
export const FILTER_COLORS: readonly FilterColor[] = ['red', 'green', 'blue'];
export const BEAM_COLORS: readonly BeamColor[] = ['white', 'red', 'green', 'blue'];

export type Cell =
  | { kind: 'empty' }
  | { kind: 'wall' }
  /** 'white' = geraakt door elke straal. */
  | { kind: 'crystal'; color: BeamColor }
  | { kind: 'fixedMirror'; mirror: MirrorKind }
  | { kind: 'prism' }
  | { kind: 'filter'; color: FilterColor }
  | { kind: 'source'; dir: Dir };

export type ElementKind = 'fixedMirror' | 'prism' | 'filter';
export const ELEMENT_KINDS: readonly ElementKind[] = ['fixedMirror', 'prism', 'filter'];

export interface Puzzle {
  version: 1;
  width: number;
  height: number;
  /** Aantal spiegels dat de speler mag plaatsen. */
  mirrors: number;
  /** Rij voor rij; index = y * width + x. */
  cells: Cell[];
}

export interface Placement {
  x: number;
  y: number;
  mirror: MirrorKind;
}
