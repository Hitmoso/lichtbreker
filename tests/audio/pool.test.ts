import { describe, expect, it } from 'vitest';
import { MAX_VOICES, VoicePool } from '../../src/audio/pool';

describe('VoicePool', () => {
  it('keeps at most 12 voices and fades out the oldest', () => {
    expect(MAX_VOICES).toBe(12);
    const pool = new VoicePool();
    const faded: number[] = [];
    for (let i = 0; i < 30; i++) pool.add(10, () => faded.push(i), 0);
    expect(pool.size).toBe(12);
    // De oudste 18 zijn afgedempt, in volgorde.
    expect(faded).toEqual(Array.from({ length: 18 }, (_, i) => i));
  });
  it('forgets voices that have finished', () => {
    const pool = new VoicePool();
    pool.add(1, () => {}, 0);
    pool.add(3, () => {}, 0);
    expect(pool.size).toBe(2);
    pool.add(5, () => {}, 2);
    expect(pool.size).toBe(2);
  });
});
