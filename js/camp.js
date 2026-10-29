// Nexus - the fire at the heart of the scene: a burning oil drum with the crew sat around it, and the embers it throws up.
// The drum sits at the origin; everything else is placed relative to it, facing it.
// The camp is the safe zone: the crew scavenge scrap from the alley and spend it at the fire on weapon upgrades.
const Camp = (() => {
  const crew = [];                                   // { name, rig }, updated each frame
  const colliders = [];                              // circles the player walks around
  let flames = [], embers = null, fireLight = null, fireGlow = null, glowBase = null;

  // Scrap: glowing tech parts in the alley. Walking over one takes it. The upgrades cost scrap at the fire.
  const FIRE_R = 4.0, PICK_R = 1.1;                  // metres: how close to the drum counts as at the camp, and to a scrap
  const SCRAP_AT = [[-4.6, 0.8], [4.2, 2.0], [-2.0, -8.0], [3.6, -9.5], [-6.0, -13.0], [5.6, -16.0], [-1.0, -19.0], [-4.0, -21.0]];
  const scrap = [];                                  // { x, z, mesh, taken, phase }
  // Gear: each of the four has a weapon (3 tiers, +15% damage each) and armour (2 tiers, +12% health each). A tier needs the one before it.
  const GEAR = {
    you: { w: ['Tempered Katana', 'Resonant Katana', 'Spire-Cut Katana'], a: ['Reinforced Coat', 'Plated Jacket'] },
    ruen: { w: ['Data-Orb Core', 'Orb Lattice', 'Orb Singularity'], a: ['Stitched Coat', 'Hardlight Weave'] },
    kyle: { w: ['Kinetic Gauntlet', 'Gauntlet Servos', 'Gauntlet Overdrive'], a: ['Plate Harness', 'Bulwark Plate'] },
    yuna: { w: ['Tuned Blasters', 'Plasma Coils', 'Dual Overclock'], a: ['Stealth Weave', 'Ghost Suit'] },
  };
  const WCOST = Tuning.gear.wcost, ACOST = Tuning.gear.acost, WMULT = Tuning.gear.weapon, AMULT = Tuning.gear.armor;
  const UPGRADES = [];
  for (const who of Object.keys(GEAR)) {
    GEAR[who].w.forEach((name, i) => UPGRADES.push({ id: who + '-w' + (i + 1), who, slot: 'w', tier: i + 1, name, cost: WCOST[i], text: '+15% damage' }));
    GEAR[who].a.forEach((name, i) => UPGRADES.push({ id: who + '-a' + (i + 1), who, slot: 'a', tier: i + 1, name, cost: ACOST[i], text: '+12% health' }));
  }
  const LEGACY = { orb: 'ruen-w1', gauntlet: 'kyle-w1', blasters: 'yuna-w1' };       // ids from the first saves
  const owned = new Set();
  let parts = 0;

  // Turns a rig to look at the drum from where it stands
  const faceFire = (obj, x, z) => { obj.rotation.y = Math.atan2(-x, -z); };

  function drum(root) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.5, metalness: 0.6, flatShading: true });
    const band = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.4, metalness: 0.7, flatShading: true });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.4, 1.05, 12), steel);
    body.position.y = 0.52; root.add(body);
    for (const y of [0.18, 0.86]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.025, 6, 16), band);
      hoop.rotation.x = Math.PI / 2; hoop.position.y = y; root.add(hoop);
    }
    // The open top: a dark rim with the fire inside
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 12, 1, true), steel);
    rim.position.y = 1.05; root.add(rim);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.4, 12), new THREE.MeshBasicMaterial({ color: 0x1a0c04 }));
    hole.rotation.x = -Math.PI / 2; hole.position.y = 1.08; root.add(hole);

    // Flames: flat-shaded cones of orange and yellow that stretch and lean as they burn
    const orange = new THREE.MeshBasicMaterial({ color: 0xff6a1a, toneMapped: false });
    const yellow = new THREE.MeshBasicMaterial({ color: 0xffc35a, toneMapped: false });
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, r = i % 3 === 0 ? 0 : 0.18;
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.13 + (i % 2) * 0.04, 0.5 + (i % 3) * 0.12, 5), i % 2 ? yellow : orange);
      f.position.set(Math.cos(a) * r, 1.22, Math.sin(a) * r);
      f.userData.phase = i * 1.7; f.userData.base = f.position.y;
      root.add(f); flames.push(f);
    }
    fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.glow(), color: 0xff7a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35, toneMapped: false }));
    fireGlow.position.set(0, 1.3, 0); fireGlow.scale.set(3.4, 3.4, 1); root.add(fireGlow);
    glowBase = 0.85;

    fireLight = new THREE.PointLight(0xff7a2a, 1.6, 12, 1.4); fireLight.position.set(0, 1.5, 0); root.add(fireLight);

    // A warm pool on the ground around the drum
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), new THREE.MeshBasicMaterial({ map: Tex.glow(), color: 0x3a1608, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.02; root.add(pool);
    colliders.push({ x: 0, z: 0, r: 0.5 });
  }

  // Sparks that rise from the drum and fade out above it
  function emberField(root) {
    const N = 90, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
    for (let i = 0; i < N; i++) respawn(pos, vel, life, i, true);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    embers = new THREE.Points(g, new THREE.PointsMaterial({ map: Tex.pixel(), color: 0xffa040, size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    embers.userData = { pos, vel, life };
    root.add(embers);
  }
  function respawn(pos, vel, life, i, scatter) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.35;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = scatter ? 1.1 + Math.random() * 2.4 : 1.15; pos[i * 3 + 2] = Math.sin(a) * r;
    vel[i * 3] = (Math.random() - 0.5) * 0.3; vel[i * 3 + 1] = 0.35 + Math.random() * 0.5; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    life[i] = Math.random();
  }

  // Seats for the crew. Each one is a pipe or a crate to sit on, and its position in the reference image
  const SEATS = [
    { who: 'ruen', x: -1.9, z: -0.9, h: 0.62, prop: 'pipe' },
    { who: 'kyle', x: 1.5, z: -1.2, h: 0.72, prop: 'crate' },
    { who: 'yuna', x: 2.7, z: 0.4, h: 0.62, prop: 'pipe' },
  ];

  function seat(root, s, rig) {
    const f = Math.atan2(-s.x, -s.z);
    if (s.prop === 'pipe') {
      const m = new THREE.MeshStandardMaterial({ color: 0x2f3442, roughness: 0.5, metalness: 0.5, flatShading: true });
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.6, 10), m);
      p.rotation.set(0, f, Math.PI / 2); p.position.set(s.x, 0.3, s.z); root.add(p);
    } else {
      const m = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.9, flatShading: true });
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), m);
      c.position.set(s.x, 0.36, s.z); c.rotation.y = f + 0.2; root.add(c);
    }
    rig.root.position.set(s.x, 0, s.z);
    faceFire(rig.root, s.x, s.z);
    root.add(rig.root);
    colliders.push({ x: s.x, z: s.z, r: 0.5 });
  }

  // The scrap lies on the ground: a small cyan octahedron that bobs and turns until it is picked up
  function scatterScrap(root) {
    const m = new THREE.MeshStandardMaterial({ color: 0x0b2a30, emissive: 0x3ff0ff, emissiveIntensity: 1.4, roughness: 0.4, flatShading: true });
    SCRAP_AT.forEach(([x, z], i) => {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), m);
      mesh.position.set(x, 0.4, z); root.add(mesh);
      scrap.push({ x, z, mesh, taken: false, phase: Math.random() * Math.PI * 2, key: 'a' + i });
    });
  }

  function build(scene) {
    const root = new THREE.Group(); scene.add(root);
    drum(root);
    emberField(root);
    scatterScrap(root);
    for (const s of SEATS) {
      const rig = Chars.create(s.who);
      rig.seatH = s.h;
      seat(root, s, rig);
      crew.push({ name: s.who, rig, mode: 'seated', seat: s });
    }
    // The bystander on the right of the stall, standing a little apart from the fire
    const stranger = Chars.create('stranger');
    stranger.root.position.set(6.4, 0, -3.8); faceFire(stranger.root, 6.4, -3.8);
    stranger.root.rotation.y += 0.35; root.add(stranger.root);
    crew.push({ name: 'stranger', rig: stranger });
    colliders.push({ x: 6.4, z: -3.8, r: 0.45 });
    return root;
  }

  // Scrap that the world's chunks drop in the streets: added to a chunk's group (world coordinates) and removed when it unloads.
  // key names it, so a part that was picked up does not come back when the chunk loads again.
  let scrapMat = null;
  function addScrap(group, x, z, key) {
    scrapMat = scrapMat || new THREE.MeshStandardMaterial({ color: 0x0b2a30, emissive: 0x3ff0ff, emissiveIntensity: 1.4, roughness: 0.4, flatShading: true });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), scrapMat); mesh.position.set(x, 0.4, z); group.add(mesh);
    const h = { x, z, mesh, taken: false, phase: Math.random() * Math.PI * 2, key, group }; scrap.push(h); return h;
  }
  function dropScrap(h) { const i = scrap.indexOf(h); if (i >= 0) scrap.splice(i, 1); h.group.remove(h.mesh); h.mesh.geometry.dispose(); }

  // Scrap: spin and bob, and take any that the avatar walks over
  function collectScrap(t, dt, p) {
    for (const s of scrap) {
      if (s.taken) continue;
      s.mesh.position.y = 0.4 + Math.sin(t * 3 + s.phase) * 0.06;
      s.mesh.rotation.y += dt * 1.5;
      if (Math.hypot(p.x - s.x, p.z - s.z) < PICK_R) { s.taken = true; s.mesh.visible = false; parts += 1; Sound.sfx('pickup'); if (s.key && typeof World !== 'undefined') World.markTaken(s.key); }
    }
  }

  // The upgrades: buying one spends its scrap and keeps it for good
  function buy(id) {
    const u = UPGRADES.find(x => x.id === id);
    if (!u || owned.has(id) || parts < u.cost || (u.tier > 1 && !owned.has(u.who + '-' + u.slot + (u.tier - 1)))) return false;
    parts -= u.cost; owned.add(id);
    return true;
  }
  // The damage multiplier a crew member's attacks get from their upgrade (1 when there is none)
  const tiersOwned = (who, slot) => UPGRADES.filter(u => u.who === who && u.slot === slot && owned.has(u.id)).length;
  const damageMult = who => Math.pow(WMULT, tiersOwned(who, 'w'));
  const hpMult = who => Math.pow(AMULT, tiersOwned(who, 'a'));
  // The next piece of gear to craft for a slot (null once maxed), and the name of what is worn now
  const nextGear = (who, slot) => UPGRADES.find(u => u.who === who && u.slot === slot && !owned.has(u.id)) || null;
  const wornName = (who, slot) => { const n = tiersOwned(who, slot); return n ? GEAR[who][slot][n - 1] : null; };
  // Camps: the alley's fire and the ones in the districts (World.SITES). Found by walking up to them; resting there heals the crew and saves.
  const found = new Set(['fire']), skits = new Set(); let lastCamp = 'fire';
  const SITE_R = 3.6;
  const siteList = () => [{ id: 'fire', name: 'The Underbelly fire', x: 0, z: 0 }, ...Object.entries(World.SITES).map(([id, s]) => ({ id, name: s.name, x: s.x, z: s.z }))];
  function nearCamp(p) {
    if (Math.hypot(p.x, p.z) < FIRE_R) return 'fire';
    for (const s of siteList()) if (s.id !== 'fire' && Math.hypot(p.x - s.x, p.z - s.z) < SITE_R) return s.id;
    return null;
  }
  const nearFire = p => nearCamp(p) !== null;
  const discover = id => { if (!found.has(id)) { found.add(id); return true; } return false; };
  // Where the crew stand when they arrive at a camp (travel, or waking after a defeat)
  const campSpot = id => { const s = siteList().find(q => q.id === id); return id === 'fire' ? { x: -2.4, z: 2.4 } : { x: s.x, z: s.z + 3.0 }; };
  let fadeEl = null;
  function fadeThen(cb) {                                          // a short fade to black and back around a jump
    if (!fadeEl) { fadeEl = document.createElement('div'); fadeEl.className = 'fade'; document.body.appendChild(fadeEl); }
    fadeEl.classList.add('on');
    setTimeout(() => { cb(); setTimeout(() => fadeEl.classList.remove('on'), 150); }, 450);
  }
  function arriveAt(id) {
    const sp = campSpot(id), n = Player.collidePoint(sp.x, sp.z);
    Player.teleport(n.x, n.z); Player.faceTowards(id === 'fire' ? 0 : siteList().find(q => q.id === id).x, id === 'fire' ? 0 : siteList().find(q => q.id === id).z);
    Camp.restoreCrew(Player.state());
  }
  // Resting at a camp (opening its menu): the crew are healed, the camp becomes the place they wake at, and the game saves
  function rest(id) {
    if (!id) return;
    discover(id); lastCamp = id; Combat.restAll(); Save.save();
    const toast = document.getElementById('toast'); if (toast) { toast.textContent = 'The crew rest. Everyone is back on their feet.'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
    Sound.sfx('quest');
  }
  function travel(id) { if (!found.has(id)) return; lastCamp = id; fadeThen(() => { arriveAt(id); Save.save(); }); }
  function wake() { fadeThen(() => { arriveAt(lastCamp); Combat.restAll(); Save.save(); }); }

  // ---------------- The crew follow the avatar once it leaves the camp ----------------
  // seated -> follow (the avatar is more than LEAVE_R from the fire) -> returning (it is back within BACK_R) -> seated again at their seat.
  // Followers keep a loose formation behind and beside the avatar, walking or running to keep up, and are kept out of walls like the avatar.
  const LEAVE_R = 9, BACK_R = 5, FORM = { ruen: [0.0, -2.4], kyle: [-1.5, -1.5], yuna: [1.5, -1.5] };
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // A follower walks toward its spot, feeling its way round obstacles: each frame it tries the direct line and a fan of detours to either side
  // and takes the one that gets closest, sticking to the side it chose so it does not dither. If it makes no headway for a while it
  // sidesteps on purpose, and if it is stuck for good while the avatar is far off it is moved to the avatar's side.
  const FAN = [0, 0.45, -0.45, 0.95, -0.95, 1.55, -1.55, 2.2, -2.2];
  const STUCK_SNAP = 3.0, FAR_SNAP = 28;
  function stepTo(c, tx, tz, dt, run, farFrom) {
    const p = c.rig.root.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    let v = 0;
    c.px = c.px || 0; c.pz = c.pz || 0;
    if (d > 0.25) {
      v = Math.min(run ? 6.4 : 3.0, 0.6 + d * 1.8);
      const step = Math.min(v * dt, d), want = Math.atan2(dx, dz);
      let best = null, bestScore = -1e9;
      const base = c.detour && c.detour.t > 0 ? c.detour.ang : want;                // a deliberate sidestep overrides for a moment
      for (const off of FAN) {
        const ang = base + off, n = Player.collidePoint(p.x + Math.sin(ang) * step, p.z + Math.cos(ang) * step);
        const gain = ((n.x - p.x) * dx + (n.z - p.z) * dz) / d;                       // how much nearer to the goal this step gets
        const score = gain - Math.abs(off) * 0.01 * step + (c.side && Math.sign(off) === c.side ? 0.02 * step : 0);
        if (score > bestScore) { bestScore = score; best = { n, off }; }
      }
      p.x = best.n.x; p.z = best.n.z; if (best.off) c.side = Math.sign(best.off); else if (bestScore > step * 0.7) c.side = 0;
      const faceTo = Math.hypot(best.n.x - c.px, best.n.z - c.pz) > 0.001 ? Math.atan2(Math.sin(want + best.off * 0.5), Math.cos(want + best.off * 0.5)) : want;
      c.rig.root.rotation.y += wrap(faceTo - c.rig.root.rotation.y) * Math.min(1, dt * 9);
      // Headway over the last half second: none means stuck
      c.prog = (c.prog || 0) + Math.max(0, bestScore);
      c.progT = (c.progT || 0) + dt;
      if (c.progT >= 0.5) {
        const made = c.prog, expect = v * 0.5 * 0.35;
        c.stuck = made < expect && d > 1.2 ? (c.stuck || 0) + c.progT : 0;
        c.prog = 0; c.progT = 0;
        if (c.stuck > 1.0 && (!c.detour || c.detour.t <= 0)) c.detour = { ang: want + (c.side || (Math.random() < 0.5 ? 1 : -1)) * 1.7, t: 0.9 };       // back off and go round
      }
      if (c.detour) c.detour.t -= dt;
      // Stuck for good, or left far behind: join the avatar
      if (farFrom && (c.stuck > STUCK_SNAP && farFrom.d > 7 || farFrom.d > FAR_SNAP)) { c.stuck = 0; c.detour = null; return { v: 0, d, snap: true }; }
    } else { c.stuck = 0; c.prog = 0; c.progT = 0; }
    c.px = p.x; c.pz = p.z;
    return { v, d };
  }
  // Puts a follower at its formation spot beside the avatar, on free ground
  function snapTo(c, av, f) {
    const h = av.heading, sx = Math.sin(h), sz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
    for (const k of [1, 1.6, 2.2, 0.6]) {
      const n = Player.collidePoint(av.x + sx * f[1] * k + rx * f[0] * k, av.z + sz * f[1] * k + rz * f[0] * k);
      if (Math.hypot(n.x - av.x, n.z - av.z) > 0.8) { c.rig.root.position.set(n.x, 0, n.z); c.rig.root.rotation.y = h; c.px = n.x; c.pz = n.z; return; }
    }
    c.rig.root.position.set(av.x, 0, av.z - 1.5);
  }
  function crewMove(c, dt, av) {
    const rig = c.rig; if (rig.combat || c.name === 'stranger') return null;
    if (c.mode === 'scene') return 0;
    const away = Math.hypot(av.x, av.z), busy = Cutscene.active();
    if (c.mode === 'seated' && away > LEAVE_R && !busy) { c.mode = 'follow'; rig.kind = 'stand'; rig.hips.position.y = rig.hipsRest; }
    else if (c.mode === 'follow' && away < BACK_R) c.mode = 'returning';
    else if (c.mode === 'returning' && away > LEAVE_R) c.mode = 'follow';
    if (c.mode === 'follow') {
      const f = FORM[c.name] || [0, -2], h = av.heading, sx = Math.sin(h), sz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
      const goal = Player.collidePoint(av.x + sx * f[1] + rx * f[0], av.z + sz * f[1] + rz * f[0]), tx = goal.x, tz = goal.z;      // the spot must be on free ground
      const away = Math.hypot(av.x - rig.root.position.x, av.z - rig.root.position.z);
      const r = stepTo(c, tx, tz, dt, Math.hypot(tx - rig.root.position.x, tz - rig.root.position.z) > 3.5 || av.speed > 4.0, { d: away });
      if (r.snap) { snapTo(c, av, f); return 0; }
      if (r.v === 0) rig.root.rotation.y += wrap(h - rig.root.rotation.y) * Math.min(1, dt * 4);     // standing still: face where the avatar faces
      return r.v;
    }
    if (c.mode === 'returning') {
      const r = stepTo(c, c.seat.x, c.seat.z, dt, false, { d: 99 });
      if (r.snap) { rig.root.position.set(c.seat.x, 0, c.seat.z); c.mode = 'seated'; rig.kind = 'seated'; faceFire(rig.root, c.seat.x, c.seat.z); rig.seatH = c.seat.h; return 0; }
      if (r.d <= 1.15) { c.mode = 'seated'; rig.kind = 'seated'; rig.root.position.set(c.seat.x, 0, c.seat.z); faceFire(rig.root, c.seat.x, c.seat.z); rig.seatH = c.seat.h; return 0; }   // the seat's own collider holds them just short, so close enough sits
      return r.v;
    }
    return 0;
  }
  // A place scene: the crew gather round (x, z), standing and facing `facing`; held in 'scene' mode until the scene ends
  function gatherAt(x, z, facing) {
    const off = { ruen: [-1.8, 1.5], kyle: [1.8, 1.5], yuna: [0, 3.0] };
    for (const c of crew) if (off[c.name]) {
      c.mode = 'scene'; c.rig.kind = 'stand'; c.rig.hips.position.y = c.rig.hipsRest;
      const n = Player.collidePoint(x + off[c.name][0], z + off[c.name][1]); c.rig.root.position.set(n.x, 0, n.z); c.rig.root.rotation.y = facing;
    }
  }
  function release() { for (const c of crew) if (c.mode === 'scene') c.mode = 'follow'; }
  // Seats everyone at once (a cutscene at the fire starts with the crew where the story expects them)
  function seatAll() {
    for (const c of crew) if (c.seat) { c.mode = 'seated'; c.rig.kind = 'seated'; c.rig.root.position.set(c.seat.x, 0, c.seat.z); faceFire(c.rig.root, c.seat.x, c.seat.z); c.rig.seatH = c.seat.h; }
  }
  // After a battle: a crew member goes back to being seated or following, as they were
  function afterBattle(rig) { const c = crew.find(q => q.rig === rig); if (c) rig.kind = c.mode === 'seated' ? 'seated' : 'stand'; }

  // Flicker the flames and the light, rise the embers, and pose the crew
  function update(t, dt) {
    collectScrap(t, dt, Player.state());
    for (const f of flames) {
      const k = 0.85 + 0.25 * Math.sin(t * 9 + f.userData.phase) * Math.sin(t * 4.3 + f.userData.phase * 0.7);
      f.scale.set(1, k, 1);
      f.position.y = f.userData.base + (k - 1) * 0.2;
    }
    fireLight.intensity = 1.6 + Math.sin(t * 11) * 0.18 + Math.sin(t * 4.7) * 0.14;
    fireGlow.material.opacity = glowBase * (0.9 + 0.1 * Math.sin(t * 8));
    const { pos, vel, life } = embers.userData;
    for (let i = 0; i < life.length; i++) {
      pos[i * 3] += (vel[i * 3] + Math.sin(t * 2 + i) * 0.15) * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] > 4.4) respawn(pos, vel, life, i, false);
    }
    embers.geometry.attributes.position.needsUpdate = true;
    const av = Player.state();
    for (const c of crew) if (!c.rig.combat) Chars.update(c.rig, t, dt, crewMove(c, dt, av) || 0);   // Combat poses the crew during a battle
  }

  return {
    build, update, crew, colliders, SEATS,
    UPGRADES, GEAR, buy, damageMult, hpMult, nextGear, wornName, nearFire, nearCamp, rest, siteList, discover, travel, wake, fadeThen, FIRE_R,
    found: () => [...found], lastCamp: () => lastCamp, setLast: id => { lastCamp = id; }, skitSeen: id => skits.has(id), markSkit: id => skits.add(id), addScrap, dropScrap, seatAll, gatherAt, release, afterBattle, addParts: n => { parts += n; },
    isOwned: id => owned.has(id),
    getState: () => ({ parts, owned: [...owned], found: [...found], last: lastCamp, skits: [...skits] }),
    setState(d) {
      parts = d.parts || 0; owned.clear(); (d.owned || []).forEach(id => owned.add(LEGACY[id] || id));
      found.clear(); found.add('fire'); (d.found || []).forEach(id => found.add(id)); lastCamp = d.last || 'fire'; skits.clear(); (d.skits || []).forEach(id => skits.add(id));
      for (const s of scrap) if (s.key && s.key[0] === 'a' && World.isTaken(s.key)) { s.taken = true; s.mesh.visible = false; }       // the alley's scrap that was already picked up
    },
    // After a load: the crew sit at the fire if the avatar is near it, otherwise they are following the avatar
    restoreCrew(av) {
      seatAll();
      if (Math.hypot(av.x, av.z) <= LEAVE_R) return;
      for (const c of crew) if (c.seat) {
        const f = FORM[c.name] || [0, -2], n = Player.collidePoint(av.x + Math.sin(av.heading) * f[1] + Math.cos(av.heading) * f[0], av.z + Math.cos(av.heading) * f[1] - Math.sin(av.heading) * f[0]);
        c.mode = 'follow'; c.rig.kind = 'stand'; c.rig.hips.position.y = c.rig.hipsRest; c.rig.root.position.set(n.x, 0, n.z); c.rig.root.rotation.y = av.heading;
      }
    },
    get parts() { return parts; },
  };
})();
