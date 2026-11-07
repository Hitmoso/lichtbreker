import { describe, expect, it } from 'vitest';
import { shareResult } from '../../src/ui/share';

const text = 'Lichtbreker #1 💎 3/5';

describe('shareResult', () => {
  it('uses the native share sheet when available', async () => {
    let got = '';
    expect(await shareResult(text, { share: async (d) => { got = d?.text ?? ''; } })).toBe('shared');
    expect(got).toBe(text);
  });
  it('copies to the clipboard without share', async () => {
    let got = '';
    expect(await shareResult(text, { clipboard: { writeText: async (t: string) => { got = t; } } as Clipboard })).toBe('copied');
    expect(got).toBe(text);
  });
  it('reports a cancelled share as failed without throwing', async () => {
    const err = Object.assign(new Error('cancel'), { name: 'AbortError' });
    expect(await shareResult(text, { share: async () => { throw err; } })).toBe('failed');
  });
  it('falls back to clipboard when share throws a non-abort error', async () => {
    expect(await shareResult(text, {
      share: async () => { throw new Error('NotAllowed'); },
      clipboard: { writeText: async () => {} } as unknown as Clipboard,
    })).toBe('copied');
  });
  it('reports a rejected clipboard as failed', async () => {
    expect(await shareResult(text, { clipboard: { writeText: async () => { throw new Error('denied'); } } as unknown as Clipboard })).toBe('failed');
    expect(await shareResult(text, {})).toBe('failed');
  });
});
