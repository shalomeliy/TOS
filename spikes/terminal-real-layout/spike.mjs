// Throwaway spike for roadmap v12 (full-size training terminal, docs/specs/terminal-real-layout.md section 12).
// 1) speed: does the full terminal (16 blocks x 2,112 places, 8 QC, 36 sprinters, 32 yard cranes, a few hundred boxes) load
//    in under 1 s and run a cycle in under 50 ms? Also: what today's index.html yard search would cost at that size.
// 2) flow: one command in 3 stages (QC > lane > sprinter > TP zone > yard crane) with full lanes, a full TP and the reject chain.
//    Does any box get stuck, lost or doubled?
// Run from the project root: node spikes/terminal-real-layout/spike.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch();
const spikeUrl = pathToFileURL(resolve('spikes/terminal-real-layout/spike.html')).href;
const appUrl = pathToFileURL(resolve('index.html')).href;
const out = [];
const say = s => { console.log(s); out.push(s); };
let fails = 0;
const ok = (cond, msg) => { say(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

async function open(throttle = 1) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (throttle > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  await page.goto(spikeUrl);
  return { page, errors };
}

// ---------------- 1. speed ----------------
say('## 1. Speed');
say('| CPU | boxes in yard | load (ms) | fresh + first draw (ms) | cycles | cycle avg / max (ms) | draw avg / max (ms) |');
say('|---|---|---|---|---|---|---|');
for (const throttle of [1, 4]) for (const yard of [400, 3000, 20000]) {
  const { page, errors } = await open(throttle);
  const load = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n.loadEventEnd - n.startTime; });
  const r = await page.evaluate(yard => {
    const t0 = performance.now(); SPIKE.fresh({ seed: 1, yard }); SPIKE.render(); const first = performance.now() - t0;
    const cyc = [], drw = [];
    let n = 0;
    while (SPIKE.S.cmds.some(c => c.status !== 'DONE') && n++ < 400) { SPIKE.cycle(); cyc.push(SPIKE.S.lastCycleMs); SPIKE.render(); drw.push(SPIKE.S.lastRenderMs); }
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    return { first, n, cAvg: avg(cyc), cMax: Math.max(...cyc), dAvg: avg(drw), dMax: Math.max(...drw), boxes: Object.keys(SPIKE.S.units).length };
  }, yard);
  say(`| ${throttle === 1 ? 'normal' : 'slow x4'} | ${yard} (total ${r.boxes}) | ${load.toFixed(0)} | ${r.first.toFixed(1)} | ${r.n} | ${r.cAvg.toFixed(2)} / ${r.cMax.toFixed(2)} | ${r.dAvg.toFixed(1)} / ${r.dMax.toFixed(1)} |`);
  if (errors.length) { say('page errors: ' + errors.join('; ')); fails++; }
  await page.close();
}

// today's index.html: planSlot scans every stack and, for each, every open work instruction. Same search at the new size
{
  const page = await browser.newPage();
  await page.goto(appUrl);
  const r = await page.evaluate(() => {
    localStorage.clear(); fresh();
    const res = {};
    for (const [label, perBlock, wis] of [['today (48 stacks)', 0, 0], ['5,632 stacks, 0 open WI', 1408, 0], ['5,632 stacks, 300 open WI', 1408, 300]]) {
      fresh();
      for (const b of ['A', 'B', 'C', 'D']) for (let i = 0; i < perBlock; i++) S.stacks[`${b}-x${i}`] = [];
      const anyUnit = Object.keys(S.units)[0];
      for (let i = 0; i < wis; i++) S.wis.push({ id: 'X' + i, unit: anyUnit, dest: 'none', status: 'DISPATCHED', kind: 'DISCHARGE' });
      const u = Object.values(S.units).find(x => x.category === 'IMPORT') || Object.values(S.units)[0];
      const t0 = performance.now(); for (let i = 0; i < 20; i++) planSlot(u); res[label] = (performance.now() - t0) / 20;
    }
    return res;
  });
  say('');
  say('Today\'s yard search (`planSlot` in index.html), one call:');
  for (const [k, v] of Object.entries(r)) say(`- ${k}: ${v.toFixed(2)} ms`);
  await page.close();
}

// ---------------- 2. flow ----------------
say('');
say('## 2. Flow and the reject chain');
const { page, errors } = await open();
const E = (fn, arg) => page.evaluate(fn, arg);
// helper inside the page: run until done or stalled, checking the invariants after every cycle
await E(() => {
  window.runAll = (max = 600, everyCycle) => {
    let n = 0, errs = [], stall = 0;
    while (SPIKE.S.cmds.some(c => c.status !== 'DONE' && !(c.why || '').includes('no other')) && n++ < max) {
      if (everyCycle) everyCycle(n);
      const moved = SPIKE.cycle();
      const e = SPIKE.check(); if (e.length) { errs = errs.concat(e.slice(0, 3)); break; }
      stall = moved ? 0 : stall + 1;
      if (stall > 12 && !SPIKE.S.eq.some(m => ['WORKSHOP', 'STUCK', 'HATCH'].includes(m.status))) return { n, errs, deadlock: true };
    }
    const open = SPIKE.S.cmds.filter(c => c.status !== 'DONE');
    return { n, errs, deadlock: false, open: open.length, waiting: open.map(c => c.id + ': ' + c.why) };
  };
});

// 2.1 a full day, booked lanes, 5 seeds
for (const seed of [1, 2, 3, 4, 5]) {
  const r = await E(seed => { SPIKE.fresh({ seed }); return runAll(); }, seed);
  ok(!r.deadlock && !r.errs.length && r.open === 0, `full run seed ${seed}: ${r.n} cycles, open ${r.open}, errors ${r.errs.length}, deadlock ${r.deadlock}`);
}
// 2.2 lock-up hunt: all 8 QCs into one block, many mixes. Naive = the yard crane puts a load box on the TP without
// booking a lane at the quay crane first (in theory: lanes full of discharges + TP full of loads = nobody can move)
{
  const r = await E(() => {
    const res = {};
    for (const rl of [false, true]) { let dead = 0, runs = 0;
      for (let seed = 1; seed <= 20; seed++) for (const crew of [1, 2, 3]) for (const [d, l] of [[20, 20], [5, 30], [30, 5]]) {
        SPIKE.fresh({ seed, crew, block: 3, disch: d, load: l, reserveLane: rl }); runs++;
        const x = runAll(2000); if (x.deadlock || x.open || x.errs.length) dead++;
      }
      res[rl] = `${dead} of ${runs}`; }
    return res;
  });
  say(`INFO  lock-up hunt, all 8 QCs into one block: without lane booking ${r.false} runs locked up`);
  ok(r.true.startsWith('0 '), `lock-up hunt with the lane booked when the yard crane starts a Load: ${r.true} runs locked up`);
}
// 2.3 crew size: 1 sprinter vs 3
{
  const r = await E(() => {
    const res = {};
    for (const crew of [1, 2, 3]) { SPIKE.fresh({ seed: 2, crew }); const x = runAll(); res[crew] = { n: x.n, waited: SPIKE.S.eq.filter(e => e.type === 'QC').reduce((a, e) => a + e.waited, 0) }; }
    return res;
  });
  say(`INFO  crew size: 1 sprinter = ${r[1].n} cycles (QC idle ${r[1].waited}), 2 = ${r[2].n} (${r[2].waited}), 3 = ${r[3].n} (${r[3].waited})`);
  ok(r[3].n < r[1].n, 'with 3 sprinters the quay cranes finish in fewer cycles than with 1');
  const lanes = await E(() => { SPIKE.fresh({ seed: 2, crew: 1 }); for (let i = 0; i < 6; i++) SPIKE.cycle(); return SPIKE.S.eq.filter(e => e.why === 'all 4 lanes occupied').length; });
  ok(lanes > 0, `with 1 sprinter, ${lanes} quay cranes say "all 4 lanes occupied"`);
  const zero = await E(() => { SPIKE.fresh({ seed: 2 }); const q = SPIKE.eq('QC03'); SPIKE.S.crew.QC03.slice().forEach(id => SPIKE.assign(SPIKE.eq(id), null)); SPIKE.cycle(); return q.why; });
  ok(zero === 'no sprinter assigned', `QC03 with 0 sprinters: "${zero}"`);
  const fourth = await E(() => { SPIKE.fresh({ seed: 2, crew: 3 }); return SPIKE.assign(SPIKE.eq('SP36'), 'QC01'); });
  ok(fourth === 'max 3', `a 4th sprinter for QC01: "${fourth}"`);
}
// 2.4 full TP: the water-side yard crane of block 05 is in the workshop
{
  const r = await E(() => {
    SPIKE.fresh({ seed: 3, block: 5, disch: 6, load: 0 }); SPIKE.eq('ASC-05W').status = 'WORKSHOP';
    for (let i = 0; i < 15; i++) SPIKE.cycle();
    const full = SPIKE.S.tpW[5].every(Boolean), msg = SPIKE.S.cmds.find(c => c.why.includes('zones occupied'))?.why || '';
    SPIKE.eq('ASC-05W').status = 'IDLE';
    const after = runAll();
    return { full, msg, after, errs: SPIKE.check() };
  });
  ok(r.full && r.msg.includes('block 05'), `yard crane in workshop: TP fills, sprinter waits: "${r.msg}"`);
  ok(r.after.open === 0 && !r.after.deadlock && !r.errs.length, `crane back: everything flows on by itself, ${r.after.open} open`);
}
// 2.5 twin: a TP full of twins
{
  const r = await E(() => {
    SPIKE.fresh({ seed: 4, block: 7, disch: 0, load: 0 });
    // 8 twin discharges for QC01 into block 07
    const S = SPIKE.S; let u = 900000;
    for (let i = 0; i < 8; i++) { const a = 'TWNU' + (++u), b = 'TWNU' + (++u); S.units[a] = { id: a, size: 20, onVessel: 'V1' }; S.units[b] = { id: b, size: 20, onVessel: 'V1' };
      const c = S.cmds.length; S.cmds.push({ ...JSON.parse(JSON.stringify({})), id: 'TW' + i, kind: 'DISCHARGE', qc: 'QC01', block: 7, units: [a, b], st: 0, stages: ['QC', 'SP', 'ASC'], lane: null, laneQc: null, laneBy: null, zone: null, mach: null, status: 'QUEUED', why: '', rejectedBy: [new Set(), new Set(), new Set()], returns: 0, lifts: 0, lastProgress: 0, history: [] }); }
    const x = runAll();
    const h = S.cmds.flatMap(c => c.history);
    return { x, qc: h.filter(s => s.startsWith('QC')).length, sp: h.filter(s => s.startsWith('SP')).length, asc: h.filter(s => s.startsWith('ASC')).length, inBlock: S.used[7] };
  });
  ok(r.qc === 8 && r.sp === 8 && r.asc === 16, `16 boxes of 20 ft as 8 twins: quay crane ${r.qc} lifts, sprinters ${r.sp} trips, yard crane ${r.asc} lifts`);
}
// 2.6 reject command only: it comes back, usually to the same machine
{
  const r = await E(() => {
    let same = 0, tries = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      SPIKE.fresh({ seed }); for (let i = 0; i < 3; i++) SPIKE.cycle();
      const c = SPIKE.S.cmds.find(c => c.mach && c.stages[c.st] === 'SP'); if (!c) continue;
      const first = c.mach; SPIKE.rejectCommand(c.id, false); SPIKE.cycle();
      tries++; if (c.mach === first || c.history.at(-1) === 'SP:' + first) same++;
      if (c.returns !== 1) return { bad: true };
    }
    return { same, tries };
  });
  ok(!r.bad && r.same > 0, `reject command only (sprinter): back to the same sprinter in ${r.same} of ${r.tries} tries, returns counter = 1`);
}
// 2.7 reject command + machine on a sprinter
{
  const r = await E(() => {
    SPIKE.fresh({ seed: 1, crew: 3 });
    let c; for (let i = 0; i < 40 && !c; i++) { SPIKE.cycle(); c = SPIKE.S.cmds.find(c => c.mach && c.stages[c.st] === 'SP' && c.kind === 'DISCHARGE'); }
    const first = c.mach, sp = SPIKE.eq(first), qc = sp.qc;
    SPIKE.rejectCommand(c.id, true);
    const idleWhy = sp.why || 'waiting for a new command';
    SPIKE.cycle();
    const otherNext = sp.cmd && sp.cmd !== c.id;
    const x = runAll();
    const spSteps = c.history.filter(s => s.startsWith('SP:'));
    return { first, qc, idleWhy, otherNext, spSteps, crewOk: spSteps.every(s => SPIKE.S.crew[qc].includes(s.slice(3))), x };
  });
  ok(!r.spSteps.includes('SP:' + r.first) && r.crewOk && r.spSteps.length === 1, `reject command + machine (${r.first}): the trip went to ${r.spSteps.join(',')} of the same quay crane ${r.qc}, never back to ${r.first}`);
  ok(r.otherNext, `${r.first} took a different command already in the next cycle`);
  ok(r.x.open === 0 && !r.x.errs.length, `the run still finishes: ${r.x.open} open, ${r.x.errs.length} errors`);
}
// 2.8 reject command + machine on a yard crane: no substitute, waits with a reason, manual Redeck closes it
{
  const r = await E(() => {
    SPIKE.fresh({ seed: 1 });
    let c; for (let i = 0; i < 40 && !c; i++) { SPIKE.cycle(); c = SPIKE.S.cmds.find(c => c.mach && c.stages[c.st] === 'ASC' && c.kind === 'DISCHARGE' && c.lifts === 0); }
    const asc = SPIKE.eq(c.mach); SPIKE.rejectCommand(c.id, true);
    const x = runAll();
    const why = c.why, ascMovedAfter = asc.moves, waiting = c.status;
    const fin = SPIKE.manualFinish(c.id);
    return { id: c.id, asc: asc.id, why, waiting, fin, done: c.status, errs: SPIKE.check(), open: SPIKE.S.cmds.filter(c => c.status !== 'DONE').length, ascMovedAfter };
  });
  ok(r.waiting === 'QUEUED' && r.why.includes('no other ASC'), `${r.id} rejected by ${r.asc}: waits, "${r.why}"`);
  ok(r.fin === 'ok' && r.done === 'DONE' && !r.errs.length && r.open === 0, `manual Redeck closes it, nothing open, no box doubled`);
}
// 2.9 reject machine only: warning, the command stays on it
{
  const r = await E(() => { SPIKE.fresh({ seed: 1 }); SPIKE.cycle(); const m = SPIKE.S.eq.find(e => e.cmd); const res = SPIKE.rejectMachineOnly(m.id); return { res, still: !!m.cmd, w: SPIKE.S.warnings[0] }; });
  ok(r.res === 'warning' && r.still, `reject machine only: "${r.w}"`);
}
// 2.10 stuck quay crane: commands wait, sprinters moved by the controller work at once
{
  const r = await E(() => {
    SPIKE.fresh({ seed: 5 }); for (let i = 0; i < 3; i++) SPIKE.cycle();
    const q3 = SPIKE.eq('QC03'); q3.status = 'STUCK';
    const before = SPIKE.S.cmds.filter(c => c.qc === 'QC03' && c.status !== 'DONE').length;
    for (let i = 0; i < 5; i++) SPIKE.cycle();
    const crew = SPIKE.S.crew.QC03.slice(); crew.forEach(id => SPIKE.assign(SPIKE.eq(id), 'QC04'));
    const movesBefore = crew.map(id => SPIKE.eq(id).moves);
    SPIKE.cycle(); SPIKE.cycle();
    const worked = crew.some((id, i) => SPIKE.eq(id).moves > movesBefore[i] || SPIKE.eq(id).cmd);
    const after = SPIKE.S.cmds.filter(c => c.qc === 'QC03' && c.status !== 'DONE').length;
    q3.status = 'IDLE'; crew.forEach(id => SPIKE.assign(SPIKE.eq(id), 'QC03'));
    const x = runAll();
    return { before, after, worked, crewNow: SPIKE.S.crew.QC04.length, x };
  });
  ok(r.after > 0 && r.worked, `QC03 stuck: ${r.after} of its commands wait (none lost), its sprinters worked at QC04 within 2 cycles`);
  ok(r.x.open === 0 && !r.x.errs.length, 'QC03 back: the day finishes');
}
// 2.11 chaos: random rejections all day, 5 seeds; every box ends in exactly one place
{
  const r = await E(() => {
    const res = [];
    for (const seed of [11, 12, 13, 14, 15]) {
      SPIKE.fresh({ seed, crew: 2 });
      let rej = 0, rejM = 0;
      let x = runAll(800, n => {
        for (const c of SPIKE.S.cmds) if (c.mach && Math.random() < 0.05) { const m = Math.random() < 0.5; SPIKE.rejectCommand(c.id, m); rej++; if (m) rejM++; }
      });
      // waiting yard-crane / quay-crane stages: the controller finishes them by hand (Redeck); the rest must then flow
      const stuck = SPIKE.S.cmds.filter(c => c.status !== 'DONE');
      let manual = 0;
      stuck.forEach(c => { if (SPIKE.manualFinish(c.id) === 'ok') manual++; });
      const y = runAll();
      res.push({ seed, rej, rejM, cycles: x.n, errs: x.errs.concat(y.errs), deadlock: x.deadlock || y.deadlock, left: SPIKE.S.cmds.filter(c => c.status !== 'DONE').map(c => c.id + ' ' + c.kind + ' ' + c.stages[c.st] + ': ' + c.why), manual, final: SPIKE.check() });
    }
    return res;
  });
  for (const x of r) ok(!x.errs.length && !x.deadlock && !x.final.length, `chaos seed ${x.seed}: ${x.rej} rejects (${x.rejM} with machine), ${x.cycles} cycles, ${x.manual} closed by hand, still open: ${x.left.length ? x.left.join('; ') : 'none'}`);
}
if (errors.length) { say('page errors: ' + errors.join('; ')); fails++; }
await browser.close();
say('');
say(fails ? `${fails} FAILED` : 'ALL PASS');
const { writeFileSync } = await import('node:fs');
writeFileSync(resolve('spikes/terminal-real-layout/last-run.txt'), out.join('\n') + '\n');
process.exit(fails ? 1 : 0);
