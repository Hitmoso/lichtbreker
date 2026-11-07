/// <reference lib="webworker" />
import { DIFFICULTIES } from '../config';
import { getDaily } from '../core/daily';
import { generate } from '../core/generator';
import type { WorkerRequest } from './client';

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  try {
    const msg = e.data;
    const result = msg.kind === 'daily' ? getDaily(msg.date) : generate(msg.seed, DIFFICULTIES[msg.difficulty]);
    self.postMessage({ ok: true, result });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
