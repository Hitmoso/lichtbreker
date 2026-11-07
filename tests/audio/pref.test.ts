import { describe, expect, it } from 'vitest';
import { readSoundOn, SOUND_KEY, writeSoundOn } from '../../src/audio/pref';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  };
}

const throwing = {
  getItem: () => { throw new Error('geen toegang'); },
  setItem: () => { throw new Error('vol'); },
} as unknown as Storage;

describe('sound preference', () => {
  it('defaults to on', () => {
    expect(readSoundOn(null)).toBe(true);
    expect(readSoundOn(memStorage())).toBe(true);
    expect(readSoundOn(throwing)).toBe(true);
  });
  it('remembers off', () => {
    const s = memStorage();
    writeSoundOn(s, false);
    expect(s.getItem(SOUND_KEY)).toBe('off');
    expect(readSoundOn(s)).toBe(false);
    writeSoundOn(s, true);
    expect(readSoundOn(s)).toBe(true);
  });
  it('never throws when storage fails', () => {
    expect(() => writeSoundOn(throwing, false)).not.toThrow();
    expect(() => writeSoundOn(null, false)).not.toThrow();
  });
});
