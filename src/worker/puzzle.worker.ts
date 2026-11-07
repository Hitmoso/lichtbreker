/// <reference lib="webworker" />
import { getDaily } from '../core/daily';

self.onmessage = (e: MessageEvent<{ date: string }>) => {
  try {
    self.postMessage({ ok: true, daily: getDaily(e.data.date) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
