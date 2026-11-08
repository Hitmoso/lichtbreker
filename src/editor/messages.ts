import { DAILY, type GenSettings } from '../config';
import type { QualityReport } from '../core/generator';

/** Validatiemelding (validatePuzzle) in mensentaal voor de bouwer. */
export function humanError(err: string): string {
  const sources = /^precies één bron nodig, gevonden: (\d+)$/.exec(err);
  if (sources) return sources[1] === '0' ? 'Er is nog geen bron' : 'Er zijn meerdere bronnen';
  if (err === 'bron wijst naar buiten') return 'De bron wijst naar buiten';
  if (err === 'bron staat niet op de rand') return 'De bron staat niet op de rand';
  return err.charAt(0).toUpperCase() + err.slice(1);
}

/** Max als tekst; '≥ 6' als het zoeken op een groot bord is afgebroken. */
export const maxText = (a: { max: number; report: QualityReport }) => (a.report.exact ? String(a.max) : `≥ ${a.max}`);

/** Kwaliteitstips (alleen advies) uit een qualityReport. */
export function qualityTips(r: QualityReport, settings: GenSettings = DAILY): string[] {
  if (!r.exact && r.errors.length === 0) return [`Te groot om exact te rekenen; max is minstens ${r.max}`];
  const tips: string[] = [];
  if (!r.maxInRange) tips.push(`Max ligt buiten ${settings.maxScore[0]}–${settings.maxScore[1]}`);
  if (r.tooEasyWithout) tips.push('Zonder spiegels raak je al de helft');
  if (r.greedyReachesMax) tips.push('Gulzig spelen haalt het maximum al');
  if (r.fewerMirrorsSuffice) tips.push('Je hebt niet alle spiegels nodig');
  return tips;
}
