// Nexus - battle: an ATB (active time battle) encounter with the crew against husks from the alley.
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
  const PARTY = {
    you: { name: 'You', hp: 110, rate: 0.12, color: '#ffffff' },
    ruen: { name: 'Ruen', hp: 90, rate: 0.13, color: '#c9a0ff' },
    kyle: { name: 'Kyle', hp: 150, rate: 0.1, color: '#ffd27a' },
    yuna: { name: 'Yuna', hp: 80, rate: 0.2, color: '#7ff7ff' },
  };
  const ORDER = ['you', 'ruen', 'kyle', 'yuna'];
  const HUSK = { name: 'Husk', hp: 60, rate: 0.09, color: '#ff5a7a' };
  const COMMANDS = {
    you: [{ label: 'Strike', run: u => strike(u, 16, 'slash3') }, { label: 'Brace', run: u => brace(u) }],
    ruen: [{ label: 'Data Bolt', run: u => strike(u, 22, 'attack2') }, { label: 'Data Burst', run: u => startCast(u) }],
    kyle: [{ label: 'Strike', run: u => strike(u, 18, 'attack1') }, { label: 'Guard', run: u => guard(u) }],
    yuna: [{ label: 'Blast', run: u => { strike(u, 14, 'shoot'); strike(u, 14, null); } }, { label: 'Stagger', run: u => stagger(u) }],
  };

  const ease = x => x * x * (3 - 2 * x);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const $ = id => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);

  let scene = null, phase = 'explore', phaseT = 0, clock = 0;
  let party = [], foes = [], target = null, cast = null, shots = [], pops = [], menuFor = null;
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
    for (let i = 0; i < 3; i++) {
      const rig = Chars.create('husk'); rig.root.position.set(FOE_HOME[i][0], 0, FOE_HOME[i][1]); scene.add(rig.root);
      const f = { id: 'husk' + i, name: HUSK.name, rig, hp: HUSK.hp, hpMax: HUSK.hp, rate: HUSK.rate, atb: 0, alive: true, foe: true, wind: null, home: { x: FOE_HOME[i][0], z: FOE_HOME[i][1], ry: 0 }, spot: FOE_SPOT[i] };
      f.label = makeLabel(HUSK.name, HUSK.color, f);
      foes.push(f);
    }
    target = foes[0];
    buildUI();
    $('engage').addEventListener('click', start);
    window.addEventListener('keydown', e => { if (e.code === 'KeyE') start(); });
    for (const u of [...party, ...foes]) setHome(u);
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

  // A glowing shot that flies from one unit to another; it is cosmetic, the damage lands at once
  function shot(from, to, color) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.glow(), color: new THREE.Color(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    s.scale.set(0.9, 0.9, 1); scene.add(s);
    shots.push({ s, from: from.rig.root.position.clone().setY(1.2), to: to.rig.root.position.clone().setY(1.2), t: 0 });
  }

  // ---------------- Damage ----------------
  function kill(u) {
    u.alive = false; u.ready = false; clearWind(u);
    Chars.play(u.rig, 'die', true);
    log(u.name + (u.foe ? ' falls.' : ' is down!'));
  }
  function damage(u, dmg) {
    if (!u.alive) return;
    u.hp = Math.max(0, u.hp - dmg); popup(u, '-' + dmg, u.foe ? '#ffffff' : '#ff8a8a');
    if (u.hp <= 0) kill(u); else Chars.play(u.rig, u.hp < u.hpMax * 0.3 ? 'impact2' : 'impact');
  }
  // A husk's attack on a crew member. Kyle may intercept a fatal blow on Ruen or Yuna
  function hitParty(u, dmg) {
    const kyle = party.find(p => p.id === 'kyle');
    if (dmg >= u.hp && u.id !== 'kyle' && kyle.alive && kyle.guard > 0 && kyle.atb >= 0.5) {
      kyle.atb = 0; kyle.guard = 0;
      log('Kyle intercepts the blow meant for ' + u.name + '!');
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
  function endTurn(u) { u.atb = 0; u.ready = false; menuFor = null; }
  function strike(u, dmg, clip = 'attack1') {                     // clip null: the second blow of a combo, the first one's clip plays on
    const t = selected(); if (!t) return;
    if (clip) Chars.play(u.rig, clip);
    shot(u, t, u.color); hitFoe(t, dmg); log(u.name + ' hits the husk for ' + dmg + '.');
    endTurn(u);
  }
  function guard(u) {
    u.guard = GUARD_TIME; u.rig.idleClip = 'blockIdle'; Chars.play(u.rig, 'block');
    log('Kyle raises his guard.'); endTurn(u);
  }
  function brace(u) {
    u.brace = BRACE_TIME; u.rig.idleClip = 'blockIdle'; Chars.play(u.rig, 'block');
    log('You brace.'); endTurn(u);
  }
  function stagger(u) {
    const t = selected(); if (!t) return;
    Chars.play(u.rig, 'kick');
    t.atb = Math.max(0, t.atb - STAGGER);
    if (t.wind) { t.wind = null; log('Stagger breaks the husk\'s wind-up.'); } else log('Stagger pushes the husk back.');
    shot(u, t, u.color);
    endTurn(u);
  }
  function startCast(u) { cast = { t: 0 }; Chars.play(u.rig, 'attack3'); log('Ruen begins Data Burst.'); endTurn(u); }

  // ---------------- Husk AI ----------------
  function foeAct(f) {
    f.atb = 0;
    if (Math.random() < 0.35) {
      const t = pick(); if (!t) return;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0xff3a5a, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(t.rig.root.position.x, 0.04, t.rig.root.position.z); scene.add(ring);
      f.wind = { t: WIND, target: t, ring, dmg: Math.round(rand(30, 36)) };
      log(f.name + ' winds up on ' + t.name + '!');
    } else {
      const t = pick(); if (!t) return;
      Chars.play(f.rig, 'attack2');
      shot(f, t, HUSK.color); hitParty(t, Math.round(rand(11, 15)));
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
      if (t) { Chars.play(f.rig, 'attack1'); shot(f, t, HUSK.color); hitParty(t, w.dmg); log(f.name + ' crushes ' + t.name + '!'); }
      clearWind(f);
    }
  }
  function clearWind(f) { if (f.wind) { scene.remove(f.wind.ring); f.wind.ring.geometry.dispose(); f.wind = null; } }

  // ---------------- Phases ----------------
  function start() {
    if (phase !== 'explore' || !canEngage()) return;
    phase = 'enter'; phaseT = 0;
    Player.setFrozen(true);
    for (const u of party) {
      u.hp = u.hpMax; u.alive = true; u.ready = false; u.atb = rand(0, 0.3); u.guard = 0; u.brace = 0;
      u.home = { x: u.rig.root.position.x, z: u.rig.root.position.z, ry: u.rig.root.rotation.y };   // where the avatar stands now
      u.rig.combat = true; u.rig.kind = 'stand'; u.rig.clip = null; u.rig.idleClip = 'idleAlert';
      u.from = u.rig.root.position.clone(); u.rig.root.rotation.set(0, Math.PI, 0);
      u.to = new THREE.Vector3(SPOT[u.id][0], 0, SPOT[u.id][1]);
    }
    for (const f of foes) {
      f.hp = f.hpMax; f.alive = true; f.atb = rand(0, 0.2); f.rig.combat = true; f.wind = null;
      f.rig.clip = null; f.rig.idleClip = 'idleAlert';
      f.from = f.rig.root.position.clone(); f.to = new THREE.Vector3(f.spot[0], 0, f.spot[1]);
      f.rig.root.rotation.set(0, 0, 0);
    }
    cast = null; target = foes[1]; menuFor = null;
    ui.log.innerHTML = ''; ui.banner.hidden = true;
    log('An ambush from the alley!');
  }

  function end(text) {
    phase = 'result'; phaseT = 0;
    cast = null; menuFor = null;
    for (const u of party) u.ready = false;
    ui.banner.textContent = text; ui.banner.hidden = false;
  }

  function startLeave() {
    phase = 'leave'; phaseT = 0; ui.banner.hidden = true;
    for (const u of [...party, ...foes]) { clearWind(u); u.from = u.rig.root.position.clone(); }
    for (const u of party) u.to = new THREE.Vector3(u.home.x, 0, u.home.z);
    for (const f of foes) f.to = new THREE.Vector3(f.home.x, 0, f.home.z);
  }

  function finishLeave() {
    phase = 'explore'; phaseT = 0;
    for (const u of party) {
      u.rig.combat = false; u.rig.clip = null; u.rig.idleClip = 'idleEase';
      if (u.id !== 'you') u.rig.kind = 'seated';
      u.rig.root.rotation.set(0, u.home.ry, 0); u.rig.root.position.y = 0;
      u.rig.root.position.set(u.home.x, 0, u.home.z);
    }
    for (const f of foes) {
      f.rig.combat = false; f.rig.clip = null; f.alive = true; f.hp = f.hpMax;
      f.rig.root.rotation.set(0, 0, 0); f.rig.root.position.set(f.home.x, 0, f.home.z);
    }
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
  function applyCamera(cam) {
    const ex = Player.exploreView(), k = blend();
    cam.position.lerpVectors(ex.pos, BATTLE.pos, k);
    v.lerpVectors(ex.look, BATTLE.look, k);
    cam.lookAt(v);
  }

  function canEngage() {
    if (phase !== 'explore') return false;
    const p = Player.state();
    return foes.some(f => f.alive && Math.hypot(p.x - f.home.x, p.z - f.home.z) <= ENCOUNTER_R);
  }

  // ---------------- Per-frame ----------------
  function update(dt, camera) {
    clock += dt; phaseT += dt;

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
      for (const u of party) {
        if (!u.alive) continue;
        u.guard = Math.max(0, u.guard - dt);
        if (u.brace > 0) { u.brace = Math.max(0, u.brace - dt); if (u.brace === 0) u.rig.idleClip = 'idleAlert'; }
        if (u.id === 'kyle' && u.guard === 0 && u.rig.idleClip === 'blockIdle') u.rig.idleClip = 'idleAlert';
        u.atb = Math.min(1, u.atb + u.rate * dt);
        if (u.atb >= 1 && !(u.id === 'ruen' && cast)) u.ready = true;
      }
      for (const f of foes) {
        if (!f.alive) continue;
        if (f.wind) { updateWind(f, dt); continue; }
        f.atb = Math.min(1, f.atb + f.rate * dt);
        if (f.atb >= 1) foeAct(f);
      }
      if (cast) {
        cast.t = Math.min(1, cast.t + CAST_RATE * dt);
        if (cast.t >= 1) {
          for (const f of foesAlive()) hitFoe(f, 30);
          log('Data Burst!');
          cast = null;
        }
      }
      if (!foesAlive().length) end('Cleared');
      else if (!alive().length) end('Defeat');
    }

    if (phase === 'result' && phaseT >= RESULT_WAIT) startLeave();

    if (phase === 'explore') ui.engage.hidden = !canEngage();
    else ui.engage.hidden = true;
    ui.battle.hidden = phase === 'explore';

    // Idle motion for everyone not under the crew's own pose
    for (const f of foes) Chars.update(f.rig, clock, dt, walking);
    for (const u of party) if (u.rig.combat) Chars.update(u.rig, clock, dt, walking);

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
    document.body.classList.toggle('battle', show);
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
    const who = party.find(u => u.alive && u.ready && !(u.id === 'ruen' && cast));
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

  return { init, update, applyCamera, active, start, canEngage, phase: () => phase };
})();
