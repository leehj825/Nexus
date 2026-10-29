// Nexus - battle: an ATB (active time battle) encounter with the crew against a group of husks: the three in the alley, or a patrol met in the Neon Market.
// Phases: explore -> enter (the camera eases to the battle angle, the crew stand, the husks come forward) -> battle -> result -> leave.
// Every combatant fills an ATB gauge in real time. A full gauge makes a crew member ready; the player picks the command from the
// menu. Husks act on their own when full, and a few wind up a telegraphed Crush that can be broken with a Stagger.
// The crew's mechanics:
//   Ruen: dual gauge. Her ATB refills as normal, and Data Burst runs a casting meter first; a hit on her breaks the cast.
//   Kyle: Intercept. While Guard is up, a fatal hit on Ruen or Yuna is taken by Kyle instead if his ATB is at least half full.
//   Yuna: fast gauge. Her ATB fills at twice the rate, and Stagger pushes an enemy's turn back.
const Combat = (() => {
  const TRANS = 1.4, ENCOUNTER_R = 6.5, GUARD_TIME = Tuning.guardTime, BRACE_TIME = Tuning.braceTime, CAST_RATE = Tuning.castRate, STAGGER = Tuning.stagger, RESULT_WAIT = 2.2, WIND = Tuning.wind;
  const BATTLE = { pos: new THREE.Vector3(0.2, 3.4, 7.4), look: new THREE.Vector3(0, 1.0, -2.6) };
  const SPOT = { you: [-0.9, -2.6], ruen: [-2.6, -0.7], kyle: [0.6, -1.5], yuna: [2.6, -0.5] };     // the far side of the fire, facing the husks
  const FOE_SPOT = [[-2.8, -5.8], [0.0, -6.8], [2.8, -5.8]];
  const FOE_HOME = [[-2.6, -13.5], [0.2, -14.5], [2.6, -13.5]];
  const FOE_SPOTS = { 3: FOE_SPOT, 2: [[-1.6, -6.2], [1.6, -6.2]], 1: [[0, -6.2]] };
  // The stage: local battle coordinates (the fire at the origin, the foes toward -z) placed in the world. The alley keeps the identity
  // stage; a fight met out in the world turns and moves it so the crew, the foes and the camera all land on open ground.
  const stage = { ox: 0, oz: 0, th: 0 };
  const W = (lx, lz) => ({ x: stage.ox + lx * Math.cos(stage.th) + lz * Math.sin(stage.th), z: stage.oz - lx * Math.sin(stage.th) + lz * Math.cos(stage.th) });
  const stagePos = new THREE.Vector3().copy(BATTLE.pos), stageLook = new THREE.Vector3().copy(BATTLE.look);
  const groups = new Map();                                        // every husk group that can be fought: { id, x, z, rigs, tier, aggro, onClear }
  let cur = null, aggroCd = 4, alleyDone = false;                    // the husks that hold the alley's gate: beaten once, gone for good
  const PARTY = {
    you: { name: 'You', hp: Tuning.party.you.hp, rate: Tuning.party.you.rate, color: '#ffffff' },
    ruen: { name: 'Ruen', hp: Tuning.party.ruen.hp, rate: Tuning.party.ruen.rate, color: '#c9a0ff' },
    kyle: { name: 'Kyle', hp: Tuning.party.kyle.hp, rate: Tuning.party.kyle.rate, color: '#ffd27a' },
    yuna: { name: 'Yuna', hp: Tuning.party.yuna.hp, rate: Tuning.party.yuna.rate, color: '#7ff7ff' },
  };
  const ORDER = ['you', 'ruen', 'kyle', 'yuna'];
  const HUSK = { name: 'Husk', ...Tuning.foes.husk, color: '#ff5a7a' };
  const BOSS = { name: 'Loader Mech', ...Tuning.foes.loader, color: '#ffd24a' };            // the Foundry's guardian: a sweep that hits everyone, crushes, and a shard volley once it is half broken
  const ENFORCER = { name: 'Enforcer', ...Tuning.foes.enforcer, color: '#9fd8ff' };       // raises a shield (half damage) until Stagger or Shockwave breaks it
  const DRONE = { name: 'Sentry Drone', ...Tuning.foes.drone, color: '#3ff0ff' };
  const SERAPH = { name: 'Seraph Drone', ...Tuning.foes.seraph, color: '#ffe9a8' };        // heals and shields the others: break it first
  const CEO = { name: 'The CEO', ...Tuning.foes.ceo, color: '#fff0c0' };
  const BRUTE = { name: 'Husk Brute', ...Tuning.foes.brute, color: '#ff8a4a' };       // big and slow: no light attacks, only the telegraphed Crush, which hits hard
  const COMMANDS = {
    you: [{ label: 'Strike', run: u => strike(u, 16, 'brawlPunch') }, { label: 'Brace', run: u => brace(u) }],
    ruen: [{ label: 'Data Bolt', run: u => strike(u, 22, 'mgBolt') }, { label: 'Data Burst', run: u => startCast(u) }],
    kyle: [{ label: 'Strike', run: u => strike(u, 18, 'brawlSwipe') }, { label: 'Guard', run: u => guard(u) }],
    yuna: [{ label: 'Blast', run: u => { strike(u, 14, 'mgBolt2'); strike(u, 14, null); } }, { label: 'Stagger', run: u => stagger(u) }],
  };

  const ease = x => x * x * (3 - 2 * x);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const $ = id => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);

  let scene = null, phase = 'explore', phaseT = 0, clock = 0;
  let party = [], foes = [], altFoes = [], target = null, cast = null, shots = [], pops = [], menuFor = null;
  let explore = null;                                              // the exploration camera pose, read from the player each frame
  let ui = null;
  const v = new THREE.Vector3();

  // A crew member's health and gauge speed from their level and armour. A rise in health (a level, a new piece of armour) heals the difference.
  function refreshStats(u, heal) {
    const mx = Math.round(PARTY[u.id].hp * Growth.hpMult(u.id) * Camp.hpMult(u.id));
    if (heal && u.hp > 0 && mx > u.hpMax) u.hp += mx - u.hpMax;
    u.hpMax = mx; u.hp = Math.min(u.hp, mx); u.rate = PARTY[u.id].rate * Growth.rateMult(u.id);
  }
  const refreshAll = heal => { for (const u of party) refreshStats(u, heal); };
  const pdmg = (u, base) => Math.round(base * Camp.damageMult(u.id) * Growth.dmgMult(u.id));        // damage from a level and a weapon

  // ---------------- Setup ----------------
  function init(s, camera) {
    scene = s;
    ui = { engage: $('engage'), battle: $('battle'), banner: $('banner'), log: $('log'), actions: $('actions') };
    for (const id of ORDER) {
      const rig = id === 'you' ? Player.rig() : Camp.crew.find(c => c.name === id).rig;
      const u = { id, name: PARTY[id].name, color: PARTY[id].color, rig, hp: PARTY[id].hp, hpMax: PARTY[id].hp, rate: PARTY[id].rate, atb: 0, ready: false, alive: true, guard: 0, brace: 0, home: { x: rig.root.position.x, z: rig.root.position.z, ry: rig.root.rotation.y } };
      u.label = makeLabel(u.name, u.color, null);
      party.push(u); refreshStats(u, false); u.hp = u.hpMax;
    }
    const alleyRigs = [];
    for (let i = 0; i < 3; i++) {
      const rig = Chars.create('husk'); rig.root.position.set(FOE_HOME[i][0], 0, FOE_HOME[i][1]); scene.add(rig.root); alleyRigs.push(rig);
    }
    register({ id: 'alley', x: 0, z: -14, rigs: alleyRigs, tier: 0, aggro: true, aggroR: 7.5, radius: 9, text: 'An ambush from the alley!', onClear: () => { alleyDone = true; } });
    target = null;
    buildUI();
    bindView(document.getElementById('game'), camera);
    $('engage').addEventListener('click', start);
    window.addEventListener('keydown', e => { if (e.code === 'KeyE') start(); });
    for (const u of party) setHome(u);
  }

  // ---------------- Husk groups ----------------
  function register(g) { g.foes = null; g.cleared = false; groups.set(g.id, g); return g; }
  function unregister(id) { const g = groups.get(id); if (g && g.foes) for (const f of g.foes) f.label.el.remove(); groups.delete(id); }
  // Foe records for a group's husks (made the first time it is fought)
  function foesOf(g) {
    if (g.foes) return g.foes;
    g.foes = g.rigs.map((rig, i) => {
      const BS = rig.name === 'loader', B = rig.name === 'brute' || BS, K = { loader: BOSS, brute: BRUTE, enforcer: ENFORCER, drone: DRONE, seraph: SERAPH, ceo: CEO }[rig.name] || HUSK, hp = Math.round(K.hp * (1 + Tuning.tier.hp * g.tier) * Tuning.scale.foeHp);
      const f = { id: g.id + ':' + i, name: K.name, ai: K.ai || (BS ? 'boss' : 'husk'), xp: Math.round(K.xp * (1 + Tuning.tier.xp * g.tier) * Tuning.scale.xp), brute: B, boss: BS, turn: 0, phase2: false, color: K.color, rig, hp, hpMax: hp, dmgMul: (1 + Tuning.tier.dmg * g.tier) * Tuning.scale.foeDmg * (BS ? Tuning.scale.bossDmg : rig.name === 'ceo' ? Tuning.scale.ceoDmg : 1), rate: K.rate * (1 + Tuning.tier.rate * g.tier), atb: 0, alive: true, foe: true, wind: null, home: { x: rig.root.position.x, z: rig.root.position.z, ry: rig.root.rotation.y } };
      f.rate0 = f.rate; f.label = makeLabel(K.name, K.color, f); return f;
    });
    return g.foes;
  }
  const groupDist = (g, p) => { let d = 1e9; for (const r of g.rigs) d = Math.min(d, Math.hypot(p.x - r.root.position.x, p.z - r.root.position.z)); return d; };
  function nearestGroup() {
    const p = Player.state(); let best = null, bd = 1e9;
    for (const g of groups.values()) { if (g.cleared) continue; const d = groupDist(g, p); if (d < Math.max(g.radius || ENCOUNTER_R, g.aggroR || 0) && d < bd) { best = g; bd = d; } }
    return best;
  }
  // Picks the stage for a fight with group g: the way the foes lie from the crew, turned in steps of 45 degrees until the crew's spots, the
  // foes' spots and the camera's ground point are all clear of buildings and props
  function placeStage(g) {
    if (g.id === 'alley') { stage.ox = 0; stage.oz = 0; stage.th = 0; }
    else {
      const p = Player.state(), n = g.rigs.length, c = g.rigs.reduce((a, r) => ({ x: a.x + r.root.position.x / n, z: a.z + r.root.position.z / n }), { x: 0, z: 0 });
      const th0 = Math.atan2(c.x - p.x > 0 ? -(c.x - p.x) : -(c.x - p.x), -(c.z - p.z)); let best = null;
      for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) {
        const th = th0 + k * Math.PI / 4, ox = c.x + 6.3 * Math.sin(th), oz = c.z + 6.3 * Math.cos(th);
        stage.ox = ox; stage.oz = oz; stage.th = th;
        const pts = [[0.2, 7.4, 1.5], ...Object.values(SPOT).map(q => [q[0], q[1], 0.9]), ...(FOE_SPOTS[n] || FOE_SPOTS[3]).map(q => [q[0], q[1], 0.9])];
        const blocked = pts.filter(q => { const w = W(q[0], q[1]); return World.blocked(w.x, w.z, q[2]); }).length;
        if (!best || blocked < best.blocked) best = { th, ox, oz, blocked };
        if (!blocked) break;
      }
      stage.ox = best.ox; stage.oz = best.oz; stage.th = best.th;
    }
    const cp = W(BATTLE.pos.x, BATTLE.pos.z), cl = W(BATTLE.look.x, BATTLE.look.z);
    stagePos.set(cp.x, BATTLE.pos.y, cp.z); stageLook.set(cl.x, BATTLE.look.y, cl.z);
  }

  function setHome(u) { u.rig.root.position.set(u.home.x, 0, u.home.z); u.rig.root.rotation.set(0, u.home.ry, 0); }

  function makeLabel(name, color, foe) {
    const el = document.createElement('div');
    el.className = 'lbl' + (foe ? ' foe' : '');
    el.hidden = true;
    el.innerHTML = `<b style="color:${color}">${name}</b><div class="lbar"><i></i></div><span class="warn">!</span>`;
    $('labels').appendChild(el);
    if (foe) el.addEventListener('pointerdown', e => { e.stopPropagation(); if (foe.alive) target = foe; });
    return { el, bar: el.querySelector('.lbar i'), warn: el.querySelector('.warn') };
  }

  function buildUI() {
    for (const u of party) {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<b style="color:${u.color}">${u.name}</b><div class="bar hp"><i></i></div><div class="bar atb"><i></i></div>` + (u.id === 'ruen' ? '<div class="bar cast"><i></i></div>' : '');
      $('party').appendChild(el);
      u.card = { hp: el.querySelector('.hp i'), atb: el.querySelector('.atb i'), cast: el.querySelector('.cast i') };
    }
  }

  // ---------------- Helpers ----------------
  const alive = () => party.filter(u => u.alive);
  const foesAlive = () => foes.filter(f => f.alive);
  const selected = () => (target && target.alive ? target : foesAlive()[0] || null);
  const pick = () => {                                              // husks prefer Ruen, who is fragile
    const a = alive(); if (!a.length) return null;
    const ruen = a.find(u => u.id === 'ruen');
    if (ruen && Math.random() < 0.5) return ruen;
    return a[Math.floor(Math.random() * a.length)];
  };
  function log(text) { ui.log.insertBefore(Object.assign(document.createElement('div'), { textContent: text }), ui.log.firstChild); while (ui.log.childElementCount > 3) ui.log.lastChild.remove(); }
  function popup(u, text, color) { const el = document.createElement('div'); el.className = 'pop'; el.textContent = text; el.style.color = color; $('labels').appendChild(el); pops.push({ el, u, t: 0 }); }

  // A glowing bolt that flies from one unit to another with a trail; the damage lands at once, the hit sparks on arrival
  function shot(from, to, color) {
    const a = from.rig.root.position.clone().setY(1.3), b2 = to.rig.root.position.clone().setY(1.2);
    FX.proj(a, b2, new THREE.Color(color), 0.24, null, from.id === 'ruen' ? 1.0 : 0.65);
  }
  // Camera shake and the red flash when the crew is hit
  let shakeA = 0, flashA = 0;
  const shake = a => { shakeA = Math.max(shakeA, a); };

  // ---------------- Damage ----------------
  function kill(u) {
    u.alive = false; u.ready = false; u.rush = null; clearWind(u);
    Chars.play(u.rig, 'die', true); FX.dissolve(u.rig.root.position, u.foe ? 0xff3fb4 : 0x7fe9ff); Sound.sfx('die'); shake(0.3);
    log(u.name + (u.foe ? ' falls.' : ' is down!'));
  }
  function damage(u, dmg) {
    if (!u.alive) return;
    u.hp = Math.max(0, u.hp - dmg); popup(u, '-' + dmg, u.foe ? '#ffffff' : '#ff8a8a');
    const heavy = dmg >= 22; FX.hit(u.rig.root.position.clone().setY(1.2), u.foe ? 0xffe9a8 : 0xff6a6a, heavy); Sound.sfx(heavy ? 'crit' : 'hit'); shake(heavy ? 0.28 : 0.12);
    if (!u.foe) { flashA = Math.min(0.6, 0.25 + dmg / 80); }
    if (u.hp <= 0) kill(u); else Chars.play(u.rig, u.hp < u.hpMax * 0.3 ? 'impact2' : 'impact');
  }
  // A husk's attack on a crew member. Kyle may intercept a fatal blow on Ruen or Yuna
  function hitParty(u, dmg, from) {
    if (from && from.weak > 0) dmg = Math.round(dmg * 0.7);
    const kyle = party.find(p => p.id === 'kyle');
    if (dmg >= u.hp && u.id !== 'kyle' && kyle.alive && kyle.guard > 0 && kyle.atb >= 0.5) {
      kyle.atb = 0; kyle.guard = 0;
      log('Kyle intercepts the blow meant for ' + u.name + '!'); FX.shield(kyle.rig.root.position); Sound.sfx('shield');
      shot(u, kyle, '#ffd27a');
      damage(kyle, Math.round(dmg * 0.6));
      return;
    }
    if (u.brace > 0) { dmg = Math.round(dmg * 0.5); log(u.name + ' braces through it.'); }
    damage(u, dmg);
    if (u.id === 'ruen' && cast && u.alive) { cast = null; log('Ruen is hit. The casting breaks.'); }
  }
  // Foe takes a hit from a crew member's command
  function hitFoe(f, dmg) {
    if (!f.alive) return;
    if (f.guard > 0) dmg = Math.round(dmg * 0.5);
    if (f.shielded) { dmg = Math.round(dmg * Tuning.ceo.shieldSoak); if (Math.random() < 0.25) log(f.name + '\'s shield soaks the blow.'); }
    damage(f, dmg);
  }
  // A burst of Ruen's grounds the singularity's shield for a time
  function breakShield(f) { if (f.shielded) { f.shielded = false; f.shieldT = Tuning.ceo.shieldDown; log('The shield is grounded!'); FX.nova(f.rig.root.position, 0xc9a0ff); } }

  // ---------------- Commands ----------------
  // While anyone is attacking, everybody else waits: no gauge fills, no husk acts, no cast ticks, no menu. A run-up and strike holds it
  // for as long as the fighter is away; a ranged attack or a husk's blow holds it for its animation.
  let actT = 0;
  const busy = t => { actT = Math.max(actT, t); };
  const isBusy = () => actT > 0 || party.some(u => u.rush);
  function endTurn(u, delay = 0) { u.atb = -delay; u.ready = false; menuFor = null; }                 // a skill's delay leaves the gauge below empty, so the next turn is later
  // The melee fighters (Jin, Kyle) run up to their target, strike it face to face and run back; the others shoot from where they stand
  const MELEE = { you: true, kyle: true }, RUN = 12, REACH = 1.25, SWING = 1.8;          // run speed (m/s) and how much faster than normal the blow plays
  function strike(u, dmg, clip = 'brawlPunch', opts = {}) {          // clip null: the second blow of a combo, the first one's clip plays on
    const t = selected(); if (!t) return;
    dmg = pdmg(u, dmg); const others = opts.all ? pdmg(u, opts.all) : 0;      // level and weapon
    if (MELEE[u.id] && clip) {
      const home = u.to.clone(), tp = t.rig.root.position;
      const dir = home.clone().sub(tp).setY(0).normalize();
      u.rush = { phase: 'out', t: 0, target: t, dmg, clip, home, stand: tp.clone().setY(0).addScaledVector(dir, REACH), struck: false, others };
      endTurn(u, opts.delay); return;
    }
    if (clip) { Chars.play(u.rig, clip); Sound.sfx(clip === 'mgBolt' ? 'bolt' : 'blast'); } else Sound.sfx('blast', { delay: 0.14 });
    shot(u, t, u.color); hitFoe(t, dmg); log(u.name + ' hits ' + t.name + ' for ' + dmg + '.');
    if (clip) busy(Math.min(Chars.clipLength(clip), 1.1));
    endTurn(u, opts.delay);
  }
  // Moves a rushing fighter one frame: out to the target, the blow (damage lands on the clip's hit frame), back to the spot
  function updateRush(u, dt) {
    const r = u.rush, p = u.rig.root.position; u.speed = 0;
    if (!u.alive) { u.rush = null; return; }
    const face = (to) => { const dx = to.x - p.x, dz = to.z - p.z; if (Math.hypot(dx, dz) > 0.01) u.rig.root.rotation.y = Math.atan2(dx, dz); };
    const go = (to) => {                                              // run toward a point; true on arrival
      const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz), step = RUN * dt;
      face(to);
      if (d <= step) { p.x = to.x; p.z = to.z; return true; }
      p.x += dx / d * step; p.z += dz / d * step; u.speed = RUN; return false;
    };
    if (r.phase === 'out') {
      if (!r.target.alive) r.target = selected() || r.target;
      r.stand = r.target.rig.root.position.clone().setY(0).addScaledVector(r.home.clone().sub(r.target.rig.root.position).setY(0).normalize(), REACH);
      if (go(r.stand)) { r.phase = 'hit'; r.t = 0; face(r.target.rig.root.position); Chars.play(u.rig, r.clip, false, SWING); }
    } else if (r.phase === 'hit') {
      r.t += dt; face(r.target.rig.root.position);
      const hitAt = Math.max(0.06, ((Mocap.clips[r.clip] && Mocap.clips[r.clip].hit) || 0.3) / SWING);
      if (!r.struck && r.t >= hitAt) {
        r.struck = true; Sound.sfx('swing', { pitch: u.id === 'kyle' ? -300 : 200 });
        if (!r.target.alive) r.target = selected() || r.target;
        if (r.target.alive) { hitFoe(r.target, r.dmg); log(u.name + ' hits ' + r.target.name + ' for ' + r.dmg + '.'); }
        if (r.others) for (const f of foesAlive()) if (f !== r.target) { hitFoe(f, r.others); FX.hit(f.rig.root.position.clone().setY(1.2), 0xffe9a8, false); }
      }
      if (r.t >= Math.min(Chars.clipLength(r.clip), 1.4) / SWING) { r.phase = 'back'; u.rig.clip = null; }
    } else if (go(r.home)) { u.rush = null; u.rig.root.rotation.y = Math.PI + stage.th; }
  }
  function guard(u) {
    u.guard = GUARD_TIME; u.rig.idleClip = 'blockIdle'; Chars.play(u.rig, 'block'); FX.shield(u.rig.root.position); Sound.sfx('shield');
    log('Kyle raises his guard.'); endTurn(u);
  }
  function brace(u) {
    u.brace = BRACE_TIME; u.rig.idleClip = 'blockIdle'; Chars.play(u.rig, 'block'); FX.shield(u.rig.root.position, 0xffffff); Sound.sfx('shield');
    log('You brace.'); endTurn(u);
  }
  function stagger(u) {
    const t = selected(); if (!t) return;
    Chars.play(u.rig, 'brawlSwipe');
    t.atb = Math.max(0, t.atb - STAGGER); t.guard = 0;
    if (party.some(a => a.locked > 0)) { for (const a of party) a.locked = 0; log('Yuna breaks the lock on the crew!'); }
    if (t.wind) { t.wind = null; log('Stagger breaks the wind-up.'); } else log('Stagger pushes ' + t.name + ' back.');
    shot(u, t, u.color); busy(0.9);
    endTurn(u);
  }
  function ruenRig() { return party.find(p => p.id === 'ruen').rig; }
  const ruenUnit = () => party.find(p => p.id === 'ruen');
  function startCast(u, power = 1) { cast = { t: 0, power }; Chars.play(u.rig, 'mgHoly'); FX.charge(u.rig.root.position); Sound.sfx('cast'); log(power === 2 ? 'Ruen begins Data Storm.' : 'Ruen begins Data Burst.'); endTurn(u); }


  // ---------------- Skills (learned at set levels, see growth.js) and link attacks (unlocked by bonds) ----------------
  function arc(u) { strike(u, 22, 'brawlSwipe', { all: 14, delay: Tuning.delay.arc }); }
  function edge(u) { strike(u, 48, 'brawlSwipe', { delay: Tuning.delay.edge }); }
  function mend(u) {
    Chars.play(u.rig, 'mgHeal'); Sound.sfx('shield'); busy(1.1);
    for (const a of alive()) { const h = Math.round(a.hpMax * Tuning.mend); a.hp = Math.min(a.hpMax, a.hp + h); popup(a, '+' + h, '#8dffb0'); FX.shield(a.rig.root.position, 0x6dff9a); }
    log('Ruen mends the crew.'); endTurn(u, Tuning.delay.mend);
  }
  function bulwark(u) {
    Chars.play(u.rig, 'block'); Sound.sfx('shield'); busy(1.0);
    for (const a of alive()) { a.brace = BRACE_TIME; a.rig.idleClip = 'blockIdle'; FX.shield(a.rig.root.position, 0xffd27a); }
    log('Kyle\'s Bulwark covers the crew.'); endTurn(u, Tuning.delay.bulwark);
  }
  function shockwave(u) {
    Chars.play(u.rig, 'brawlSwipe'); Sound.sfx('nova'); shake(0.3); busy(1.3); FX.nova(u.rig.root.position, 0xffd27a);
    for (const f of foesAlive()) { f.guard = 0; hitFoe(f, pdmg(u, 22)); f.atb = Math.max(0, f.atb - 0.35); clearWind(f); }
    log('Kyle\'s Shockwave rocks the foes.'); endTurn(u, Tuning.delay.shock);
  }
  function weakPoint(u) {
    const t = selected(); if (!t) return;
    Chars.play(u.rig, 'mgBolt2'); Sound.sfx('blast'); shot(u, t, u.color); hitFoe(t, pdmg(u, 12)); busy(0.9);
    t.weak = Tuning.weakTime; t.guard = 0; t.atb = Math.max(0, t.atb - STAGGER * 0.6); clearWind(t); log(t.name + ' is hit in a weak spot and will hit softer.'); endTurn(u, Tuning.delay.weak);
  }
  function barrage(u) {
    Chars.play(u.rig, 'mgBolt2'); Sound.sfx('blast'); busy(1.6);
    for (let i = 0; i < 5; i++) { const fs = foesAlive(); if (!fs.length) break; const t = fs[Math.floor(Math.random() * fs.length)]; shot(u, t, u.color); hitFoe(t, pdmg(u, 10)); }
    log('Yuna\'s Barrage!'); endTurn(u, Tuning.delay.barrage);
  }
  const SKILL_RUN = { arc, edge, mend, storm: u => startCast(u, 2), bulwark, shock: shockwave, weak: weakPoint, barrage };
  // A link spends half of the partner's gauge; at bond level 3 it hits 30% harder
  const partyOf = id => party.find(p => p.id === id);
  const lbonus = (a, b) => Growth.bondLevel(a, b) >= 3 ? 1.3 : 1;
  function crossfire(u) {
    const t = selected(), y = partyOf('yuna'); if (!t) return; const lb = lbonus('you', 'yuna');
    Chars.play(u.rig, 'brawlPunch'); Chars.play(y.rig, 'mgBolt2'); Sound.sfx('crit'); shot(u, t, u.color); shot(y, t, y.color); shake(0.2); busy(1.3);
    hitFoe(t, Math.round((pdmg(u, 30) + pdmg(y, 24)) * lb)); t.atb = Math.max(0, t.atb - STAGGER); clearWind(t);
    y.atb = Math.max(0, y.atb - 0.5); log('Jin and Yuna\'s Crossfire!'); endTurn(u, Tuning.delay.link);
  }
  function aegis(u) {
    const k = partyOf('kyle'), lb = lbonus('ruen', 'kyle');
    Chars.play(u.rig, 'mgNova'); Chars.play(k.rig, 'block'); Sound.sfx('nova'); shake(0.35); busy(1.4); FX.shield(k.rig.root.position);
    for (const f of foesAlive()) { FX.nova(f.rig.root.position); breakShield(f); hitFoe(f, Math.round(pdmg(u, 26) * lb)); }
    k.guard = GUARD_TIME; k.rig.idleClip = 'blockIdle'; k.atb = Math.max(0, k.atb - 0.5); log('Ruen\'s Aegis Burst, under Kyle\'s shield!'); endTurn(u, Tuning.delay.link);
  }
  function vow(u) {
    const t = selected(), j = partyOf('you'); if (!t) return; const lb = lbonus('kyle', 'you');
    Chars.play(u.rig, 'brawlSwipe'); Chars.play(j.rig, 'brawlPunch'); Sound.sfx('crit'); shot(u, t, u.color); shot(j, t, j.color); shake(0.2); busy(1.3);
    hitFoe(t, Math.round((pdmg(u, 24) + pdmg(j, 18)) * lb));
    for (const a of [u, j]) { a.brace = BRACE_TIME; a.rig.idleClip = 'blockIdle'; FX.shield(a.rig.root.position, 0xffffff); }
    j.atb = Math.max(0, j.atb - 0.5); log('Kyle and Jin\'s Iron Vow!'); endTurn(u, Tuning.delay.link);
  }
  const LINK_RUN = { crossfire, aegis, vow };
  // What a crew member's menu holds: the two basic commands, the skills their level has earned, and the links their bonds allow (greyed out unless the partner is up with half a gauge)
  function commandsFor(u) {
    const list = COMMANDS[u.id].map(c => ({ label: c.label, run: c.run }));
    for (const s of Growth.unlocked(u.id)) list.push({ label: s.name, run: SKILL_RUN[s.id], skill: true });
    for (const l of Growth.LINKS) if (l.lead === u.id && Growth.bondLevel(l.lead, l.with) >= 2) { const p = partyOf(l.with); list.push({ label: l.name, run: LINK_RUN[l.id], link: true, off: !(p && p.alive && p.atb >= 0.5) }); }
    return list;
  }

  // ---------------- Husk AI ----------------
  function bossAct(f) {
    f.turn++;
    if (!f.phase2 && f.hp < f.hpMax * 0.5) { f.phase2 = true; f.rate *= 1.35; log('The Loader Mech\'s glitch takes over!'); Sound.sfx('growl'); shake(0.35); FX.nova(f.rig.root.position); }
    const all = party.filter(u => u.alive); if (!all.length) return;
    const sweep = f.phase2 ? f.turn % 2 === 0 : f.turn % 3 === 0;
    if (sweep) {                                                      // the sweep (or, broken, the shard volley) hits everyone at once
      Chars.play(f.rig, 'brawlSwipe', false, 0.9); busy(1.5);
      for (const u of all) { shot(f, u, f.color); hitParty(u, Math.round((f.phase2 ? rand(...Tuning.boss.volley) : rand(...Tuning.boss.sweep)) * f.dmgMul), f); }
      log(f.phase2 ? 'Scrap shards rain on the crew!' : 'The Loader Mech sweeps its arm across the crew!');
    } else {
      const t = pick(); if (!t) return;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0xff3a5a, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(t.rig.root.position.x, 0.04, t.rig.root.position.z); scene.add(ring);
      f.wind = { t: WIND, target: t, ring, dmg: Math.round(rand(...Tuning.boss.crush) * f.dmgMul) };
      log(f.name + ' winds up on ' + t.name + '!'); Sound.sfx('growl');
    }
  }
  // A red ring on a target and a wind-up before the blow lands; Stagger can break it
  function startWind(f, t, dmg) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0xff3a5a, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(t.rig.root.position.x, 0.04, t.rig.root.position.z); scene.add(ring);
    f.wind = { t: WIND, target: t, ring, dmg }; log(f.name + ' winds up on ' + t.name + '!'); Sound.sfx('growl');
  }
  function enforcerAct(f) {
    if (!(f.guard > 0) && Math.random() < Tuning.enf.guardChance) { f.guard = Tuning.enf.guard; Chars.play(f.rig, 'block'); FX.shield(f.rig.root.position, 0x9fd8ff); Sound.sfx('shield'); busy(0.6); log(f.name + ' raises its shield.'); return; }
    const t = pick(); if (!t) return;
    Chars.play(f.rig, 'shoot'); Sound.sfx('blast'); busy(0.9); shot(f, t, f.color); hitParty(t, Math.round(rand(...Tuning.enf.shot) * f.dmgMul), f); log(f.name + ' fires at ' + t.name + '.');
  }
  function droneAct(f) {
    busy(1.0); Sound.sfx('blast');
    for (let i = 0; i < 2; i++) { const t = pick(); if (!t) return; shot(f, t, f.color); hitParty(t, Math.round(rand(...Tuning.drone.shot) * f.dmgMul), f); }
    log(f.name + ' fires a burst.');
  }
  function seraphAct(f) {
    const allies = foesAlive().filter(x => x !== f), hurt = allies.filter(x => x.hp < x.hpMax * 0.9).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
    busy(1.0); FX.nova(f.rig.root.position, 0xffe9a8); Sound.sfx('shield');
    if (hurt) { const h = Math.round(hurt.hpMax * Tuning.seraph.heal); hurt.hp = Math.min(hurt.hpMax, hurt.hp + h); popup(hurt, '+' + h, '#8dffb0'); FX.shield(hurt.rig.root.position, 0xffe9a8); log(f.name + ' mends ' + hurt.name + '.'); }
    else if (allies.length) { const a = allies[Math.floor(Math.random() * allies.length)]; a.guard = Tuning.seraph.guard; FX.shield(a.rig.root.position, 0xffe9a8); log(f.name + ' shields ' + a.name + '.'); }
    else { const t = pick(); if (t) { shot(f, t, f.color); hitParty(t, Math.round(rand(8, 11) * f.dmgMul), f); } }
  }
  // The CEO, in three forms. Command: lances and sweeps. Rewrite: it locks a crew member's gauge (Yuna's Stagger breaks the locks). Singularity: shielded, and only
  // a burst from Ruen grounds the shield for a while.
  function ceoAct(f) {
    f.turn++;
    const r = f.hp / f.hpMax, ph = r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
    if (ph !== f.phase) {
      f.phase = ph;
      if (ph === 2) { log('The CEO rewrites the rules!'); f.rate *= Tuning.ceo.rate2; shake(0.3); Sound.sfx('growl'); FX.nova(f.rig.root.position, 0xffe3a0); }
      if (ph === 3) { Chars.morph(f.rig); f.shielded = true; f.shieldT = 0; f.rate *= Tuning.ceo.rate3; log('The singularity opens! Only a burst from Ruen can ground its shield.'); shake(0.45); Sound.sfx('nova'); FX.nova(f.rig.root.position, 0xffffff); }
    }
    const all = party.filter(u => u.alive); if (!all.length) return;
    const sweep = () => { Chars.play(f.rig, 'brawlSwipe', false, 0.9); busy(1.4); for (const u of all) { shot(f, u, f.color); hitParty(u, Math.round((ph === 3 ? rand(...Tuning.ceo.pulse) : rand(...Tuning.ceo.sweep)) * f.dmgMul), f); } log(ph === 3 ? 'The singularity pulses through the crew!' : 'The CEO sweeps a wave of light across the crew!'); };
    if (ph === 1) { if (f.turn % 3 === 0) sweep(); else { const t = pick(); if (t) { Chars.play(f.rig, 'brawlPunch'); busy(0.9); shot(f, t, f.color); hitParty(t, Math.round(rand(...Tuning.ceo.lance) * f.dmgMul), f); log('The CEO lances ' + t.name + ' with data.'); } } }
    else if (ph === 2) {
      if (f.turn % 2 === 0) { const t = all.filter(u => !(u.locked > 0))[Math.floor(Math.random() * all.length)] || all[0]; if (t && !(t.locked > 0)) { t.locked = Tuning.ceo.lock; t.ready = false; menuFor = null; FX.shield(t.rig.root.position, 0xff3fb4); log('The CEO locks ' + t.name + '\'s commands! Yuna\'s Stagger can break the lock.'); busy(0.8); return; } }
      if (f.turn % 3 === 0) sweep(); else { const t = pick(); if (t) startWind(f, t, Math.round(rand(...Tuning.ceo.crush2) * f.dmgMul)); }
    } else {
      if (f.turn % 2 === 0) sweep(); else { const t = pick(); if (t) startWind(f, t, Math.round(rand(...Tuning.ceo.crush3) * f.dmgMul)); }
    }
  }
  function foeAct(f) {
    f.atb = 0;
    if (f.ai === 'ceo') return ceoAct(f);
    if (f.ai === 'enforcer') return enforcerAct(f);
    if (f.ai === 'drone') return droneAct(f);
    if (f.ai === 'seraph') return seraphAct(f);
    if (f.boss) return bossAct(f);
    if (f.brute || Math.random() < 0.35) {
      const t = pick(); if (!t) return;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0xff3a5a, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(t.rig.root.position.x, 0.04, t.rig.root.position.z); scene.add(ring);
      f.wind = { t: WIND, target: t, ring, dmg: Math.round((f.brute ? rand(...Tuning.brute.crush) : rand(...Tuning.husk.crush)) * f.dmgMul) };
      log(f.name + ' winds up on ' + t.name + '!'); Sound.sfx('growl');
    } else {
      const t = pick(); if (!t) return;
      Chars.play(f.rig, 'brawlPunch'); busy(0.9);
      shot(f, t, f.color || HUSK.color); hitParty(t, Math.round(rand(...Tuning.husk.lash) * f.dmgMul), f);
      log(f.name + ' lashes ' + t.name + '.');
    }
  }
  function updateWind(f, dt) {
    const w = f.wind; if (!w) return;
    w.t -= dt;
    const k = 1 - clamp(w.t / WIND, 0, 1);
    w.ring.scale.setScalar(2.2 - k * 1.4);
    w.ring.material.opacity = 0.4 + k * 0.5;
    if (w.t <= 0) {
      const t = w.target.alive ? w.target : pick();
      if (t) { Chars.play(f.rig, 'brawlSwipe', false, f.brute ? 0.8 : 1); busy(f.brute ? 1.3 : 1.0); shot(f, t, f.color || HUSK.color); hitParty(t, w.dmg, f); log(f.name + ' crushes ' + t.name + '!'); }
      clearWind(f);
    }
  }
  function clearWind(f) { if (f.wind) { scene.remove(f.wind.ring); f.wind.ring.geometry.dispose(); f.wind = null; } }

  // ---------------- Phases ----------------
  function start() {
    if (phase !== 'explore') return;
    const g = nearestGroup(); if (!g || (typeof Cutscene !== 'undefined' && Cutscene.active())) return;
    cur = g; foes = foesOf(g); placeStage(g);
    phase = 'enter'; phaseT = 0; resetView();
    Player.setFrozen(true);
    for (const u of party) {
      refreshStats(u, false); u.locked = 0; u.rush = null; u.alive = u.hp > 0; u.ready = false; u.atb = rand(0, 0.3); u.guard = 0; u.brace = 0;
      u.home = { x: u.rig.root.position.x, z: u.rig.root.position.z, ry: u.rig.root.rotation.y };   // where the avatar stands now
      u.rig.combat = true; u.rig.kind = 'stand'; u.rig.clip = null; u.rig.idleClip = u.rig.loco.battle;
      u.from = u.rig.root.position.clone(); u.rig.root.rotation.set(0, Math.PI + stage.th, 0);
      const sp = W(SPOT[u.id][0], SPOT[u.id][1]); u.to = new THREE.Vector3(sp.x, 0, sp.z);
    }
    const spots = FOE_SPOTS[foes.length] || FOE_SPOT;
    foes.forEach((f, i) => {
      f.hp = f.hpMax; f.alive = true; f.atb = rand(0, 0.2); f.rig.combat = true; f.wind = null;
      f.rate = f.rate0 || f.rate; f.phase2 = false; f.guard = 0; f.weak = 0; f.turn = 0; f.phase = 1; f.shielded = false; f.shieldT = 0; if (f.ai === 'ceo') Chars.morph(f.rig, false);
      f.rig.clip = null; f.rig.idleClip = f.rig.loco.battle;
      f.from = f.rig.root.position.clone(); const sp = W(spots[i][0], spots[i][1]); f.to = new THREE.Vector3(sp.x, 0, sp.z);
      f.rig.root.rotation.set(0, stage.th, 0);
    });
    cast = null; target = foes[Math.floor(foes.length / 2)]; menuFor = null;
    ui.log.innerHTML = ''; ui.banner.hidden = true;
    log(g.text || 'Husks! They have seen you.'); Sound.sfx('growl'); shake(0.15);
  }

  let resultWait = RESULT_WAIT;
  function end(text) {
    phase = 'result'; phaseT = 0; resultWait = RESULT_WAIT;
    cast = null; menuFor = null;
    for (const u of party) u.ready = false;
    const lvl = $('lvl'); lvl.hidden = true;
    if (text === 'Cleared') {                                                 // the spoils: XP for everyone, level-ups, and the pairs grow closer
      const xp = foes.reduce((n, f) => n + (f.xp || 0), 0), ups = Growth.award(xp); Growth.fought(); refreshAll(true);
      lvl.innerHTML = '<div class="xp">+' + xp + ' XP</div>' + ups.map(g => '<div><b style="color:' + PARTY[g.id].color + '">' + PARTY[g.id].name + '</b> Lv ' + g.from + ' \u2192 ' + g.to + (g.skills.length ? ' \u00b7 New: ' + g.skills.join(', ') : '') + '</div>').join('');
      lvl.hidden = false; if (ups.length) { resultWait = 5; setTimeout(() => Sound.sfx('quest'), 900); }
    }
    ui.banner.textContent = text; ui.banner.hidden = false; Sound.sfx(text === 'Cleared' ? 'win' : 'lose');
  }

  // Rest: everyone back to full health, the fallen included
  function restAll() { for (const u of party) { u.hp = u.hpMax; u.alive = true; } }

  function startLeave() {
    phase = 'leave'; phaseT = 0; ui.banner.hidden = true; $('lvl').hidden = true;
    for (const u of [...party, ...foes]) { clearWind(u); u.rush = null; u.from = u.rig.root.position.clone(); }
    for (const u of party) u.to = new THREE.Vector3(u.home.x, 0, u.home.z);
    for (const f of foes) f.to = new THREE.Vector3(f.home.x, 0, f.home.z);
  }

  function finishLeave() {
    phase = 'explore'; phaseT = 0;
    for (const u of party) {
      u.rush = null; u.rig.combat = false; u.rig.clip = null; u.rig.idleClip = u.rig.loco.idle;
      if (u.id !== 'you') Camp.afterBattle(u.rig);
      u.rig.root.rotation.set(0, u.home.ry, 0); u.rig.root.position.y = 0;
      u.rig.root.position.set(u.home.x, 0, u.home.z);
    }
    const won = foes.every(f => !f.alive), lost = party.every(u => !u.alive);
    for (const u of party) u.hp = u.hp <= 0 ? (won ? Math.round(u.hpMax * Tuning.patch) : 0) : Math.min(u.hpMax, u.hp + (won ? Math.round(u.hpMax * Tuning.patch) : 0));       // a win patches everyone up a little and gets the fallen on their feet
    for (const f of foes) {
      f.rig.combat = false; f.rig.clip = null;
      f.rig.root.rotation.set(0, 0, 0); f.rig.root.position.set(f.home.x, 0, f.home.z);
      if (!(won && !cur.persistent)) { f.alive = true; f.hp = f.hpMax; }
    }
    if (won && cur) {
      const loot = cur.id === 'alley' ? 1 : Math.round(Tuning.loot.base + Math.floor(cur.tier * Tuning.loot.perTier));
      if (cur.persistent) Camp.addParts(1);
      else {                                                                  // a patrol is gone for good: remove it, drop its loot
        Camp.addParts(loot); cur.cleared = true;
        for (const f of foes) { scene.remove(f.rig.root); if (f.rig.root.parent) f.rig.root.parent.remove(f.rig.root); f.label.el.remove(); }
        if (cur.onClear) cur.onClear(cur);
        groups.delete(cur.id);
      }
    }
    aggroCd = 5; cur = null; foes = [];
    Player.setFrozen(false);
    if (lost) { Camp.wake(); log('The crew come to at camp.'); } else Save.save();
  }

  function blend() {
    if (phase === 'explore') return 0;
    if (phase === 'enter') return ease(clamp(phaseT / TRANS, 0, 1));
    if (phase === 'leave') return 1 - ease(clamp(phaseT / TRANS, 0, 1));
    return 1;
  }

  function active() { return phase !== 'explore'; }

  // The camera: the alley's pose blended toward the battle angle
  // The battle camera: the preset angle, turned / zoomed / panned by the player (drag to rotate, wheel or pinch to zoom, two fingers or a
  // right / shift drag to pan, double-tap to reset). The player's changes fade out with the blend, so leaving a battle glides home.
  const view = { yaw: 0, pitch: 0, zoom: 1, pan: new THREE.Vector3() };
  const resetView = () => { view.yaw = 0; view.pitch = 0; view.zoom = 1; view.pan.set(0, 0, 0); };
  const sph = new THREE.Vector3(), bpos = new THREE.Vector3(), blook = new THREE.Vector3();
  function applyCamera(cam) {
    const ex = Player.exploreView(), k = blend();
    sph.copy(stagePos).sub(stageLook);
    const r = sph.length() * (1 + (view.zoom - 1) * k), az = Math.atan2(sph.x, sph.z) + view.yaw * k;
    const el = clamp(Math.asin(sph.y / sph.length()) + view.pitch * k, 0.12, 1.45);
    blook.copy(stageLook).addScaledVector(view.pan, k);
    bpos.set(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r).add(blook);
    cam.position.lerpVectors(ex.pos, bpos, k);
    if (shakeA > 0.003) cam.position.add(v.set((Math.random() - 0.5) * shakeA, (Math.random() - 0.5) * shakeA * 0.6, (Math.random() - 0.5) * shakeA));
    v.lerpVectors(ex.look, blook, k);
    cam.lookAt(v);
  }
  function bindView(canvas, camera) {
    const ptr = new Map(); let two = null, lastTap = 0;
    const pair = () => { const [a, b] = [...ptr.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    const pan = (dx, dy) => {
      const kk = camera.position.distanceTo(blook) * 2 * Math.tan(camera.fov * Math.PI / 360) / innerHeight;
      camera.updateMatrixWorld();
      const rt = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      view.pan.addScaledVector(rt, -dx * kk).addScaledVector(up, dy * kk);
      view.pan.set(clamp(view.pan.x, -8, 8), clamp(view.pan.y, -1.5, 4), clamp(view.pan.z, -8, 8));
    };
    canvas.addEventListener('pointerdown', e => {
      if (phase === 'explore') return;
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, btn: e.button, shift: e.shiftKey });
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* a pointer that already ended */ }
      two = ptr.size === 2 ? pair() : null;
    });
    canvas.addEventListener('pointermove', e => {
      const p = ptr.get(e.pointerId); if (!p || phase === 'explore') return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptr.size === 2) {
        const n = pair(); if (two) { view.zoom = clamp(view.zoom * two.d / Math.max(n.d, 1), 0.4, 2.2); pan(n.x - two.x, n.y - two.y); } two = n;
      } else if (p.btn === 2 || p.btn === 1 || p.shift) pan(dx, dy);
      else { view.yaw -= dx * 0.006; view.pitch = clamp(view.pitch + dy * 0.004, -0.8, 0.9); }
    });
    const lift = e => {
      const p = ptr.get(e.pointerId); ptr.delete(e.pointerId); two = ptr.size === 2 ? pair() : null;
      if (p && ptr.size === 0 && e.type === 'pointerup' && e.pointerType === 'touch' && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 20) {
        const now = performance.now(); if (now - lastTap < 320) { resetView(); lastTap = 0; } else lastTap = now;
      }
    };
    canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift);
    canvas.addEventListener('wheel', e => { if (phase === 'explore') return; e.preventDefault(); view.zoom = clamp(view.zoom * (1 + e.deltaY * 0.001), 0.4, 2.2); }, { passive: false });
    canvas.addEventListener('dblclick', () => { if (phase !== 'explore') resetView(); });
  }

  function canEngage() {
    if (phase !== 'explore' || (typeof Cutscene !== 'undefined' && Cutscene.active())) return false;
    return !!nearestGroup();
  }

  // ---------------- Per-frame ----------------
  function update(dt, camera) {
    clock += dt; phaseT += dt;
    shakeA *= Math.exp(-dt * 7); flashA = Math.max(0, flashA - dt * 1.6); const fl = document.getElementById('flash'); if (fl) fl.style.opacity = flashA.toFixed(3);
    const pp = Player.state();

    const walking = phase === 'enter' || phase === 'leave' ? 1.6 : 0;      // the units walk while they move into place
    if (phase === 'enter' || phase === 'leave') {
      const k = ease(clamp(phaseT / TRANS, 0, 1));
      for (const u of [...party, ...foes]) {
        u.rig.root.position.lerpVectors(u.from, u.to, k);
      }
      if (phaseT >= TRANS) {
        if (phase === 'enter') { phase = 'battle'; phaseT = 0; log('Battle!'); } else finishLeave();
      }
    }

    if (phase === 'battle') {
      actT = Math.max(0, actT - dt);
      const wait = isBusy();
      for (const u of party) {
        if (!u.alive) continue;
        u.guard = Math.max(0, u.guard - dt);
        if (u.brace > 0) { u.brace = Math.max(0, u.brace - dt); if (u.brace === 0) u.rig.idleClip = u.rig.loco.battle; }
        if (u.id === 'kyle' && u.guard === 0 && u.rig.idleClip === 'blockIdle') u.rig.idleClip = u.rig.loco.battle;
        if (u.locked > 0) { u.locked = Math.max(0, u.locked - dt); u.ready = false; continue; }
        if (wait) continue;
        u.atb = Math.min(1, u.atb + u.rate * dt);
        if (u.atb >= 1 && !(u.id === 'ruen' && cast)) u.ready = true;
      }
      for (const f of foes) {
        if (!f.alive || wait) continue;
        if (f.weak > 0) f.weak = Math.max(0, f.weak - dt);
        if (f.guard > 0) f.guard = Math.max(0, f.guard - dt);
        if (f.ai === 'ceo' && f.phase === 3 && !f.shielded) { f.shieldT -= dt; if (f.shieldT <= 0) { f.shielded = true; log('The singularity\'s shield re-forms.'); } }
        if (f.wind) { updateWind(f, dt); continue; }
        f.atb = Math.min(1, f.atb + f.rate * dt);
        if (f.atb >= 1) foeAct(f);
      }
      if (cast && !wait) {
        cast.t = Math.min(1, cast.t + CAST_RATE * (cast.power === 2 ? 0.65 : 1) * dt);
        if (cast.t >= 1) {
          Chars.play(ruenRig(), 'mgNova'); busy(1.4); Sound.sfx('nova'); shake(0.4);
          for (const f of foesAlive()) { FX.nova(f.rig.root.position); breakShield(f); hitFoe(f, pdmg(ruenUnit(), cast.power === 2 ? 60 : 30)); }
          log(cast.power === 2 ? 'Data Storm!' : 'Data Burst!');
          cast = null;
        }
      }
      if (!foesAlive().length) end('Cleared');
      else if (!alive().length) end('Defeat');
    }

    if (phase === 'result' && phaseT >= resultWait) startLeave();

    if (phase === 'explore') {
      aggroCd = Math.max(0, aggroCd - dt);
      const g = nearestGroup(); ui.engage.hidden = !g;
      if (g && g.aggro && aggroCd === 0 && groupDist(g, pp) < (g.aggroR || 4.4) && !(typeof Cutscene !== 'undefined' && Cutscene.active())) start();      // a patrol that has seen you
    }
    else ui.engage.hidden = true;
    ui.battle.hidden = phase === 'explore';

    // Idle motion for everyone not under the crew's own pose
    for (const f of foes) Chars.update(f.rig, clock, dt, walking);
    for (const g of groups.values()) if (g !== cur && groupDist(g, pp) < 45) for (const r of g.rigs) Chars.update(r, clock, dt, 0);          // groups not in the fight stand idle
    for (const u of party) if (u.rig.combat) { if (u.rush) updateRush(u, dt); Chars.update(u.rig, clock, dt, u.rush ? u.speed : walking); }

    updateShots(dt);
    updatePops(dt);
    updateUI(camera);
  }

  function updateShots(dt) {
    shots = shots.filter(s => {
      s.t += dt / 0.35;
      if (s.t >= 1) { scene.remove(s.s); s.s.material.dispose(); return false; }
      s.s.position.lerpVectors(s.from, s.to, s.t);
      s.s.material.opacity = 1 - s.t * 0.4;
      return true;
    });
  }
  function updatePops(dt) {
    pops = pops.filter(p => {
      p.t += dt;
      if (p.t > 0.9) { p.el.remove(); return false; }
      p.el.style.opacity = 1 - p.t / 0.9;
      return true;
    });
  }

  // Projects a world point above a unit's head to the screen, and places the labels, pops and HUD bars
  function screenOf(pos, y, camera) {
    v.set(pos.x, y, pos.z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, behind: v.z > 1 };
  }
  function updateUI(camera) {
    const show = phase !== 'explore';
    document.body.classList.toggle('in-battle', show);
    for (const u of [...party, ...foes]) {
      const L = u.label, p = u.rig.root.position;
      const s = screenOf(p, u.foe ? 2.1 : 2.0, camera);
      L.el.hidden = !show || s.behind || (u.foe && !u.alive);
      L.el.style.transform = `translate(${s.x}px, ${s.y - 36}px)`;
      L.bar.style.width = (clamp(u.hp / u.hpMax, 0, 1) * 100) + '%';
      L.el.classList.toggle('target', u === target && u.alive);
      L.warn.hidden = !(u.foe && u.wind);
      L.el.classList.toggle('guarded', !!(u.foe && (u.guard > 0 || u.shielded)));
    }
    for (const u of party) {
      u.card.hp.style.width = (clamp(u.hp / u.hpMax, 0, 1) * 100) + '%';
      u.card.atb.style.width = (Math.max(0, u.atb) * 100) + '%';
      u.card.atb.parentNode.classList.toggle('full', u.ready); u.card.atb.parentNode.classList.toggle('locked', u.locked > 0);
      if (u.card.cast) u.card.cast.style.width = (cast ? cast.t * 100 : 0) + '%';
    }
    for (const p of pops) {
      const s = screenOf(p.u.rig.root.position, 2.4 + p.t * 0.6, camera);
      p.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
    }
    // The command menu: the first ready crew member (in order), who is not casting
    const who = isBusy() ? null : party.find(u => u.alive && u.ready && !(u.id === 'ruen' && cast));
    const cmds = who ? commandsFor(who) : [], key = who ? who.id + '|' + cmds.map(c => c.label + (c.off ? '-' : '')).join(',') : null;
    if (key !== menuFor) {
      menuFor = key;
      ui.actions.innerHTML = '';
      for (const c of cmds) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = c.label; b.disabled = !!c.off; b.classList.toggle('skill', !!c.skill); b.classList.toggle('link', !!c.link);
        b.addEventListener('click', () => { if (who.ready && !c.off) c.run(who); menuFor = null; });
        ui.actions.appendChild(b);
      }
    }
    ui.actions.hidden = !who || phase !== 'battle';
  }

  return { init, update, applyCamera, active, start, canEngage, debugWin: () => { for (const f of foesAlive()) hitFoe(f, 9999); }, register, unregister, alleyCleared: () => alleyDone, getState: () => ({ alley: alleyDone, hp: party.map(u => [u.id, Math.round(u.hp)]) }), debugRun: (id, label) => { const u = partyOf(id), c = u && commandsFor(u).find(q => q.label === label); if (!c) return 'missing'; if (c.off) return 'off'; u.atb = 1; u.ready = true; c.run(u); return 'ok'; }, debugFoeHp: f => { for (const x of foes) x.hp = Math.round(x.hpMax * f); }, debugFoeAct: () => { for (const f of foes) if (f.alive && !f.wind) foeAct(f); }, debugReady: () => { for (const u of party) if (u.alive) u.atb = 1; }, restAll, refreshAll, partyInfo: () => party.map(u => ({ id: u.id, name: u.name, hp: u.hp, hpMax: u.hpMax })), setState(d) {
    for (const [id, hp] of d.hp || []) { const u = party.find(q => q.id === id); if (u) { u.hp = hp; u.alive = hp > 0; } }
     if (d.alley && !alleyDone) { alleyDone = true; const g = groups.get('alley'); if (g) for (const r of g.rigs) scene.remove(r.root); unregister('alley'); } }, debugClearAlley: () => { alleyDone = true; const g = groups.get('alley'); if (g) for (const r of g.rigs) scene.remove(r.root); unregister('alley'); }, engaging: () => phase !== 'explore', groupList: () => [...groups.values()], debugInfo: () => ({ phase, units: [...party, ...foes].map(u => ({ n: u.name, foe: !!u.foe, hp: Math.round(u.hp), atb: u.atb, alive: u.alive })) }), encounterR: ENCOUNTER_R, phase: () => phase, stage: () => stage };
})();
