// Nexus - searches the tuning numbers for the ones that make the simulated playthrough hit the targets below (see Balance.md).
// Run: node tools/balance_opt.js [iterations] [runsPerEval]; the best numbers are written to tools/best_tuning.json
const fs = require('fs');
const sim = require('./balance_sim.js');
const base = sim.getT();
const iters = +process.argv[2] || 600, RUNS = +process.argv[3] || 60;
const clone = o => JSON.parse(JSON.stringify(o));
// What the search may change: [path, low, high]
const PARAMS = [
  ['tier.hp', 0.1, 1.3], ['tier.dmg', 0.08, 0.9], ['tier.xp', 0.05, 0.6], ['scale.xp', 0.3, 1.6],
  ['growth.hp', 0.06, 0.2], ['growth.dmg', 0.05, 0.18],
  ['zoneTier.market.base', 0.2, 1.5], ['zoneTier.market.perRow', 0.15, 0.8], ['zoneTier.hub.base', 1.5, 6], ['zoneTier.hub.perRow', 0.15, 0.8], ['zoneTier.spire.base', 2.5, 9], ['zoneTier.spire.perRow', 0.15, 0.8],
  ['foes.loader.hp', 400, 2400], ['foes.loader.rate', 0.05, 0.22], ['foes.ceo.rate', 0.06, 0.26], ['tier.rate', 0, 0.12], ['foes.husk.rate', 0.07, 0.15], ['foes.brute.rate', 0.05, 0.12], ['foes.enforcer.rate', 0.08, 0.16], ['foes.drone.rate', 0.1, 0.2], ['scale.bossDmg', 0.6, 3.0], ['foes.ceo.hp', 800, 5000], ['scale.ceoDmg', 0.6, 3.0],
  ['gear.wmul', 1, 3], ['gear.amul', 1, 3], ['loot.base', 1, 3], ['xp.step', 10, 50],
];
const get = (o, path) => path.split('.').reduce((a, k) => a[k], o);
const set = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
const BASE_W = base.gear.wcost.slice(), BASE_A = base.gear.acost.slice();
function build(vec) {
  const T = clone(base);
  PARAMS.forEach(([p], i) => {
    if (p === 'gear.wmul') T.gear.wcost = BASE_W.map(c => Math.max(1, Math.round(c * vec[i])));
    else if (p === 'gear.amul') T.gear.acost = BASE_A.map(c => Math.max(1, Math.round(c * vec[i])));
    else set(T, p, vec[i]);
  });
  return T;
}
const TARGET = { alley: [0.97, 0.15], market: [0.93, 0.28], hub: [0.9, 0.32], spire: [0.88, 0.35], loader: [0.75, 0.6], ceo: [0.65, 0.7] };
const MARKS = { tower: 4.5, hubGate: 5.5, beforeBoss: 7.2, afterBoss: 7.9, beforeCeo: 9.0, end: 9.6 };
function loss(M) {
  let L = 0;
  for (const [k, [w, h]] of Object.entries(TARGET)) { const c = M.cats[k]; if (!c) { L += 5; continue; } L += 4 * (c.win1st - w) ** 2 + 6 * (c.hpLost - h) ** 2; }
  for (const [k, v] of Object.entries(MARKS)) L += 0.08 * (M.marks[k] - v) ** 2;
  L += 0.004 * (M.gear - 16) ** 2 + 0.0002 * Math.max(0, M.scrapLeft - 10) ** 2;
  L += 3 * (1 - M.finished) ** 2;
  // fights should take a sensible while: regular patrols 30-60 s, bosses a bit longer
  for (const k of ['market', 'hub', 'spire']) { const c = M.cats[k]; if (c) L += 0.00003 * (Math.max(0, 30 - c.secs) ** 2 + Math.max(0, c.secs - 70) ** 2); }
  return L;
}
const ev = vec => { const M = sim.simulate(build(vec), { runs: RUNS }); return [loss(M), M]; };
const start = PARAMS.map(([p]) => p === 'gear.wmul' || p === 'gear.amul' ? 1.5 : get(base, p));
let best = start.slice(), [bl] = ev(best);
const rnd = (a, b) => a + Math.random() * (b - a);
for (let i = 0; i < iters; i++) {
  const cand = i < iters * 0.25 ? PARAMS.map(([, lo, hi]) => rnd(lo, hi)) : best.map((v, j) => Math.min(PARAMS[j][2], Math.max(PARAMS[j][1], v + (Math.random() < 0.35 ? rnd(-1, 1) * (PARAMS[j][2] - PARAMS[j][1]) * (i < iters * 0.6 ? 0.15 : 0.05) : 0))));
  const [l] = ev(cand);
  if (l < bl) { bl = l; best = cand; if (i % 5 === 0 || true) process.stderr.write(`iter ${i} loss ${l.toFixed(4)}\n`); }
}
// polish: re-evaluate the best with more runs
const T = build(best); fs.writeFileSync(__dirname + '/best_tuning.json', JSON.stringify(T, null, 1));
const M = sim.simulate(T, { runs: 400 }); sim.report(M); console.log('loss', loss(M).toFixed(4));
console.log(JSON.stringify(Object.fromEntries(PARAMS.map(([p], i) => [p, +best[i].toFixed(3)]))));
