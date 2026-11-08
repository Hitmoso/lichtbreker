import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, fetchAccounts, login, PBKDF2_ITERATIONS } from '../../src/publish/crypto';

describe('crypto', () => {
  it('round-trips a token with the right password', async () => {
    const acc = await encryptToken('max', 'github_pat_ABC', 'kort', 1000);
    expect(acc).toMatchObject({ name: 'max', iter: 1000 });
    expect(acc.data).not.toContain('github_pat');
    expect(await decryptToken(acc, 'kort')).toBe('github_pat_ABC');
  });

  it('returns null for a wrong password', async () => {
    const acc = await encryptToken('max', 'tok', 'goed', 1000);
    expect(await decryptToken(acc, 'fout')).toBeNull();
  });

  it('uses fresh salt and iv each time', async () => {
    const a = await encryptToken('max', 'tok', 'pw', 1000);
    const b = await encryptToken('max', 'tok', 'pw', 1000);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it('defaults to 600000 iterations', () => {
    expect(PBKDF2_ITERATIONS).toBe(600_000);
  });

  it('logs in case-insensitively and returns the stored name', async () => {
    const accounts = [await encryptToken('Max', 'tok-max', 'pw1', 1000), await encryptToken('lisa', 'tok-lisa', 'pw2', 1000)];
    expect(await login(accounts, 'MAX', 'pw1')).toEqual({ name: 'Max', token: 'tok-max' });
    expect(await login(accounts, ' lisa ', 'pw2')).toEqual({ name: 'lisa', token: 'tok-lisa' });
    expect(await login(accounts, 'lisa', 'pw1')).toBeNull();
    expect(await login(accounts, 'onbekend', 'pw1')).toBeNull();
  });

  it('rejects broken account lists', async () => {
    expect(await login('kapot', 'max', 'pw')).toBeNull();
    expect(await login([{ name: 'max', salt: '!!', iv: '!!', data: '!!' }], 'max', 'pw')).toBeNull();
  });

  it('fetchAccounts gives [] on failure', async () => {
    const fail = (async () => { throw new TypeError('offline'); }) as typeof fetch;
    expect(await fetchAccounts(fail)).toEqual([]);
    const ok = (async () => new Response(JSON.stringify([{ name: 'a', salt: 's', iv: 'i', data: 'd' }]))) as typeof fetch;
    expect(await fetchAccounts(ok)).toHaveLength(1);
    const junk = (async () => new Response('{"x":1}')) as typeof fetch;
    expect(await fetchAccounts(junk)).toEqual([]);
  });
});
