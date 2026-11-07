import type { BoardView } from '../../render/board';
import type { SavedState } from '../../state/storage';
import type { Round } from '../round';

export type ModeName = 'daily' | 'endless';

/** Wat een modus van de app krijgt. */
export interface ModeContext {
  board: BoardView;
  getSaved(): SavedState;
  setSaved(s: SavedState): void;
  announce(msg: string): void;
  /** Na elke nieuwe puzzel van de actieve modus (tips, tutorial). */
  onPuzzle(): void;
  /** Naar een andere modus wisselen. */
  switchTo(mode: ModeName): void;
  /** Kop (puzzelnummer) en vakgrootte bijwerken. */
  refreshHeader(): void;
  fit(): void;
  /** Laadmelding op het veld tonen of verbergen. */
  setLoading(on: boolean): void;
}

export interface Mode {
  readonly name: ModeName;
  readonly round: Round;
  /** Extra balk onder de schakelaar (bijv. niveaukeuze), of null. */
  readonly controls: HTMLElement | null;
  /** Tekst naast de titel, bijv. "#12". */
  label(): string;
  enter(): Promise<void>;
  leave(): void;
}
