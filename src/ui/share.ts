export type ShareOutcome = 'shared' | 'copied' | 'failed';
type ShareNav = Partial<Pick<Navigator, 'share' | 'clipboard'>>;

/** Deelt via het deelmenu van het toestel, anders via het klembord. Gooit nooit. */
export async function shareResult(text: string, nav: ShareNav = typeof navigator !== 'undefined' ? navigator : {}): Promise<ShareOutcome> {
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ text });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'failed';
    }
  }
  try {
    if (!nav.clipboard?.writeText) return 'failed';
    await nav.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
