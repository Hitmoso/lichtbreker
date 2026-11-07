/** Spoilervrije deeltekst (spec 5.1). */
export function shareText(number: number, score: number, max: number): string {
  const blocks = '🟨'.repeat(score) + '⬛'.repeat(Math.max(0, max - score)) + (score >= max ? '✨' : '');
  return `Lichtbreker #${number} 💎 ${score}/${max}\n${blocks}`;
}
