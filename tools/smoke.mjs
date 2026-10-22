// Smoke test: load index.html in headless Chromium, play a short terminal day, fail on any console error.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const errors = [];
// Use Playwright's own browser if present; otherwise any Chromium already downloaded on this machine.
async function launch() {
  try { return await chromium.launch(); } catch (e) {
    const { readdirSync, existsSync } = await import('node:fs');
    const root = resolve(process.env.LOCALAPPDATA || '', 'ms-playwright');
    const dir = existsSync(root) && readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
    const exe = dir && resolve(root, dir, 'chrome-win64', 'chrome.exe');
    if (!exe || !existsSync(exe)) throw e;
    return chromium.launch({ executablePath: exe });
  }
}
const browser = await launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(resolve('index.html')).href);
await page.evaluate(() => localStorage.clear());
await page.click('[data-act="reset"]');

const check = (cond, msg) => { if (!cond) { errors.push('CHECK FAILED: ' + msg); } };
const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.TOS.state)));

// ISO 6346 check digit: CSQU305438 -> 3 (published example)
check(await page.evaluate(() => window.TOS.checkDigit('CSQU305438')) === 3, 'ISO 6346 check digit');

// every page renders
for (const id of ['overview', 'vessels', 'yard', 'inventory', 'gate', 'work', 'equipment', 'billing', 'mapping', 'settings']) {
  await page.click(`nav a[data-id="${id}"]`);
  check((await page.textContent('#content')).length > 100, 'page renders: ' + id);
  check(await page.isVisible('.help'), 'help box shown: ' + id);
}

// every button, nav link and form label has a tooltip text
const noTip = await page.evaluate(() => {
  const missing = [];
  for (const id of ['overview', 'vessels', 'yard', 'inventory', 'gate', 'work', 'equipment', 'billing', 'settings']) {
    document.querySelector(`nav a[data-id="${id}"]`).click();
    document.querySelectorAll('button, nav a, .menubar a, form label, [data-act]').forEach(el => {
      if (!(el.dataset.tip || (TIPS[el.dataset.act] && (typeof TIPS[el.dataset.act] !== 'function' || TIPS[el.dataset.act](el))))) missing.push(id + ': ' + el.outerHTML.slice(0, 60));
    });
  }
  return missing;
});
check(noTip.length === 0, 'tooltips missing:\n  ' + noTip.join('\n  '));
await page.hover('[data-act="cycle"]');
check(await page.isVisible('#tip') && (await page.textContent('#tip')).includes('רבע שעה'), 'tooltip shows on hover');

// settings: turning help and tips off hides them, survives reload and Reset demo
await page.click('nav a[data-id="settings"]');
await page.click('[data-act="prefHelp"]');
await page.click('[data-act="prefTips"]');
await page.click('[data-act="reset"]');
await page.reload();
await page.click('nav a[data-id="yard"]');
check(!(await page.isVisible('.help')), 'help box hidden after turning it off');
await page.hover('[data-act="cycle"]');
check(!(await page.isVisible('#tip')), 'tooltip hidden after turning it off');
await page.click('nav a[data-id="settings"]');
await page.click('[data-act="prefHelp"]');
await page.click('[data-act="prefTips"]');

// vessel 1 arrives by ETA, start work, run until complete
for (let i = 0; i < 5; i++) await page.click('[data-act="cycle"]');
await page.click('nav a[data-id="vessels"]');
await page.click('[data-act="start"]');
for (let i = 0; i < 30; i++) await page.click('[data-act="cycle"]');
let s = await state();
check(s.visits[0].phase === 'COMPLETE', 'visit 1 complete, got ' + s.visits[0].phase);
check(Object.values(s.units).filter(u => u.visit === s.visits[0].id).every(u => u.state === 'YARD'), 'imports in yard');

// gate in an export for visit 2, gate out a held unit (rejected) and a free one
await page.click('nav a[data-id="gate"]');
await page.selectOption('form[data-form="gatein"] select[name="visit"]', s.visits[1].id);
await page.click('form[data-form="gatein"] button');
const held = Object.values(s.units).find(u => u.state === 'YARD' && u.holds.length);
await page.selectOption('form[data-form="gateout"] select[name="unit"]', held.id);
await page.click('form[data-form="gateout"] button');
check((await page.textContent('.flash')).includes('rejected'), 'held unit rejected at gate');
const free = Object.values(s.units).find(u => u.state === 'YARD' && !u.holds.length && u.category === 'IMPORT' && u.inTime < 0);
await page.selectOption('form[data-form="gateout"] select[name="unit"]', free.id);
await page.click('form[data-form="gateout"] button');
for (let i = 0; i < 3; i++) await page.click('[data-act="cycle"]');
s = await state();
check(s.units[free.id].state === 'DEPARTED', 'free import delivered');
check(s.charges.some(c => c.unit === free.id && c.type === 'STORAGE'), 'storage charged after free days');

// vessel 2: arrive, work, depart
await page.click('nav a[data-id="vessels"]');
await page.click(`[data-act="arrive"][data-id="${s.visits[1].id}"]`);
await page.click(`[data-act="start"][data-id="${s.visits[1].id}"]`);
for (let i = 0; i < 40; i++) await page.click('[data-act="cycle"]');
s = await state();
check(s.visits[1].phase === 'COMPLETE', 'visit 2 complete, got ' + s.visits[1].phase);
check(Object.values(s.units).filter(u => u.visit === s.visits[1].id && u.category === 'EXPORT').every(u => u.state === 'LOADED'), 'all exports loaded');
await page.click(`[data-act="depart"][data-id="${s.visits[1].id}"]`);

// stacks never exceed max height, every yard unit is in exactly one stack
s = await state();
check(Object.values(s.stacks).every(st => st.length <= 4), 'stack height <= 4');
const inStacks = Object.values(s.stacks).flat();
check(new Set(inStacks).size === inStacks.length, 'no duplicate positions');
check(Object.values(s.units).filter(u => u.state === 'YARD').length === inStacks.length, 'yard units == stacked units');

// billing
await page.click('nav a[data-id="billing"]');
await page.click('[data-act="invoice"]');
await page.click('[data-act="finalize"]');
await page.click('[data-act="pay"]');
await page.click('[data-act="invView"]');
await page.click('[data-act="credit"]');
s = await state();
check(s.invoices.length >= 2 && s.invoices.some(i => i.status === 'PAID'), 'invoices created and paid');
check(s.charges.some(c => c.type === 'CREDIT' && !c.invoice), 'credit pending');

// phone width: no horizontal scroll on the page itself
await page.setViewportSize({ width: 390, height: 800 });
check(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'no page-level horizontal scroll at 390px');

await page.setViewportSize({ width: 1400, height: 900 });
await page.click('nav a[data-id="yard"]');
await page.screenshot({ path: process.env.SHOT || 'smoke-yard.png' });
await browser.close();

console.log(`moves=${s.stats.moves} rehandles=${s.stats.rehandles} invoices=${s.invoices.length}`);
if (errors.length) { console.error('FAIL\n' + errors.join('\n')); process.exit(1); }
console.log('PASS');
