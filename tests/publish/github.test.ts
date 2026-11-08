import { describe, expect, it } from 'vitest';
import { FALLBACK } from '../../src/core/generator';
import { createGithub, GithubError } from '../../src/publish/github';
import { fromBase64Utf8, toBase64Utf8 } from '../../src/publish/overrides';

interface Call { method: string; url: string; body?: Record<string, unknown> }
type Responder = (c: Call) => { status: number; body?: unknown } | 'throw';

/** Nep-fetch: registreert verzoeken en antwoordt via `respond`. */
function fakeFetch(respond: Responder) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const c: Call = { method: init?.method ?? 'GET', url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    const r = respond(c);
    if (r === 'throw') throw new TypeError('Failed to fetch');
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  return { fn, calls };
}

const file = (data: Record<string, unknown>, sha: string) => ({ status: 200, body: { content: toBase64Utf8(JSON.stringify(data, null, 2)).replace(/(.{60})/g, '$1\n'), sha } });
const decoded = (c: Call) => JSON.parse(fromBase64Utf8(String(c.body!.content)));

describe('github.publish', () => {
  it('writes only the given date', async () => {
    const { fn, calls } = fakeFetch((c) => (c.method === 'GET' ? file({ '2026-01-01': FALLBACK }, 'sha1') : { status: 200, body: { commit: { sha: 'c1' } } }));
    const r = await createGithub('tok', fn).publish('2026-12-24', FALLBACK, 'max');
    expect(r.commitSha).toBe('c1');
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toBe('https://api.github.com/repos/Hitmoso/lichtbreker/contents/src/data/overrides.json');
    expect(put.body).toMatchObject({ message: 'puzzel: 2026-12-24 (door max)', sha: 'sha1', branch: 'main' });
    expect(Object.keys(decoded(put))).toEqual(['2026-01-01', '2026-12-24']);
    expect(calls[0].url).toContain('?ref=main');
  });

  it('uses a removal message when puzzle is null', async () => {
    const { fn, calls } = fakeFetch((c) => (c.method === 'GET' ? file({ '2026-12-24': FALLBACK }, 's') : { status: 200, body: { commit: { sha: 'c' } } }));
    await createGithub('tok', fn).publish('2026-12-24', null, 'max');
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.body!.message).toBe('puzzel: 2026-12-24 verwijderd (door max)');
    expect(decoded(put)).toEqual({});
  });

  it("retries on conflict and keeps the other's change", async () => {
    let gets = 0, puts = 0;
    const { fn, calls } = fakeFetch((c) => {
      if (c.method === 'GET') { gets++; return gets === 1 ? file({ '2026-01-01': FALLBACK }, 'a') : file({ '2026-01-01': FALLBACK, '2026-02-02': FALLBACK }, 'b'); }
      puts++;
      return puts === 1 ? { status: 409 } : { status: 200, body: { commit: { sha: 'c2' } } };
    });
    await createGithub('tok', fn).publish('2026-12-24', FALLBACK, 'max');
    const last = calls.filter((c) => c.method === 'PUT')[1];
    expect(last.body!.sha).toBe('b');
    expect(Object.keys(decoded(last))).toEqual(['2026-01-01', '2026-02-02', '2026-12-24']);
  });

  it('gives up after 3 conflicts', async () => {
    const { fn, calls } = fakeFetch((c) => (c.method === 'GET' ? file({}, 's') : { status: 422 }));
    await expect(createGithub('tok', fn).publish('2026-12-24', FALLBACK, 'max')).rejects.toMatchObject({ kind: 'conflict' });
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(3);
  });

  it('maps auth and network errors', async () => {
    const auth = fakeFetch(() => ({ status: 401 }));
    const e = await createGithub('tok', auth.fn).publish('2026-12-24', FALLBACK, 'max').catch((x) => x);
    expect(e).toBeInstanceOf(GithubError);
    expect(e).toMatchObject({ kind: 'auth', status: 401 });
    const net = fakeFetch(() => 'throw');
    await expect(createGithub('tok', net.fn).getOverrides()).rejects.toMatchObject({ kind: 'network' });
  });

  it('sends the token and API headers', async () => {
    let headers: Headers | undefined;
    const fn = (async (_: RequestInfo | URL, init?: RequestInit) => { headers = new Headers(init?.headers); return new Response(JSON.stringify(file({}, 's').body)); }) as typeof fetch;
    await createGithub('geheim', fn).getOverrides();
    expect(headers!.get('Authorization')).toBe('Bearer geheim');
    expect(headers!.get('Accept')).toBe('application/vnd.github+json');
    expect(headers!.get('X-GitHub-Api-Version')).toBe('2022-11-28');
  });
});

describe('github.checkAccess', () => {
  it('maps push permission, refusals and offline', async () => {
    expect(await createGithub('t', fakeFetch(() => ({ status: 200, body: { permissions: { push: true } } })).fn).checkAccess()).toBe('ok');
    expect(await createGithub('t', fakeFetch(() => ({ status: 200, body: { permissions: { push: false } } })).fn).checkAccess()).toBe('denied');
    expect(await createGithub('t', fakeFetch(() => ({ status: 401 })).fn).checkAccess()).toBe('denied');
    expect(await createGithub('t', fakeFetch(() => 'throw').fn).checkAccess()).toBe('offline');
  });
});

describe('github.runStatus', () => {
  const status = (body: unknown, code = 200) => createGithub('t', fakeFetch(() => ({ status: code, body })).fn).runStatus('c1');
  it('maps workflow runs', async () => {
    expect((await status({ workflow_runs: [] })).state).toBe('pending');
    expect((await status({ workflow_runs: [{ status: 'in_progress', conclusion: null, html_url: 'u' }] })).state).toBe('pending');
    expect(await status({ workflow_runs: [{ status: 'completed', conclusion: 'success', html_url: 'u1' }] })).toEqual({ state: 'success', url: 'u1' });
    expect((await status({ workflow_runs: [{ status: 'completed', conclusion: 'failure', html_url: 'u2' }] })).state).toBe('failure');
    expect((await status({}, 403)).state).toBe('unknown');
  });
  it('asks for runs of the commit', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200, body: { workflow_runs: [] } }));
    await createGithub('t', fn).runStatus('abc');
    expect(calls[0].url).toBe('https://api.github.com/repos/Hitmoso/lichtbreker/actions/runs?head_sha=abc');
  });
});
