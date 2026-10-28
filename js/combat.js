// Nexus - battle: an ATB (active time battle) encounter with the crew against a group of husks: the three in the alley, or a patrol met in the Neon Market.
// Phases: explore -> enter (the camera eases to the battle angle, the crew stand, the husks come forward) -> battle -> result -> leave.
// Every combatant fills an ATB gauge in real time. A full gauge makes a crew member ready; the player picks the command from the
// menu. Husks act on their own when full, and a few wind up a telegraphed Crush that can be broken with a Stagger.
// The crew's mechanics:
//   Ruen: dual gauge. Her ATB refills as normal, and Data Burst runs a casting meter first; a hit on her breaks the cast.
//   Kyle: Intercept. While Guard is up, a fatal hit on Ruen or Yuna is taken by Kyle instead if his ATB is at least half full.
//   Yuna: fast gauge. Her ATB fills at twice the rate, and Stagger pushes an enemy's turn back.
const Combat = (() => {
  const TRANS = 1.4, ENCOUNTER_R = 6.5, GUARD_TIME = 8, BRACE_TIME = 6, CAST_RATE = 0.4, STAGGER = 0.35, RESULT_WAIT = 2.2, WIND = 1.6;
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
  let cur = null, aggroCd = 4;
  const PARTY = {
    you: { name: 'You', hp: 110, rate: 0.12, color: '#ffffff' },
    ruen: { name: 'Ruen', hp: 90, rate: 0.13, color: '#c9a0ff' },
    kyle: { name: 'Kyle', hp: 150, rate: 0.1, color: '#ffd27a' },
    yuna: { name: 'Yuna', hp: 80, rate: 0.2, color: '#7ff7ff' },
  };
  const ORDER = ['you', 'ruen', 'kyle', 'yuna'];
  const HUSK = { name: 'Husk', hp: 60, rate: 0.09, color: '#ff5a7a' };
  const BRUTE = { name: 'Husk Brute', hp: 130, rate: 0.065, color: '#ff8a4a' };       // big and slow: no light attacks, only the telegraphed Crush, which hits hard
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

  // ---------------- Setup ----------------
  function init(s, camera) {
    scene = s;
    ui = { engage: $('engage'), battle: $('battle'), banner: $('banner'), log: $('log'), actions: $('actions') };
    for (const id of ORDER) {
      const rig = id === 'you' ? Player.rig() : Camp.crew.find(c => c.name === id).rig;
      const u = { id, name: PARTY[id].name, color: PARTY[id].color, rig, hp: PARTY[id].hp, hpMax: PARTY[id].hp, rate: PARTY[id].rate, atb: 0, ready: false, alive: true, guard: 0, brace: 0, home: { x: rig.root.position.x, z: rig.root.position.z, ry: rig.root.rotation.y } };
      u.label = makeLabel(u.name, u.color, null);
      party.push(u);
    }
    const alleyRigs = [];
    for (let i = 0; i < 3; i++) {
      const rig = Chars.create('husk'); rig.root.position.set(FOE_HOME[i][0], 0, FOE_HOME[i][1]); scene.add(rig.root); alleyRigs.push(rig);
    }
    register({ id: 'alley', x: 0, z: -14, rigs: alleyRigs, tier: 0, aggro: false, persistent: true, text: 'An ambush from the alley!' });
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
      const B = rig.name === 'brute', K = B ? BRUTE : HUSK, hp = Math.round(K.hp * (1 + 0.22 * g.tier));
      const f = { id: g.id + ':' + i, name: K.name, brute: B, color: K.color, rig, hp, hpMax: hp, dmgMul: 1 + 0.14 * g.tier, rate: K.rate * (1 + 0.05 * g.tier), atb: 0, alive: true, foe: true, wind: null, home: { x: rig.root.position.x, z: rig.root.position.z, ry: rig.root.rotation.y } };
      f.label = makeLabel(K.name, K.color, f); return f;
    });
    return g.foes;
  }
  const groupDist = (g, p) => { let d = 1e9; for (const r of g.rigs) d = Math.min(d, Math.hypot(p.x - r.root.position.x, p.z - r.root.position.z)); return d; };
  function nearestGroup() {
    const p = Player.state(); let best = null, bd = 1e9;
    for (const g of groups.values()) { if (g.cleared) continue; const d = groupDist(g, p); if (d < (g.radius || ENCOUNTER_R) && d < bd) { best = g; bd = d; } }
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
  function hitParty(u, dmg) {
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
  function hitFoe(f, dmg) { if (!f.alive) return; damage(f, dmg); }

  // ---------------- Commands ----------------
  // While anyone is attacking, everybody else waits: no gauge fills, no husk acts, no cast ticks, no menu. A run-up and strike holds it
  // for as long as the fighter is away; a ranged attack or a husk's blow holds it for its animation.
  let actT = 0;
  const busy = t => { actT = Math.max(actT, t); };
  const isBusy = () => actT > 0 || party.some(u => u.rush);
  function endTurn(u) { u.atb = 0; u.ready = false; menuFor = null; }
  // The melee fighters (Jin, Kyle) run up to their target, strike it face to face and run back; the others shoot from where they stand
  const MELEE = { you: true, kyle: true }, RUN = 12, REACH = 1.25, SWING = 1.8;          // run speed (m/s) and how much faster than normal the blow plays
  function strike(u, dmg, clip = 'brawlPunch') {                     // clip null: the second blow of a combo, the first one's clip plays on
    const t = selected(); if (!t) return;
    dmg = Math.round(dmg * Camp.damageMult(u.id));                   // the camp's weapon upgrades
    if (MELEE[u.id] && clip) {
      const home = u.to.clone(), tp = t.rig.root.position;
      const dir = home.clone().sub(tp).setY(0).normalize();
      u.rush = { phase: 'out', t: 0, target: t, dmg, clip, home, stand: tp.clone().setY(0).addScaledVector(dir, REACH), struck: false };
      endTurn(u); return;
    }
    if (clip) { Chars.play(u.rig, clip); Sound.sfx(clip === 'mgBolt' ? 'bolt' : 'blast'); } else Sound.sfx('blast', { delay: 0.14 });
    shot(u, t, u.color); hitFoe(t, dmg); log(u.name + ' hits the husk for ' + dmg + '.');
    if (clip) busy(Math.min(Chars.clipLength(clip), 1.1));
    endTurn(u);
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
        if (r.target.alive) { hitFoe(r.target, r.dmg); log(u.name + ' hits the husk for ' + r.dmg + '.'); }
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
    t.atb = Math.max(0, t.atb - STAGGER);
    if (t.wind) { t.wind = null; log('Stagger breaks the husk\'s wind-up.'); } else log('Stagger pushes the husk back.');
    shot(u, t, u.color); busy(0.9);
    endTurn(u);
  }
  function ruenRig() { return party.find(p => p.id === 'ruen').rig; }
  function startCast(u) { cast = { t: 0 }; Chars.play(u.rig, 'mgHoly'); FX.charge(u.rig.root.position); Sound.sfx('cast'); log('Ruen begins Data Burst.'); endTurn(u); }

  // ---------------- Husk AI ----------------
  function foeAct(f) {
    f.atb = 0;
    if (f.brute || Math.random() < 0.35) {
      const t = pick(); if (!t) return;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0xff3a5a, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(t.rig.root.position.x, 0.04, t.rig.root.position.z); scene.add(ring);
      f.wind = { t: WIND, target: t, ring, dmg: Math.round((f.brute ? rand(38, 46) : rand(30, 36)) * f.dmgMul) };
      log(f.name + ' winds up on ' + t.name + '!'); Sound.sfx('growl');
    } else {
      const t = pick(); if (!t) return;
      Chars.play(f.rig, 'brawlPunch'); busy(0.9);
      shot(f, t, f.color || HUSK.color); hitParty(t, Math.round(rand(11, 15) * f.dmgMul));
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
      if (t) { Chars.play(f.rig, 'brawlSwipe', false, f.brute ? 0.8 : 1); busy(f.brute ? 1.3 : 1.0); shot(f, t, f.color || HUSK.color); hitParty(t, w.dmg); log(f.name + ' crushes ' + t.name + '!'); }
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
      u.rush = null; u.hp = u.hpMax; u.alive = true; u.ready = false; u.atb = rand(0, 0.3); u.guard = 0; u.brace = 0;
      u.home = { x: u.rig.root.position.x, z: u.rig.root.position.z, ry: u.rig.root.rotation.y };   // where the avatar stands now
      u.rig.combat = true; u.rig.kind = 'stand'; u.rig.clip = null; u.rig.idleClip = u.rig.loco.battle;
      u.from = u.rig.root.position.clone(); u.rig.root.rotation.set(0, Math.PI + stage.th, 0);
      const sp = W(SPOT[u.id][0], SPOT[u.id][1]); u.to = new THREE.Vector3(sp.x, 0, sp.z);
    }
    const spots = FOE_SPOTS[foes.length] || FOE_SPOT;
    foes.forEach((f, i) => {
      f.hp = f.hpMax; f.alive = true; f.atb = rand(0, 0.2); f.rig.combat = true; f.wind = null;
      f.rig.clip = null; f.rig.idleClip = f.rig.loco.battle;
      f.from = f.rig.root.position.clone(); const sp = W(spots[i][0], spots[i][1]); f.to = new THREE.Vector3(sp.x, 0, sp.z);
      f.rig.root.rotation.set(0, stage.th, 0);
    });
    cast = null; target = foes[Math.floor(foes.length / 2)]; menuFor = null;
    ui.log.innerHTML = ''; ui.banner.hidden = true;
    log(g.text || 'Husks! They have seen you.'); Sound.sfx('growl'); shake(0.15);
  }

  function end(text) {
    phase = 'result'; phaseT = 0;
    cast = null; menuFor = null;
    for (const u of party) u.ready = false;
    ui.banner.textContent = text; ui.banner.hidden = false; Sound.sfx(text === 'Cleared' ? 'win' : 'lose');
  }

  function startLeave() {
    phase = 'leave'; phaseT = 0; ui.banner.hidden = true;
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
    const won = foes.every(f => !f.alive);
    for (const f of foes) {
      f.rig.combat = false; f.rig.clip = null;
      f.rig.root.rotation.set(0, 0, 0); f.rig.root.position.set(f.home.x, 0, f.home.z);
      if (!(won && !cur.persistent)) { f.alive = true; f.hp = f.hpMax; }
    }
    if (won && cur) {
      const loot = 1 + Math.floor(cur.tier / 2) + (cur.id === 'alley' ? 0 : 1);
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
        if (wait) continue;
        u.atb = Math.min(1, u.atb + u.rate * dt);
        if (u.atb >= 1 && !(u.id === 'ruen' && cast)) u.ready = true;
      }
      for (const f of foes) {
        if (!f.alive || wait) continue;
        if (f.wind) { updateWind(f, dt); continue; }
        f.atb = Math.min(1, f.atb + f.rate * dt);
        if (f.atb >= 1) foeAct(f);
      }
      if (cast && !wait) {
        cast.t = Math.min(1, cast.t + CAST_RATE * dt);
        if (cast.t >= 1) {
          Chars.play(ruenRig(), 'mgNova'); busy(1.4); Sound.sfx('nova'); shake(0.4);
          for (const f of foesAlive()) { FX.nova(f.rig.root.position); hitFoe(f, 30); }
          log('Data Burst!');
          cast = null;
        }
      }
      if (!foesAlive().length) end('Cleared');
      else if (!alive().length) end('Defeat');
    }

    if (phase === 'result' && phaseT >= RESULT_WAIT) startLeave();

    if (phase === 'explore') {
      aggroCd = Math.max(0, aggroCd - dt);
      const g = nearestGroup(); ui.engage.hidden = !g;
      if (g && g.aggro && aggroCd === 0 && groupDist(g, pp) < 4.4 && !(typeof Cutscene !== 'undefined' && Cutscene.active())) start();      // a patrol that has seen you
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
    }
    for (const u of party) {
      u.card.hp.style.width = (clamp(u.hp / u.hpMax, 0, 1) * 100) + '%';
      u.card.atb.style.width = (u.atb * 100) + '%';
      u.card.atb.parentNode.classList.toggle('full', u.ready);
      if (u.card.cast) u.card.cast.style.width = (cast ? cast.t * 100 : 0) + '%';
    }
    for (const p of pops) {
      const s = screenOf(p.u.rig.root.position, 2.4 + p.t * 0.6, camera);
      p.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
    }
    // The command menu: the first ready crew member (in order), who is not casting
    const who = isBusy() ? null : party.find(u => u.alive && u.ready && !(u.id === 'ruen' && cast));
    const key = who ? who.id : null;
    if (key !== menuFor) {
      menuFor = key;
      ui.actions.innerHTML = '';
      if (who) {
        for (const c of COMMANDS[who.id]) {
          const b = document.createElement('button');
          b.type = 'button'; b.textContent = c.label;
          b.addEventListener('click', () => { if (who.ready) c.run(who); menuFor = null; });
          ui.actions.appendChild(b);
        }
      }
    }
    ui.actions.hidden = !who || phase !== 'battle';
  }

  return { init, update, applyCamera, active, start, canEngage, debugWin: () => { for (const f of foesAlive()) hitFoe(f, 9999); }, register, unregister, engaging: () => phase !== 'explore', groupList: () => [...groups.values()], debugInfo: () => ({ phase, units: [...party, ...foes].map(u => ({ n: u.name, foe: !!u.foe, hp: Math.round(u.hp), atb: u.atb, alive: u.alive })) }), encounterR: ENCOUNTER_R, phase: () => phase, stage: () => stage };
})();
