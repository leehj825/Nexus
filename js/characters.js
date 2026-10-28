// Nexus - the crew, built in code the way Deepward builds its heroes: a joint hierarchy of Groups dressed with primitive meshes,
// flat-shaded and posed procedurally (no model or animation files).
// Conventions: feet at y=0, facing +Z, the character's right hand is on -X. Joints rotate so that a negative x swings a limb forward.
// The look follows the reference shot (1792912047890.jpg): chunky low-poly bodies with boxy square limbs, tapered torsos, faces
// with eyes, brows and noses, layered clothing and armour, and cyan light lines on the tech.
const Chars = (() => {
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0.1, flatShading: true }, o));
  const lit = (c, k = 1.4) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: k, roughness: 0.4, flatShading: true });
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = false; parent.add(o); return o; };
  const joint = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // A tapered box: w0 x d0 across the top face, w1 x d1 across the bottom, h tall. The workhorse for torsos, skulls and plates
  const tb = (w0, w1, h, d0, d1) => {
    const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; p.setXYZ(i, p.getX(i) * (top ? w0 : w1), p.getY(i) * h, p.getZ(i) * (top ? d0 : d1)); }
    g.computeVertexNormals(); return g;
  };
  const tilt = (o, x = 0, y = 0, z = 0) => { o.rotation.set(x, y, z); return o; };
  const dark = std(0x0d0f14, { roughness: 0.5 }), white = std(0xe6ecef, { roughness: 0.4 });
  // A limb segment hanging down from its joint, returns the joint at its far end
  const seg = (parent, len, r0, r1, m) => { if (m) add(parent, new THREE.CylinderGeometry(r0, r1, len, 6), m, 0, -len / 2, 0); return joint(parent, 0, -len, 0); };

  // The skeleton. p: { thigh, shin, shoulderW, torsoH, armR, legR, hipW, headS }. Returns the rig with its named joints
  function skeleton(p) {
    const root = new THREE.Group();
    const hips = joint(root, 0, p.thigh + p.shin, 0);
    const torso = joint(hips, 0, 0.1, 0);
    const head = joint(torso, 0, p.torsoH, 0);
    const c = { root, hips, torso, head, j: {} };
    c.j.torso = torso; c.j.head = head; c.hipsRest = p.thigh + p.shin;   // the mocap clips write these joints
    head.scale.setScalar(p.headS || 1.1);                                   // the reference crew has big, readable heads
    for (const side of [-1, 1]) {
      const k = side > 0 ? 'L' : 'R';
      c.j['hip' + k] = joint(hips, side * (p.hipW || 0.12), 0, 0);
      c.j['knee' + k] = seg(c.j['hip' + k], p.thigh, p.legR, p.legR * 0.85, null);
      c.j['ank' + k] = seg(c.j['knee' + k], p.shin, p.legR * 0.85, p.legR * 0.7, null);
      c.j['sh' + k] = joint(torso, side * p.shoulderW, p.torsoH - 0.1, 0);
      c.j['el' + k] = seg(c.j['sh' + k], 0.34, p.armR, p.armR * 0.85, null);
      c.j['wr' + k] = seg(c.j['el' + k], 0.32, p.armR * 0.85, p.armR * 0.7, null);
    }
    return c;
  }

  // Limbs, boxy like the reference: square tapered thighs, shins, upper arms and forearms, block knees and elbows that fill the
  // bend, boots with a shaft, a toe-heavy foot and a sole, cuffs, and blocky hands with a thumb.
  // m.pants m.shoes m.sleeve m.skin are needed; m.sole, m.hand, m.cuff are optional. p.bootH sets the height of the boot shaft
  function limbs(c, p, m) {
    const sole = m.sole || dark, hand = m.hand || m.skin, cuff = m.cuff || m.sleeve, r = p.legR, a = p.armR, bh = p.bootH || 0.17;
    for (const k of ['L', 'R']) {
      add(c.j['hip' + k], tb(r * 2.3, r * 1.95, p.thigh, r * 2.3, r * 2.0), m.pants, 0, -p.thigh / 2, 0);
      add(c.j['knee' + k], tb(r * 1.95, r * 1.6, p.shin, r * 2.0, r * 1.7), m.pants, 0, -p.shin / 2, 0);
      add(c.j['knee' + k], box(r * 1.9, r * 1.6, r * 2.0), m.pants, 0, 0, 0);                                                 // the knee
      add(c.j['ank' + k], tb(r * 1.85, r * 1.9, bh, r * 1.95, r * 2.0), m.shoes, 0, bh / 2 - 0.04, 0);                         // boot shaft
      add(c.j['ank' + k], tb(0.14, 0.16, 0.09, 0.2, 0.28), m.shoes, 0, -0.045, 0.065);                                         // boot body, toe-heavy
      add(c.j['ank' + k], box(0.17, 0.035, 0.31), sole, 0, -0.09, 0.065);                                                      // sole
      add(c.j['sh' + k], box(a * 2.3, a * 2.1, a * 2.3), m.sleeve, 0, -0.01, 0);                                              // shoulder
      add(c.j['sh' + k], tb(a * 2.1, a * 1.8, 0.34, a * 2.1, a * 1.8), m.sleeve, 0, -0.17, 0);
      add(c.j['el' + k], tb(a * 1.8, a * 1.5, 0.32, a * 1.8, a * 1.5), m.sleeve, 0, -0.16, 0);
      add(c.j['el' + k], box(a * 1.75, a * 1.6, a * 1.75), m.sleeve, 0, 0, 0);                                                 // the elbow
      add(c.j['wr' + k], box(a * 1.65, 0.05, a * 1.65), cuff, 0, 0.015, 0);                                                    // cuff
      add(c.j['wr' + k], box(a * 1.7, 0.11, a * 1.45), hand, 0, -0.06, 0);                                                     // the hand
      add(c.j['wr' + k], box(a * 0.55, 0.07, a * 0.7), hand, (k === 'L' ? -1 : 1) * a * 0.95, -0.045, a * 0.35);               // thumb
    }
  }

  // A face on the head joint: a tapered skull with a nose, ears, a neck, eyes with whites and brows, and a mouth.
  // o: { w, d, brow (material), eye (iris colour), skin (material) }. The front of the face is at z = d / 2
  function face(head, m, o = {}) {
    const w = o.w || 0.28, d = o.d || 0.27, z = d / 2;
    add(head, box(0.11, 0.12, 0.11), m.skin, 0, 0.0, 0);                                                                  // neck
    add(head, tb(w, w * 0.8, 0.3, d, d * 0.9), m.skin, 0, 0.16, 0);                                                      // skull, narrowing to the jaw
    add(head, box(0.04, 0.055, 0.045), m.skin, 0, 0.125, z + 0.012);                                                     // nose
    for (const s of [-1, 1]) {
      add(head, box(0.03, 0.065, 0.045), m.skin, s * (w * 0.5 + 0.008), 0.155, 0);                                       // ears
      if (o.simple) { add(head, box(0.034, 0.03, 0.012), o.eye || dark, s * 0.06, 0.168, z + 0.003); continue; }            // plain dark eyes
      add(head, box(0.052, 0.03, 0.012), white, s * 0.065, 0.178, z + 0.002);                                            // eye white
      add(head, box(0.028, 0.03, 0.012), o.eye || dark, s * 0.065 + (o.look || 0) * 0.01, 0.178, z + 0.008);             // iris
      add(head, box(0.07, o.browH || 0.016, 0.016), o.brow || m.hair, s * 0.066, 0.215, z + 0.004).rotation.z = s * -0.12 * (o.angry || 1);   // brow
    }
    add(head, box(o.simple ? 0.05 : 0.07, 0.012, 0.012), std(0x8a4a48, { roughness: 0.6 }), 0, 0.07, z + 0.002);                           // mouth
  }

  // Detail pieces shared by the crew
  function belt(torso, m, w, d, y = 0.0) {
    add(torso, box(w, 0.06, d), m.belt || dark, 0, y, 0);
    add(torso, box(0.07, 0.05, 0.015), m.buckle || m.trim || white, 0, y, d / 2 + 0.003);
  }
  function pouch(parent, m, x, y, z, s = 1) { add(parent, box(0.07 * s, 0.09 * s, 0.05 * s), m, x, y, z); }
  // A rig's own seated pose: joint name -> [x, y, z] rotations laid over the default seat (thighs level, shins down)
  const pose = (c, o) => { c.seatPose = o; };
  const SEAT_POSE = {
    ruen: { shR: [-0.15, 0, -0.22], elR: [-0.2, 0, 0], wrR: [0, 0, 0.2], shL: [-0.3, 0, 0.42], elL: [-1.25, 0, 0], wrL: [0.2, 0, 0] },
    kyle: { torso: [0.32, 0, 0], head: [-0.3, 0, 0], shL: [-0.7, -0.45, -0.05], shR: [-0.7, 0.45, 0.05], elL: [-0.85, 0, 0], elR: [-0.85, 0, 0], wrL: [-0.2, 0, 0], wrR: [-0.2, 0, 0] },
    yuna: { torso: [0.08, 0, 0], shL: [-0.35, 0, 0.1], shR: [-0.35, 0, -0.05], elL: [-0.55, 0, 0], elR: [-0.55, 0, 0], wrL: [0.75, 0, 0], wrR: [0.75, 0, 0] },
  };

  // The data-orb: a glowing ball with specks of light round it, floating over her left palm (placed each frame in update)
  function addOrb(c) {
    const orbit = joint(c.root, 0, 0, 0), orb = joint(orbit, 0, 0, 0);
    add(orb, new THREE.IcosahedronGeometry(0.13, 1), new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x37d8ff, emissiveIntensity: 1.1, transparent: true, opacity: 0.8, flatShading: true }));
    add(orb, new THREE.IcosahedronGeometry(0.06, 0), lit(0xbff6ff, 2.0));
    const speck = lit(0x7fe9ff, 2.0);
    c.specks = [];
    for (let i = 0; i < 10; i++) {
      const sp = add(orb, box(0.02, 0.02, 0.02), speck);
      sp.userData = { a: i * 2.4, r: 0.15 + (i % 3) * 0.035, y: ((i * 37) % 10) / 10 - 0.5, v: 0.8 + (i % 4) * 0.35 };
      c.specks.push(sp);
    }
    if (typeof Tex !== 'undefined') {
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.glow(), color: 0x37d8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6, toneMapped: false }));
      g.scale.set(0.7, 0.7, 1); orb.add(g);
    }
    c.orb = orb; c.orbit = orbit;
  }
  // The energy blade in the right hand: a dark grip in the fist, a short guard, and a cyan blade with a white core
  // running on forward and down from the hand. m needs steelD, bladeEdge and bladeCore
  function addBlade(c, m) {
    const blade = joint(c.j.wrR, 0, -0.08, 0.01); blade.rotation.x = -0.6;
    add(blade, box(0.03, 0.12, 0.03), m.steelD, 0, -0.03, 0);                                                  // the grip
    add(blade, box(0.09, 0.02, 0.035), m.steelD, 0, -0.08, 0);                                                 // the guard
    add(blade, box(0.022, 0.6, 0.008), m.bladeEdge, 0, -0.38, 0);                                              // the blade
    add(blade, box(0.008, 0.58, 0.01), m.bladeCore, 0, -0.38, 0);                                              // its white core
  }

  // ---------------- Ruen: the Intuitive Hacker. Slender, a brown chin-length bob with a fringe, an open navy jacket over an
  // olive top, a tan belt, brown trousers and boots. One hand rests on the pipe, the other is held out palm up under the data-orb ----------------
  function ruen() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.19, torsoH: 0.58, armR: 0.062, legR: 0.078, hipW: 0.1, headS: 1.12, bootH: 0.14 };
    const m = {
      skin: std(0xe2ad8c, { roughness: 0.6 }), hair: std(0x40291e, { roughness: 0.55 }), jacket: std(0x1d2334), top: std(0x6c705c),
      pants: std(0x6e5642), shoes: std(0x3a2a20), sole: std(0x1e1612), sleeve: std(0x1d2334), cuff: std(0x283044),
      belt: std(0x8a6a48), buckle: std(0xc2a47a, { roughness: 0.4, metalness: 0.3 }),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.seatH = 0.62; c.kind = 'seated'; c.seed = 1.3;
    const T = c.torso;
    add(T, tb(0.26, 0.21, 0.5, 0.17, 0.15), m.top, 0, 0.3, 0);                                             // the olive top
    add(T, tb(0.2, 0.21, 0.1, 0.05, 0.07), m.top, 0, 0.4, 0.075);                                           // bust
    add(T, tb(0.31, 0.26, 0.5, 0.05, 0.05), m.jacket, 0, 0.3, -0.075);                                      // jacket back
    for (const s of [-1, 1]) {
      add(T, tb(0.09, 0.08, 0.5, 0.19, 0.17), m.jacket, s * 0.115, 0.3, 0.005);                              // jacket fronts, open over the top
      tilt(add(T, box(0.055, 0.24, 0.03), m.jacket, s * 0.085, 0.44, 0.1), 0, 0, s * 0.28);                  // lapels
      add(T, box(0.012, 0.42, 0.012), m.cuff, s * 0.07, 0.27, 0.104);                                        // the jacket's front edge
    }
    add(T, tb(0.21, 0.25, 0.07, 0.17, 0.2), m.jacket, 0, 0.585, -0.01);                                     // collar
    add(T, tb(0.24, 0.27, 0.2, 0.16, 0.18), m.pants, 0, -0.07, 0);                                          // hips
    belt(T, m, 0.265, 0.185, 0.03);
    const H = c.head;
    face(H, m, { w: 0.25, d: 0.25, eye: std(0x3a2418), angry: 0.5 });
    add(H, tb(0.24, 0.285, 0.09, 0.24, 0.285), m.hair, 0, 0.33, -0.01);                                     // crown
    add(H, box(0.285, 0.3, 0.06), m.hair, 0, 0.17, -0.12);                                                  // the back of the bob
    for (const s of [-1, 1]) add(H, tb(0.04, 0.05, 0.29, 0.25, 0.26), m.hair, s * 0.145, 0.17, 0.0);         // sides, down to the jaw
    add(H, box(0.27, 0.06, 0.04), m.hair, 0, 0.285, 0.12);                                                  // the fringe
    tilt(add(H, box(0.13, 0.07, 0.035), m.hair, 0.05, 0.255, 0.13), 0, 0, -0.45);                           // swept to one side
    addOrb(c);
    pose(c, SEAT_POSE.ruen);
    return c;
  }

  // ---------------- Kyle: the Steadfast Protector. Burly, a square head with short dark hair and a full beard, a riveted leather
  // vest over a tan shirt, bare upper arms with a cyan band, huge boxy steel gauntlets with screens on the backs of the hands ----------------
  function kyle() {
    const p = { thigh: 0.44, shin: 0.42, shoulderW: 0.3, torsoH: 0.62, armR: 0.1, legR: 0.12, hipW: 0.14, headS: 1.12 };
    const m = {
      skin: std(0xcf9670, { roughness: 0.7 }), hair: std(0x2e1f16), shirt: std(0x9a7a5e), vest: std(0x4b3b30, { roughness: 0.75 }),
      rivet: std(0xa89a88, { metalness: 0.5, roughness: 0.4 }), pants: std(0x4a3428), shoes: std(0x2a2420), sleeve: std(0xcf9670, { roughness: 0.7 }),
      steel: std(0x6a7078, { roughness: 0.45, metalness: 0.45 }), steelD: std(0x464b54, { roughness: 0.45, metalness: 0.45 }),
      cyan: lit(0x3ff0ff, 1.1), amber: lit(0xff8a30, 1.3), belt: std(0x241a14), cuff: std(0x464b54, { metalness: 0.45 }),
    };
    m.hand = m.steel;
    const c = skeleton(p); limbs(c, p, m);
    c.seatH = 0.72; c.kind = 'seated'; c.seed = 2.1;
    const T = c.torso;
    add(T, tb(0.6, 0.48, 0.6, 0.34, 0.3), m.shirt, 0, 0.31, 0);                                              // broad chest in the shirt
    add(T, tb(0.62, 0.5, 0.6, 0.36, 0.32), m.vest, 0, 0.31, 0);                                             // the leather vest over it
    add(T, box(0.012, 0.5, 0.012), dark, 0, 0.28, 0.172);                                                    // the vest's front seam
    for (const s of [-1, 1]) {
      add(T, box(0.13, 0.05, 0.36), m.vest, s * 0.19, 0.57, 0);                                              // straps over the shoulders
      add(T, box(0.17, 0.12, 0.25), m.shirt, s * 0.3, 0.53, 0);                                              // the shirt's short sleeves
      for (const y of [0.42, 0.3, 0.18]) add(T, box(0.025, 0.025, 0.012), m.rivet, s * 0.11, y, 0.173);       // rivets down the front
    }
    add(T, tb(0.26, 0.3, 0.07, 0.22, 0.25), m.vest, 0, 0.6, -0.01);                                          // thick collar
    add(T, tb(0.46, 0.5, 0.22, 0.3, 0.32), m.pants, 0, -0.06, 0);                                            // waist
    belt(T, m, 0.5, 0.33, 0.03);
    pouch(T, m.belt, -0.24, -0.04, 0.12, 1.3); pouch(T, m.belt, 0.24, -0.04, 0.12, 1.3);
    add(c.j.shL, box(0.215, 0.035, 0.215), m.cyan, 0, -0.22, 0);                                             // the light band round his left arm
    const H = c.head;
    face(H, m, { w: 0.29, d: 0.28, eye: std(0x2a1a10), angry: 1.8, browH: 0.024 });
    add(H, tb(0.3, 0.31, 0.07, 0.29, 0.3), m.hair, 0, 0.33, -0.01);                                          // short flat-topped hair
    add(H, box(0.31, 0.14, 0.05), m.hair, 0, 0.25, -0.13);
    for (const s of [-1, 1]) add(H, box(0.04, 0.2, 0.1), m.hair, s * 0.148, 0.16, 0.04);                      // sideburns running into the beard
    add(H, tb(0.27, 0.2, 0.13, 0.08, 0.08), m.hair, 0, 0.055, 0.135);                                        // the beard
    add(H, tb(0.29, 0.25, 0.1, 0.2, 0.24), m.hair, 0, 0.04, 0.03);
    add(H, box(0.14, 0.035, 0.04), m.hair, 0, 0.098, 0.158);                                                 // moustache
    for (const k of ['L', 'R']) {                                                                              // the gauntlets, elbow to fingertips
      const s = k === 'L' ? 1 : -1, E = c.j['el' + k], W = c.j['wr' + k];
      add(E, tb(0.25, 0.23, 0.3, 0.26, 0.24), m.steel, 0, -0.17, 0);
      add(E, box(0.27, 0.06, 0.28), m.steelD, 0, -0.03, 0);                                                    // the gauntlet's cuff
      add(E, box(0.27, 0.03, 0.28), k === 'L' ? m.cyan : m.amber, 0, -0.075, 0);                               // a light band below it
      add(E, box(0.012, 0.06, 0.16), m.cyan, s * 0.122, -0.2, 0);                                              // a readout on the outside
      add(W, box(0.25, 0.15, 0.25), m.steel, 0, -0.08, 0);                                                     // the fist
      add(W, box(0.012, 0.1, 0.13), m.cyan, s * 0.128, -0.08, 0);                                              // the screen on the back of the hand
      for (let i = 0; i < 4; i++) add(W, box(0.055, 0.075, 0.07), m.steelD, 0, -0.19, -0.09 + i * 0.06);       // fingers
      add(W, box(0.06, 0.1, 0.07), m.steelD, -s * 0.12, -0.12, 0.09);                                          // thumb
    }
    pose(c, SEAT_POSE.kyle);
    return c;
  }

  // ---------------- Yuna: the Independent Ranger. A small plain face, dark hair pulled back with a high arched ponytail and a tie,
  // an earpiece, a fitted dark suit with light stripes down the thighs, a big armoured left shoulder with a back unit lit by
  // vertical cyan bars, banded bracers, tall tan boots, and two long cyan-lit blasters ----------------
  function yuna() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.18, torsoH: 0.58, armR: 0.06, legR: 0.072, hipW: 0.1, headS: 1.08, bootH: 0.3 };
    const m = {
      skin: std(0xe6b696, { roughness: 0.6 }), hair: std(0x2e2220, { roughness: 0.55 }), suit: std(0x3c3537, { roughness: 0.7 }),
      suitB: std(0x2c2729, { roughness: 0.7 }), stripe: std(0x6e6260), accent: lit(0x3ff0ff, 1.1), tie: std(0xc0606a),
      pants: std(0x332e31), shoes: std(0x6a4c3a), sole: std(0x1a1416), sleeve: std(0x332e31),
      armor: std(0x8a95a2, { roughness: 0.5, metalness: 0.2 }), armorB: std(0x5d6672, { roughness: 0.5, metalness: 0.25 }),
      hand: std(0x2b2629), cuff: std(0x5d6672, { metalness: 0.25 }), belt: std(0x1a1416),
      gun: std(0x8a929c, { metalness: 0.35, roughness: 0.45 }), gunD: std(0x2e323a, { metalness: 0.4, roughness: 0.4 }), plasma: lit(0x3ff0ff, 1.8),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.seatH = 0.62; c.kind = 'seated'; c.seed = 4.0;
    const T = c.torso;
    add(T, tb(0.28, 0.21, 0.3, 0.18, 0.15), m.suit, 0, 0.42, 0);                                            // chest, narrowing to the waist
    add(T, tb(0.2, 0.23, 0.27, 0.15, 0.17), m.suit, 0, 0.14, 0);
    add(T, tb(0.2, 0.21, 0.1, 0.05, 0.07), m.suit, 0, 0.42, 0.075);                                         // bust
    add(T, tb(0.07, 0.03, 0.12, 0.02, 0.02), m.skin, 0, 0.52, 0.09);                                        // the neckline
    add(T, tb(0.03, 0.1, 0.26, 0.02, 0.02), m.suitB, 0, 0.2, 0.085);                                        // darker panel down the front
    add(T, tb(0.23, 0.26, 0.2, 0.17, 0.19), m.suit, 0, -0.07, 0);
    belt(T, m, 0.25, 0.18, 0.02);
    add(T, tb(0.15, 0.18, 0.07, 0.15, 0.17), m.suit, 0, 0.6, 0);
    // The armoured left shoulder: a tall pauldron over a back unit with vertical light bars, and a plated upper arm
    tilt(add(T, tb(0.17, 0.23, 0.18, 0.24, 0.26), m.armor, 0.2, 0.53, 0), 0, 0, -0.2);
    add(T, box(0.17, 0.3, 0.12), m.armorB, 0.12, 0.36, -0.14);                                               // the back unit
    for (const dx of [0.07, 0.14]) add(T, box(0.02, 0.22, 0.012), m.accent, dx, 0.36, -0.204);
    for (const dz of [-0.1, -0.16]) add(T, box(0.012, 0.22, 0.02), m.accent, 0.207, 0.36, dz);
    add(c.j.shL, tb(0.16, 0.14, 0.24, 0.16, 0.14), m.armorB, 0.0, -0.17, 0);
    for (const k of ['L', 'R']) {
      for (const y of [-0.1, -0.22]) add(c.j['el' + k], box(0.135, 0.1, 0.135), m.armor, 0, y, 0);           // banded bracers
      add(c.j['el' + k], box(0.012, 0.18, 0.04), m.accent, (k === 'L' ? 1 : -1) * 0.068, -0.16, 0);
      add(c.j['hip' + k], box(0.05, p.thigh * 0.9, 0.012), m.stripe, 0, -p.thigh / 2, p.legR * 1.06);         // light stripes down the thighs
      add(c.j['knee' + k], box(0.15, 0.08, 0.06), m.armorB, 0, -0.01, 0.07);                                 // knee pads
    }
    const H = c.head;
    face(H, m, { w: 0.24, d: 0.24, eye: std(0x2a1a14), simple: true });
    add(H, tb(0.22, 0.27, 0.1, 0.22, 0.27), m.hair, 0, 0.33, -0.015);                                       // hair pulled back smooth over the crown
    add(H, box(0.265, 0.27, 0.06), m.hair, 0, 0.19, -0.115);                                                // and down the back
    add(H, box(0.26, 0.045, 0.04), m.hair, 0, 0.29, 0.115);                                                 // hairline
    tilt(add(H, box(0.14, 0.07, 0.035), m.hair, -0.05, 0.28, 0.125), 0, 0, 0.35);                         // the fringe, swept across to one side
    for (const s of [-1, 1]) add(H, box(0.03, 0.16, 0.18), m.hair, s * 0.135, 0.22, -0.035);                // hair framing the ears
    add(H, box(0.035, 0.09, 0.09), m.armorB, 0.135, 0.15, 0.0);                                              // the earpiece
    add(H, box(0.01, 0.03, 0.05), m.accent, 0.154, 0.15, 0.0);
    // The ponytail: tied high at the back of the crown, it rises and arches back, then hangs down behind her
    const tail = joint(H, 0, 0.31, -0.12);
    add(tail, box(0.08, 0.05, 0.07), m.tie, 0, 0, 0);
    const rise = joint(tail, 0, 0, 0); rise.rotation.x = -0.6;
    add(rise, tb(0.09, 0.08, 0.17, 0.09, 0.08), m.hair, 0, 0.08, 0);
    const fall = joint(rise, 0, 0.16, 0); fall.rotation.x = -2.25;
    add(fall, tb(0.1, 0.05, 0.4, 0.09, 0.05), m.hair, 0, 0.19, 0);
    c.tail = tail; tail.userData.fall = fall;
    // Long blasters held by the hand around a pistol grip: the fist wraps the grip under the body, the barrel runs forward and
    // the body sits on top of the hand with a trigger guard in front of the fingers. m.hand is the glove
    for (const k of ['L', 'R']) {
      const g = c.j['wr' + k], gun = joint(g, 0, 0, 0.0); gun.rotation.x = 0.12;
      add(gun, box(0.062, 0.14, 0.07), m.gunD, 0, -0.065, 0.0);                                               // the grip inside the fist
      add(gun, box(0.12, 0.05, 0.035), m.hand, 0, -0.06, 0.05);                                               // fingers wrapped round the front
      add(gun, box(0.09, 0.12, 0.46), m.gun, 0, 0.065, 0.11);                                                 // body on top of the hand
      add(gun, box(0.075, 0.04, 0.48), m.gunD, 0, 0.14, 0.1);                                                 // top slide
      add(gun, box(0.05, 0.015, 0.09), m.gunD, 0, 0.0, 0.1);                                                  // trigger guard
      for (const s of [-1, 1]) {
        for (const y of [0.04, 0.09]) add(gun, box(0.012, 0.018, 0.32), m.plasma, s * 0.05, y, 0.13);         // two light strips down each side
        add(gun, box(0.012, 0.07, 0.025), m.plasma, s * 0.05, 0.065, -0.06);
      }
      add(gun, box(0.06, 0.06, 0.1), m.gunD, 0, 0.08, 0.38);                                                   // muzzle
      add(gun, box(0.065, 0.065, 0.025), m.plasma, 0, 0.08, 0.435);
      add(gun, box(0.08, 0.1, 0.07), m.gunD, 0, 0.07, -0.15);                                                 // rear block
    }
    pose(c, SEAT_POSE.yuna);
    return c;
  }

  // ---------------- The player, seen from behind in the reference: short brown hair with a visor, a stepped grey hood folded
  // over the back and shoulders with a cyan light at its top, round grey pauldrons, a dark navy shirt and trousers, banded
  // light bracers, dark gloves and brown boots ----------------
  function player() {
    const p = { thigh: 0.43, shin: 0.43, shoulderW: 0.23, torsoH: 0.6, armR: 0.072, legR: 0.085, hipW: 0.11, headS: 1.12, bootH: 0.16 };
    const m = {
      skin: std(0xc9a080, { roughness: 0.6 }), hair: std(0x3a2a20, { roughness: 0.7 }), shirt: std(0x141926),
      hood: std(0x8494aa, { roughness: 0.55, metalness: 0.15 }), hoodD: std(0x66748a, { roughness: 0.55, metalness: 0.15 }),
      trim: lit(0x3ff0ff, 1.2), pants: std(0x1d2333), shoes: std(0x5a3c28, { roughness: 0.8 }), sole: std(0x2a1c14), sleeve: std(0x2a3446),
      bracer: std(0xaeb8c6, { roughness: 0.45, metalness: 0.2 }), hand: std(0x3a2a22), cuff: std(0xaeb8c6, { metalness: 0.2 }),
      visor: std(0xb6c0cc, { roughness: 0.4, metalness: 0.3 }), lens: lit(0x6fdcff, 0.9), belt: std(0x3a2618),
      bladeEdge: lit(0x3ff0ff, 1.6), bladeCore: lit(0xe6feff, 2.4), steelD: std(0x464b54, { roughness: 0.45, metalness: 0.45 }),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.kind = 'stand'; c.seed = 0.6;
    const T = c.torso;
    add(T, tb(0.38, 0.32, 0.5, 0.24, 0.21), m.shirt, 0, 0.27, 0);                                            // dark shirt, tapering to the waist
    add(T, tb(0.33, 0.36, 0.16, 0.22, 0.24), m.pants, 0, -0.05, 0);
    belt(T, m, 0.37, 0.25, 0.02);
    pouch(T, m.belt, -0.16, -0.03, 0.13); pouch(T, m.belt, 0.16, -0.03, 0.13);
    // The hood: folded over the shoulders, wide across the top of the back and stepping in to a point between the shoulder blades
    add(T, tb(0.36, 0.42, 0.1, 0.27, 0.3), m.hood, 0, 0.55, -0.01);                                          // round the neck and shoulders
    add(T, tb(0.44, 0.3, 0.14, 0.05, 0.05), m.hood, 0, 0.44, -0.135);
    add(T, tb(0.28, 0.16, 0.1, 0.05, 0.05), m.hood, 0, 0.32, -0.135);
    add(T, tb(0.14, 0.04, 0.08, 0.05, 0.05), m.hood, 0, 0.23, -0.135);
    add(T, tb(0.06, 0.14, 0.025, 0.04, 0.04), m.trim, 0, 0.535, -0.158);                                     // the light at the top
    add(T, tb(0.3, 0.26, 0.08, 0.04, 0.04), m.hoodD, 0, 0.5, 0.118);                                         // the hood's front edge
    for (const s of [-1, 1]) tilt(add(T, tb(0.13, 0.2, 0.12, 0.2, 0.23), m.hood, s * 0.25, 0.53, 0), 0, 0, -s * 0.25);   // pauldrons
    for (const k of ['L', 'R']) for (const y of [-0.09, -0.21]) add(c.j['el' + k], box(0.13, 0.1, 0.13), m.bracer, 0, y, 0);   // banded bracers
    const H = c.head;
    face(H, m, { w: 0.25, d: 0.25, eye: std(0x2a1a10), angry: 1.2 });
    add(H, tb(0.26, 0.275, 0.08, 0.26, 0.275), m.hair, 0, 0.33, -0.01);                                      // short hair
    add(H, box(0.275, 0.24, 0.05), m.hair, 0, 0.2, -0.12);
    for (const s of [-1, 1]) add(H, box(0.03, 0.12, 0.2), m.hair, s * 0.135, 0.24, -0.02);
    add(H, box(0.27, 0.04, 0.04), m.hair, 0, 0.29, 0.12);                                                    // hairline
    for (const s of [-1, 1]) add(H, box(0.03, 0.045, 0.16), m.visor, s * 0.14, 0.18, 0.04);                   // the visor's arms
    add(H, box(0.27, 0.045, 0.02), m.lens, 0, 0.18, 0.132);                                                  // and its lens
    addBlade(c, m);
    return c;
  }

  // ---------------- A crew member on the street: lean, in a tan beanie with a cyan visor band, a teal jacket with a light zip
  // stripe and a pink backpack strap, teal trousers, pale gloves ----------------
  function stranger() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.2, torsoH: 0.6, armR: 0.06, legR: 0.075, hipW: 0.1, headS: 1.12 };
    const m = {
      skin: std(0xd8b498, { roughness: 0.6 }), hair: std(0x3a2a22), coat: std(0x3e6068, { roughness: 0.6 }), coatB: std(0x2f4a52),
      zip: std(0xb8a888), strap: std(0xc0709a), pants: std(0x36494e), shoes: std(0x1e2224), sleeve: std(0x3e6068), cuff: std(0x2f4a52),
      hand: std(0xd8d4cc), cap: std(0xb09a7c, { roughness: 0.8 }), band: std(0x5a4c72), visor: lit(0x4ff0ff, 1.1), belt: std(0x1e2224),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.kind = 'stand'; c.seed = 3.7;
    const T = c.torso;
    add(T, tb(0.34, 0.29, 0.56, 0.21, 0.19), m.coat, 0, 0.29, 0);
    add(T, box(0.035, 0.54, 0.012), m.zip, 0, 0.29, 0.103);                                                  // the zip stripe
    add(T, tb(0.29, 0.31, 0.18, 0.2, 0.21), m.coatB, 0, -0.06, 0);                                           // jacket hem
    belt(T, m, 0.3, 0.215, 0.03);
    add(T, tb(0.18, 0.22, 0.08, 0.17, 0.2), m.coatB, 0, 0.6, 0);                                             // collar
    add(T, box(0.06, 0.04, 0.24), m.strap, 0.1, 0.57, -0.01);                                                // backpack strap over the shoulder
    add(T, box(0.06, 0.4, 0.015), m.strap, 0.1, 0.38, 0.105);
    add(T, box(0.24, 0.32, 0.1), m.coatB, 0, 0.34, -0.15);                                                    // the pack
    const H = c.head;
    face(H, m, { w: 0.25, d: 0.25, eye: dark, simple: true });
    add(H, tb(0.26, 0.27, 0.12, 0.26, 0.27), m.cap, 0, 0.33, -0.005);                                        // the beanie
    add(H, box(0.27, 0.035, 0.27), m.band, 0, 0.255, 0.0);                                                  // its band
    add(H, box(0.265, 0.05, 0.03), m.visor, 0, 0.19, 0.125);                                                 // the visor over the eyes
    for (const s of [-1, 1]) add(H, box(0.025, 0.05, 0.2), m.visor, s * 0.13, 0.19, 0.03);
    add(H, box(0.26, 0.1, 0.04), m.hair, 0, 0.2, -0.115);
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
    const T = c.torso;
    add(T, tb(0.5, 0.4, 0.58, 0.32, 0.28), m.rag, 0, 0.28, 0);
    add(T, box(0.3, 0.3, 0.02), m.seam, 0, 0.3, 0.16);
    add(T, new THREE.CylinderGeometry(0.26, 0.34, 0.5, 6), m.rag2, 0, -0.25, 0).scale.set(1, 1, 0.7);
    for (const s of [-1, 1]) tilt(add(T, new THREE.ConeGeometry(0.05, 0.22, 4), m.claw, s * 0.12, 0.62, -0.18), -0.5, 0, 0);   // spines on the back
    add(T, new THREE.ConeGeometry(0.06, 0.26, 4), m.claw, 0, 0.66, -0.18).rotation.x = -0.5;
    const H = c.head;
    add(H, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 6), m.skin, 0, 0.0, 0);
    add(H, tb(0.24, 0.18, 0.28, 0.23, 0.2), m.skin, 0, 0.15, 0);
    add(H, tb(0.28, 0.3, 0.16, 0.28, 0.3), m.rag, 0, 0.3, -0.01);                                            // hood
    add(H, tb(0.3, 0.3, 0.26, 0.06, 0.06), m.rag, 0, 0.17, -0.14);
    for (const x of [-0.05, 0.05]) add(H, box(0.06, 0.03, 0.02), m.eye, x, 0.16, 0.115);
    add(H, box(0.1, 0.02, 0.02), dark, 0, 0.07, 0.115);
    for (const k of ['L', 'R']) add(c.j['wr' + k], new THREE.ConeGeometry(0.03, 0.12, 4), m.claw, 0, -0.1, 0.02).rotation.x = Math.PI;
    return c;
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
    c.j.shL.rotation.x = c.j.shR.rotation.x = -0.45;
    c.j.elL.rotation.x = c.j.elR.rotation.x = -0.9;
    for (const k in c.seatPose || {}) {                                       // each rig sits its own way (Kyle leans on his knees, Ruen holds out the orb)
      const j = c.j[k], r = c.seatPose[k];
      j.rotation.set(r[0], r[1], r[2]);
    }
    c.head.rotation.y += Math.sin(t * 0.4 + c.seed) * 0.18;
  }


  // ---------------- The custom models: the rig comes from Models, the extras (seat, data-orb, blade, blasters) are added here ----------------
  const MODEL_SETUP = {
    ruen: { kind: 'seated', seatH: 0.62, seed: 1.3, seat: SEAT_POSE.ruen, extra: c => addOrb(c) },
    kyle: { kind: 'seated', seatH: 0.72, seed: 2.1, seat: SEAT_POSE.kyle, extra: () => {} },
    yuna: { kind: 'seated', seatH: 0.62, seed: 4.0, extra: c => blasters(c),
      seat: { torso: [0.08, 0, 0], shL: [-0.5, 0, 0.1], shR: [-0.5, 0, -0.05], elL: [-0.6, 0, 0], elR: [-0.6, 0, 0] } },
    husk: { kind: 'stand', seed: 5.5, extra: () => {} },
    brute: { kind: 'stand', seed: 7.2, extra: () => {} },
    player: { kind: 'stand', seed: 0.6, extra: c => addBlade(c, { steelD: std(0x464b54, { roughness: 0.45, metalness: 0.45 }), bladeEdge: lit(0x3ff0ff, 1.6), bladeCore: lit(0xe6feff, 2.4) }) },
  };
  // Yuna's blasters: short pistols held in each hand with the barrel running along the forearm (the grip sits in the fist,
  // the body on top of the hand), after the reference
  function blasters(c) {
    const m = {
      gun: std(0x77808c, { metalness: 0.35, roughness: 0.45 }), gunD: std(0x23282f, { metalness: 0.4, roughness: 0.4 }),
      gunTop: std(0xb4aaa6, { metalness: 0.3, roughness: 0.45 }), plasma: lit(0x3ff0ff, 1.7), glove: std(0x2b2629),
    };
    for (const k of ['L', 'R']) {
      const gun = joint(c.j['wr' + k], 0, -0.11, 0.045); gun.rotation.x = Math.PI / 2 - 0.1;
      add(gun, box(0.06, 0.09, 0.07), m.gunD, 0, -0.045, -0.055);                                             // grip, in the fist
      add(gun, box(0.1, 0.1, 0.085), m.glove, 0, -0.055, -0.055);                                             // a glove round the grip (the model's own hand is torn)
      add(gun, box(0.085, 0.11, 0.34), m.gunD, 0, 0.055, 0.12);                                               // dark body
      add(gun, box(0.07, 0.02, 0.34), m.gunTop, 0, 0.12, 0.12);                                               // pale top plate
      add(gun, box(0.05, 0.05, 0.1), m.gunD, 0, 0.07, 0.34);                                                  // short barrel
      add(gun, box(0.055, 0.04, 0.012), m.plasma, 0, 0.07, 0.395);                                            // muzzle glow
      add(gun, box(0.05, 0.02, 0.1), m.gunD, 0, 0.0, 0.07);                                                   // trigger guard
      for (const s of [-1, 1]) {
        tilt(add(gun, box(0.012, 0.018, 0.22), m.plasma, s * 0.046, 0.085, 0.14), 0.12, 0, 0);
        tilt(add(gun, box(0.012, 0.018, 0.16), m.plasma, s * 0.046, 0.045, 0.1), 0.12, 0, 0);
      }
    }
  }
  function modelRig(kind) {
    const c = Models.rig(kind), s = MODEL_SETUP[kind];
    c.kind = s.kind; c.seed = s.seed; if (s.seatH) c.seatH = s.seatH; if (s.seat) c.seatPose = s.seat;
    s.extra(c);
    return c;
  }
  // The custom models were made in an A-pose (arms swung out, bent a little at the elbow), but every pose and clip assumes arms
  // hanging straight down. armFix holds, per side, how far the upper arm, the forearm and the hand lean out of straight down.
  // Each bone is turned back by its own lean, and its parent's lean is put back in front: q_sh = q * Rz(-upper),
  // q_el = Rz(upper) * q * Rz(-fore), q_wr = Rz(fore) * q * Rz(-hand)
  const zq = new THREE.Quaternion(), zn = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  function undoAPose(c) {
    for (const k of ['L', 'R']) {
      const [up, fore, hand] = c.armFix[k];
      c.j['sh' + k].quaternion.multiply(zn.setFromAxisAngle(Z, -up));
      c.j['el' + k].quaternion.premultiply(zq.setFromAxisAngle(Z, up)).multiply(zn.setFromAxisAngle(Z, -fore));
      c.j['wr' + k].quaternion.premultiply(zq.setFromAxisAngle(Z, fore)).multiply(zn.setFromAxisAngle(Z, -hand));
    }
  }

  // ---------------- Talking: gestures laid on top of whatever pose the figure is in (seated, idle clip), used by cutscenes ----------------
  // setTalk(c, mood, speaking): mood is one of talk / worry / firm / think / alert / nod / wipe (or null to stop); speaking is true while the
  // words are coming out (full movement) and false once the line is done (the figure settles). setLook(c, worldPoint) turns the head to a point.
  const gq = new THREE.Quaternion(), ge = new THREE.Euler(), gv = new THREE.Vector3();
  const addRot = (j, x, y = 0, z = 0) => { if (j) j.quaternion.multiply(gq.setFromEuler(ge.set(x, y, z))); };
  function setTalk(c, mood, speaking = true) { c.talkMood = mood; c.talkSpeaking = speaking; }
  const tmpAim = new THREE.Vector3();
  function setOrbAim(c, on) { c.orbAimOn = !!on; }
  function setLook(c, pt) { c.lookPt = pt || null; }
  function gesture(c, t, dt) {
    const want = c.talkMood ? (c.talkSpeaking ? 1 : 0.35) : 0;
    c.talkAmp = (c.talkAmp || 0) + (want - (c.talkAmp || 0)) * Math.min(1, dt * 6);
    c.lookAmp = (c.lookAmp || 0) + ((c.lookPt ? 1 : 0) - (c.lookAmp || 0)) * Math.min(1, dt * 4);
    const a = c.talkAmp, ph = t + (c.seed || 0);
    if (c.lookAmp > 0.01 && c.lookPt) {                                           // listeners turn their head toward the speaker
      c.root.updateMatrixWorld(true); gv.copy(c.lookPt); c.head.parent.worldToLocal(gv);
      const yaw = Math.max(-0.9, Math.min(0.9, Math.atan2(gv.x, gv.z))), pit = Math.max(-0.25, Math.min(0.25, -Math.atan2(gv.y - c.head.position.y - 0.15, Math.hypot(gv.x, gv.z)) * 0.5));
      addRot(c.head, pit * c.lookAmp, yaw * c.lookAmp);
    }
    if (a < 0.01) { if (c.orb && c.name === 'ruen') c.orb.scale.setScalar(1); return; }
    const beat = Math.max(0, Math.sin(ph * 5.2)) * (0.6 + 0.4 * Math.sin(ph * 1.3)), slow = Math.sin(ph * 1.6), m = c.talkMood;
    const sp = c.talkSpeaking ? 1 : 0.3, R = c.j.shR, E = c.j.elR, L = c.j.shL, EL = c.j.elL;
    if (m === 'talk') {                                                       // an even conversation: head bobs on the words, a hand comes up
      addRot(c.head, a * (-0.04 + 0.07 * beat * sp), a * 0.1 * slow); addRot(c.torso, a * 0.02 * slow);
      addRot(R, a * -0.35 * (0.4 + beat) * sp); addRot(E, a * -0.5 * (0.3 + beat) * sp);
    } else if (m === 'worry') {                                               // head down, shoulders in, slow breaths
      addRot(c.head, a * (0.22 + 0.03 * slow), a * 0.12 * slow); addRot(c.torso, a * (0.1 + 0.02 * slow));
      addRot(R, a * -0.12, 0, a * 0.1); addRot(L, a * -0.12, 0, a * -0.1);
    } else if (m === 'firm') {                                                // chest up, chin up, a decisive chop with the hand on each beat
      addRot(c.head, a * (-0.1 + 0.05 * beat * sp)); addRot(c.torso, a * -0.07);
      addRot(R, a * (-0.45 - 0.5 * beat) * sp, 0, a * 0.1); addRot(E, a * (-0.7 - 0.5 * beat) * sp);
    } else if (m === 'think') {                                               // head tilted, a hand toward the chin
      addRot(c.head, a * 0.12, a * 0.15 * slow, a * 0.2); addRot(c.torso, a * 0.04);
      addRot(L, a * -0.55, 0, a * 0.05); addRot(EL, a * -1.0);
    } else if (m === 'alert') {                                               // snaps up: chin up, a little back, a hand out
      addRot(c.head, a * (-0.17 - 0.03 * beat), a * 0.05 * Math.sin(ph * 3)); addRot(c.torso, a * -0.1);
      addRot(R, a * -0.55 * sp, 0, a * 0.15); addRot(E, a * -0.4 * sp);
    } else if (m === 'nod') {                                                 // a calm, agreeing nod
      addRot(c.head, a * 0.16 * Math.max(0, Math.sin(ph * 3.2)) * sp); addRot(c.torso, a * 0.03);
    } else if (m === 'wipe') {                                                // rubbing a blade clean: the forearm sweeps to and fro, eyes down
      addRot(c.head, a * 0.16); addRot(R, a * -0.55); addRot(E, a * (-0.65 + 0.28 * Math.sin(ph * 6)));
    }
    if (c.orb && c.name === 'ruen') c.orb.scale.setScalar(1 + a * sp * 0.18 * (0.5 + 0.5 * Math.sin(ph * 7)));   // the orb pulses with her voice
  }

  const orbAt = new THREE.Vector3();
  const kinds = { ruen, kyle, yuna, player, stranger, husk };
  // The clips a figure walks, runs and idles with, and the idle it holds in battle. Nobody holds a weapon, so everyone
  // walks and runs with the plain unarmed locomotion. The crew drop into the magic stance when a fight starts (their
  // strikes are brawling punches and hooks, their skills are casts); the husks keep a loose unarmed idle.
  const UNARMED = { idle: 'idleEase', walk: 'walkCalm', run: 'runCalm', battle: 'mgIdle' };
  const LOCO = { husk: { idle: 'idleEase', walk: 'walkCalm', run: 'runCalm', battle: 'idleUnarmed' }, brute: { idle: 'idleEase', walk: 'walkCalm', run: 'walkCalm', battle: 'idleUnarmed' }, loader: { idle: 'idleEase', walk: 'walkCalm', run: 'walkCalm', battle: 'idleUnarmed' } };

  // Builds one of the crew by name and returns its rig (the root is what the scene adds)
  function create(kind) {
    // The Loader Mech has no model of its own yet: it borrows the Brute's, scaled up and painted in hazard yellow
    const stand = kind === 'loader' && !Models.has('loader');
    const c = Models.has(kind) ? modelRig(kind) : stand ? modelRig('brute') : kinds[kind](); c.name = kind;
    if (stand) {
      c.root.scale.setScalar(1.55);
      c.root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setHex(0xffd060); o.material.emissiveIntensity = 1.0; } });
    }
    c.walk = 0; c.speed = 0;
    c.mocap = true; c.loco = LOCO[kind] || UNARMED; c.idleClip = c.loco.idle;   // standing figures use the clips; idleClip is what they do when still
    return c;
  }

  // Plays a one-shot clip on a rig: it runs once and hands back to the idle. hold keeps its last frame (a death, say)
  function play(c, name, hold = false, rate = 1) { c.clip = { name, t: 0, hold, rate }; }               // rate: playback speed (1.7 = 70% faster)
  function clipLength(name) { return Mocap.clips[name] ? Mocap.clips[name].d : 0; }


  // ---------------- Creature motion: a layer over the clips for the husks. They are not people: they hunch, hang their arms, shamble with a
  // roll in the hips and twitch their heads. The clips (mostly walking and brawling) supply the legs and the strikes; this bends them out of human shape.
  const CREATURE = {
    husk: { hunch: 0.2, head: 0.12, armsOut: 0.05, armFwd: 0.22, roll: 0.1, lurch: 0.035, twitch: 1, breath: 0.03 },
    loader: { hunch: 0.08, head: 0.05, armsOut: 0.25, armFwd: 0.05, roll: 0.03, lurch: 0.02, twitch: 0, breath: 0.015 },
    brute: { hunch: 0.14, head: 0.12, armsOut: 0.2, armFwd: 0.1, roll: 0.07, lurch: 0.05, twitch: 0.3, breath: 0.045 },
  };
  function creature(c, t, dt, speed) {
    const k = CREATURE[c.name], ph = (c.walkT || 0) * Math.PI * 2 / 1.03, mv = Math.min(1, speed / 1.5);
    const u = c.clip ? Math.sin(Math.min(1, c.clip.t / (Mocap.clips[c.clip.name].d || 1)) * Math.PI) : 0;       // 0 -> 1 -> 0 over a played clip
    const jerk = Math.max(0, Math.sin(t * 0.9 + c.seed) * Math.sin(t * 2.3 + c.seed * 2) - 0.55) * 2.2 * k.twitch;           // an occasional snap of the head
    addRot(c.torso, k.hunch + Math.sin(t * 1.7 + c.seed) * k.breath + u * 0.25, 0, Math.sin(ph) * k.roll * mv);
    addRot(c.head, k.head - u * 0.1 + jerk * 0.3, Math.sin(t * 0.6 + c.seed) * 0.25 * k.twitch + jerk * 0.5, Math.sin(ph + 0.8) * -k.roll * mv + jerk * 0.15);
    addRot(c.j.shL, -k.armFwd, 0, k.armsOut); addRot(c.j.shR, -k.armFwd, 0, -k.armsOut);
    addRot(c.j.elL, -0.12 - Math.sin(t * 1.3 + c.seed) * 0.05, 0, 0); addRot(c.j.elR, -0.12 - Math.sin(t * 1.3 + c.seed + 1) * 0.05, 0, 0);
    c.hips.position.x += Math.sin(ph) * k.lurch * mv;
  }

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
        c.clip.t += dt * (c.clip.rate || 1);
        if (clip.loop || c.clip.hold || c.clip.t < clip.d) { Mocap.sample(c, c.clip.name, c.clip.t); played = true; }
        else c.clip = null;
      }
      if (!played && c.mocap) {
        const moving = speed > 0.15, run = speed > 3.2;
        if (moving) c.walkT = (c.walkT || 0) + dt * (run ? speed / 3.6 : speed / 1.6);
        Mocap.sample(c, !moving ? c.idleClip : run ? c.loco.run : c.loco.walk, moving ? c.walkT : t);
        played = true;
      }
      if (!played) {
        c.walk += dt * (2 + speed * 2.4) * (speed > 0.05 ? 1 : 0);
        standPose(c, t, speed);
        if (c.stance) { c.j.shL.rotation.x = c.j.shR.rotation.x = -0.9; c.j.elL.rotation.x = c.j.elR.rotation.x = -0.8; }
        if (c.lean) c.torso.rotation.x = c.lean;
      }
    }
    if (c.armFix) undoAPose(c);
    if (CREATURE[c.name] && c.armFix) creature(c, t, dt, speed);
    if (c.talkMood || c.talkAmp > 0.01 || c.lookPt || c.lookAmp > 0.01) gesture(c, t, dt);
    if (c.name === 'ruen') {                                                     // the orb floats over her left palm, specks circling it
      c.root.updateMatrixWorld(true);
      c.j.wrL.getWorldPosition(orbAt); c.root.worldToLocal(orbAt);
      c.orbAim = (c.orbAim || 0) + ((c.orbAimOn ? 1 : 0) - (c.orbAim || 0)) * Math.min(1, dt * 2.2);
      if (c.orbAim > 0.002) {                                                     // the orb drifts out toward the alley's far end, like a compass needle
        gv.set(0, 0.25, -2.0).multiplyScalar(c.orbAim); c.root.localToWorld(gv.set(orbAt.x, orbAt.y + 0.3, orbAt.z)); gv.add(tmpAim.set(0, 0.2 * c.orbAim, -2.2 * c.orbAim)); c.root.worldToLocal(gv);
        c.orbit.position.set(gv.x, gv.y + Math.sin(t * 2.2) * 0.025, gv.z);
      } else c.orbit.position.set(orbAt.x, orbAt.y + 0.3 + Math.sin(t * 2.2) * 0.025, orbAt.z);
      c.orb.rotation.y = t * 0.8;
      for (const sp of c.specks) {
        const u = sp.userData, a = u.a + t * u.v;
        sp.position.set(Math.cos(a) * u.r, u.y * 0.16 + Math.sin(t * 1.3 + u.a) * 0.02, Math.sin(a) * u.r);
      }
    }
    if (c.name === 'yuna' && c.tail) { c.tail.rotation.x = -Math.min(speed, 4) * 0.06; }
  }

  return { create, update, play, clipLength, setTalk, setLook, setOrbAim };
})();
