/**
 * Accounts voor de puzzelbouwer beheren.
 *   npm run bouwer:account                    → account toevoegen of vervangen (interactief)
 *   npm run bouwer:account -- --verwijder max → account verwijderen
 * Schrijft public/bouwers.json. Daarna committen en pushen.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { encryptToken, type Account } from '../src/publish/crypto';

const FILE = new URL('../public/bouwers.json', import.meta.url);

function readAccounts(): Account[] {
  try {
    const list = JSON.parse(readFileSync(FILE, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeAccounts(list: Account[]) {
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(FILE, JSON.stringify(sorted, null, 2) + '\n');
}

/** Vraagt iets; met `hidden` wordt de invoer niet getoond. */
function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    out._writeToOutput = (s: string) => { if (s.includes(question)) out.output.write(s); };
  }
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a); }));
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const list = readAccounts();

  const del = args.indexOf('--verwijder');
  if (del >= 0) {
    const name = (args[del + 1] ?? '').trim().toLowerCase();
    const rest = list.filter((a) => a.name.toLowerCase() !== name);
    if (rest.length === list.length) console.log(`Geen account "${name}" gevonden.`);
    else { writeAccounts(rest); console.log(`Account "${name}" verwijderd.`); }
    console.log('Klaar. Commit en push public/bouwers.json.');
    return;
  }

  const name = (await ask('Naam: ')).trim();
  if (!name) throw new Error('Naam mag niet leeg zijn.');
  const pw = await ask('Wachtwoord: ', true);
  if (!pw) throw new Error('Wachtwoord mag niet leeg zijn.');
  if ((await ask('Wachtwoord nogmaals: ', true)) !== pw) throw new Error('De wachtwoorden zijn niet gelijk.');
  if (pw.length < 10) console.log('\x1b[33mLet op: dit wachtwoord is kort en dus makkelijker te raden.\x1b[0m');
  const token = (await ask('GitHub-sleutel (token): ', true)).trim();
  if (!token) throw new Error('Sleutel mag niet leeg zijn.');

  const acc = await encryptToken(name, token, pw);
  writeAccounts([...list.filter((a) => a.name.toLowerCase() !== name.toLowerCase()), acc]);
  console.log(`Account "${name}" opgeslagen.`);
  console.log('Klaar. Commit en push public/bouwers.json.');
}

main().catch((e) => { console.error(`Fout: ${e instanceof Error ? e.message : e}`); process.exit(1); });
