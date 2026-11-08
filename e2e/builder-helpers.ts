import { expect, type Page } from '@playwright/test';
import { encryptToken } from '../src/publish/crypto';
import { fromBase64Utf8, toBase64Utf8 } from '../src/publish/overrides';

export const PASSWORD = 'geheim';

/** Levert ./bouwers.json met één testaccount "tester" (nep-sleutel, snelle sleuteafleiding). */
export async function mockAccounts(page: Page, password = PASSWORD) {
  const acc = await encryptToken('tester', 'test-token', password, 1000);
  await page.route('**/bouwers.json', (route) => route.fulfill({ json: [acc] }));
}

export interface GithubMock {
  /** Gedecodeerde inhoud van elke PUT naar overrides.json. */
  puts: { message: string; data: Record<string, unknown> }[];
  /** Overrides zoals de nep-repo ze nu heeft. */
  files: Record<string, unknown>;
}

/** Bootst de GitHub-API na: toegang ok, overrides lezen/schrijven, bouwstatus eerst bezig en dan gelukt. */
export async function mockGithub(page: Page, initial: Record<string, unknown> = {}): Promise<GithubMock> {
  const mock: GithubMock = { puts: [], files: { ...initial } };
  let polls = 0;
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/repos/Hitmoso/lichtbreker') return route.fulfill({ json: { permissions: { push: true } } });
    if (url.pathname.endsWith('/contents/src/data/overrides.json')) {
      if (req.method() === 'GET') return route.fulfill({ json: { content: toBase64Utf8(JSON.stringify(mock.files, null, 2) + '\n'), sha: `sha${mock.puts.length}` } });
      const body = req.postDataJSON() as { message: string; content: string };
      const data = JSON.parse(fromBase64Utf8(body.content));
      mock.files = data;
      mock.puts.push({ message: body.message, data });
      return route.fulfill({ json: { commit: { sha: `c${mock.puts.length}` } } });
    }
    if (url.pathname.endsWith('/actions/workflows/pages.yml/runs')) {
      polls++;
      const done = polls >= 2;
      return route.fulfill({ json: { workflow_runs: [{ status: done ? 'completed' : 'in_progress', conclusion: done ? 'success' : null, html_url: 'https://github.com/x' }] } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return mock;
}

/** Opent de bouwer en logt in als "tester". Wist eerst een bewaard ontwerp. */
export async function loginAs(page: Page) {
  await page.goto('/?bouwer');
  await page.evaluate(() => localStorage.removeItem('lichtbreker:bouwer:ontwerp'));
  await page.getByLabel('Naam').fill('tester');
  await page.getByLabel('Wachtwoord').fill(PASSWORD);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Gereedschap' })).toBeVisible({ timeout: 15_000 });
}

/** Tikt op vak (x, y) van het veld. */
export async function tapCell(page: Page, x: number, y: number) {
  const canvas = page.locator('.board-host canvas');
  const box = (await canvas.boundingBox())!;
  const cols = Number(await canvas.getAttribute('data-cols'));
  const size = box.width / cols;
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}
