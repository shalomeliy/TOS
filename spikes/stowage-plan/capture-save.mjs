import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
const exe = resolve(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe');
const browser = await chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(process.argv[2])).href);
const json = await page.evaluate(() => {
  localStorage.clear(); fresh();
  for (let i = 0; i < 5; i++) cycle();
  startWork(S.visits[0]);
  for (let i = 0; i < 3; i++) cycle();
  ACTIONS.invoice();
  for (let i = 0; i < 2; i++) cycle();
  if (S.ver === 2) { arrive(S.visits[1]); startWork(S.visits[1]); cycle(); cycle(); }
  return JSON.stringify(S);
});
const s = JSON.parse(json);
console.log('invoices', s.invoices.length, 'charges', s.charges.length, 'ver', s.ver, 'eq', s.eq.map(e => e.id).join(','), 'dispatched', s.wis.filter(w => w.status === 'DISPATCHED').length, 'planned', s.wis.filter(w => w.status === 'PLANNED').length);
writeFileSync(process.argv[3], json);
await browser.close();
