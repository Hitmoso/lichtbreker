import { describe, expect, it } from 'vitest';
import { validatePuzzle } from '../../src/core/validate';
import overrides from '../../src/data/overrides.json';

/** Fouten in een overrides-object; leeg = in orde. */
function checkOverrides(obj: Record<string, unknown>): string[] {
  const errs: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const realDate = /^\d{4}-\d{2}-\d{2}$/.test(k) && !Number.isNaN(Date.parse(`${k}T00:00:00Z`))
      && new Date(`${k}T00:00:00Z`).toISOString().slice(0, 10) === k;
    if (!realDate) errs.push(`${k}: geen geldige datum`);
    const pe = validatePuzzle(v);
    if (pe.length) errs.push(`${k}: ${pe.join(', ')}`);
  }
  return errs;
}

describe('overrides.json', () => {
  it('detects bad entries', () => {
    expect(checkOverrides({ x: {} })).not.toEqual([]);
    expect(checkOverrides({ '2026-02-30': {} }).length).toBeGreaterThan(1);
  });

  it('every override is a valid dated puzzle', () => {
    expect(checkOverrides(overrides as Record<string, unknown>)).toEqual([]);
  });
});
