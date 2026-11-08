import { describe, expect, it } from 'vitest';
import { clearSession, loadSession, saveSession, SESSION_KEY } from '../../src/publish/session';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const stores = () => ({ local: new MemStorage() as unknown as Storage, session: new MemStorage() as unknown as Storage });

describe('session', () => {
  it('remembers on this device in localStorage', () => {
    const s = stores();
    saveSession({ name: 'max', token: 't' }, true, s);
    expect(s.local.getItem(SESSION_KEY)).not.toBeNull();
    expect(s.session.getItem(SESSION_KEY)).toBeNull();
    expect(loadSession(s)).toEqual({ name: 'max', token: 't' });
  });

  it('otherwise only for this session', () => {
    const s = stores();
    saveSession({ name: 'max', token: 't' }, false, s);
    expect(s.local.getItem(SESSION_KEY)).toBeNull();
    expect(loadSession(s)).toEqual({ name: 'max', token: 't' });
  });

  it('clears both', () => {
    const s = stores();
    saveSession({ name: 'a', token: 't' }, true, s);
    saveSession({ name: 'b', token: 't' }, false, s);
    clearSession(s);
    expect(loadSession(s)).toBeNull();
  });

  it('ignores broken data and missing storage', () => {
    const s = stores();
    s.local.setItem(SESSION_KEY, '{kapot');
    expect(loadSession(s)).toBeNull();
    s.local.setItem(SESSION_KEY, JSON.stringify({ name: 1 }));
    expect(loadSession(s)).toBeNull();
    expect(loadSession({ local: null, session: null })).toBeNull();
    expect(() => saveSession({ name: 'a', token: 't' }, true, { local: null, session: null })).not.toThrow();
  });
});
