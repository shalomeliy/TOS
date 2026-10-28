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
const CUR_VER = await page.evaluate(() => STATE_VER);   // saved-state version of this build

// ISO 6346 check digit: CSQU305438 -> 3 (published example)
check(await page.evaluate(() => window.TOS.checkDigit('CSQU305438')) === 3, 'ISO 6346 check digit');
check(/^v\d+\.\d+ \(\d\d-\d\d-\d{4}\)$/.test(await page.textContent('#appVer')), 'version shown top right: ' + await page.textContent('#appVer'));

// every page renders
for (const id of ['overview', 'vessels', 'berth', 'stowage', 'yard', 'yardrules', 'inventory', 'inspector', 'gate', 'appts', 'rail', 'work', 'equipment', 'billing', 'mapping', 'settings']) {
  await page.click(`nav a[data-id="${id}"]`);
  check((await page.textContent('#content')).length > 100, 'page renders: ' + id);
  check(await page.isVisible('.help'), 'help box shown: ' + id);
}

// rule: every control (button, link, field), every screen title and every heading / column / status tag has a Hebrew tooltip.
// Run at the start and again at the end of the day, when state-dependent buttons exist.
const PAGES_ALL = ['overview', 'vessels', 'berth', 'stowage', 'yard', 'yardrules', 'inventory', 'inspector', 'gate', 'appts', 'rail', 'work', 'equipment', 'billing', 'mapping', 'settings'];
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
    // every heading, column, status tag and screen part explains what it shows
    document.querySelectorAll(INFO_SEL).forEach(el => {
      if (!hebrew(tipText(el))) missing.push(`${when} ${id}: no explanation for "${el.textContent.trim().slice(0, 40)}" (${el.tagName.toLowerCase()}.${el.className})`);
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

// gate in an export for visit 2, gate out a held unit (rejected) and a free one.
// These older scenarios test the gate without truck appointments (version 8 rule switched off)
await page.evaluate(() => { S.apptRule.required = false; });
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
check(Object.values(s.units).filter(u => u.visit === s.visits[1].id && u.category === 'EXPORT' && !u.train).every(u => u.state === 'LOADED'), 'all exports loaded (except those still on the train)');
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
check(s.ver === CUR_VER, 'fresh state has the current version');
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
check(s.ver === CUR_VER && s.clock === v1s.clock && Object.keys(s.units).length === Object.keys(v1s.units).length, 'v1 save upgraded, clock and units kept');
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
  check(s.ver === CUR_VER && (await page.textContent('.flash')).includes('could not be read'), 'bad save starts fresh with a message: ' + bad.slice(0, 20));
}
await page.click('[data-act="reset"]');

// ---------- version 3: stowage plan ----------
// a version 2 save with a vessel mid-loading converts and finishes in the old order (no plan)
const v2raw = readFileSync(resolve('tools/fixtures/save-v2.json'), 'utf8');
await page.evaluate(raw => localStorage.setItem('tos-trainer-v1', raw), v2raw);
await page.reload();
const v2run = await page.evaluate(() => {
  const ok = S.ver === STATE_VER && S.visits.every(v => 'plan' in v && v.onboard) && Object.values(S.units).filter(u => u.category === 'EXPORT').every(u => u.pod >= 1 && u.pod <= 3);
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
  const ex = Object.values(S.units).filter(u => u.visit === v2.id && u.category === 'EXPORT' && !u.train);   // the demo train's exports are still on the train
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

// ---------- version 4: stowage practice ----------
// the rules, called directly on the practice board of MV Harbor Lesson (V002, still INBOUND)
const prac = await page.evaluate(() => {
  const v = S.visits[1]; v.practice = {};
  const w = practiceWaiting(v), u40 = w.find(u => sizeOf(u) === '40'), u20 = w.filter(u => sizeOf(u) === '20');
  const r = { waiting: w.length, exports: yardExports(v).length };
  r.size = !!canPlace(v, u40, '01-01-02');                       // 40' into a 20' bay
  r.float = !!canPlace(v, u20[0], '01-01-04');                   // nothing under it (an import on board does not count)
  u20[0].pod = 1; u20[1].pod = 3;                                // a near-port box under a far-port box
  r.okBottom = canPlace(v, u20[0], '01-01-02') === null;
  v.practice['01-01-02'] = { unit: u20[0].id, by: 'me' };
  r.okTop = canPlace(v, u20[1], '01-01-04') === null;            // allowed (soft rule only)
  v.practice['01-01-04'] = { unit: u20[1].id, by: 'me' };
  r.taken = !!canPlace(v, u20[2], '01-01-04');
  const get = k => practiceAt(v, k);
  r.brk = boardBreak(v, get, '01-01-04')?.kind;
  r.score = boardScore(v, get);
  r.removeUnder = !!canRemove(v, '01-01-02');                    // a box sits on top
  r.removeTop = canRemove(v, '01-01-04') === null;
  delete v.practice['01-01-04'];
  r.afterRemove = boardScore(v, get);
  // computer fills the rest around the learner's box: nothing floats
  r.fill = practiceFill(v);
  r.floating = Object.keys(v.practice).filter(k => slotBelow(k) && !v.practice[slotBelow(k)]).length;
  r.allPlaced = practiceWaiting(v).length === 0;
  r.auto = boardScore(v, autoBoard(v));
  v.practice = null;
  return r;
});
check(prac.waiting === prac.exports && prac.waiting >= 10, 'waiting list = every yard export of the vessel: ' + prac.waiting);
check(prac.size && prac.float && prac.taken, 'wrong size, floating and taken slots are refused: ' + JSON.stringify([prac.size, prac.float, prac.taken]));
check(prac.okBottom && prac.okTop && prac.brk === 'port', 'far-port box on a near-port box is allowed with a port-order warning');
check(prac.score.port === 1 && prac.score.extra === 1 && prac.score.placed === 2, 'score counts the break and the extra move: ' + JSON.stringify(prac.score));
check(prac.removeUnder && prac.removeTop, 'a box with a box on top cannot be removed, the top one can');
check(prac.afterRemove.port === 0 && prac.afterRemove.extra === 0, 'removing the top box clears its warning');
check(prac.floating === 0 && prac.allPlaced, 'the computer fills the rest with nothing floating: ' + JSON.stringify(prac.fill));
check(prac.auto.port === 0 && prac.auto.weight === 0 && prac.auto.extra === 0, 'the automatic plan scores 0 breaks and 0 extra moves');

// the same flow by clicks: open practice, pick a 40' box (jumps to bay 06), refused and allowed clicks, compare
await page.click('[data-act="reset"]');
await page.click('nav a[data-id="stowage"]');
await page.click('[data-act="stowVisit"][data-id="V002"]');
await page.click('[data-act="pstart"]');
check((await page.textContent('#content')).includes('Waiting to be placed (10)'), 'practice shows the waiting list');
const pick40 = await page.$$eval('button[data-act="ppick"]', bs => bs.find(b => b.textContent.includes("40'"))?.dataset.id);
await page.click(`[data-act="ppick"][data-id="${pick40}"]`);
check((await page.textContent('.pick')).includes(pick40) && (await page.$eval('[data-act="bay"].on', b => b.dataset.id)) === '06', 'picking a 40\' box shows it and opens bay 06');
noTip = await auditTips('practice');
check(noTip.length === 0, 'tooltips missing in practice:\n  ' + noTip.join('\n  '));
await page.click('nav a[data-id="stowage"]');
await page.click('button.slot.no');
check((await page.textContent('.flash')).startsWith('Not allowed:') && /[֐-׿]/.test(await page.textContent('.flash')) && (await page.getAttribute('.flash', 'role')) === 'alert', 'refused click explains in Hebrew and is announced');
await page.click('button.slot.ok');
check(/Placed/.test(await page.textContent('.flash')) && (await page.textContent('.pstatus')).includes('placed 1 / 10'), 'allowed click places the box and updates the score');
await page.click('[data-act="pfill"]');
await page.click('[data-act="pcompare"]');
check((await page.textContent('#content')).includes('Who planned') && (await page.textContent('.pstatus')).includes('placed 10 / 10'), 'computer fills the rest and the comparison shows');
// practice never changes the real loading: start work, the automatic plan loads, practice is read-only
const real = await page.evaluate(() => {
  const v = S.visits[1]; arrive(v); startWork(v);
  let n = 0; while (S.wis.some(w => w.status !== 'COMPLETE') && n++ < 400) cycle();
  const planMap = JSON.stringify(Object.keys(v.plan).sort().map(k => k + v.plan[k].unit + v.plan[k].seq));
  return { phase: v.phase, practiceKept: Object.keys(v.practice).length, breaks: Object.keys(v.plan).filter(k => ruleBreak(v, k)).length, planMap,
    cmp: boardScore(v, autoBoard(v)).placed };
});
check(real.phase === 'COMPLETE' && real.practiceKept === 10 && real.breaks === 0, 'real loading uses the automatic plan and completes, practice kept: ' + JSON.stringify({ ...real, planMap: undefined }));
check(real.cmp === 10, 'comparison after work started still shows the computer plan, got ' + real.cmp);
// the same day without any practice builds exactly the same real plan
await page.click('[data-act="reset"]');
const noPractice = await page.evaluate(() => { const v = S.visits[1]; arrive(v); startWork(v); return JSON.stringify(Object.keys(v.plan).sort().map(k => k + v.plan[k].unit + v.plan[k].seq)); });
check(noPractice === real.planMap, 'practice does not change the real plan');
await page.evaluate(() => { fresh(); const v = S.visits[1]; v.practice = {}; practiceFill(v); arrive(v); startWork(v); UI.page = 'stowage'; UI.stowVisit = v.id; UI.view = 'practice'; render(); });
check((await page.textContent('#content')).includes('Read-only') && !(await page.$('[data-act="pfill"]')), 'practice is read-only once work started');

// a version 3 save loads and reaches the current version
await page.evaluate(raw => localStorage.setItem('tos-trainer-v1', raw), readFileSync(resolve('tools/fixtures/save-v3.json'), 'utf8'));
await page.reload();
s = await state();
check(s.ver === CUR_VER && !(await page.$('.flash.err')), 'v3 save loads at the current version');
await page.click('[data-act="reset"]');

// ---------- version 5: unit vs unit facility visit ----------
const life = await page.evaluate(() => {
  S.apptRule.required = false;   // walk-in trucks: appointments are tested in version 8
  const steps = u => curVisit(u).steps.map(x => x.state).join('>');
  const v1 = S.visits[0], v2 = S.visits[1];
  const imp = Object.values(S.units).find(u => u.visit === v1.id && !u.holds.length);
  const r = { advised: imp.transit };
  for (let i = 0; i < 4; i++) cycle();                         // V001 arrives 07:00
  r.inbound = imp.transit;
  startWork(v1); syncTransit();
  let n = 0; while (imp.state !== 'YARD' && n++ < 40) cycle();
  // a truck takes it: gate out, then the truck leaves
  FORMS.gateout({ unit: imp.id }); syncTransit();
  r.ecout = imp.transit;
  n = 0; while (imp.state !== 'DEPARTED' && n++ < 40) cycle();
  r.importSteps = steps(imp); r.importOut = curVisit(imp).outBy;
  // export: gate in for V002, then load, then the vessel sails
  FORMS.gatein({ kind: 'EXPORT', visit: v2.id, pod: '2', line: 'RED', iso: '22G1' }); syncTransit();
  const exp = Object.values(S.units).filter(u => u.category === 'EXPORT').pop();
  n = 0; while (exp.state !== 'YARD' && n++ < 40) cycle();
  arrive(v2); startWork(v2); syncTransit();
  n = 0; while (v2.phase !== 'COMPLETE' && n++ < 200) cycle();
  // a late export, gated in while the vessel is loading, still records YARD before EC/OUT (review finding)
  const v3 = addVisit('MV Late Test', 'BLU', 0, 4, '28');   // imports keep it WORKING while the late box arrives
  arrive(v3); startWork(v3); syncTransit();
  FORMS.gatein({ kind: 'EXPORT', visit: v3.id, pod: '1', line: 'BLU', iso: '22G1' }); syncTransit();
  const late = Object.values(S.units).filter(u => u.category === 'EXPORT').pop();
  n = 0; while (late.state !== 'LOADED' && n++ < 40) cycle();
  r.lateSteps = steps(late);
  depart(v2); syncTransit();
  r.exportSteps = steps(exp); r.exportOut = curVisit(exp).outBy;
  // a held import refused at the gate records no step
  const held = Object.values(S.units).find(u => u.state === 'YARD' && u.holds.length);
  const before = steps(held); FORMS.gateout({ unit: held.id }); syncTransit(); r.heldSame = before === steps(held);
  // the empty import comes back through the gate: same number, a new visit
  FORMS.gatein({ kind: 'EMPTY', ret: imp.id, line: 'BLU', iso: '22G1' }); syncTransit();
  r.back = { visits: imp.visits.length, oldClosed: imp.visits[0].outTime != null, newCat: curVisit(imp).category, newSteps: steps(imp), id: imp.id };
  n = 0; while (imp.state !== 'YARD' && n++ < 40) cycle();
  r.back.afterYard = steps(imp);
  // no visit ever records the same state twice in a row
  r.dupes = Object.values(S.units).filter(u => u.visits.some(x => x.steps.some((st, i) => i && st.state === x.steps[i - 1].state))).length;
  return r;
});
check(life.advised === 'ADVISED' && life.inbound === 'INBOUND' && life.ecout === 'EC/OUT', 'import: ADVISED, then INBOUND, then EC/OUT at gate-out: ' + JSON.stringify([life.advised, life.inbound, life.ecout]));
check(life.importSteps === 'ADVISED>INBOUND>EC/IN>YARD>EC/OUT>DEPARTED' && life.importOut === 'Truck', 'import life cycle: ' + life.importSteps);
check(life.exportSteps === 'EC/IN>YARD>EC/OUT>LOADED>DEPARTED' && /^Vessel /.test(life.exportOut), 'export life cycle: ' + life.exportSteps);
check(life.lateSteps === 'EC/IN>YARD>EC/OUT>LOADED', 'late export records YARD before EC/OUT: ' + life.lateSteps);
check(life.heldSame, 'a refused truck records no step');
check(life.back.visits === 2 && life.back.oldClosed && life.back.newCat === 'EMPTY' && life.back.newSteps === 'EC/IN' && life.back.afterYard === 'EC/IN>YARD', 'returning container keeps its number and gets a new visit: ' + JSON.stringify(life.back));
check(life.dupes === 0, 'no visit repeats a state');
// the screen: a container number opens the Inspector with its visits and life cycle
await page.evaluate(() => render());
await page.click('nav a[data-id="gate"]');
await page.click(`#content a[data-act="unit"][data-id="${life.back.id}"]`);
const insp = await page.textContent('#content');
check(insp.includes('Unit Inspector') && insp.includes('UFV0') && (await page.$$('#content tr td.mono')).length >= 2 && insp.includes('Life cycle of'), 'container link opens the Inspector with its visits');
check((await page.$$('.tstep')).length === 7 && !!(await page.$('.tstep.now')), 'life cycle shows 7 steps and the current one');
noTip = await auditTips('inspector');
check(noTip.length === 0, 'tooltips missing in the Inspector:\n  ' + noTip.join('\n  '));
await page.click('nav a[data-id="inventory"]');
check((await page.textContent('#content')).includes('Transit state'), 'inventory shows the Transit state column');

// a version 4 save loads: every container gets one visit and a transit state
await page.evaluate(raw => localStorage.setItem('tos-trainer-v1', raw), readFileSync(resolve('tools/fixtures/save-v4.json'), 'utf8'));
await page.reload();
s = await state();
check(s.ver === CUR_VER && Object.values(s.units).every(u => u.visits.length === 1 && u.transit) && !(await page.$('.flash.err')), 'v4 save loads with one visit and a transit state per container');
// a container that had already left in an old save keeps its real out time (review finding)
const v4gone = JSON.parse(readFileSync(resolve('tools/fixtures/save-v4.json'), 'utf8'));
const goneId = Object.keys(v4gone.units).find(id => v4gone.units[id].state === 'YARD');
Object.assign(v4gone.units[goneId], { state: 'DEPARTED', pos: null, outTime: 123 });
for (const k in v4gone.stacks) v4gone.stacks[k] = v4gone.stacks[k].filter(id => id !== goneId);
await page.evaluate(raw => localStorage.setItem('tos-trainer-v1', raw), JSON.stringify(v4gone));
await page.reload();
s = await state();
check(s.units[goneId].transit === 'DEPARTED' && s.units[goneId].visits[0].outTime === 123 && s.units[goneId].visits[0].steps.length === 1, 'old departed container keeps its out time: ' + JSON.stringify(s.units[goneId].visits[0]));
await page.click('[data-act="reset"]');

// ---------- version 6: berth schedule and quay crane split ----------
await page.click('[data-act="reset"]');
s = await state();
check(s.visits[0].cranes === 2 && s.visits[1].cranes === 1 && s.eq.filter(e => e.type === 'QC').every(e => e.vessel === null), 'seed visits ask for 2 and 1 quay cranes, none assigned yet');
await page.click('nav a[data-id="berth"]');
check((await page.$$('.bbar')).length === 2 && (await page.$$('.blbl')).length === 2 && !!(await page.$('.bnow')), 'berth plan shows two quays, two vessel bars and the now line');
// the window estimate: V001 has 8 imports and no exports, 2 cranes -> 4 working cycles after its ETA (07:00) = 08:00
let bw = await page.evaluate(() => berthWindow(S.visits[0]));
check(bw.from === 60 && bw.to === 120 && bw.est, 'V001 window 07:00-08:00 estimated: ' + JSON.stringify(bw));
await page.click('[data-act="cranes"][data-id="V001:1"]');
bw = await page.evaluate(() => berthWindow(S.visits[0]));
check(bw.to === 180, 'one crane doubles the stay (07:00-09:00): ' + JSON.stringify(bw));
await page.click('[data-act="cranes"][data-id="V001:2"]');
// a working vessel gets its cranes; a QC never works for another vessel
await page.evaluate(() => { for (let i = 0; i < 4; i++) cycle(); startWork(S.visits[0]); render(); });
s = await state();
check(s.eq.filter(e => e.type === 'QC' && e.vessel === 'V001').length === 2, 'V001 gets both quay cranes when work starts');
// V002 starts at the same time and has none: its jobs wait with a reason
await page.evaluate(() => { arrive(S.visits[1]); startWork(S.visits[1]); cycle(); render(); });
s = await state();
const v2wi = s.wis.filter(w => w.visit === 'V002' && w.status === 'PLANNED');
check(v2wi.length > 0 && v2wi.every(w => ['No quay crane assigned to this vessel', 'After discharge', 'Slot above not discharged'].includes(w.note)), 'V002 waits with no crane: ' + [...new Set(v2wi.map(w => w.note))]);
check(s.wis.filter(w => w.status === 'DISPATCHED' && w.eq.some(id => id.startsWith('QC'))).every(w => w.visit === 'V001'), 'cranes only work for their own vessel');
// the planner moves QC02 to V002: from the next cycle both vessels work
await page.click('nav a[data-id="berth"]');
await page.click('[data-act="qcAssign"][data-id="QC02:V002"]');
await page.evaluate(() => { cycle(); cycle(); render(); });
s = await state();
check(s.wis.some(w => w.visit === 'V002' && w.eq.includes('QC02')), 'QC02 works for V002 after the move');
noTip = await auditTips('berth');
check(noTip.length === 0, 'tooltips missing on the berth schedule:\n  ' + noTip.join('\n  '));
// when V001 finishes, its crane goes to V002 by itself; everything finishes
const crane = await page.evaluate(() => {
  let n = 0; while (S.visits[0].phase !== 'COMPLETE' && n++ < 100) cycle();
  const freed = S.eq.filter(e => e.type === 'QC' && e.vessel === 'V002').length;
  n = 0; while (S.visits[1].phase !== 'COMPLETE' && n++ < 200) cycle();
  return { freed, done: S.visits[1].phase, after: S.eq.filter(e => e.type === 'QC' && e.vessel).length };
});
check(crane.freed === 1 && crane.done === 'COMPLETE' && crane.after === 0, 'V002 asks for 1 crane and gets one when V001 completes; all cranes free at the end: ' + JSON.stringify(crane));
// conflict: a new vessel for quay 27 while V001 still holds it (complete, not departed)
await page.click('nav a[data-id="vessels"]');
await page.fill('form[data-form="visit"] input[name="eta"]', '0');
await page.click('form[data-form="visit"] button');
check((await page.textContent('.flash')).includes('booked by'), 'creating a visit on a taken quay warns about the conflict');
await page.click('nav a[data-id="berth"]');
check(!!(await page.$('.bbar.bconf')) && (await page.textContent('#content')).includes('CONFLICT'), 'berth plan marks the conflict');
await page.click('[data-act="moveQuay"]');
s = await state();
check(s.visits.at(-1).quay === '28', 'move to the other quay');
const etaBefore = s.visits.at(-1).eta;
await page.click(`[data-act="etaShift"][data-id="${s.visits.at(-1).id}:60"]`);
s = await state();
check(s.visits.at(-1).eta === etaBefore + 60, 'ETA +1h');
// Shabbat stretches the window: a 4-move job with 1 crane starting Fri 14:30 ends Sat 20:30 (2 cycles before, 2 after)
const shabEnd = await page.evaluate(m => addWork(m, 4), 1440 + 14 * 60 + 30 - 360);
check(shabEnd === 2880 + 20 * 60 + 30 - 360, 'Shabbat stretches the berth window: ' + shabEnd);
// a version 5 save loads: visits get a crane request, quay cranes are free
const v5 = JSON.parse(readFileSync(resolve('tools/fixtures/save-v4.json'), 'utf8'));
await page.evaluate(raw => localStorage.setItem('tos-trainer-v1', raw), JSON.stringify(v5));
await page.reload();
s = await state();
check(s.ver === CUR_VER && s.visits.every(v => v.cranes === 1) && s.eq.filter(e => e.type === 'QC').every(e => 'vessel' in e), 'old save gets cranes per visit and a vessel field per QC');
await page.click('[data-act="reset"]');

// ---------- version 7: rail ----------
await page.click('[data-act="reset"]');
s = await state();
const t1 = s.trains[0];
const onTrain = Object.values(s.units).filter(u => u.train === t1.id && u.state === 'ON_TRAIN');
const bookedImp = Object.values(s.units).filter(u => u.train === t1.id && u.category === 'IMPORT');
check(t1 && t1.phase === 'INBOUND' && t1.cars === 4 && onTrain.length === 4 && onTrain.every(u => u.category === 'EXPORT' && u.visit === 'V002' && u.car), 'demo train T001 brings 4 exports for V002 on its cars');
check(bookedImp.length === 3 && bookedImp.filter(u => u.holds.length).length === 1 && onTrain.every(u => u.transit === 'ADVISED'), 'three yard imports booked to T001, one under hold; boxes on an inbound train are ADVISED');
check(s.eq.some(e => e.id === 'RMG01' && e.type === 'RMG'), 'rail crane RMG01 exists');
await page.click('nav a[data-id="gate"]');
check(!(await page.$$eval('form[data-form="gateout"] option', os => os.map(o => o.value))).some(id => bookedImp.some(u => u.id === id)), 'imports booked to a train are not offered to trucks');
await page.click('nav a[data-id="rail"]');
check((await page.$$('.car')).length === 4 && (await page.textContent('#content')).includes('Inland shuttle 1'), 'rail screen draws the 4 cars of T001');
// the train arrives by itself at 09:00 (12 cycles)
for (let i = 0; i < 12; i++) await page.click('[data-act="cycle"]');
s = await state();
check(s.trains[0].phase === 'ARRIVED' && s.trains[0].ata === 180, 'T001 arrives on the siding at 09:00: ' + s.trains[0].phase);
// a second train waits for the siding
await page.fill('form[data-form="train"] input[name="eta"]', '0');
await page.click('form[data-form="train"] button');
await page.click('[data-act="cycle"]');
s = await state();
check(s.trains[1].phase === 'INBOUND' && /siding/.test(s.trains[1].wait || ''), 'a second train waits while the siding is taken: ' + s.trains[1].wait);
await page.click('[data-act="trainShow"][data-id="T001"]');
await page.click('[data-act="trainStart"][data-id="T001"]');
s = await state();
const railWi = s.wis.filter(w => w.train === 'T001');
check(railWi.filter(w => w.kind === 'RAIL_DISCH').length === 4 && railWi.filter(w => w.kind === 'RAIL_LOAD').length === 3 && s.trains[0].phase === 'WORKING', 'start work: 4 rail discharges + 3 rail loads');
check(Object.values(s.units).filter(u => u.train === 'T001' && u.category === 'IMPORT').every(u => u.car), 'every booked import gets a car');
noTip = await auditTips('rail');
check(noTip.length === 0, 'tooltips missing on the rail screen:\n  ' + noTip.join('\n  '));
await page.click('nav a[data-id="rail"]');
for (let i = 0; i < 12; i++) await page.click('[data-act="cycle"]');
s = await state();
const exIn = onTrain.map(u => s.units[u.id]);
check(exIn.every(u => u.state === 'YARD' && ['A', 'B'].includes(u.pos[0]) && !u.train), 'rail exports go to the export blocks');
check(s.wis.filter(w => w.train === 'T001' && w.status === 'COMPLETE').every(w => w.eq.includes('RMG01') && !w.eq.some(e => e.startsWith('AGV'))), 'rail moves use the rail crane and a yard crane, no AGV');
const heldImp = s.units[bookedImp.find(u => u.holds.length).id];
check(s.trains[0].phase === 'COMPLETE' && heldImp.state === 'YARD' && s.wis.find(w => w.id === heldImp.wi)?.note.startsWith('Hold'), 'train complete; the held import waits for its hold: ' + s.trains[0].phase);
check(bookedImp.filter(u => !u.holds.length).every(u => s.units[u.id].state === 'LOADED' && s.units[u.id].transit === 'LOADED'), 'free imports are loaded onto the train');
check(s.charges.filter(c => c.type === 'LIFT_RAIL').length === 6, 'six rail lifts charged');
check(s.visits[1].phase === 'INBOUND' && exIn.every(u => s.units[u.id].category === 'EXPORT'), 'rail exports wait in the yard for V002');
// release the hold: the box goes on the train even though work was complete; then the train departs
await page.click('nav a[data-id="inventory"]');
await page.click(`[data-act="release"][data-id="${heldImp.id}"]`);
for (let i = 0; i < 2; i++) await page.click('[data-act="cycle"]');
await page.click('nav a[data-id="rail"]');
await page.click('[data-act="trainDepart"][data-id="T001"]');
s = await state();
check(s.trains[0].phase === 'DEPARTED' && bookedImp.every(u => s.units[u.id].state === 'DEPARTED' && s.units[u.id].transit === 'DEPARTED' && s.units[u.id].visits.at(-1).outBy.startsWith('Train')), 'all three imports leave by train');
// the waiting train takes the siding
await page.click('[data-act="cycle"]');
s = await state();
check(s.trains[1].phase === 'ARRIVED', 'the second train arrives once the siding is free');
// when V002 works, the exports that came by rail are planned and loaded
const railEx = await page.evaluate(ids => { const v = S.visits[1]; arrive(v); startWork(v); let n = 0; while (v.phase === 'WORKING' && n++ < 200) cycle(); return ids.map(id => S.units[id].state); }, exIn.map(u => u.id));
check(railEx.every(x => x === 'LOADED'), 'exports that came by rail are loaded on V002: ' + railEx);
// a train leaves without a box on hold: the box stays in the yard, free again
const behind = await page.evaluate(() => {
  const t = S.trains[1], u = Object.values(S.units).find(x => railReady(x) && x.holds.length);
  if (!u) return 'no held import';
  u.train = t.id; trainStart(t); let n = 0; while (t.phase === 'WORKING' && n++ < 40) cycle();
  const ph = t.phase; trainDepart(t);
  return { ph, train: u.train, wi: u.wi, state: u.state };
});
check(behind.ph === 'COMPLETE' && behind.train === null && behind.wi === null && behind.state === 'YARD', 'a held box is left behind when the train departs: ' + JSON.stringify(behind));
// a version 6 save (the v4 fixture goes through every step) gets an empty train list and the rail crane
await page.evaluate(raw => localStorage.setItem('tos-trainer-v1', raw), readFileSync(resolve('tools/fixtures/save-v4.json'), 'utf8'));
await page.reload();
s = await state();
check(s.ver === CUR_VER && Array.isArray(s.trains) && s.trains.length === 0 && s.eq.some(e => e.id === 'RMG01'), 'old save gets the rail crane and no trains');
await page.click('nav a[data-id="rail"]');
check((await page.textContent('#content')).includes('No train visits'), 'rail screen works on an old save');
await page.click('[data-act="reset"]');

// ---------- version 8: truck appointments ----------
await page.click('[data-act="reset"]');
s = await state();
const seedAp = s.appts[0];
check(s.apptRule.required && s.apptRule.cap === 3 && s.appts.length === 2 && seedAp.kind === 'DELIVER' && seedAp.slot === 60, 'demo has two appointments, rule on, 3 per hour');
// a truck with no appointment is turned away and creates nothing
await page.click('nav a[data-id="gate"]');
let unitsBefore8 = Object.keys(s.units).length;
await page.selectOption('form[data-form="gatein"] select[name="appt"]', '');
await page.click('form[data-form="gatein"] button');
s = await state();
check((await page.textContent('.flash')).includes('No appointment') && s.gate.at(-1).status === 'REJECTED' && Object.keys(s.units).length === unitsBefore8, 'walk-in truck rejected, no unit created');
// the seeded pickup (07:00-08:00) is too early at 06:00, on time at 06:45
await page.selectOption('form[data-form="gateout"] select[name="unit"]', seedAp.unit);
await page.click('form[data-form="gateout"] button');
s = await state();
check(s.gate.at(-1).reason.startsWith('Too early') && s.gate.at(-1).truck === seedAp.truck && s.appts[0].status === 'BOOKED', 'early truck rejected, appointment kept: ' + s.gate.at(-1).reason);
for (let i = 0; i < 3; i++) await page.click('[data-act="cycle"]');
await page.click('nav a[data-id="gate"]');
await page.selectOption('form[data-form="gateout"] select[name="unit"]', seedAp.unit);
await page.click('form[data-form="gateout"] button');
s = await state();
check(s.appts[0].status === 'USED' && s.gate.at(-1).appt === seedAp.id && s.gate.at(-1).status === 'PLANNED' && s.units[seedAp.unit].wi, 'on-time truck accepted and uses its appointment');
// book the current hour (06:00-07:00) until it is full; the next booking is refused
await page.click('nav a[data-id="appts"]');
check((await page.$$('.aslot')).length === 24, '24 bookable hours shown');
await page.selectOption('form[data-form="appt"] select[name="kind"]', 'RECEIVE EXPORT');
await page.selectOption('form[data-form="appt"] select[name="slot"]', '0');
await page.click('form[data-form="appt"] button');
check((await page.textContent('.flash')).includes('booked'), 'appointment booked from the form');
const full = await page.evaluate(() => {
  FORMS.appt({ kind: 'RECEIVE EMPTY', slot: '0' }); FORMS.appt({ kind: 'RECEIVE EXPORT', slot: '0' });
  const n = S.appts.length; FORMS.appt({ kind: 'RECEIVE EXPORT', slot: '0' }); render();
  return { n, after: S.appts.length, used: apptUsed(0), msg: UI.msg.text };
});
check(full.used === 3 && full.after === full.n && full.msg.includes('full'), 'fourth truck in a full hour refused: ' + JSON.stringify(full));
check(await page.$eval('.aslot[data-id="0"]', b => b.disabled && b.classList.contains('afull')), 'full hour drawn red and disabled');
// gate in with an appointment for something else is refused; with the right one it is accepted
const g8 = await page.evaluate(() => {
  const ex = S.appts.find(a => a.slot === 0 && a.kind === 'RECEIVE EXPORT' && a.status === 'BOOKED');
  FORMS.gatein({ kind: 'EMPTY', appt: ex.id, line: 'BLU', iso: '22G1' });
  const wrong = S.gate.at(-1).reason;
  FORMS.gatein({ kind: 'EXPORT', appt: ex.id, visit: S.visits[1].id, pod: '1', line: 'RED', iso: '22G1' });
  return { wrong, ok: S.gate.at(-1).status, appt: ex.status, truck: S.gate.at(-1).truck === ex.truck };
});
check(g8.wrong.includes('not to return an empty') && g8.ok === 'PLANNED' && g8.appt === 'USED' && g8.truck, 'appointment for another purpose refused, right one used: ' + JSON.stringify(g8));
// cancel frees the place
await page.click('nav a[data-id="appts"]');
const cancelId = await page.evaluate(() => S.appts.find(a => a.slot === 0 && a.kind === 'RECEIVE EMPTY').id);
await page.click(`[data-act="apptCancel"][data-id="${cancelId}"]`);
s = await state();
check(s.appts.find(a => a.id === cancelId).status === 'CANCELLED', 'appointment cancelled');
// a truck that never came: the 09:00 export drop-off is MISSED after 11:30
await page.evaluate(() => { for (let i = 0; i < 24; i++) cycle(); render(); });
s = await state();
check(s.appts[1].status === 'MISSED' && s.log.some(e => e.msg.includes(s.appts[1].id + ' missed')), 'unused appointment becomes MISSED');
noTip = await auditTips('v8');
check(noTip.length === 0, 'tooltips missing after appointments:\n  ' + noTip.join('\n  '));
// rule off: any truck may come
await page.evaluate(() => { FORMS.apptRule({ cap: '3' }); FORMS.gatein({ kind: 'EMPTY', appt: '', line: 'GRN', iso: '22G1' }); render(); });
s = await state();
check(!s.apptRule.required && s.gate.at(-1).status === 'PLANNED' && !s.gate.at(-1).appt, 'rule off: walk-in accepted');
// berth schedule: Start work and Depart buttons work there too
await page.click('[data-act="reset"]');
for (let i = 0; i < 4; i++) await page.click('[data-act="cycle"]');
await page.click('nav a[data-id="berth"]');
await page.click('[data-act="start"][data-id="V001"]');
s = await state();
check(s.visits[0].phase === 'WORKING', 'Start work from the berth schedule');
check(await page.$eval('[data-act="depart"][data-id="V001"]', b => b.disabled), 'Depart disabled while working');
await page.evaluate(() => { let n = 0; while (S.visits[0].phase === 'WORKING' && n++ < 100) cycle(); render(); });
await page.click('[data-act="depart"][data-id="V001"]');
s = await state();
check(s.visits[0].phase === 'DEPARTED', 'Depart from the berth schedule');
// version 9: yard rules. The default is one vessel per export stack and imports spread low, as before
await page.click('[data-act="reset"]');
await page.click('nav a[data-id="yardrules"]');
s = await state();
check(s.yardRules.on.VESSEL && !s.yardRules.on.POD && s.yardRules.imports === 'SPREAD' && s.yardRules.order[0] === 'VESSEL', 'default yard rules: same vessel only, spread low');
check(await page.$eval('[data-act="ruleUp"][data-id="VESSEL"]', b => b.disabled), 'top rule cannot move up');
const y9 = await page.evaluate(() => {
  const R = S.yardRules, all = { order: R.order, on: Object.fromEntries(R.order.map(id => [id, true])), imports: 'SPREAD' };
  return { none: yardTest({ order: R.order, on: {}, imports: 'SPREAD' }), all: yardTest(all), pile: yardTest(Object.assign({}, all, { imports: 'PILE' })), rows: document.querySelectorAll('fieldset table.grid')[1].rows.length };
});
check(y9.rows === 5 && y9.all.total < y9.none.total && y9.all.stacks > y9.none.stacks && y9.pile.stacks < y9.all.stacks && y9.pile.imp > y9.all.imp,
  'rule test: all rules fewer rehandles but more stacks, piling up saves stacks and costs rehandles: ' + JSON.stringify(y9));
// switching a rule on is logged, restarts the counters, and the next export keeps to it
await page.click('[data-act="ruleToggle"][data-id="POD"]');
s = await state();
check(s.yardRules.on.POD && s.log.at(-1).msg.startsWith('Yard rules: Same port of discharge on') && s.yardSince.rehandles === s.stats.rehandles, 'POD rule switched on and logged');
const pod9 = await page.evaluate(() => {
  const v = S.visits[1], key = S.units[Object.keys(S.units).find(id => S.units[id].visit === v.id && S.units[id].category === 'EXPORT')].pos;
  const pod = S.stacks[key].map(id => S.units[id].pod)[0] % 3 + 1;     // a port no box in that stack goes to
  const u = { id: 'TEST', category: 'EXPORT', visit: v.id, pod, weight: 10, iso: '22G1', holds: [] };
  const to = planSlot(u);
  return { breaks: stackBreaks(u, to, rulesFor(u)), mixed: S.stacks[to].some(id => S.units[id].pod !== pod) };
});
check(!pod9.breaks.length && !pod9.mixed, 'an export goes to a stack with its own port only: ' + JSON.stringify(pod9));
// order: moving a rule down swaps it with the next one
await page.click('[data-act="ruleDown"][data-id="VESSEL"]');
s = await state();
check(s.yardRules.order[0] === 'POD' && s.yardRules.order[1] === 'VESSEL', 'rule moved down');
// pile up: an import goes on a stack that already has boxes
await page.click('[data-act="yardImports"][data-id="PILE"]');
const pile9 = await page.evaluate(() => { const u = { id: 'TEST', category: 'IMPORT', visit: null, weight: 10, iso: '22G1', holds: [] }; const to = planSlot(u); return { h: S.stacks[to].length, spread: (S.yardRules.imports = 'SPREAD', S.stacks[planSlot(u)].length), back: (S.yardRules.imports = 'PILE') }; });
check(pile9.h > 0 && pile9.spread === 0, 'pile up puts an import on a started stack, spread low on an empty one: ' + JSON.stringify(pile9));
noTip = await auditTips('v9');
check(noTip.length === 0, 'tooltips missing after yard rules:\n  ' + noTip.join('\n  '));
await page.click('nav a[data-id="yardrules"]');
await page.click('[data-act="rulesDefault"]');
s = await state();
check(s.yardRules.order[0] === 'VESSEL' && !s.yardRules.on.POD && s.yardRules.imports === 'SPREAD', 'back to the default rules');
// an older save gets no appointments and the rule switched on
await page.evaluate(raw => localStorage.setItem('tos-trainer-v1', raw), readFileSync(resolve('tools/fixtures/save-v4.json'), 'utf8'));
await page.reload();
s = await state();
check(s.ver === CUR_VER && s.appts.length === 0 && s.apptRule.required && s.apptRule.cap === 3, 'old save gets appointments, none booked');
check(s.yardRules.on.VESSEL && !s.yardRules.on.POD && s.yardRules.imports === 'SPREAD' && s.yardSince, 'old save gets the default yard rules');
await page.click('nav a[data-id="yardrules"]');
check((await page.textContent('#content')).includes('Your rules'), 'yard rules screen works on an old save');
await page.click('nav a[data-id="appts"]');
check((await page.textContent('#content')).includes('No appointments yet'), 'appointments screen works on an old save');
await page.click('[data-act="reset"]');

// phone width: no horizontal scroll on the page itself
await page.setViewportSize({ width: 390, height: 800 });
for (const id of ['overview', 'vessels', 'berth', 'stowage', 'yardrules', 'inspector', 'gate', 'appts', 'rail', 'equipment']) {
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
