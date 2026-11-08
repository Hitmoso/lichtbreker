/// <reference lib="webworker" />
import type { WorkerRequest } from './client';
import { handleRequest } from './handle';

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  try {
    self.postMessage({ ok: true, result: handleRequest(e.data) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
