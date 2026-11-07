import { describe, expect, it } from 'vitest';
import { tapCue } from '../../src/audio/cue';
import type { Placement } from '../../src/core/types';

const p = (x: number, y: number, mirror: Placement['mirror']): Placement => ({ x, y, mirror });

describe('tapCue', () => {
  it('recognises placing, rotating and removing a mirror', () => {
    expect(tapCue([], [p(1, 1, '/')])).toBe('place');
    expect(tapCue([p(1, 1, '/')], [p(1, 1, '\\')])).toBe('rotate');
    expect(tapCue([p(1, 1, '\\')], [])).toBe('remove');
  });
});
