/** Validatiemelding (validatePuzzle) in mensentaal voor de bouwer. */
export function humanError(err: string): string {
  const sources = /^precies één bron nodig, gevonden: (\d+)$/.exec(err);
  if (sources) return sources[1] === '0' ? 'Er is nog geen bron' : 'Er zijn meerdere bronnen';
  if (err === 'bron wijst naar buiten') return 'De bron wijst naar buiten';
  if (err === 'bron staat niet op de rand') return 'De bron staat niet op de rand';
  return err.charAt(0).toUpperCase() + err.slice(1);
}
