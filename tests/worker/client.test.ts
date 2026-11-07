import { describe, expect, it } from 'vitest';
import { getDaily } from '../../src/core/daily';
import { requestDaily } from '../../src/worker/client';

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  constructor(private mode: 'error' | 'echo') {}
  postMessage(msg: { date: string }) {
    setTimeout(() => {
      if (this.mode === 'error') this.onerror?.({ message: 'boom' } as ErrorEvent);
      else this.onmessage?.({ data: { ok: true, daily: getDaily(msg.date) } } as MessageEvent);
    }, 0);
  }
  terminate() {}
}

describe('requestDaily', () => {
  const expected = JSON.stringify(getDaily('2026-11-07'));
  it('falls back to the main thread without a worker', async () => {
    expect(JSON.stringify(await requestDaily('2026-11-07', { workerFactory: () => null }))).toBe(expected);
  });
  it('falls back to the main thread when the worker errors', async () => {
    const r = await requestDaily('2026-11-07', { workerFactory: () => new FakeWorker('error') as unknown as Worker });
    expect(JSON.stringify(r)).toBe(expected);
  });
  it('uses the worker result when it works', async () => {
    const r = await requestDaily('2026-11-07', { workerFactory: () => new FakeWorker('echo') as unknown as Worker });
    expect(JSON.stringify(r)).toBe(expected);
  });
});
