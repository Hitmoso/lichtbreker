import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../../src/config';
import { getDaily } from '../../src/core/daily';
import { FALLBACK } from '../../src/core/generator';
import { generateV2 } from '../../src/core/generator2';
import { solve } from '../../src/core/solver';
import { requestAnalyse, requestDaily, requestEndless, requestGeneratedDaily, type WorkerRequest } from '../../src/worker/client';
import { handleRequest } from '../../src/worker/handle';

/** Bootst de echte worker na (zelfde protocol). */
class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  terminated = false;
  constructor(private mode: 'error' | 'echo' | 'silent') {}
  postMessage(msg: WorkerRequest) {
    setTimeout(() => {
      if (this.mode === 'silent') return;
      if (this.mode === 'error') return this.onerror?.({ message: 'boom' } as ErrorEvent);
      const result = handleRequest(msg);
      this.onmessage?.({ data: { ok: true, result } } as MessageEvent);
    }, 0);
  }
  terminate() { this.terminated = true; }
}
const fake = (mode: 'error' | 'echo' | 'silent') => () => new FakeWorker(mode) as unknown as Worker;

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
  const expected = JSON.stringify(generateV2(7, DIFFICULTIES.easy));
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

describe('requestAnalyse', () => {
  it('returns max and report', async () => {
    const a = await requestAnalyse(FALLBACK, { workerFactory: () => null }).result;
    expect(a!.max).toBe(solve(FALLBACK).max);
    expect(a!.report.max).toBe(a!.max);
    const viaWorker = await requestAnalyse(FALLBACK, { workerFactory: fake('echo') }).result;
    expect(viaWorker!.max).toBe(a!.max);
  });
  it('cancel resolves null and terminates', async () => {
    const w = new FakeWorker('silent');
    const req = requestAnalyse(FALLBACK, { workerFactory: () => w as unknown as Worker });
    req.cancel();
    expect(await req.result).toBeNull();
    expect(w.terminated).toBe(true);
  });
});

describe('requestGeneratedDaily', () => {
  it('ignores overrides', async () => {
    const d = await requestGeneratedDaily('2026-11-07', { workerFactory: () => null });
    expect(d.source).not.toBe('override');
    expect(JSON.stringify(d)).toBe(JSON.stringify(getDaily('2026-11-07', {})));
  });
});
