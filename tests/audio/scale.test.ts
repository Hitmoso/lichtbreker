import { describe, expect, it } from 'vitest';
import { CHORD_STEPS, hitStep, noteFreq, ROOT_HZ } from '../../src/audio/scale';

describe('noteFreq', () => {
  it('follows the D major pentatonic scale from D5', () => {
    expect(ROOT_HZ).toBeCloseTo(587.33, 1);
    expect(noteFreq(0)).toBeCloseTo(587.33, 1);
    expect(noteFreq(1)).toBeCloseTo(587.33 * 2 ** (2 / 12), 1);
    expect(noteFreq(5)).toBeCloseTo(1174.66, 1);
    expect(noteFreq(-5)).toBeCloseTo(293.67, 1);
  });
});

describe('hitStep', () => {
  it('rises with every crystal at first', () => {
    for (let n = 2; n <= 10; n++) expect(hitStep(n)).toBeGreaterThan(hitStep(n - 1));
  });
  it('stays within two octaves for long chains and never repeats a step', () => {
    for (let n = 1; n <= 50; n++) {
      expect(hitStep(n)).toBeGreaterThanOrEqual(0);
      expect(hitStep(n)).toBeLessThanOrEqual(10);
      if (n > 1) expect(hitStep(n)).not.toBe(hitStep(n - 1));
    }
    for (let n = 12; n <= 50; n++) expect(hitStep(n)).toBeGreaterThanOrEqual(5);
  });
});

describe('CHORD_STEPS', () => {
  it('is a rising D6/9 arpeggio', () => {
    expect(CHORD_STEPS).toEqual([0, 2, 3, 4, 6, 7, 8]);
  });
});
