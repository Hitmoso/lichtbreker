import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../../src/config';
import { getDaily } from '../../src/core/daily';
import { generate } from '../../src/core/generator';
import { requestDaily, requestEndless, type WorkerRequest } from '../../src/worker/client';

/** Bootst de echte worker na (zelfde protocol). */
class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  constructor(private mode: 'error' | 'echo') {}
  postMessage(msg: WorkerRequest) {
    setTimeout(() => {
      if (this.mode === 'error') return this.onerror?.({ message: 'boom' } as ErrorEvent);
      const result = msg.kind === 'daily' ? getDaily(msg.date) : generate(msg.seed, DIFFICULTIES[msg.difficulty]);
      this.onmessage?.({ data: { ok: true, result } } as MessageEvent);
    }, 0);
  }
  terminate() {}
}
const fake = (mode: 'error' | 'echo') => () => new FakeWorker(mode) as unknown as Worker;

describe('requestDaily', () => {
  const expected = JSON.stringify(getDaily('2026-11-07'));
  it('falls back to the main thread without a worker', async () => {
    expect(JSON.stringify(await requestDaily('2026-11-07', { workerFactory: () => null }))).toBe(expected);
  });
  it('falls back to the main thread when the worker errors', async () => {
    expect(JSON.stringify(await requestDaily('2026-11-07', { workerFactory: fake('error') }))).toBe(expected);
  });
  it('uses the worker result when it works', async () => {
    expect(JSON.stringify(await requestDaily('2026-11-07', { workerFactory: fake('echo') }))).toBe(expected);
  });
});

describe('requestEndless', () => {
  const expected = JSON.stringify(generate(7, DIFFICULTIES.easy));
  it('falls back to the main thread without a worker', async () => {
    expect(JSON.stringify(await requestEndless(7, 'easy', { workerFactory: () => null }))).toBe(expected);
  });
  it('falls back to the main thread when the worker errors', async () => {
    expect(JSON.stringify(await requestEndless(7, 'easy', { workerFactory: fake('error') }))).toBe(expected);
  });
  it('uses the worker result when it works', async () => {
    expect(JSON.stringify(await requestEndless(7, 'easy', { workerFactory: fake('echo') }))).toBe(expected);
  });
});
