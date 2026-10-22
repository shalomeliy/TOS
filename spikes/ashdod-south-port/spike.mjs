// Throwaway spike for version 2 (Ashdod): with 2 ASCs sharing each block and dispatch paused on Shabbat,
// does the day still finish without stalls, double moves or broken stacks? And does a Fri->Sun run behave?
// Run from the project root: node spikes/ashdod-south-port/spike.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const exe = resolve(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe');
const browser = await chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
const url = pathToFileURL(resolve('index.html')).href;

async function run(seed, { asc2, startAt, extra }) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(s => { let x = s; Math.random = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648); }, seed);
  await page.goto(url);
  const r = await page.evaluate(({ asc2, startAt, extra }) => {
    localStorage.clear();
    fresh();
    if (asc2) BLOCKS.forEach(b => S.eq.push({ id: 'ASC-' + b.id + '2', type: 'ASC-' + b.id, desc: 'ASC 2', status: 'IDLE', wi: null, moves: 0 }));
    // Shabbat: T0 = Thu 06:00, so Fri 15:00 = 1980 and Sat 20:00 = 3720 (and every 7 days after)
    const isWorkTime = m => { const w = ((m % 10080) + 10080) % 10080; return !(w >= 1980 && w < 3720); };
    const orig = tryDispatch;
    let pausedDispatch = 0;
    tryDispatch = wi => { if (!isWorkTime(S.clock)) { pausedDispatch++; wi.note = 'Shabbat'; return false; } return orig(wi); };
    const dispatchedInShabbat = [];
    const v1 = S.visits[0], v2 = S.visits[1];
    for (let i = 0; i < extra; i++) {
      const u = addUnit({ line: 'RED', category: 'EXPORT', iso: '22G1', visit: v2.id, state: 'YARD', inTime: -1440 });
      placeUnit(u, planSlot(u));
    }
    S.clock = startAt;
    arrive(v1); startWork(v1); arrive(v2); startWork(v2);
    let cycles = 0;
    while (S.wis.some(w => w.status !== 'COMPLETE') && cycles < 2000) {
      cycle(); cycles++;
      S.wis.filter(w => w.status === 'DISPATCHED' && w.started === S.clock && !isWorkTime(S.clock)).forEach(w => dispatchedInShabbat.push(w.id));
    }
    const stacks = Object.values(S.stacks), flat = stacks.flat();
    return {
      cycles, endClock: S.clock, pausedDispatch, dispatchedInShabbat: dispatchedInShabbat.length,
      open: S.wis.filter(w => w.status !== 'COMPLETE').length,
      maxHeight: Math.max(...stacks.map(s => s.length)), dup: flat.length - new Set(flat).size,
      yardMismatch: Object.values(S.units).filter(u => u.state === 'YARD').length - flat.length,
      loaded: Object.values(S.units).filter(u => u.visit === v2.id && u.category === 'EXPORT' && u.state !== 'LOADED').length,
      rehandles: S.stats.rehandles,
      ascMoves: S.eq.filter(e => e.type.startsWith('ASC')).map(e => e.id + ':' + e.moves).join(' '),
    };
  }, { asc2, startAt, extra });
  await page.close();
  return { ...r, errors };
}

const fmt = m => { const d = new Date(Date.UTC(2026, 9, 22, 6, 0) + m * 60000); return d.toUTCString().slice(0, 3) + ' ' + d.toISOString().slice(11, 16); };
console.log('scenario                         | ASC | cycles | ends      | open | in-shabbat | maxH | dup | mismatch | not loaded | rehandles | err');
for (const [name, startAt] of [['Thu 06:00 (normal day)', 0], ['Fri 13:00 (runs into Shabbat)', 1860]]) {
  for (const extra of [0, 14]) for (const asc2 of [false, true]) for (const seed of [1, 2, 3]) {
    const r = await run(seed, { asc2, startAt, extra });
    console.log(`${(name + ' +' + extra).padEnd(32)} | ${asc2 ? 8 : 4}   | ${String(r.cycles).padStart(6)} | ${fmt(r.endClock)} | ${String(r.open).padStart(4)} | ${String(r.dispatchedInShabbat).padStart(10)} | ${r.maxHeight}    | ${r.dup}   | ${r.yardMismatch}        | ${r.loaded}          | ${String(r.rehandles).padStart(9)} | ${r.errors.length}`);
  }
}
await browser.close();
