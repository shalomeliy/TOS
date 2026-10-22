// Throwaway spike: does plan-order loading (later POD lower, heavier lower) finish in reasonable cycles,
// and how many extra yard rehandles does it cause compared with today's creation-order loading?
// Run from the project root: node spikes/stowage-plan/spike.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const exe = resolve(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe');
const browser = await chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
const url = pathToFileURL(resolve('index.html')).href;

async function run(seed, mode, extra) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // seeded Math.random so both modes see the same yard
  await page.addInitScript(s => { let x = s; Math.random = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648); }, seed);
  await page.goto(url);
  const r = await page.evaluate(({ mode, extra }) => {
    localStorage.clear();
    fresh();
    const v = S.visits[1];
    for (let i = 0; i < extra; i++) {
      const u = addUnit({ line: 'RED', category: 'EXPORT', iso: Math.random() < 0.3 ? '45G1' : '22G1', visit: v.id, state: 'YARD', inTime: -1440 });
      placeUnit(u, planSlot(u));
    }
    const exportsList = Object.values(S.units).filter(u => u.visit === v.id && u.category === 'EXPORT');
    exportsList.forEach(u => { u.pod = 1 + Math.floor(Math.random() * 3); });
    const yardRehBefore = S.stats.rehandles;
    arrive(v); startWork(v);

    // ship: 20' bays 01,03 and 40' bay 06; 4 rows; tiers 02,04 (hold) 82,84 (deck)
    const TIERS = ['02', '04', '82', '84'], ROWS = 4;
    const plan = {};          // unitId -> {slot, below}
    const order = [];
    for (const [size, bays] of [['20', ['01', '03']], ['40', ['06']]]) {
      const units = exportsList.filter(u => (u.iso[0] === '4' ? '40' : '20') === size)
        .sort((a, b) => b.pod - a.pod || b.weight - a.weight);
      let i = 0;
      for (const bay of bays) for (let t = 0; t < TIERS.length; t++) for (let r = 1; r <= ROWS; r++) {
        if (i >= units.length) break;
        const u = units[i++];
        plan[u.id] = { slot: `${bay}-${String(r).padStart(2, '0')}-${TIERS[t]}`, below: t ? `${bay}-${String(r).padStart(2, '0')}-${TIERS[t - 1]}` : null };
        order.push(u.id);
      }
    }
    const filled = new Set();
    let floating = 0;
    if (mode === 'plan') {
      S.wis.filter(w => w.kind === 'LOAD').forEach(w => { w.created = order.indexOf(w.unit); });
      const origTry = window.tryDispatch, origComplete = window.complete;
      window.tryDispatch = w => {
        if (w.kind === 'LOAD') { const p = plan[w.unit]; if (p.below && !filled.has(p.below)) { w.note = 'Slot below not loaded'; return false; } }
        return origTry(w);
      };
      window.complete = w => {
        if (w.kind === 'LOAD') { const p = plan[w.unit]; if (p.below && !filled.has(p.below)) floating++; filled.add(p.slot); }
        return origComplete(w);
      };
    }
    // in baseline, count rule breaks if units were stacked in the order they happen to load
    const loadOrder = [];
    if (mode === 'base') {
      const orig = window.complete;
      window.complete = w => { if (w.kind === 'LOAD') loadOrder.push(w.unit); return orig(w); };
    }
    let cycles = 0;
    while (S.wis.some(w => w.visit === v.id && w.status !== 'COMPLETE') && cycles < 500) { cycle(); cycles++; }
    let breaks = 0;
    if (mode === 'base') {
      // same fill rule (bottom tier first) applied to actual load order
      const stacks = {};
      loadOrder.forEach((id, k) => {
        const u = S.units[id], size = u.iso[0] === '4' ? 40 : 20;
        const key = size + '-' + (k % (size === 40 ? 4 : 8));
        const st = (stacks[key] ||= []);
        const under = st[st.length - 1];
        if (under && (u.pod > under.pod || (u.pod === under.pod && u.weight > under.weight))) breaks++;
        st.push(u);
      });
    }
    return { cycles, exports: exportsList.length, loaded: exportsList.filter(u => u.state === 'LOADED').length,
      rehandles: S.stats.rehandles - yardRehBefore, floating, breaks };
  }, { mode, extra });
  await page.close();
  return { ...r, errors };
}

const rows = [];
for (const extra of [0, 14]) for (const seed of [1, 2, 3, 4, 5]) {
  const base = await run(seed, 'base', extra);
  const plan = await run(seed, 'plan', extra);
  rows.push({ exports: base.exports, seed, baseCycles: base.cycles, planCycles: plan.cycles, baseReh: base.rehandles, planReh: plan.rehandles,
    baseRuleBreaks: base.breaks, planFloating: plan.floating, planLoaded: `${plan.loaded}/${plan.exports}`, errors: base.errors.length + plan.errors.length });
}
console.table(rows);
await browser.close();
