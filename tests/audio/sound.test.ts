import { describe, expect, it } from 'vitest';
import { SOUND_KEY } from '../../src/audio/pref';
import { silentSfx, Sound, type Sfx } from '../../src/audio/sound';

const calls = (s: Sfx) => {
  s.place(); s.rotate(); s.remove(); s.reject(); s.reset(); s.charge();
  s.hit(1); s.hit(30, { soft: true }); s.perfectNote(0); s.perfectNote(20); s.bloom(); s.solutionMirror(3);
};

describe('Sound without Web Audio', () => {
  it('is silent and never throws when there is no AudioContext', () => {
    const s = new Sound({ storage: null, createContext: () => null });
    expect(() => calls(s)).not.toThrow();
    expect(() => calls(silentSfx)).not.toThrow();
  });
  it('never throws when creating the context fails', () => {
    const s = new Sound({ storage: null, createContext: () => { throw new Error('kapot'); } });
    expect(() => calls(s)).not.toThrow();
  });
  it('uses the default (no AudioContext in Node) without throwing', () => {
    expect(() => calls(new Sound({ storage: null }))).not.toThrow();
  });
  it('remembers turning sound off', () => {
    const m = new Map<string, string>();
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } } as unknown as Storage;
    const s = new Sound({ storage, createContext: () => null });
    expect(s.on).toBe(true);
    s.setOn(false);
    expect(s.on).toBe(false);
    expect(m.get(SOUND_KEY)).toBe('off');
    expect(new Sound({ storage, createContext: () => null }).on).toBe(false);
  });
});
