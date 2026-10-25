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
for (const id of ['overview', 'vessels', 'stowage', 'yard', 'inventory', 'gate', 'work', 'equipment', 'billing', 'mapping', 'settings']) {
  await page.click(`nav a[data-id="${id}"]`);
  check((await page.textContent('#content')).length > 100, 'page renders: ' + id);
  check(await page.isVisible('.help'), 'help box shown: ' + id);
}

// rule: every control (button, link, field) and every screen title has a Hebrew tooltip.
// Run at the start and again at the end of the day, when state-dependent buttons exist.
const PAGES_ALL = ['overview', 'vessels', 'stowage', 'yard', 'inventory', 'gate', 'work', 'equipment', 'billing', 'mapping', 'settings'];
const auditTips = when => page.evaluate(({ pages, when }) => {
  const missing = [];
  const hebrew = t => typeof t === 'string' && /[֐-׿]/.test(t);
  const hasTip = el => hebrew(tipText(el)) || hebrew(el.closest('label')?.dataset.tip);
  for (const id of pages) {
    document.querySelector(`nav a[data-id="${id}"]`).click();
    const h1 = document.querySelector('#content h1');
    if (!h1 || !hebrew(h1.dataset.tip)) missing.push(`${when} ${id}: screen title has no tooltip`);
    document.querySelectorAll('button, a, input, select, textarea, form label, [data-act]').forEach(el => {
      if (!hasTip(el)) missing.push(`${when} ${id}: ` + el.outerHTML.slice(0, 70));
    });
  }
  return missing;
}, { pages: PAGES_ALL, when });
let noTip = await auditTips('start');
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
// state-dependent buttons now exist (finalize, pay, lines, credit, release, depart): audit again
await page.click('nav a[data-id="yard"]');
await page.click('[data-act="stack"]');
await page.click('nav a[data-id="billing"]');
await page.click('[data-act="invView"]');
noTip = await auditTips('end');
check(noTip.length === 0, 'tooltips missing:\n  ' + noTip.join('\n  '));

// ---------- version 2: Ashdod South Port ----------
// time rules on the 15-minute grid (clock = minutes after Thu 22-Oct 06:00)
const FRI = 1440, SAT = 2880, SUN = 4320, at = (day, hh, mm = 0) => day + hh * 60 + mm - 360;
const rules = await page.evaluate(t => ({
  work: t.work.map(m => isWorkTime(m)), gate: t.gate.map(m => isGateOpen(m)),
  span: storageDays(t.span[0], t.span[1]), seed: storageDays(-5 * 1440, 0), fmt: fmt(0),
}), {
  work: [at(FRI, 14, 45), at(FRI, 15), at(SAT, 19, 45), at(SAT, 20)],
  gate: [at(FRI, 14, 45), at(FRI, 15), at(SAT, 21), at(SUN, 4, 45), at(SUN, 5), at(0, 23, 45), at(FRI, 0)],
  span: [at(FRI, 10), at(SUN, 10)],
});
check(JSON.stringify(rules.work) === '[true,false,false,true]', 'work time Fri 14:45 / 15:00, Sat 19:45 / 20:00: ' + rules.work);
check(JSON.stringify(rules.gate) === '[true,false,false,false,true,true,false]', 'gate hours: ' + rules.gate);
check(rules.span === 2, 'Fri 10:00 -> Sun 10:00 is 2 storage days (Saturday not counted), got ' + rules.span);
check(rules.seed === 5, 'six calendar days with one Saturday = 5, got ' + rules.seed);
check(rules.fmt.startsWith('Thu 22-Oct 06:00'), 'clock shows weekday: ' + rules.fmt);

// equipment: 2 QC, 4 AGV, 8 ASC (2 per block)
await page.click('[data-act="reset"]');
s = await state();
check(s.ver === 3, 'fresh state has version 3');
check(s.eq.filter(e => e.type === 'QC').length === 2 && s.eq.filter(e => e.type === 'AGV').length === 4 && s.eq.filter(e => e.type.startsWith('ASC-')).length === 8, 'equipment 2 QC / 4 AGV / 8 ASC');
check(['A', 'B', 'C', 'D'].every(b => s.eq.filter(e => e.type === 'ASC-' + b).length === 2), 'two ASCs per block');
await page.click('nav a[data-id="overview"]');
check((await page.textContent('#content')).includes('Quay 27') && (await page.textContent('#content')).includes('Rail siding'), 'overview shows the terminal layout');

// gate closed: Friday 15:00 receive is refused and creates no unit; Saturday delivery is refused
await page.evaluate(m => { S.clock = m; render(); }, at(FRI, 15));
await page.click('nav a[data-id="gate"]');
const unitsBefore = Object.keys(s.units).length;
await page.click('form[data-form="gatein"] button');
s = await state();
check(Object.keys(s.units).length === unitsBefore, 'closed gate creates no unit');
check(s.gate.at(-1).status === 'REJECTED' && s.gate.at(-1).reason.includes('Sun 25-Oct 05:00'), 'gate-in rejected with reopen time: ' + s.gate.at(-1).reason);
check((await page.textContent('#portState')).includes('SHABBAT'), 'chip shows SHABBAT at Fri 15:00');
await page.evaluate(m => { S.clock = m; render(); }, at(SAT, 21));
await page.click('nav a[data-id="gate"]');
await page.click('form[data-form="gateout"] button');
s = await state();
check(s.gate.at(-1).status === 'REJECTED' && s.gate.at(-1).kind.startsWith('DELIVER'), 'gate-out on Saturday night rejected');
check((await page.textContent('#portState')).includes('GATE CLOSED'), 'chip shows GATE CLOSED on Saturday night');

// Shabbat pause: start both vessels Friday 13:00, nothing is dispatched until Saturday 20:00, then it all finishes
await page.click('[data-act="reset"]');
const pause = await page.evaluate(({ start, from, to }) => {
  S.clock = start; arrive(S.visits[0]); startWork(S.visits[0]); arrive(S.visits[1]); startWork(S.visits[1]);
  let n = 0;
  while (S.wis.some(w => w.status !== 'COMPLETE') && n++ < 400) cycle();
  return { open: S.wis.filter(w => w.status !== 'COMPLETE').length, inPause: S.wis.filter(w => w.started >= from && w.started < to).length,
    after: S.wis.filter(w => w.started >= to).length, logs: S.log.filter(l => /Shabbat/.test(l.msg)).length };
}, { start: at(FRI, 13), from: at(FRI, 15), to: at(SAT, 20) });
check(pause.open === 0, 'all work finishes after Shabbat, open: ' + pause.open);
check(pause.inPause === 0 && pause.after > 0, `no job dispatched during Shabbat (${pause.inPause}), jobs resumed after (${pause.after})`);
check(pause.logs === 2, 'one log line when Shabbat starts and one when it ends, got ' + pause.logs);

// +1 day from Friday lands in Shabbat, the next jump lands on Sunday
await page.evaluate(m => { S.clock = m; render(); }, at(FRI, 6));
await page.click('[data-act="day"]');
check((await page.textContent('#clock')).startsWith('Sat') && (await page.textContent('#portState')).includes('SHABBAT'), '+1 day from Friday shows Shabbat');
await page.click('[data-act="day"]');
check((await page.textContent('#clock')).startsWith('Sun'), 'next +1 day is Sunday');

// a second vessel for a taken quay waits and says why
await page.click('[data-act="reset"]');
await page.click('nav a[data-id="vessels"]');
await page.click(`[data-act="arrive"][data-id="V001"]`);
await page.fill('form[data-form="visit"] input[name="eta"]', '0');
await page.selectOption('form[data-form="visit"] select[name="quay"]', '27');
await page.click('form[data-form="visit"] button');
await page.click(`[data-act="arrive"][data-id="V003"]`);
s = await state();
check(s.visits[2].phase === 'INBOUND' && /quay 27/.test(s.visits[2].wait || ''), 'vessel for a taken quay waits: ' + s.visits[2].wait);
check((await page.textContent('.flash')).includes('Waiting for quay 27'), 'waiting reason shown');
const berthed = await page.evaluate(() => { depart(S.visits[0]); cycle(); const v = S.visits[2]; return { phase: v.phase, wait: v.wait, quay: v.quay }; });
check(berthed.phase === 'ARRIVED' && !berthed.wait && berthed.quay === '27', 'waiting vessel berths once the quay is free: ' + JSON.stringify(berthed));

// mapping page names the real TOS
await page.click('nav a[data-id="mapping"]');
check((await page.textContent('#content')).includes('Konecranes'), 'mapping page mentions Konecranes');

// old saves: a real version 1 save converts; a broken or foreign save starts a fresh port with a message
const { readFileSync } = await import('node:fs');
const v1 = readFileSync(resolve('tools/fixtures/save-v1.json'), 'utf8');
const v1s = JSON.parse(v1);
await page.evaluate(raw => localStorage.setItem('tos-trainer-v1', raw), v1);
await page.reload();
s = await state();
check(s.ver === 3 && s.clock === v1s.clock && Object.keys(s.units).length === Object.keys(v1s.units).length, 'v1 save upgraded, clock and units kept');
check(s.eq.filter(e => e.type.startsWith('ASC-')).length === 8 && !s.eq.some(e => /^ASC-[A-D]$/.test(e.id)), 'v1 save has 8 ASCs with new ids');
check(s.wis.every(w => w.eq.every(id => s.eq.some(e => e.id === id))), 'every job points at existing equipment');
check(s.visits.every(v => v.quay), 'every visit has a quay');
check(v1s.invoices.length > 0 && s.invoices.length === v1s.invoices.length && s.charges.length === v1s.charges.length, 'v1 save keeps invoices and charges');
check(s.seq.tx === v1s.seq.tx && s.seq.truck === v1s.seq.truck, 'v1 save keeps its counters');
check(s.log.some(l => l.msg.includes('upgraded from version 1')), 'upgrade logged');
const done = await page.evaluate(() => { let n = 0; while (S.wis.some(w => w.status !== 'COMPLETE') && n++ < 400) cycle(); return S.wis.filter(w => w.status !== 'COMPLETE').length; });
check(done === 0, 'upgraded save finishes its work');
for (const bad of ['not json', JSON.stringify({ ver: 99, units: {} }), JSON.stringify({ hello: 1 })]) {
  await page.evaluate(raw => localStorage.setItem('tos-trainer-v1', raw), bad);
  await page.reload();
  s = await state();
  check(s.ver === 3 && (await page.textContent('.flash')).includes('could not be read'), 'bad save starts fresh with a message: ' + bad.slice(0, 20));
}
await page.click('[data-act="reset"]');

// ---------- version 3: stowage plan ----------
// a version 2 save with a vessel mid-loading converts and finishes in the old order (no plan)
const v2raw = readFileSync(resolve('tools/fixtures/save-v2.json'), 'utf8');
await page.evaluate(raw => localStorage.setItem('tos-trainer-v1', raw), v2raw);
await page.reload();
const v2run = await page.evaluate(() => {
  const ok = S.ver === 3 && S.visits.every(v => 'plan' in v && v.onboard) && Object.values(S.units).filter(u => u.category === 'EXPORT').every(u => u.pod >= 1 && u.pod <= 3);
  const working = S.visits.find(v => v.phase === 'WORKING');
  let n = 0; while (S.wis.some(w => w.status !== 'COMPLETE') && n++ < 400) cycle();
  return { ok, unplanned: working && working.plan === null, open: S.wis.filter(w => w.status !== 'COMPLETE').length };
});
check(v2run.ok && v2run.unplanned && v2run.open === 0, 'v2 save upgraded, working vessel finishes unplanned: ' + JSON.stringify(v2run));
await page.click('[data-act="reset"]');

// the same seed gives the same demo (weights, holds, PODs)
check(await page.evaluate(() => { const a = JSON.stringify(Object.values(S.units).map(u => [u.weight, u.pod, u.holds])); fresh(); return a === JSON.stringify(Object.values(S.units).map(u => [u.weight, u.pod, u.holds])); }), 'fresh demo is repeatable');

// plan rules, loading never floats, discharge top first, late gate-in
await page.click('[data-act="reset"]');
const stow = await page.evaluate(() => {
  const v1 = S.visits[0], v2 = S.visits[1];
  arrive(v1); startWork(v1); arrive(v2); startWork(v2);
  const r = { exports: 0, planned: 0, breaks: 0, sizeMix: 0, floatLoad: 0, floatDisch: 0 };
  const ex = Object.values(S.units).filter(u => u.visit === v2.id && u.category === 'EXPORT');
  r.exports = ex.length; r.planned = ex.filter(u => v2.plan[u.vslot]?.unit === u.id).length;
  for (const k of Object.keys(v2.plan)) { if (ruleBreak(v2, k)) r.breaks++; if (SHIP.bays[slotParts(k).bay] !== sizeOf(S.units[v2.plan[k].unit])) r.sizeMix++; }
  const first = { ...v1.onboard };
  // late export for the last stop, gated in while the vessel is loading
  const late = addUnit({ line: 'RED', category: 'EXPORT', iso: '22G1', visit: v2.id, state: 'AT_GATE', pod: 3 });
  newWI('GATE_IN', late);
  let n = 0;
  while (S.wis.some(w => w.status !== 'COMPLETE') && n++ < 400) {
    cycle();
    for (const k of Object.keys(v2.onboard)) if (slotBelow(k) && !v2.onboard[slotBelow(k)]) r.floatLoad++;
    for (const k of Object.keys(v1.onboard)) if (slotBelow(k) && first[slotBelow(k)] && !v1.onboard[slotBelow(k)]) r.floatDisch++;
  }
  r.allLoaded = Object.entries(v2.plan).every(([k, p]) => v2.onboard[k] === p.unit && S.units[p.unit].state === 'LOADED');
  r.importsOff = Object.keys(v1.onboard).length === 0;
  r.late = { slot: late.vslot, state: late.state, isLate: !!v2.plan[late.vslot]?.late };
  return r;
});
check(stow.planned === stow.exports && stow.exports >= 10, `every yard export has a slot (${stow.planned}/${stow.exports})`);
check(stow.breaks === 0 && stow.sizeMix === 0, `plan breaks no rule (${stow.breaks}) and never mixes 20/40 (${stow.sizeMix})`);
check(stow.floatLoad === 0, 'no box is ever loaded above an empty slot, got ' + stow.floatLoad);
check(stow.floatDisch === 0 && stow.importsOff, 'imports leave top tier first, got ' + stow.floatDisch);
check(stow.allLoaded, 'every planned slot is loaded at the end');
check(stow.late.isLate && stow.late.state === 'LOADED', 'late gate-in gets a free slot and loads: ' + JSON.stringify(stow.late));

// late exports for a vessel that still has imports on board must not be planned on top of an import (review finding)
await page.click('[data-act="reset"]');
const lateOnImports = await page.evaluate(() => {
  const v = addVisit('MV Big', 'BLU', 0, 20, '28');
  arrive(v); startWork(v);
  for (let i = 0; i < 2; i++) { const u = addUnit({ line: 'BLU', category: 'EXPORT', iso: '22G1', visit: v.id, state: 'AT_GATE', pod: 1 + i }); newWI('GATE_IN', u); }
  let n = 0; while (v.phase === 'WORKING' && n++ < 400) cycle();
  return { phase: v.phase, open: S.wis.filter(w => w.visit === v.id && w.status !== 'COMPLETE').map(w => w.note) };
});
check(lateOnImports.phase === 'COMPLETE', 'vessel with imports and late exports completes: ' + JSON.stringify(lateOnImports));

// more exports than 40' slots: the rest are short-shipped and stay in the yard
await page.click('[data-act="reset"]');
const shortRun = await page.evaluate(() => {
  const v = S.visits[1];
  for (let i = 0; i < 20; i++) { const u = addUnit({ line: 'RED', category: 'EXPORT', iso: '45G1', visit: v.id, state: 'YARD', inTime: 0 }); placeUnit(u, planSlot(u)); }
  arrive(v); startWork(v);
  const short = Object.values(S.units).filter(u => u.short);
  return { short: short.length, noJob: short.every(u => !u.wi && u.state === 'YARD'), slots40: Object.keys(v.plan).filter(k => SHIP.bays[slotParts(k).bay] === '40').length };
});
check(shortRun.short > 0 && shortRun.noJob && shortRun.slots40 === 16, 'overflow is short-shipped, stays in the yard: ' + JSON.stringify(shortRun));

// Friday 12:00: loading stops at 15:00 part-way and finishes the same plan after Saturday 20:00
await page.click('[data-act="reset"]');
const fri = await page.evaluate(({ start, sat20 }) => {
  const v = S.visits[1];
  for (let i = 0; i < 14; i++) { const u = addUnit({ line: 'RED', category: 'EXPORT', iso: '22G1', visit: v.id, state: 'YARD', inTime: 0 }); placeUnit(u, planSlot(u)); }
  S.clock = start; arrive(v); startWork(v);
  const planBefore = JSON.stringify(Object.keys(v.plan).sort().map(k => k + v.plan[k].unit));
  const loadedAt = () => Object.keys(v.onboard).length;
  let atPause = null;
  while (S.wis.some(w => w.status !== 'COMPLETE') && S.clock < start + 3000) { cycle(); if (S.clock === sat20 - 15) atPause = loadedAt(); }
  return { atPause, planned: Object.keys(v.plan).length, end: loadedAt(), same: planBefore === JSON.stringify(Object.keys(v.plan).sort().map(k => k + v.plan[k].unit)),
    breaks: Object.keys(v.plan).filter(k => ruleBreak(v, k)).length };
}, { start: at(FRI, 12), sat20: at(SAT, 20) });
check(fri.atPause > 0 && fri.atPause < fri.planned && fri.end === fri.planned && fri.same && fri.breaks === 0, 'Friday load pauses part-way and finishes the same plan: ' + JSON.stringify(fri));

// the Stowage Plan screen: a bay, slots as buttons with labels, a Hebrew reason on click
await page.click('[data-act="reset"]');
await page.evaluate(() => { arrive(S.visits[1]); startWork(S.visits[1]); render(); });
await page.click('nav a[data-id="vessels"]');
check((await page.textContent('#content')).includes('10 planned, 0 loaded'), 'vessel table shows the plan count');
await page.click('[data-act="stowOpen"][data-id="V002"]');
check((await page.textContent('#content')).includes('Planned 10 / Loaded 0 / Warnings 0'), 'stowage summary line');
const slotBtn = await page.$('button.slot[aria-label*="POD"]');
check(!!slotBtn && /POD [A-Z]{5}/.test(await slotBtn.getAttribute('aria-label')), 'planned slot is a labelled button');
await slotBtn.click();
check(/[֐-׿]/.test(await page.textContent('.stowwrap')), 'slot click shows a Hebrew reason');
await page.click('[data-act="bayNext"]');
await page.click('[data-act="stowMode"][data-id="weight"]');
check((await page.textContent('#content')).includes('Darker = heavier'), 'weight colour mode');
await page.click('nav a[data-id="mapping"]');
check((await page.textContent('#content')).includes('Autostow'), 'mapping page mentions Autostow');
await page.click('[data-act="reset"]');

// phone width: no horizontal scroll on the page itself
await page.setViewportSize({ width: 390, height: 800 });
for (const id of ['overview', 'vessels', 'stowage', 'gate', 'equipment']) {
  await page.click(`nav a[data-id="${id}"]`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'no page-level horizontal scroll at 390px: ' + id);
}

await page.setViewportSize({ width: 1400, height: 900 });
await page.click('nav a[data-id="yard"]');
await page.screenshot({ path: process.env.SHOT || 'smoke-yard.png' });
await browser.close();

console.log(`moves=${s.stats.moves} rehandles=${s.stats.rehandles} invoices=${s.invoices.length}`);
if (errors.length) { console.error('FAIL\n' + errors.join('\n')); process.exit(1); }
console.log('PASS');
