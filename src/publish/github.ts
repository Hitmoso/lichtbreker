import { PUBLISH } from '../config';
import type { Puzzle } from '../core/types';
import { formatOverrides, fromBase64Utf8, setOverride, toBase64Utf8 } from './overrides';

export type GithubErrorKind = 'auth' | 'conflict' | 'network' | 'other';

export class GithubError extends Error {
  constructor(readonly kind: GithubErrorKind, readonly status: number) {
    super(`GitHub: ${kind} (${status})`);
  }
}

export type RunState = 'pending' | 'success' | 'failure' | 'unknown';

export interface Github {
  /** Mag deze sleutel naar de repo schrijven? */
  checkAccess(): Promise<'ok' | 'denied' | 'offline'>;
  /** Actuele overrides uit de repo (niet de meegebouwde kopie). */
  getOverrides(): Promise<{ data: Record<string, unknown>; sha: string }>;
  /** Zet (puzzel) of verwijdert (null) één datum; probeert tot 3 keer bij een conflict. */
  publish(date: string, puzzle: Puzzle | null, author: string): Promise<{ commitSha: string }>;
  /** Status van de publicatie-workflow voor een commit. */
  runStatus(commitSha: string): Promise<{ state: RunState; url?: string }>;
}

const API = 'https://api.github.com';
const REPO = `${API}/repos/${PUBLISH.owner}/${PUBLISH.repo}`;
const CONTENTS = `${REPO}/contents/${PUBLISH.path}`;
const MAX_TRIES = 3;

const kindOf = (status: number): GithubErrorKind =>
  status === 401 || status === 403 ? 'auth' : status === 409 || status === 422 ? 'conflict' : 'other';

export function createGithub(token: string, fetchFn: typeof fetch = (...a) => fetch(...a)): Github {
  const call = async (url: string, init: RequestInit = {}): Promise<Response> => {
    try {
      return await fetchFn(url, {
        ...init,
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new GithubError('network', 0);
    }
  };
  const json = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const r = await call(url, init);
    if (!r.ok) throw new GithubError(kindOf(r.status), r.status);
    return (await r.json()) as T;
  };

  const getOverrides = async () => {
    const f = await json<{ content: string; sha: string }>(`${CONTENTS}?ref=${PUBLISH.branch}`);
    return { data: JSON.parse(fromBase64Utf8(f.content)) as Record<string, unknown>, sha: f.sha };
  };

  return {
    async checkAccess() {
      try {
        const r = await json<{ permissions?: { push?: boolean } }>(REPO);
        return r.permissions?.push ? 'ok' : 'denied';
      } catch (e) {
        return e instanceof GithubError && e.kind === 'network' ? 'offline' : 'denied';
      }
    },

    getOverrides,

    async publish(date, puzzle, author) {
      const message = puzzle ? `puzzel: ${date} (door ${author})` : `puzzel: ${date} verwijderd (door ${author})`;
      for (let attempt = 1; ; attempt++) {
        const { data, sha } = await getOverrides();
        const content = toBase64Utf8(formatOverrides(setOverride(data, date, puzzle)));
        try {
          const r = await json<{ commit: { sha: string } }>(CONTENTS, {
            method: 'PUT',
            body: JSON.stringify({ message, content, sha, branch: PUBLISH.branch }),
          });
          return { commitSha: r.commit.sha };
        } catch (e) {
          if (!(e instanceof GithubError && e.kind === 'conflict') || attempt >= MAX_TRIES) throw e;
        }
      }
    },

    async runStatus(commitSha) {
      try {
        const r = await json<{ workflow_runs?: { status: string; conclusion: string | null; html_url: string }[] }>(
          `${REPO}/actions/workflows/${PUBLISH.workflow}/runs?head_sha=${encodeURIComponent(commitSha)}`,
        );
        const run = r.workflow_runs?.[0];
        if (!run || run.status !== 'completed') return { state: 'pending' };
        if (run.conclusion === 'success') return { state: 'success', url: run.html_url };
        // Geannuleerd (een nieuwere publicatie nam het over) of overgeslagen: geen fout van deze publicatie.
        if (run.conclusion === 'cancelled' || run.conclusion === 'skipped') return { state: 'unknown', url: run.html_url };
        return { state: 'failure', url: run.html_url };
      } catch (e) {
        if (e instanceof GithubError && (e.status === 403 || e.status === 404)) return { state: 'unknown' };
        throw e;
      }
    },
  };
}
