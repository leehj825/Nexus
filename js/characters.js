// Nexus - the crew, built in code the way Deepward builds its heroes: a joint hierarchy of Groups dressed with primitive meshes,
// flat-shaded and posed procedurally (no model or animation files).
// Conventions: feet at y=0, facing +Z, the character's right hand is on -X. Joints rotate so that a negative x swings a limb forward.
const Chars = (() => {
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0.1, flatShading: true }, o));
  const lit = (c, k = 1.4) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: k, roughness: 0.4, flatShading: true });
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = false; parent.add(o); return o; };
  const joint = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  // A limb segment hanging down from its joint, returns the joint at its far end
  const seg = (parent, len, r0, r1, m) => { if (m) add(parent, new THREE.CylinderGeometry(r0, r1, len, 7), m, 0, -len / 2, 0); return joint(parent, 0, -len, 0); };

  // The skeleton. p: { thigh, shin, shoulderW, torsoH, armR, legR }. Returns the rig with its named joints
  function skeleton(p) {
    const root = new THREE.Group();
    const hips = joint(root, 0, p.thigh + p.shin, 0);
    const torso = joint(hips, 0, 0.1, 0);
    const head = joint(torso, 0, p.torsoH, 0);
    const c = { root, hips, torso, head, j: {} };
    c.j.torso = torso; c.j.head = head; c.hipsRest = p.thigh + p.shin;   // the mocap clips write these joints
    head.scale.setScalar(p.headS || 1.2);                                   // the reference crew has big, readable heads
    for (const side of [-1, 1]) {
      const k = side > 0 ? 'L' : 'R';
      c.j['hip' + k] = joint(hips, side * 0.13, 0, 0);
      c.j['knee' + k] = seg(c.j['hip' + k], p.thigh, p.legR, p.legR * 0.85, null);
      c.j['ank' + k] = seg(c.j['knee' + k], p.shin, p.legR * 0.85, p.legR * 0.7, null);
      c.j['sh' + k] = joint(torso, side * p.shoulderW, p.torsoH - 0.1, 0);
      c.j['el' + k] = seg(c.j['sh' + k], 0.34, p.armR, p.armR * 0.85, null);
      c.j['wr' + k] = seg(c.j['el' + k], 0.32, p.armR * 0.85, p.armR * 0.7, null);
    }
    return c;
  }

  // Meshes for the limbs are added after the skeleton so each dress function decides the materials
  function limbs(c, p, m) {
    for (const k of ['L', 'R']) {
      add(c.j['hip' + k], new THREE.CylinderGeometry(p.legR * 1.1, p.legR * 0.9, p.thigh, 7), m.pants, 0, -p.thigh / 2, 0);
      add(c.j['knee' + k], new THREE.CylinderGeometry(p.legR * 0.9, p.legR * 0.78, p.shin, 7), m.pants, 0, -p.shin / 2, 0);
      add(c.j['ank' + k], new THREE.BoxGeometry(0.16, 0.09, 0.32), m.shoes, 0, -0.04, 0.08);
      add(c.j['sh' + k], new THREE.SphereGeometry(p.armR * 1.25, 7, 5), m.sleeve, 0, 0, 0);
      add(c.j['sh' + k], new THREE.CylinderGeometry(p.armR, p.armR * 0.85, 0.34, 7), m.sleeve, 0, -0.17, 0);
      add(c.j['el' + k], new THREE.CylinderGeometry(p.armR * 0.85, p.armR * 0.7, 0.32, 7), m.sleeve, 0, -0.16, 0);
      add(c.j['wr' + k], new THREE.SphereGeometry(p.armR * 0.95, 7, 5), m.skin, 0, -0.03, 0);
    }
  }

  // A person in a pose. kind: 'seated' (hips on a seat at c.seatH) or 'stand' (walks with `speed`)
  function rest(c) {
    for (const k in c.j) c.j[k].rotation.set(0, 0, 0);
    c.hips.rotation.set(0, 0, 0); c.hips.position.set(0, c.hipsRest, 0);
  }
  function standPose(c, t, speed) {
    const ph = c.walk || 0;
    const sw = Math.sin(ph) * Math.min(1, speed * 0.6) * 0.55;
    c.j.hipL.rotation.x = sw; c.j.hipR.rotation.x = -sw;
    c.j.kneeL.rotation.x = Math.max(0, -Math.sin(ph)) * speed * 0.2 * (speed > 0.1 ? 1 : 0);
    c.j.kneeR.rotation.x = Math.max(0, Math.sin(ph)) * speed * 0.2 * (speed > 0.1 ? 1 : 0);
    c.j.shL.rotation.x = -sw * 0.8; c.j.shR.rotation.x = sw * 0.8;
    c.j.shL.rotation.z = 0.1 + (c.armL || 0); c.j.shR.rotation.z = -0.1 - (c.armR || 0);
    c.j.elL.rotation.x = -0.15; c.j.elR.rotation.x = -0.15;
    c.torso.position.y = 0.1 + Math.sin(t * 1.7) * 0.01 * (1 - speed * 0.5);
    c.head.rotation.y = Math.sin(t * 0.5) * 0.14;
  }
  function seatPose(c, t) {
    c.hips.position.y = c.seatH;
    c.j.hipL.rotation.x = c.j.hipR.rotation.x = -Math.PI / 2;
    c.j.kneeL.rotation.x = c.j.kneeR.rotation.x = Math.PI / 2;
    c.torso.rotation.x = 0.06;
    c.torso.position.y = 0.1 + Math.sin(t * 1.5) * 0.012;               // breathing
    c.head.rotation.y = Math.sin(t * 0.4 + c.seed) * 0.18;
    c.j.shL.rotation.x = c.j.shR.rotation.x = -0.45;
    c.j.elL.rotation.x = c.j.elR.rotation.x = -0.9;
  }

  // ---------------- Ruen: the Intuitive Hacker. Slender, bob cut, a long coat, a floating data-orb ----------------
  function ruen() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.22, torsoH: 0.6, armR: 0.075, legR: 0.085, headS: 1.25 };
    const m = {
      skin: std(0xd9a88a, { roughness: 0.6 }), hair: std(0x1b1420, { roughness: 0.5 }), shirt: std(0x1d2a33),
      coat: std(0x2d3b4a), trim: lit(0x37e0ff, 0.9), pants: std(0x1a1f2a), shoes: std(0x101216), sleeve: std(0x2d3b4a),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.seatH = 0.62; c.kind = 'seated'; c.seed = 1.3;
    add(c.torso, new THREE.BoxGeometry(0.3, 0.52, 0.2), m.shirt, 0, 0.3, 0);
    add(c.torso, new THREE.CylinderGeometry(0.2, 0.27, 0.9, 6).scale(1, 1, 0.6), m.coat, 0, -0.32, 0);     // long coat
    add(c.torso, new THREE.BoxGeometry(0.02, 0.8, 0.02), m.trim, 0.0, -0.3, 0.18);                    // a line of light down the front
    add(c.head, new THREE.SphereGeometry(0.16, 9, 7), m.skin, 0, 0.14, 0).scale.set(0.92, 1.05, 0.95);
    add(c.head, new THREE.SphereGeometry(0.19, 9, 7), m.hair, 0, 0.19, -0.02).scale.set(1.05, 0.85, 1.1);   // bob cap
    add(c.head, new THREE.BoxGeometry(0.06, 0.26, 0.22), m.hair, -0.16, 0.04, 0);
    add(c.head, new THREE.BoxGeometry(0.06, 0.26, 0.22), m.hair, 0.16, 0.04, 0);
    add(c.head, new THREE.BoxGeometry(0.3, 0.28, 0.08), m.hair, 0, 0.02, -0.14);
    add(c.head, new THREE.BoxGeometry(0.28, 0.05, 0.1), m.hair, 0, 0.27, 0.13).rotation.x = -0.25;     // bangs
    for (const x of [-0.06, 0.06]) add(c.head, new THREE.BoxGeometry(0.035, 0.035, 0.02), std(0x111111), x, 0.14, 0.15);
    // The data-orb: a glowing sphere that circles her right hand
    const hand = joint(c.j.wrR, 0, -0.1, 0.12), orbit = joint(hand, 0, 0, 0);
    const orb = add(orbit, new THREE.IcosahedronGeometry(0.075, 1), lit(0x37e0ff, 1.6), 0.18, 0, 0);
    add(orbit, new THREE.TorusGeometry(0.16, 0.008, 4, 18), lit(0x37e0ff, 1.2), 0, 0, 0).rotation.x = Math.PI / 2;
    c.orb = orb; c.orbit = orbit;
    c.armR = 0.0;
    return c;
  }

  // ---------------- Kyle: the Steadfast Protector. Heavy, bulky, bearded, steel gauntlets with cyan light ----------------
  function kyle() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.44, torsoH: 0.62, armR: 0.14, legR: 0.16, headS: 1.3 };
    const m = {
      skin: std(0xc89570, { roughness: 0.7 }), hair: std(0x3a2a20), armor: std(0x6b6247, { roughness: 0.6, metalness: 0.2 }),
      plate: std(0x4a4436, { roughness: 0.5, metalness: 0.3 }), under: std(0x2a2e33), pants: std(0x2b2f38), shoes: std(0x14171c),
      sleeve: std(0x2a2e33), steel: std(0x5c6470, { roughness: 0.4, metalness: 0.5 }), cyan: lit(0x3ff0ff, 1.5),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.seatH = 0.72; c.kind = 'seated'; c.seed = 2.1;
    add(c.torso, new THREE.BoxGeometry(0.84, 0.68, 0.48), m.armor, 0, 0.33, 0);                          // chest
    add(c.torso, new THREE.BoxGeometry(0.56, 0.4, 0.06), m.plate, 0, 0.28, 0.27);                       // chest plate
    add(c.torso, new THREE.BoxGeometry(0.1, 0.3, 0.07), m.cyan, 0, 0.3, 0.3);                           // a light down the plate
    add(c.torso, new THREE.BoxGeometry(0.34, 0.24, 0.5), m.under, 0, -0.06, 0);                          // waist
    for (const x of [-0.47, 0.47]) add(c.torso, new THREE.BoxGeometry(0.36, 0.26, 0.5), m.plate, x, 0.6, 0); // pauldrons
    add(c.head, new THREE.SphereGeometry(0.17, 9, 7), m.skin, 0, 0.14, 0);
    add(c.head, new THREE.BoxGeometry(0.34, 0.1, 0.3), m.hair, 0, 0.28, -0.02);                        // short hair
    add(c.head, new THREE.BoxGeometry(0.26, 0.17, 0.14), m.hair, 0, 0.0, 0.07);                        // beard
    for (const x of [-0.06, 0.06]) add(c.head, new THREE.BoxGeometry(0.035, 0.03, 0.02), std(0x111111), x, 0.16, 0.16);
    for (const k of ['L', 'R']) {                                                                         // gauntlets on both forearms
      add(c.j['el' + k], new THREE.BoxGeometry(0.31, 0.36, 0.31), m.steel, 0, -0.2, 0);
      add(c.j['el' + k], new THREE.BoxGeometry(0.035, 0.26, 0.28), m.cyan, 0.1, -0.2, 0);
      add(c.j['el' + k], new THREE.BoxGeometry(0.035, 0.26, 0.28), m.cyan, -0.1, -0.2, 0);
    }
    c.armL = 0.05;
    return c;
  }

  // ---------------- Yuna: the Independent Ranger. Agile, ponytail, stealth tech-suit, dual plasma blasters ----------------
  function yuna() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.18, torsoH: 0.6, armR: 0.065, legR: 0.07, headS: 1.2 };
    const m = {
      skin: std(0xd9a88a, { roughness: 0.6 }), hair: std(0x2a1f2e), suit: std(0x1e2a33, { roughness: 0.6 }),
      accent: lit(0x3ff0ff, 1.1), pants: std(0x1e2a33), shoes: std(0x101216), sleeve: std(0x1e2a33),
      skinHand: std(0xd9a88a), gun: std(0x2e3440, { metalness: 0.4, roughness: 0.4 }), plasma: lit(0x3ff0ff, 2.2),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.seatH = 0.62; c.kind = 'seated'; c.seed = 4.0;
    add(c.torso, new THREE.BoxGeometry(0.3, 0.56, 0.2), m.suit, 0, 0.29, 0);
    add(c.torso, new THREE.BoxGeometry(0.31, 0.03, 0.21), m.accent, 0, 0.2, 0);                       // suit accent band
    add(c.torso, new THREE.BoxGeometry(0.28, 0.2, 0.18), m.suit, 0, -0.08, 0);
    add(c.head, new THREE.SphereGeometry(0.155, 9, 7), m.skin, 0, 0.14, 0).scale.set(0.92, 1.05, 0.95);
    add(c.head, new THREE.SphereGeometry(0.175, 9, 7), m.hair, 0, 0.2, -0.02).scale.set(1, 0.7, 1.05); // hair cap
    add(c.head, new THREE.BoxGeometry(0.3, 0.06, 0.1), m.hair, 0, 0.27, 0.11).rotation.x = -0.3;     // fringe
    const tail = joint(c.head, 0, 0.2, -0.13);                                                         // ponytail
    add(tail, new THREE.CylinderGeometry(0.045, 0.018, 0.42, 6), m.hair, 0, -0.21, 0);
    c.tail = tail;
    for (const x of [-0.06, 0.06]) add(c.head, new THREE.BoxGeometry(0.035, 0.03, 0.02), std(0x111111), x, 0.14, 0.15);
    // Blasters, one in each hand, held forward
    for (const k of ['L', 'R']) {
      const g = c.j['wr' + k];
      add(g, new THREE.BoxGeometry(0.08, 0.12, 0.26), m.gun, 0, -0.05, 0.12);
      add(g, new THREE.BoxGeometry(0.05, 0.02, 0.24), m.plasma, 0, 0.012, 0.12);
      add(g, new THREE.BoxGeometry(0.035, 0.035, 0.035), m.plasma, 0, -0.05, 0.27);
    }
    c.armR = 0; c.armL = 0;
    return c;
  }

  // ---------------- The player: a dark-coated drifter, standing, walks with WASD ----------------
  function player() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.24, torsoH: 0.62, armR: 0.08, legR: 0.09, headS: 1.25 };
    const m = {
      skin: std(0xc9a080, { roughness: 0.6 }), hair: std(0x2b2220), coat: std(0x262a33, { roughness: 0.7 }),
      trim: lit(0xff9a3a, 0.9), pants: std(0x1c1f27), shoes: std(0x0e1014), sleeve: std(0x262a33), scarf: std(0xd0643a),
      plate: std(0xb9c2cc, { roughness: 0.5, metalness: 0.3 }),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.kind = 'stand'; c.seed = 0.6;
    add(c.torso, new THREE.BoxGeometry(0.44, 0.6, 0.26), m.coat, 0, 0.3, 0);
    add(c.torso, new THREE.CylinderGeometry(0.26, 0.3, 0.7, 6).scale(1, 1, 0.7), m.coat, 0, -0.3, 0);
    add(c.torso, new THREE.BoxGeometry(0.46, 0.04, 0.27), m.trim, 0, 0.02, 0);
    add(c.torso, new THREE.BoxGeometry(0.16, 0.12, 0.05), m.scarf, 0, 0.6, 0.12);
    for (const x of [-0.26, 0.26]) add(c.torso, new THREE.BoxGeometry(0.16, 0.12, 0.28), m.plate, x, 0.56, 0);   // shoulder plates
    add(c.head, new THREE.SphereGeometry(0.17, 9, 7), m.skin, 0, 0.14, 0);
    add(c.head, new THREE.SphereGeometry(0.19, 9, 7), m.coat, 0, 0.2, -0.03).scale.set(1.05, 0.78, 1.12);   // hood
    add(c.head, new THREE.BoxGeometry(0.2, 0.08, 0.12), m.hair, 0, 0.1, 0.1);                                 // hair under it
    for (const x of [-0.06, 0.06]) add(c.head, new THREE.BoxGeometry(0.035, 0.03, 0.02), std(0x111111), x, 0.14, 0.16);
    return c;
  }

  // ---------------- A crew member on the street: pale, slender, with glowing seams (the image's standing figure) ----------------
  function stranger() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.19, torsoH: 0.6, armR: 0.06, legR: 0.065 };
    const m = {
      skin: std(0x9fd3c8, { roughness: 0.4, metalness: 0.2 }), hair: std(0x6aa39a), coat: std(0x7fbdb2, { roughness: 0.5, metalness: 0.2 }),
      seam: lit(0x3ff0ff, 1.3), pants: std(0x4f7d78), shoes: std(0x2b3b3a), sleeve: std(0x7fbdb2),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.kind = 'stand'; c.seed = 3.7;
    add(c.torso, new THREE.BoxGeometry(0.34, 0.58, 0.22), m.coat, 0, 0.3, 0);
    add(c.torso, new THREE.BoxGeometry(0.02, 0.5, 0.23), m.seam, -0.17, 0.28, 0);
    add(c.torso, new THREE.BoxGeometry(0.02, 0.5, 0.23), m.seam, 0.17, 0.28, 0);
    add(c.head, new THREE.BoxGeometry(0.2, 0.26, 0.2), m.skin, 0, 0.14, 0);
    add(c.head, new THREE.BoxGeometry(0.22, 0.05, 0.22), m.seam, 0, 0.24, 0);
    return c;
  }

  // ---------------- A husk: a hunched, tattered thing from the glitch zones. Cyan eyes, claws, a hood ----------------
  function husk() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.27, torsoH: 0.58, armR: 0.085, legR: 0.09, headS: 1.1 };
    const m = {
      skin: std(0x6d7480, { roughness: 0.8 }), rag: std(0x1d1822), rag2: std(0x2a2430), pants: std(0x15121a),
      shoes: std(0x0c0b10), sleeve: std(0x1d1822), eye: lit(0x3ff0ff, 2.6), seam: lit(0xff3fb4, 1.2), claw: std(0x9aa0aa, { metalness: 0.4 }),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.kind = 'stand'; c.seed = 5.5; c.lean = 0.28; c.stance = true;
    add(c.torso, new THREE.BoxGeometry(0.46, 0.56, 0.3), m.rag, 0, 0.28, 0);
    add(c.torso, new THREE.BoxGeometry(0.3, 0.3, 0.02), m.seam, 0, 0.3, 0.16);
    add(c.torso, new THREE.CylinderGeometry(0.26, 0.34, 0.5, 6), m.rag2, 0, -0.25, 0).scale.set(1, 1, 0.7);
    add(c.head, new THREE.BoxGeometry(0.22, 0.26, 0.22), m.skin, 0, 0.14, 0);
    add(c.head, new THREE.BoxGeometry(0.26, 0.12, 0.26), m.rag, 0, 0.3, 0);
    for (const x of [-0.05, 0.05]) add(c.head, new THREE.BoxGeometry(0.06, 0.03, 0.02), m.eye, x, 0.15, 0.12);
    for (const k of ['L', 'R']) add(c.j['wr' + k], new THREE.ConeGeometry(0.03, 0.12, 4), m.claw, 0, -0.1, 0.02).rotation.x = Math.PI;
    return c;
  }

  const kinds = { ruen, kyle, yuna, player, stranger, husk };

  // Builds one of the crew by name and returns its rig (the root is what the scene adds)
  function create(kind) {
    const c = kinds[kind](); c.name = kind;
    c.walk = 0; c.speed = 0;
    c.mocap = true; c.idleClip = 'idleEase';          // standing figures use the clips; idleClip is what they do when still
    return c;
  }

  // Plays a one-shot clip on a rig: it runs once and hands back to the idle. hold keeps its last frame (a death, say)
  function play(c, name, hold = false) { c.clip = { name, t: 0, hold }; }
  function clipLength(name) { return Mocap.clips[name] ? Mocap.clips[name].d : 0; }

  // Poses one character for time t. speed (m/s) drives the walk cycle of standing figures
  // Poses one character at time t. Standing figures use motion capture: a clip played on purpose (play) first, then the
  // idle or locomotion clip by speed. A rig without mocap falls back to the procedural pose. Seated figures are posed by hand.
  function update(c, t, dt, speed = 0) {
    c.speed = speed;
    if (c.kind === 'seated') { rest(c); seatPose(c, t); }
    else {
      rest(c);
      let played = false;
      if (c.clip) {
        const clip = Mocap.clips[c.clip.name];
        c.clip.t += dt;
        if (clip.loop || c.clip.hold || c.clip.t < clip.d) { Mocap.sample(c, c.clip.name, c.clip.t); played = true; }
        else c.clip = null;
      }
      if (!played && c.mocap) {
        const moving = speed > 0.15, run = speed > 3.2;
        if (moving) c.walkT = (c.walkT || 0) + dt * (run ? speed / 3.6 : speed / 1.6);
        Mocap.sample(c, !moving ? c.idleClip : run ? 'run' : 'walk', moving ? c.walkT : t);
        played = true;
      }
      if (!played) {
        c.walk += dt * (2 + speed * 2.4) * (speed > 0.05 ? 1 : 0);
        standPose(c, t, speed);
        if (c.stance) { c.j.shL.rotation.x = c.j.shR.rotation.x = -0.9; c.j.elL.rotation.x = c.j.elR.rotation.x = -0.8; }
        if (c.lean) c.torso.rotation.x = c.lean;
      }
    }
    if (c.name === 'ruen') { c.orbit.rotation.y = t * 1.6; c.orb.position.y = Math.sin(t * 2.2) * 0.03; }
    if (c.name === 'yuna' && c.tail) { c.tail.rotation.x = -0.35 + Math.sin(t * 3.2) * 0.12 - speed * 0.2; }
  }

  return { create, update, play, clipLength };
})();
