// Nexus - balance simulator. Plays the game's ATB fights headlessly with a simple bot, using the same numbers as js/combat.js, js/growth.js and js/camp.js,
// and walks a party through the story's encounters (taken from World.census(), saved as tools/census.json) to see how levels, gear and fights line up.
// Run: node tools/balance_sim.js [runs] [meet] [reaction]   (needs tools/census.json; see Balance.md)
const fs = require('fs');
const CFG = Object.assign({
  runs: 200, meet: 0.7, side: 0.25, react: 0.8,                       // how many playthroughs, the share of path patrols met, the share of off-path ones fought, and the player's reaction time (s)
  pick: 0.55,                                                         // the share of the scrap on the route that gets picked up
  sloppy: 0.2,                                                        // how often the bot makes a plain attack instead of the best command (players slip)
}, JSON.parse(process.env.BAL || '{}'));
if (require.main === module) { const argv = process.argv.slice(2); if (argv[0]) CFG.runs = +argv[0]; if (argv[1]) CFG.meet = +argv[1]; if (argv[2]) CFG.react = +argv[2]; }
let T = JSON.parse(fs.readFileSync(__dirname + '/../js/tuning.js', 'utf8').replace(/^[\s\S]*?const Tuning = /, '').replace(/;\s*$/, ''));      // the numbers shared with the game
const census = JSON.parse(fs.readFileSync(__dirname + '/census.json', 'utf8'));
const tierFor = r => { const z = r >= 14 ? T.zoneTier.spire : r >= 8 ? T.zoneTier.hub : T.zoneTier.market; return z.base + (r - z.row0) * z.perRow; };
const rnd = () => Math.random(), rand = (a, b) => a + rnd() * (b - a);
const IDS = ['you', 'ruen', 'kyle', 'yuna'];

// ---------- growth and gear ----------
const need = lv => T.xp.base + T.xp.step * (lv - 1), MAXLV = 10;
const hpMult = lv => 1 + T.growth.hp * (lv - 1), dmgMult = lv => 1 + T.growth.dmg * (lv - 1), rateMult = lv => 1 + T.growth.rate * (lv - 1);
const GEAR = {};                                                    // per character: the order they get bought in
function newTeam() {
  const t = {};
  for (const id of IDS) t[id] = { id, lv: 1, xp: 0, w: 0, a: 0, hp: 0, hpMax: 0 };
  for (const id of IDS) refresh(t[id], false);
  for (const id of IDS) t[id].hp = t[id].hpMax;
  return { chars: t, scrap: 0, bonds: {}, owned: 0 };
}
function refresh(c, heal) {
  const mx = Math.round(T.party[c.id].hp * hpMult(c.lv) * Math.pow(T.gear.armor, c.a));
  if (heal && c.hp > 0 && mx > c.hpMax) c.hp += mx - c.hpMax; c.hpMax = mx; c.hp = Math.min(c.hp, mx);
}
const pdmg = (c, base) => Math.round(base * Math.pow(T.gear.weapon, c.w) * dmgMult(c.lv));
const bondLv = (team, a, b) => { const p = team.bonds[[a, b].sort().join('-')] || 0; return p >= T.bond.l3 ? 3 : p >= T.bond.l2 ? 2 : 1; };
const addBond = (team, a, b, n) => { const k = [a, b].sort().join('-'); team.bonds[k] = (team.bonds[k] || 0) + n; };
function buyGear(team) {                                            // at a camp: weapons for all first, then armour, then the next tiers, whatever is affordable
  const order = [];
  for (let tier = 0; tier < 3; tier++) for (const id of ['you', 'yuna', 'ruen', 'kyle']) { order.push([id, 'w', tier]); if (tier < 2) order.push([id, 'a', tier]); }
  for (const [id, slot, tier] of order) {
    const c = team.chars[id]; if ((slot === 'w' ? c.w : c.a) !== tier) continue;
    const cost = (slot === 'w' ? T.gear.wcost : T.gear.acost)[tier]; if (team.scrap < cost) break;
    team.scrap -= cost; if (slot === 'w') c.w++; else { c.a++; refresh(c, true); }
  }
}
function award(team, xp) {
  for (const id of IDS) { const c = team.chars[id]; if (c.lv >= MAXLV) continue; c.xp += xp; while (c.lv < MAXLV && c.xp >= need(c.lv)) { c.xp -= need(c.lv); c.lv++; } refresh(c, true); }
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) addBond(team, IDS[i], IDS[j], 1);
}

// ---------- foes ----------
const FOE = T.foes;
function makeFoe(kind, tier) {
  const K = FOE[kind], hp = Math.round(K.hp * (1 + T.tier.hp * tier) * T.scale.foeHp);
  return { kind, ai: K.ai, name: kind, hp, hpMax: hp, dmgMul: (1 + T.tier.dmg * tier) * T.scale.foeDmg * (kind === 'loader' ? T.scale.bossDmg : kind === 'ceo' ? T.scale.ceoDmg : 1), rate: K.rate * (1 + T.tier.rate * tier), atb: Math.random() * 0.2, xp: Math.round(K.xp * (1 + T.tier.xp * tier) * T.scale.xp), alive: true, wind: null, guard: 0, weak: 0, turn: 0, phase: 1, shielded: false, shieldT: 0, brute: kind === 'brute' || kind === 'loader', phase2: false };
}

// ---------- one fight ----------
function fight(team, foeSpecs, tier, opts = {}) {
  const P = IDS.map(id => { const c = team.chars[id]; return { id, c, hp: c.hp > 0 ? c.hp : 1, hpMax: c.hpMax, atb: Math.random() * 0.3, rate: T.party[id].rate * rateMult(c.lv), alive: c.hp > 0, guard: 0, brace: 0, locked: 0, ready: false, wait: 0 }; });
  const foes = foeSpecs.map(k => makeFoe(k, tier));
  let busy = 0, cast = null, t = 0, ttl = 600, sinceAct = 0;
  const alive = () => P.filter(u => u.alive), fa = () => foes.filter(f => f.alive);
  const pickT = () => { const a = alive(); if (!a.length) return null; const r = a.find(u => u.id === 'ruen'); if (r && rnd() < 0.5) return r; return a[Math.floor(rnd() * a.length)]; };
  const partyDmg = (u, d, from) => {
    if (!u.alive) return;
    if (from && from.weak > 0) d = Math.round(d * 0.7);
    const k = P[2];
    if (d >= u.hp && u.id !== 'kyle' && k.alive && k.guard > 0 && k.atb >= 0.5) { k.atb = 0; k.guard = 0; d = Math.round(d * 0.6); u = k; }
    if (u.brace > 0) d = Math.round(d * 0.5);
    u.hp = Math.max(0, u.hp - d); if (u.hp <= 0) { u.alive = false; u.ready = false; }
    if (u.id === 'ruen' && cast && u.alive) cast = null;
  };
  const foeDmg = (f, d) => {
    if (!f.alive) return; if (f.guard > 0) d = Math.round(d * 0.5);
    if (f.shielded) d = Math.round(d * T.ceo.shieldSoak);
    f.hp = Math.max(0, f.hp - d); if (f.hp <= 0) f.alive = false;
  };
  const breakShield = f => { if (f.shielded) { f.shielded = false; f.shieldT = T.ceo.shieldDown; } };
  const target = () => { const a = fa(); if (!a.length) return null; return a.slice().sort((x, y) => (y.shielded ? -1 : 0) - (x.shielded ? -1 : 0) || x.hp - y.hp)[0]; };
  const wind = (f, tg, d) => { f.wind = { t: T.wind, tg, dmg: d }; };
  const useAtb = (u, delay) => { u.atb = -(delay || 0); u.ready = false; };
  const lb = (a, b) => bondLv(team, a, b) >= 3 ? 1.3 : 1;
  // --- the bot's command ---
  function act(u) {
    const c = u.c, Fs = fa(), tg = target(), n = Fs.length, lvl = c.lv, D = T.delay;
    const winders = Fs.filter(f => f.wind), avg = alive().reduce((s, x) => s + x.hp / x.hpMax, 0) / Math.max(1, alive().length), low = alive().some(x => x.hp / x.hpMax < 0.35);
    const ceo = Fs.find(f => f.ai === 'ceo');
    if (rnd() < CFG.sloppy && tg) {                                      // a lapse: the plain attack instead of the clever one
      if (u.id === 'ruen') { foeDmg(tg, pdmg(c, 22)); busy = 1.1; return useAtb(u, 0); }
      if (u.id === 'yuna') { foeDmg(tg, pdmg(c, 14)); foeDmg(tg, pdmg(c, 14)); busy = 1.1; return useAtb(u, 0); }
      foeDmg(tg, pdmg(c, u.id === 'kyle' ? 18 : 16)); busy = 1.5; return useAtb(u, 0);
    }
    if (u.id === 'you') {
      const yu = P[3], sup = P.find(x => x.id === 'yuna');
      if (bondLv(team, 'you', 'yuna') >= 2 && yu.alive && yu.atb >= 0.5 && tg) { foeDmg(tg, Math.round((pdmg(c, 30) + pdmg(yu.c, 24)) * lb('you', 'yuna'))); tg.atb = Math.max(0, tg.atb - T.stagger); tg.wind = null; yu.atb = Math.max(0, yu.atb - 0.5); busy = 1.3; return useAtb(u, D.link); }
      if (lvl >= 6 && tg && tg.hp > 40) { foeDmg(tg, pdmg(c, 48)); busy = 1.5; return useAtb(u, D.edge); }
      if (lvl >= 3 && n >= 2) { foeDmg(tg, pdmg(c, 22)); for (const f of Fs) if (f !== tg) foeDmg(f, pdmg(c, 14)); busy = 1.6; return useAtb(u, D.arc); }
      foeDmg(tg, pdmg(c, 16)); busy = 1.4; return useAtb(u, 0);
    }
    if (u.id === 'ruen') {
      if (lvl >= 3 && (low || avg < 0.55)) { for (const a of alive()) a.hp = Math.min(a.hpMax, a.hp + Math.round(a.hpMax * T.mend)); busy = 1.1; return useAtb(u, D.mend); }
      if (ceo && ceo.shielded) { cast = { t: 0, p: lvl >= 6 ? 2 : 1 }; busy = 0; return useAtb(u, 0); }
      const k = P[2];
      if (bondLv(team, 'ruen', 'kyle') >= 2 && k.alive && k.atb >= 0.5 && n >= 2) { for (const f of Fs) { breakShield(f); foeDmg(f, Math.round(pdmg(c, 26) * lb('ruen', 'kyle'))); } k.guard = T.guardTime; k.atb = Math.max(0, k.atb - 0.5); busy = 1.4; return useAtb(u, D.link); }
      if (n >= 2 || (tg && tg.hp > 60)) { cast = { t: 0, p: lvl >= 6 ? 2 : 1 }; return useAtb(u, 0); }
      foeDmg(tg, pdmg(c, 22)); busy = 1.1; return useAtb(u, 0);
    }
    if (u.id === 'kyle') {
      const j = P[0];
      if (bondLv(team, 'kyle', 'you') >= 2 && j.alive && j.atb >= 0.5 && tg) { foeDmg(tg, Math.round((pdmg(c, 24) + pdmg(j.c, 18)) * lb('kyle', 'you'))); u.brace = T.braceTime; j.brace = T.braceTime; j.atb = Math.max(0, j.atb - 0.5); busy = 1.3; return useAtb(u, D.link); }
      if (lvl >= 3 && (winders.length >= 2 || avg < 0.6)) { for (const a of alive()) a.brace = T.braceTime; busy = 1.0; return useAtb(u, D.bulwark); }
      if (lvl >= 6 && n >= 2) { for (const f of Fs) { f.guard = 0; foeDmg(f, pdmg(c, 22)); f.atb = Math.max(0, f.atb - 0.35); f.wind = null; } busy = 1.3; return useAtb(u, D.shock); }
      if (u.guard <= 0 && rnd() < 0.5) { u.guard = T.guardTime; busy = 0.4; return useAtb(u, 0); }
      foeDmg(tg, pdmg(c, 18)); busy = 1.5; return useAtb(u, 0);
    }
    // yuna
    if (P.some(x => x.locked > 0)) { for (const x of P) x.locked = 0; if (tg) { tg.atb = Math.max(0, tg.atb - T.stagger); tg.guard = 0; } busy = 0.9; return useAtb(u, 0); }
    const w = winders[0];
    if (w && (w.ai === 'ceo' || w.brute || w.dmg > 25 || rnd() < 0.7)) { w.wind = null; w.atb = Math.max(0, w.atb - T.stagger); w.guard = 0; busy = 0.9; return useAtb(u, 0); }
    if (lvl >= 6 && n >= 3) { for (let i = 0; i < 5; i++) { const fs = fa(); if (!fs.length) break; foeDmg(fs[Math.floor(rnd() * fs.length)], pdmg(c, 10)); } busy = 1.6; return useAtb(u, D.barrage); }
    if (lvl >= 3 && tg && (tg.brute || tg.ai === 'enforcer' || tg.ai === 'ceo') && tg.weak <= 0) { foeDmg(tg, pdmg(c, 12)); tg.weak = T.weakTime; tg.guard = 0; tg.atb = Math.max(0, tg.atb - T.stagger * 0.6); tg.wind = null; busy = 0.9; return useAtb(u, D.weak); }
    foeDmg(tg, pdmg(c, 14)); foeDmg(tg, pdmg(c, 14)); busy = 1.1; return useAtb(u, 0);
  }
  // --- foe behaviour ---
  function foeAct(f) {
    f.atb = 0; const F = FOE[f.kind];
    if (f.ai === 'ceo') {
      f.turn++; const r = f.hp / f.hpMax, ph = r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
      if (ph !== f.phase) { f.phase = ph; if (ph === 2) f.rate *= T.ceo.rate2; if (ph === 3) { f.shielded = true; f.shieldT = 0; f.rate *= T.ceo.rate3; } }
      const all = alive(); if (!all.length) return;
      const sweep = () => { busy = 1.4; for (const u of all) partyDmg(u, Math.round((ph === 3 ? rand(...T.ceo.pulse) : rand(...T.ceo.sweep)) * f.dmgMul), f); };
      if (ph === 1) { if (f.turn % 3 === 0) sweep(); else { const tg = pickT(); busy = 0.9; if (tg) partyDmg(tg, Math.round(rand(...T.ceo.lance) * f.dmgMul), f); } }
      else if (ph === 2) {
        if (f.turn % 2 === 0) { const free = all.filter(u => !(u.locked > 0)); if (free.length) { const u = free[Math.floor(rnd() * free.length)]; u.locked = T.ceo.lock; u.ready = false; busy = 0.8; return; } }
        if (f.turn % 3 === 0) sweep(); else { const tg = pickT(); if (tg) wind(f, tg, Math.round(rand(...T.ceo.crush2) * f.dmgMul)); }
      } else { if (f.turn % 2 === 0) sweep(); else { const tg = pickT(); if (tg) wind(f, tg, Math.round(rand(...T.ceo.crush3) * f.dmgMul)); } }
      return;
    }
    if (f.kind === 'loader') {
      f.turn++; if (!f.phase2 && f.hp < f.hpMax * 0.5) { f.phase2 = true; f.rate *= T.boss.rate2; }
      const all = alive(); if (!all.length) return;
      if (f.phase2 ? f.turn % 2 === 0 : f.turn % 3 === 0) { busy = 1.5; for (const u of all) partyDmg(u, Math.round((f.phase2 ? rand(...T.boss.volley) : rand(...T.boss.sweep)) * f.dmgMul), f); }
      else { const tg = pickT(); if (tg) wind(f, tg, Math.round(rand(...T.boss.crush) * f.dmgMul)); }
      return;
    }
    if (f.ai === 'enforcer') {
      if (!(f.guard > 0) && rnd() < T.enf.guardChance) { f.guard = T.enf.guard; busy = 0.6; return; }
      const tg = pickT(); if (!tg) return; busy = 0.9; partyDmg(tg, Math.round(rand(...T.enf.shot) * f.dmgMul), f); return;
    }
    if (f.ai === 'drone') { busy = 1.0; for (let i = 0; i < 2; i++) { const tg = pickT(); if (tg) partyDmg(tg, Math.round(rand(...T.drone.shot) * f.dmgMul), f); } return; }
    if (f.ai === 'seraph') {
      const allies = fa().filter(x => x !== f), hurt = allies.filter(x => x.hp < x.hpMax * 0.9).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; busy = 1.0;
      if (hurt) hurt.hp = Math.min(hurt.hpMax, hurt.hp + Math.round(hurt.hpMax * T.seraph.heal));
      else if (allies.length) allies[Math.floor(rnd() * allies.length)].guard = T.seraph.guard;
      else { const tg = pickT(); if (tg) partyDmg(tg, Math.round(rand(8, 11) * f.dmgMul), f); }
      return;
    }
    // husk or brute
    if (f.brute || rnd() < 0.35) { const tg = pickT(); if (tg) wind(f, tg, Math.round((f.brute ? rand(...T.brute.crush) : rand(...T.husk.crush)) * f.dmgMul)); }
    else { const tg = pickT(); busy = 0.9; if (tg) partyDmg(tg, Math.round(rand(...T.husk.lash) * f.dmgMul), f); }
  }
  const dt = 0.05; const wins = () => !fa().length, lost = () => !alive().length;
  while (t < ttl) {
    t += dt; busy = Math.max(0, busy - dt);
    for (const u of P) { u.guard = Math.max(0, u.guard - dt); u.brace = Math.max(0, u.brace - dt); }
    const wait = busy > 0;
    for (const u of P) {
      if (!u.alive) continue;
      if (u.locked > 0) { u.locked = Math.max(0, u.locked - dt); u.ready = false; continue; }
      if (wait) continue;
      u.atb = Math.min(1, u.atb + u.rate * dt);
      if (u.atb >= 1 && !(u.id === 'ruen' && cast)) u.ready = true;
    }
    for (const f of foes) {
      if (!f.alive || wait) continue;
      if (f.weak > 0) f.weak = Math.max(0, f.weak - dt); if (f.guard > 0) f.guard = Math.max(0, f.guard - dt);
      if (f.ai === 'ceo' && f.phase === 3 && !f.shielded) { f.shieldT -= dt; if (f.shieldT <= 0) f.shielded = true; }
      if (f.wind) { f.wind.t -= dt; if (f.wind.t <= 0) { const tg = f.wind.tg.alive ? f.wind.tg : pickT(); if (tg) { partyDmg(tg, f.wind.dmg, f); busy = f.brute ? 1.3 : 1.0; } f.wind = null; } continue; }
      f.atb = Math.min(1, f.atb + f.rate * dt); if (f.atb >= 1) foeAct(f);
    }
    if (cast && !wait) {
      cast.t = Math.min(1, cast.t + T.castRate * (cast.p === 2 ? 0.65 : 1) * dt);
      if (cast.t >= 1) { const ru = P[1]; busy = 1.4; for (const f of fa()) { breakShield(f); foeDmg(f, pdmg(ru.c, cast.p === 2 ? 60 : 30)); } cast = null; }
    }
    if (wins() || lost()) break;
    // the first ready crew member acts once the player has had time to choose
    if (!wait) { const u = P.find(x => x.alive && x.ready && !(x.id === 'ruen' && cast)); if (u) { u.wait = (u.wait || 0) + dt; if (u.wait >= CFG.react) { u.wait = 0; act(u); } } }
  }
  const won = wins();
  const hpLostFrac = P.reduce((s, u) => s + (u.hpMax - u.hp), 0) / P.reduce((s, u) => s + u.hpMax, 0);
  for (const u of P) { u.c.hp = u.alive ? u.hp : 0; }
  return { won, time: t, hpLost: hpLostFrac, xp: foes.reduce((s, f) => s + f.xp, 0), ko: P.filter(u => !u.alive).length };
}

// ---------- the walk through the story ----------
function rest(team) { for (const id of IDS) team.chars[id].hp = team.chars[id].hpMax; }
function after(team, res) {       // a win patches everyone up and revives the fallen
  for (const id of IDS) { const c = team.chars[id]; c.hp = c.hp <= 0 ? Math.round(c.hpMax * T.patch) : Math.min(c.hpMax, c.hp + Math.round(c.hpMax * T.patch)); }
}
function encounter(team, rigs, tier, label, log, scrapLoot) {
  let tries = 0, res;
  do {
    const snap = IDS.map(id => team.chars[id].hp);
    res = fight(team, rigs, tier); tries++;
    log.push({ label, lv: avgLv(team), won: res.won, hpLost: res.hpLost, time: res.time, tries, ko: res.ko });
    if (res.won) { award(team, res.xp); after(team, res); team.scrap += scrapLoot; }
    else rest(team);                                           // a wipe: wake at the last camp, healed, and try again
  } while (!res.won && tries < 4);
  return res.won;
}
const avgLv = team => IDS.reduce((s, id) => s + team.chars[id].lv, 0) / 4;
const bondSkits = (team, list) => { for (const [a, b, n] of list) addBond(team, a, b, n); };
function playthrough(meet, side) {
  const team = newTeam(), log = [], marks = {};
  const pat = census.filter(c => c.patrol && c.patrol.id !== 'boss' && c.patrol.id !== 'ceo');
  const loot = tier => Math.round(T.loot.base + Math.floor(tier * T.loot.perTier));
  const scrapRow = (r, cols) => census.filter(c => c.r === r && Math.abs(c.cx) <= cols).reduce((s, c) => s + c.scrap, 0);
  team.scrap += 8 * CFG.pick;                                                  // the alley's scrap
  encounter(team, ['husk', 'husk', 'husk'], 0, 'alley ambush', log, 1);
  buyGear(team);
  for (let r = 0; r < 20; r++) {
    // camps: the Market plaza at the start, the Hub checkpoint, the Foundry plaza, the Spire lobby and the atrium
    if (r === 0) { rest(team); bondSkits(team, [['ruen', 'kyle', 2], ['ruen', 'yuna', 1]]); buyGear(team); }
    if (r === 8) { rest(team); bondSkits(team, [['you', 'yuna', 2], ['kyle', 'yuna', 1]]); buyGear(team); }
    if (r === 11) { rest(team); bondSkits(team, [['you', 'kyle', 2], ['you', 'ruen', 1]]); buyGear(team); marks.beforeBoss = avgLv(team); }
    if (r === 14) { rest(team); bondSkits(team, [['ruen', 'yuna', 2], ['you', 'ruen', 1]]); buyGear(team); }
    if (r === 15) { rest(team); bondSkits(team, [['you', 'ruen', 2], ['you', 'kyle', 1], ['kyle', 'ruen', 1]]); buyGear(team); }
    if (r === 5) marks.tower = avgLv(team); if (r === 8) marks.hubGate = avgLv(team);
    if (r === 13) continue;
    for (const c of census.filter(x => x.r === r)) {
      if (!c.patrol || c.patrol.id === 'boss' || c.patrol.id === 'ceo') continue;
      const onPath = Math.abs(c.cx) <= 1, p = onPath ? meet : side;
      if (rnd() > p) continue;
      if (!encounter(team, c.patrol.rigs, tierFor(r), 'patrol r' + r + ' t' + Math.round(tierFor(r)) + ' ' + c.patrol.rigs.join('+'), log, loot(tierFor(r)))) return { team, log, marks, failed: true };
    }
    team.scrap += scrapRow(r, 1) * CFG.pick + (scrapRow(r, 3) - scrapRow(r, 1)) * CFG.pick * side;
    if (r === 11) {                                                              // the Loader Mech, after resting at the camp
      rest(team); buyGear(team);
      if (!encounter(team, ['loader'], 0, 'Loader Mech', log, 3)) return { team, log, marks, failed: true };
      marks.afterBoss = avgLv(team); buyGear(team);
    }
    if (r === 17) {
      rest(team); buyGear(team); marks.beforeCeo = avgLv(team);
      if (!encounter(team, ['ceo'], 0, 'The CEO', log, 0)) return { team, log, marks, failed: true };
    }
  }
  marks.end = avgLv(team);
  return { team, log, marks, failed: false };
}

// ---------- run and report ----------
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const pct = x => (x * 100).toFixed(0) + '%';
const zoneOf = row => row < 8 ? 'market' : row < 14 ? 'hub' : 'spire';
// Runs the playthroughs with a set of tuning numbers and returns the measurements
function simulate(tuning, cfg) {
  T = tuning; Object.assign(CFG, cfg || {});
  const runs = []; for (let i = 0; i < CFG.runs; i++) runs.push(playthrough(CFG.meet, CFG.side));
  const cats = {};
  for (const r of runs) for (const e of r.log) {
    let cat = e.label === 'alley ambush' ? 'alley' : e.label === 'Loader Mech' ? 'loader' : e.label === 'The CEO' ? 'ceo' : zoneOf(+e.label.match(/^patrol r(\d+)/)[1]);
    (cats[cat] = cats[cat] || []).push(e);
  }
  const M = { finished: mean(runs.map(r => r.failed ? 0 : 1)), marks: {}, cats: {} };
  for (const k of ['tower', 'hubGate', 'beforeBoss', 'afterBoss', 'beforeCeo', 'end']) M.marks[k] = mean(runs.filter(r => r.marks[k] !== undefined).map(r => r.marks[k]));
  for (const [k, es] of Object.entries(cats)) { const first = es.filter(e => e.tries === 1); M.cats[k] = { n: first.length / CFG.runs, win1st: mean(first.map(e => e.won ? 1 : 0)), hpLost: mean(first.map(e => e.hpLost)), secs: mean(first.map(e => e.time)), lv: mean(es.map(e => e.lv)) }; }
  M.gear = mean(runs.map(r => IDS.reduce((s, id) => s + r.team.chars[id].w + r.team.chars[id].a, 0)));
  M.scrapLeft = mean(runs.map(r => r.team.scrap));
  M.runs = runs; return M;
}
function report(M) {
  console.log(`${CFG.runs} playthroughs, meet ${CFG.meet} of the path patrols, ${CFG.side} of the others, reaction ${CFG.react}s`);
  console.log('finished:', pct(M.finished));
  for (const k in M.marks) console.log('  avg level at', k.padEnd(10), M.marks[k].toFixed(1));
  console.log('encounters (first try)'.padEnd(24) + 'per run'.padStart(8) + 'win'.padStart(7) + 'hpLost'.padStart(8) + 'secs'.padStart(7) + 'avgLv'.padStart(7));
  for (const k of ['alley', 'market', 'hub', 'spire', 'loader', 'ceo']) { const c = M.cats[k]; if (c) console.log(k.padEnd(24) + c.n.toFixed(1).padStart(8) + pct(c.win1st).padStart(7) + pct(c.hpLost).padStart(8) + c.secs.toFixed(0).padStart(7) + c.lv.toFixed(1).padStart(7)); }
  console.log('gear tiers owned at the end (of 20):', M.gear.toFixed(1), ' scrap left:', M.scrapLeft.toFixed(0));
}
module.exports = { simulate, report, CFG, getT: () => T };
if (require.main === module) { report(simulate(T, {})); }
