import type { Puzzle } from '../core/types';

/** Nieuw object met de datum gezet (puzzel) of verwijderd (null). */
export function setOverride(data: Record<string, unknown>, date: string, puzzle: Puzzle | null): Record<string, unknown> {
  const next = { ...data };
  if (puzzle) next[date] = puzzle;
  else delete next[date];
  return next;
}

/** Stabiele opmaak: datums gesorteerd, 2 spaties, afsluitende newline (schone git-diffs). */
export function formatOverrides(data: Record<string, unknown>): string {
  const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
  return JSON.stringify(sorted, null, 2) + '\n';
}

export function toBase64Utf8(s: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** GitHub levert base64 met newlines; die worden genegeerd. */
export function fromBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s+/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
