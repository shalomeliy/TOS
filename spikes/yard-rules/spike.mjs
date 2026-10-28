// throwaway spike: does the choice of yard rules change rehandles visibly in the 4-block yard?
const BLOCKS = [{ id: 'A', use: ['EXPORT'] }, { id: 'B', use: ['EXPORT'] }, { id: 'C', use: ['IMPORT'] }, { id: 'D', use: ['IMPORT', 'EMPTY'] }];
const MAX = 4;
function run(rules, pile, seed) {
  let t = seed; const rnd = () => { t += 0x6D2B79F5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const stacks = {}; BLOCKS.forEach(b => { for (let bay = 1; bay <= 6; bay++) for (let r = 1; r <= 2; r++) stacks[b.id + bay + '-' + r] = []; });
  const units = {}; let reh = 0, peak = 0;
  const RULES = {
    VESSEL: (u, x) => u.category !== 'EXPORT' || x.visit === u.visit,
    POD: (u, x) => u.category !== 'EXPORT' || x.pod === u.pod,
    SIZE: (u, x) => x.size === u.size,
    WEIGHT: (u, x) => u.category !== 'EXPORT' || (x.weight >= 15) === (u.weight >= 15),
    HOLD: (u, x) => u.category !== 'IMPORT' || x.held === u.held,
  };
  function plan(u, ex) {
    let best = null, bs = Infinity;
    for (const k in stacks) {
      const b = BLOCKS.find(b => b.id === k[0]); if (!b.use.includes(u.category) || k === ex) continue;
      const st = stacks[k].map(id => units[id]), h = st.length; if (h >= MAX) continue;
      let s = u.category === 'EXPORT' ? (h === 0 ? 5 : h * 0.5) : pile ? (h === 0 ? 4 : MAX - 1 - h) : h;
      rules.forEach((r, i) => { if (st.some(x => !RULES[r](u, x))) s += 10 * 2 ** (rules.length - 1 - i); });
      if (s < bs) { bs = s; best = k; }
    }
    return best;
  }
  const place = u => { const k = plan(u); stacks[k].push(u.id); u.pos = k; peak = Math.max(peak, Object.values(stacks).filter(s => s.length).length); };
  function take(u) {
    const st = stacks[u.pos];
    while (st[st.length - 1] !== u.id) { const top = units[st.pop()]; const to = Object.keys(stacks).filter(k => k[0] === u.pos[0] && k !== u.pos && stacks[k].length < MAX).sort((a, b) => stacks[a].length - stacks[b].length)[0] || plan(top, u.pos); stacks[to].push(top.id); top.pos = to; reh++; }
    st.pop();
  }
  let n = 0; const mk = p => { const u = Object.assign({ id: 'U' + (++n) }, p); units[u.id] = u; return u; };
  const ex = [], im = [];
  for (let i = 0; i < 56; i++) ex.push(mk({ category: 'EXPORT', visit: i % 2 ? 'V1' : 'V2', pod: 1 + Math.floor(rnd() * 3), weight: 8 + rnd() * 18, size: rnd() < 0.7 ? '20' : '40' }));
  for (let i = 0; i < 40; i++) im.push(mk({ category: 'IMPORT', held: rnd() < 0.25, size: rnd() < 0.7 ? '20' : '40' }));
  // arrivals mixed
  const arr = [...ex, ...im].map(u => [rnd(), u]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  arr.forEach(place);
  const r0 = reh;
  // imports: free ones picked up in random order, then held after release
  const free = im.filter(u => !u.held).map(u => [rnd(), u]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  [...free, ...im.filter(u => u.held)].forEach(take);
  const ri = reh - r0;
  for (const v of ['V1', 'V2']) for (const size of ['20', '40']) ex.filter(u => u.visit === v && u.size === size).sort((a, b) => b.pod - a.pod || b.weight - a.weight).forEach(take);
  return { imp: ri, exp: reh - r0 - ri, total: reh, peak };
}
const sets = { none: [], vessel: ['VESSEL'], 'vessel+pod': ['VESSEL', 'POD'], 'vessel+pod+size': ['VESSEL', 'POD', 'SIZE'], all: ['VESSEL', 'POD', 'SIZE', 'WEIGHT', 'HOLD'], 'all,weight first': ['WEIGHT', 'VESSEL', 'POD', 'SIZE', 'HOLD'] };
for (const [name, r] of Object.entries(sets)) for (const pile of [false, true]) {
  const res = [1, 2, 3, 4, 5].map(s => run(r, pile, s * 7919));
  const avg = k => (res.reduce((a, x) => a + x[k], 0) / res.length).toFixed(1);
  console.log(name.padEnd(18), pile ? 'pile  ' : 'spread', 'imp', avg('imp'), 'exp', avg('exp'), 'total', avg('total'), 'stacks', avg('peak'));
}
