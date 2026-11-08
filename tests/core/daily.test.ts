import { describe, expect, it, vi } from 'vitest';
import { amsterdamDate, getDaily, msUntilNextPuzzle, puzzleNumber } from '../../src/core/daily';
import { GEN_V2 } from '../../src/config';
import { FALLBACK, generate } from '../../src/core/generator';
import { generateV2 } from '../../src/core/generator2';
import { hashSeed } from '../../src/core/rng';
import { shareText } from '../../src/core/share';

describe('amsterdamDate', () => {
  it('uses Amsterdam wall time in winter and summer', () => {
    expect(amsterdamDate(new Date('2026-11-07T23:30:00Z'))).toBe('2026-11-08');
    expect(amsterdamDate(new Date('2026-11-07T22:59:00Z'))).toBe('2026-11-07');
    expect(amsterdamDate(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
    expect(amsterdamDate(new Date('2026-07-01T22:00:00Z'))).toBe('2026-07-02');
  });
});

describe('puzzleNumber', () => {
  it('counts days from EPOCH', () => {
    expect(puzzleNumber('2026-11-07')).toBe(1);
    expect(puzzleNumber('2026-11-08')).toBe(2);
    expect(puzzleNumber('2025-01-01')).toBe(1);
  });
  it('counts exactly one per day across DST', () => {
    expect(puzzleNumber('2027-03-29') - puzzleNumber('2027-03-27')).toBe(2);
    expect(puzzleNumber('2027-10-31') - puzzleNumber('2027-10-30')).toBe(1);
  });
});

describe('msUntilNextPuzzle', () => {
  it('counts down to Amsterdam midnight', () => {
    expect(msUntilNextPuzzle(new Date('2026-11-07T22:59:00Z'))).toBe(60_000);
    expect(msUntilNextPuzzle(new Date('2026-07-01T21:59:00Z'))).toBe(60_000);
  });
});

describe('getDaily', () => {
  it('prefers a valid override', () => {
    const d = getDaily('2026-11-09', { '2026-11-09': FALLBACK });
    expect(d.source).toBe('override');
    expect(d.number).toBe(3);
    expect(d.puzzle).toEqual(FALLBACK);
  });
  it('ignores an invalid override with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getDaily('2026-11-09', { '2026-11-09': { kapot: true } }).source).toBe('generated');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it('switches to generator v2 on GEN_V2.from', () => {
    const seedOf = (date: string) => hashSeed('lichtbreker', puzzleNumber(date));
    expect(GEN_V2.from).toBe('2026-11-10');
    expect(getDaily('2026-11-09', {}).puzzle).toEqual(generate(seedOf('2026-11-09')).puzzle);
    expect(getDaily('2026-11-10', {}).puzzle).toEqual(generateV2(seedOf('2026-11-10')).puzzle);
    expect(getDaily('2027-03-01', {}).puzzle).toEqual(generateV2(seedOf('2027-03-01')).puzzle);
  });
  it('is the same puzzle for the same date', () => {
    expect(JSON.stringify(getDaily('2026-12-01', {}))).toBe(JSON.stringify(getDaily('2026-12-01', {})));
  });
});

describe('shareText', () => {
  it('formats a partial score', () => {
    expect(shareText(12, 7, 9)).toBe('Lichtbreker #12 💎 7/9\n🟨🟨🟨🟨🟨🟨🟨⬛⬛');
  });
  it('adds sparkle at the maximum', () => {
    expect(shareText(3, 9, 9)).toBe('Lichtbreker #3 💎 9/9\n🟨🟨🟨🟨🟨🟨🟨🟨🟨✨');
  });
});
