import { describe, expect, it } from 'vitest';
import { FALLBACK } from '../../src/core/generator';
import { formatOverrides, fromBase64Utf8, setOverride, toBase64Utf8 } from '../../src/publish/overrides';

describe('overrides', () => {
  it('sets, replaces and removes a date without mutating', () => {
    const data = { '2026-01-02': 'oud' };
    const next = setOverride(data, '2026-01-01', FALLBACK);
    expect(data).toEqual({ '2026-01-02': 'oud' });
    expect(next['2026-01-01']).toEqual(FALLBACK);
    expect(setOverride(next, '2026-01-02', null)).toEqual({ '2026-01-01': FALLBACK });
  });

  it('formats with sorted keys, 2 spaces and a trailing newline', () => {
    const text = formatOverrides({ '2026-12-24': { a: 1 }, '2026-01-01': { b: 2 } });
    expect(text).toBe('{\n  "2026-01-01": {\n    "b": 2\n  },\n  "2026-12-24": {\n    "a": 1\n  }\n}\n');
    expect(formatOverrides({})).toBe('{}\n');
  });

  it('round-trips UTF-8 through base64, also with newlines in the input', () => {
    const b64 = toBase64Utf8('é💎{}');
    expect(fromBase64Utf8(b64)).toBe('é💎{}');
    expect(fromBase64Utf8(b64.slice(0, 4) + '\n' + b64.slice(4))).toBe('é💎{}');
  });
});
