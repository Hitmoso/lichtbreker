import { describe, expect, it } from 'vitest';
import { SuspendGate } from '../../src/audio/gate';

describe('SuspendGate', () => {
  it('always lets sounds through while the context runs', () => {
    const g = new SuspendGate();
    for (let i = 0; i < 5; i++) expect(g.allow('running')).toBe(true);
  });
  it('queues at most one sound while suspended or interrupted, so nothing piles up', () => {
    const g = new SuspendGate();
    expect(g.allow('suspended')).toBe(true);
    expect(g.allow('suspended')).toBe(false);
    expect(g.allow('interrupted')).toBe(false);
    // Weer actief: alles mag weer, en na een nieuwe pauze opnieuw één.
    expect(g.allow('running')).toBe(true);
    expect(g.allow('suspended')).toBe(true);
    expect(g.allow('suspended')).toBe(false);
  });
});
