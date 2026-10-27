// Nexus - the crew, built in code the way Deepward builds its heroes: a joint hierarchy of Groups dressed with primitive meshes,
// flat-shaded and posed procedurally (no model or animation files).
// Conventions: feet at y=0, facing +Z, the character's right hand is on -X. Joints rotate so that a negative x swings a limb forward.
// The look follows the reference shot: chunky faceted low-poly bodies, tapered torsos, big faces with eyes, brows and noses,
// layered clothing and armour, and thin cyan light lines on the tech.
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

  // Limbs: tapered legs with a knee, chunky boots with a cuff and a sole, sleeves with cuffs, blocky hands with a thumb.
  // m.pants m.shoes m.sleeve m.skin are needed; m.sole, m.hand, m.cuff are optional
  function limbs(c, p, m) {
    const sole = m.sole || dark, hand = m.hand || m.skin, cuff = m.cuff || m.sleeve;
    for (const k of ['L', 'R']) {
      add(c.j['hip' + k], new THREE.CylinderGeometry(p.legR * 1.15, p.legR * 0.92, p.thigh, 6), m.pants, 0, -p.thigh / 2, 0);
      add(c.j['knee' + k], new THREE.CylinderGeometry(p.legR * 0.92, p.legR * 0.74, p.shin, 6), m.pants, 0, -p.shin / 2, 0);
      add(c.j['knee' + k], new THREE.SphereGeometry(p.legR * 0.95, 6, 4), m.pants, 0, 0, 0.01);                                   // the knee
      add(c.j['ank' + k], new THREE.CylinderGeometry(p.legR * 0.95, p.legR * 1.08, 0.17, 6), m.shoes, 0, 0.06, 0);                // boot shaft
      add(c.j['ank' + k], tb(0.15, 0.17, 0.09, 0.2, 0.3), m.shoes, 0, -0.04, 0.07);                                             // boot body, toe-heavy
      add(c.j['ank' + k], box(0.18, 0.035, 0.33), sole, 0, -0.085, 0.07);                                                       // sole
      add(c.j['sh' + k], new THREE.SphereGeometry(p.armR * 1.3, 6, 5), m.sleeve, 0, 0, 0);
      add(c.j['sh' + k], new THREE.CylinderGeometry(p.armR * 1.05, p.armR * 0.88, 0.34, 6), m.sleeve, 0, -0.17, 0);
      add(c.j['el' + k], new THREE.CylinderGeometry(p.armR * 0.88, p.armR * 0.72, 0.32, 6), m.sleeve, 0, -0.16, 0);
      add(c.j['el' + k], new THREE.SphereGeometry(p.armR * 0.9, 6, 4), m.sleeve, 0, 0, 0);                                      // the elbow
      add(c.j['wr' + k], new THREE.CylinderGeometry(p.armR * 0.78, p.armR * 0.82, 0.05, 6), cuff, 0, 0.02, 0);                   // cuff
      add(c.j['wr' + k], box(p.armR * 1.7, 0.1, p.armR * 1.45), hand, 0, -0.06, 0);                                              // the hand
      add(c.j['wr' + k], box(p.armR * 0.55, 0.07, p.armR * 0.7), hand, (k === 'L' ? -1 : 1) * p.armR * 0.95, -0.045, p.armR * 0.35); // thumb
    }
  }

  // A face on the head joint: a tapered skull with a nose, ears, a neck, eyes with whites and brows, and a mouth.
  // o: { w, d, brow (material), eye (iris colour), skin (material) }. The front of the face is at z = d / 2
  function face(head, m, o = {}) {
    const w = o.w || 0.28, d = o.d || 0.27, z = d / 2;
    add(head, new THREE.CylinderGeometry(0.06, 0.07, 0.12, 6), m.skin, 0, 0.0, 0);                                      // neck
    add(head, tb(w, w * 0.78, 0.3, d, d * 0.88), m.skin, 0, 0.16, 0);                                                    // skull, narrowing to the jaw
    add(head, box(0.04, 0.05, 0.045), m.skin, 0, 0.125, z + 0.012);                                                      // nose
    for (const s of [-1, 1]) {
      add(head, box(0.03, 0.065, 0.045), m.skin, s * (w * 0.5 + 0.008), 0.155, 0);                                       // ears
      if (o.simple) { add(head, box(0.034, 0.034, 0.012), o.eye || dark, s * 0.06, 0.165, z + 0.003); continue; }           // plain dark eyes, no brows
      add(head, box(0.052, 0.03, 0.012), white, s * 0.065, 0.178, z + 0.002);                                            // eye white
      add(head, box(0.028, 0.03, 0.012), o.eye || dark, s * 0.065 + (o.look || 0) * 0.01, 0.178, z + 0.008);             // iris
      add(head, box(0.07, 0.016, 0.016), o.brow || m.hair, s * 0.066, 0.215, z + 0.004).rotation.z = s * -0.12 * (o.angry || 1);   // brow
    }
    add(head, box(o.simple ? 0.05 : 0.07, 0.012, 0.012), std(0x8a4a48, { roughness: 0.6 }), 0, 0.07, z + 0.002);                           // mouth
  }

  // Detail pieces shared by the crew
  const gemMesh = () => new THREE.OctahedronGeometry(0.05, 0).scale(1, 1.3, 0.5);
  function belt(torso, m, w, d, y = 0.0) {
    add(torso, box(w, 0.06, d), m.belt || dark, 0, y, 0);
    add(torso, box(0.07, 0.05, 0.015), m.buckle || m.trim || white, 0, y, d / 2 + 0.003);
  }
  function pouch(parent, m, x, y, z, s = 1) { add(parent, box(0.07 * s, 0.09 * s, 0.05 * s), m, x, y, z); }

  // ---------------- Ruen: the Intuitive Hacker. Slender, bob cut, a dark jacket over a tan vest, a floating data-orb ----------------
  function ruen() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.22, torsoH: 0.6, armR: 0.075, legR: 0.085, headS: 1.25 };
    const m = {
      skin: std(0xdba98c, { roughness: 0.6 }), hair: std(0x2a1a1c, { roughness: 0.45 }), jacket: std(0x1b2230), vest: std(0x8a7358),
      armor: std(0x9fb4bd, { roughness: 0.45, metalness: 0.25 }), armorDark: std(0x6f8590, { roughness: 0.5, metalness: 0.25 }),
      trim: lit(0x37e0ff, 0.9), pants: std(0x4a3d34), shoes: std(0x15171c), sleeve: std(0x1b2230), cuff: std(0x39424f), gem: lit(0x37e0ff, 1.6),
      belt: std(0x2a2018),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.seatH = 0.62; c.kind = 'seated'; c.seed = 1.3;
    const T = c.torso;
    add(T, tb(0.34, 0.27, 0.52, 0.21, 0.18), m.jacket, 0, 0.3, 0);                                         // jacket body, wide at the shoulder
    add(T, box(0.13, 0.44, 0.02), m.vest, 0, 0.3, 0.107);                                                   // tan vest showing between the lapels
    for (const s of [-1, 1]) {
      tilt(add(T, box(0.09, 0.4, 0.03), m.jacket, s * 0.085, 0.3, 0.115), 0, 0, s * 0.12);                  // lapels
      add(T, box(0.01, 0.4, 0.012), m.trim, s * 0.14, 0.3, 0.12);                                           // light piping down the front edge
      add(T, box(0.1, 0.08, 0.1), m.armorDark, s * 0.2, 0.55, 0);                                           // small shoulder plates
      add(T, box(0.1, 0.012, 0.1), m.trim, s * 0.2, 0.595, 0);
    }
    add(T, gemMesh(), m.gem, 0, 0.42, 0.125);                                                              // the data gem at the throat
    add(T, tb(0.3, 0.36, 0.2, 0.2, 0.24), m.jacket, 0, -0.07, 0);                                           // jacket skirt over the hips
    belt(T, m, 0.29, 0.2, 0.02);
    pouch(T, m.belt, 0.17, -0.01, 0.06);
    add(T, tb(0.22, 0.2, 0.08, 0.2, 0.18), m.jacket, 0, 0.62, 0);                                           // high collar
    const H = c.head;
    face(H, m, { w: 0.27, d: 0.26, eye: std(0x3a2418), angry: 0.5 });
    add(H, tb(0.31, 0.31, 0.12, 0.31, 0.3), m.hair, 0, 0.3, -0.01);                                         // crown
    add(H, tb(0.3, 0.3, 0.32, 0.06, 0.06), m.hair, 0, 0.14, -0.15);                                         // the back of the bob
    for (const s of [-1, 1]) {
      add(H, tb(0.05, 0.06, 0.34, 0.27, 0.28), m.hair, s * 0.155, 0.15, -0.02);                             // side panels to the jaw
      tilt(add(H, box(0.1, 0.16, 0.05), m.hair, s * 0.09, 0.25, 0.14), 0, 0, s * 0.35);                     // swept fringe
    }
    tilt(add(H, box(0.18, 0.06, 0.05), m.hair, 0, 0.275, 0.145), -0.2, 0, 0);
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
      skin: std(0xc99672, { roughness: 0.7 }), hair: std(0x3a281c), armor: std(0x9fb4bd, { roughness: 0.45, metalness: 0.25 }),
      plate: std(0x6f8590, { roughness: 0.5, metalness: 0.25 }), vestM: std(0x5a4636), under: std(0x1d2430), pants: std(0x2a2623), shoes: std(0x14171c),
      sleeve: std(0x2a323f), steel: std(0x5c6470, { roughness: 0.4, metalness: 0.5 }), cyan: lit(0x3ff0ff, 0.9), gem: lit(0x3ff0ff, 1.4),
      belt: std(0x241a14), hand: std(0x2a2f38, { roughness: 0.6 }), cuff: std(0x5c6470, { metalness: 0.5, roughness: 0.4 }),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.seatH = 0.72; c.kind = 'seated'; c.seed = 2.1;
    const T = c.torso;
    add(T, tb(0.9, 0.66, 0.72, 0.5, 0.42), m.under, 0, 0.32, 0);                                            // broad chest
    add(T, tb(0.62, 0.5, 0.6, 0.06, 0.06), m.vestM, 0, 0.34, 0.25);                                         // leather vest panel
    add(T, tb(0.36, 0.26, 0.3, 0.06, 0.06), m.plate, 0, 0.36, 0.285);                                       // chest plate
    add(T, gemMesh().scale(1.3, 1.3, 1.3), m.gem, 0, 0.38, 0.32);                                           // the gem
    add(T, box(0.04, 0.34, 0.02), m.cyan, -0.2, 0.34, 0.275);                                               // lights down the plate
    add(T, box(0.04, 0.34, 0.02), m.cyan, 0.2, 0.34, 0.275);
    add(T, tb(0.46, 0.5, 0.24, 0.44, 0.46), m.under, 0, -0.06, 0);                                          // waist
    belt(T, m, 0.5, 0.46, 0.03);
    pouch(T, m.belt, -0.28, -0.04, 0.12, 1.4); pouch(T, m.belt, 0.28, -0.04, 0.12, 1.4);
    for (const s of [-1, 1]) {
      add(T, tb(0.44, 0.34, 0.26, 0.52, 0.46), m.plate, s * 0.47, 0.62, 0);                                  // pauldrons
      add(T, tb(0.46, 0.36, 0.05, 0.54, 0.48), m.armor, s * 0.47, 0.76, 0);
      add(T, box(0.02, 0.12, 0.2), m.cyan, s * 0.65, 0.58, 0);                                                // glow strip on the pauldron's edge
    }
    add(T, tb(0.38, 0.5, 0.14, 0.34, 0.4), m.under, 0, 0.7, 0);                                              // thick neck collar
    const H = c.head;
    face(H, m, { w: 0.3, d: 0.29, eye: std(0x2a1a10), angry: 1.8 });
    add(H, tb(0.33, 0.33, 0.07, 0.32, 0.31), m.hair, 0, 0.32, -0.01);                                        // short hair
    add(H, box(0.34, 0.1, 0.05), m.hair, 0, 0.26, -0.14);
    for (const s of [-1, 1]) add(H, box(0.04, 0.2, 0.1), m.hair, s * 0.155, 0.12, 0.05);                      // sideburns running into the beard
    add(H, tb(0.28, 0.2, 0.19, 0.12, 0.12), m.hair, 0, 0.055, 0.14);                                         // the beard
    add(H, tb(0.3, 0.26, 0.1, 0.2, 0.26), m.hair, 0, 0.05, 0.03);
    add(H, box(0.13, 0.035, 0.04), m.hair, 0, 0.098, 0.165);                                                 // moustache
    for (const k of ['L', 'R']) {                                                                              // gauntlets on both forearms
      add(c.j['el' + k], tb(0.31, 0.26, 0.38, 0.31, 0.26), m.steel, 0, -0.2, 0);
      add(c.j['el' + k], box(0.02, 0.24, 0.1), m.cyan, 0.16, -0.2, 0.06);
      add(c.j['el' + k], box(0.02, 0.24, 0.1), m.cyan, -0.16, -0.2, 0.06);
      add(c.j['el' + k], box(0.2, 0.02, 0.3), m.cyan, 0, -0.04, 0);
      add(c.j['wr' + k], tb(0.22, 0.2, 0.12, 0.2, 0.18), m.steel, 0, -0.07, 0);                                // knuckle guard
    }
    c.armL = 0.05;
    return c;
  }

  // ---------------- Yuna: the Independent Ranger. After the reference: a small plain face, a dark side-swept bob and a tall ponytail,
  // a fitted dark suit, one big grey armoured arm with vertical cyan light strips, armoured shins, and two long cyan-lit blasters ----------------
  function yuna() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.19, torsoH: 0.6, armR: 0.065, legR: 0.075, headS: 1.12 };
    const m = {
      skin: std(0xe0b79a, { roughness: 0.6 }), hair: std(0x2f2528, { roughness: 0.5 }), suit: std(0x3b3538, { roughness: 0.7 }),
      suitB: std(0x2b2629, { roughness: 0.7 }), accent: lit(0x3ff0ff, 1.0), pants: std(0x2d2a31), shoes: std(0x4a3a32), sole: std(0x1a1416),
      sleeve: std(0x2d2a31), armor: std(0x7f8a98, { roughness: 0.5, metalness: 0.2 }), armorB: std(0x5d6672, { roughness: 0.5, metalness: 0.25 }),
      hand: std(0x2b2629), cuff: std(0x5d6672, { metalness: 0.25 }), belt: std(0x1a1416),
      gun: std(0x77808c, { metalness: 0.35, roughness: 0.45 }), gunD: std(0x2a2e36, { metalness: 0.4, roughness: 0.4 }), plasma: lit(0x3ff0ff, 1.7),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.seatH = 0.62; c.kind = 'seated'; c.seed = 4.0;
    const T = c.torso;
    add(T, tb(0.3, 0.24, 0.56, 0.2, 0.17), m.suit, 0, 0.29, 0);                                             // fitted suit
    add(T, tb(0.22, 0.18, 0.3, 0.05, 0.05), m.suitB, 0, 0.33, 0.1);                                         // darker chest panel
    add(T, tb(0.25, 0.28, 0.2, 0.18, 0.2), m.suit, 0, -0.07, 0);
    belt(T, m, 0.27, 0.19, 0.02);
    for (const s of [-1, 1]) pouch(T, m.gunD, s * 0.15, -0.1, 0.07, 0.9);                                   // hip holsters
    add(T, tb(0.17, 0.2, 0.07, 0.17, 0.19), m.suit, 0, 0.62, 0);
    // The armoured arm (her left): a tall pauldron, a vertical light strip stack and a heavy forearm guard
    tilt(add(T, tb(0.17, 0.23, 0.2, 0.22, 0.24), m.armor, 0.22, 0.53, 0), 0, 0, -0.18);
    for (const dz of [-0.07, 0.0, 0.07]) add(T, box(0.012, 0.15, 0.025), m.accent, 0.318, 0.53, dz);
    add(c.j.shL, tb(0.17, 0.15, 0.3, 0.17, 0.15), m.armorB, 0.0, -0.2, 0);
    for (const dz of [-0.04, 0.04]) add(c.j.shL, box(0.012, 0.2, 0.02), m.accent, 0.088, -0.2, dz);
    add(c.j.elL, tb(0.15, 0.17, 0.3, 0.15, 0.17), m.armorB, 0, -0.16, 0);                                   // forearm guard
    add(c.j.elR, tb(0.12, 0.13, 0.22, 0.12, 0.13), m.armorB, 0, -0.18, 0);                                  // a lighter bracer on the other arm
    for (const k of ['L', 'R']) {
      add(c.j['knee' + k], tb(0.13, 0.12, 0.26, 0.15, 0.13), m.armorB, 0, -0.26, 0.015);                    // shin armour
      add(c.j['knee' + k], box(0.15, 0.08, 0.11), m.armor, 0, -0.01, 0.06);                                 // knee cap
    }
    const H = c.head;
    face(H, m, { w: 0.255, d: 0.25, eye: std(0x2a1a14), simple: true });
    add(H, tb(0.285, 0.285, 0.2, 0.28, 0.28), m.hair, 0, 0.215, -0.045);                                    // hair shell over the crown, sides and back
    add(H, box(0.275, 0.05, 0.04), m.hair, 0, 0.292, 0.128);                                                 // hairline
    tilt(add(H, box(0.15, 0.1, 0.035), m.hair, -0.06, 0.245, 0.136), 0, 0, 0.45);                           // the fringe, swept across to one side
    for (const s of [-1, 1]) add(H, box(0.03, 0.2, 0.16), m.hair, s * 0.145, 0.17, -0.05);                  // hair framing the ears
    const tail = joint(H, 0, 0.3, -0.12);                                                                    // a tall ponytail rising off the back of the crown
    add(tail, new THREE.SphereGeometry(0.05, 6, 4), m.accent, 0, 0, 0);                                     // glowing hair tie
    add(tail, new THREE.CylinderGeometry(0.03, 0.075, 0.46, 6), m.hair, 0, 0.23, 0);
    c.tail = tail;
    c.seatArm = { sh: -0.3, el: -0.55, wr: 0.95 };                                                           // arms resting forward, blasters level
    // Long blasters, one in each hand, held forward: a grey body, a dark top rail and cyan strips along the side
    for (const k of ['L', 'R']) {
      const g = c.j['wr' + k];
      add(g, tb(0.07, 0.09, 0.15, 0.12, 0.17), m.gunD, 0, -0.1, -0.01);                                     // grip
      add(g, box(0.09, 0.1, 0.44), m.gun, 0, -0.03, 0.2);                                                    // body
      add(g, box(0.05, 0.04, 0.4), m.gunD, 0, 0.035, 0.2);                                                   // top rail
      for (const s of [-1, 1]) {
        add(g, box(0.012, 0.025, 0.3), m.plasma, s * 0.05, -0.03, 0.2);                                      // light strips
        add(g, box(0.012, 0.05, 0.03), m.plasma, s * 0.05, -0.03, 0.04);
      }
      add(g, box(0.05, 0.05, 0.14), m.gunD, 0, -0.03, 0.47);                                                 // barrel
      add(g, box(0.06, 0.06, 0.03), m.plasma, 0, -0.03, 0.55);
    }
    c.armR = 0; c.armL = 0;
    return c;
  }

  // ---------------- The player: an armoured figure after the reference shot. A boxy helmet with a light visor, a grey hood and
  // pauldrons, a dark vest with a back plate and a cyan gem, light forearm guards, dark trousers, brown boots ----------------
  function player() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.27, torsoH: 0.6, armR: 0.085, legR: 0.09, headS: 1.2 };
    const m = {
      skin: std(0xc9a080, { roughness: 0.6 }), hair: std(0x3a2a22, { roughness: 0.7 }), under: std(0x1d2430), vest: std(0x161b25),
      armor: std(0x9fb4bd, { roughness: 0.45, metalness: 0.25 }), armorDark: std(0x6f8590, { roughness: 0.5, metalness: 0.25 }),
      gem: lit(0x3ff0ff, 1.6), pants: std(0x1a1f2a), shoes: std(0x4a3426, { roughness: 0.8 }), sleeve: std(0x2a3342), glove: std(0x14181f),
      hand: std(0x14181f), cuff: std(0x9fb4bd, { metalness: 0.25 }), visor: lit(0x6fdcff, 0.9), helmet: std(0x3b3f48, { roughness: 0.55, metalness: 0.2 }),
      belt: std(0x2a2018), trim: lit(0x3ff0ff, 1.2),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.kind = 'stand'; c.seed = 0.6;
    const T = c.torso;
    // Torso: a dark under-layer and vest, a light back plate with the gem, a chest plate, a belt with pouches
    add(T, tb(0.42, 0.34, 0.5, 0.27, 0.23), m.under, 0, 0.27, 0);
    add(T, tb(0.38, 0.3, 0.4, 0.05, 0.05), m.vest, 0, 0.28, 0.14);                                          // front vest
    add(T, tb(0.38, 0.3, 0.06, 0.07, 0.07), m.armorDark, 0, 0.45, 0.155);                                   // chest yoke
    add(T, tb(0.42, 0.34, 0.36, 0.06, 0.06), m.armor, 0, 0.3, -0.15);                                        // back plate
    add(T, gemMesh().scale(1.2, 1.2, 1.2), m.gem, 0, 0.34, -0.19);
    add(T, box(0.02, 0.28, 0.01), m.trim, -0.12, 0.28, -0.185);                                              // light lines on the back plate
    add(T, box(0.02, 0.28, 0.01), m.trim, 0.12, 0.28, -0.185);
    add(T, tb(0.38, 0.4, 0.14, 0.26, 0.28), m.under, 0, -0.04, 0);
    belt(T, m, 0.42, 0.28, 0.02);
    pouch(T, m.belt, -0.18, -0.03, 0.15); pouch(T, m.belt, 0.18, -0.03, 0.15);
    pouch(T, m.belt, 0.0, -0.01, -0.17, 1.2);
    // Hood and pauldrons: angled light plates over each shoulder
    add(T, tb(0.34, 0.4, 0.14, 0.3, 0.32), m.armorDark, 0, 0.6, -0.03);
    for (const side of [-1, 1]) {
      tilt(add(T, tb(0.2, 0.26, 0.12, 0.3, 0.32), m.armor, side * 0.31, 0.53, 0), 0, 0, -side * 0.2);
      add(T, box(0.2, 0.012, 0.3), m.trim, side * 0.33, 0.595, 0);
    }
    // Forearm guards on each arm (the joints are the elbows)
    for (const k of ['L', 'R']) {
      add(c.j['el' + k], tb(0.17, 0.15, 0.26, 0.19, 0.17), m.armor, 0, -0.2, 0);
      add(c.j['el' + k], box(0.015, 0.2, 0.12), m.trim, 0.085, -0.2, 0);
    }
    // Head: a bare face under a boxy helmet with a light visor on each side
    const H = c.head;
    face(H, m, { w: 0.25, d: 0.25, eye: std(0x2a1a10), angry: 1.2 });
    add(H, tb(0.31, 0.3, 0.17, 0.31, 0.3), m.helmet, 0, 0.3, -0.01);
    add(H, tb(0.31, 0.31, 0.22, 0.05, 0.05), m.helmet, 0, 0.19, -0.15);
    add(H, box(0.3, 0.05, 0.04), m.hair, 0, 0.255, 0.145);                                                   // hair under the brim
    for (const s of [-1, 1]) {
      add(H, box(0.04, 0.12, 0.2), m.helmet, s * 0.15, 0.2, -0.02);
      add(H, box(0.025, 0.07, 0.12), m.visor, s * 0.172, 0.2, 0.0);                                         // glowing visor on the side
    }
    return c;
  }

  // ---------------- A crew member on the street: pale, slender, in a cap and a teal jacket with glowing seams ----------------
  function stranger() {
    const p = { thigh: 0.42, shin: 0.42, shoulderW: 0.19, torsoH: 0.6, armR: 0.06, legR: 0.065, headS: 1.2 };
    const m = {
      skin: std(0x9fd3c8, { roughness: 0.4, metalness: 0.2 }), hair: std(0x6aa39a), coat: std(0x7fbdb2, { roughness: 0.5, metalness: 0.2 }),
      coatB: std(0x5f9a92, { roughness: 0.5, metalness: 0.2 }), plate: std(0x9fb4bd, { roughness: 0.45, metalness: 0.25 }),
      seam: lit(0x3ff0ff, 1.3), pants: std(0x4f7d78), shoes: std(0x2b3b3a), sleeve: std(0x7fbdb2), cuff: std(0x5f9a92), hand: std(0x9fd3c8),
      cap: std(0xc9d6d9, { roughness: 0.6 }), belt: std(0x2b3b3a),
    };
    const c = skeleton(p); limbs(c, p, m);
    c.kind = 'stand'; c.seed = 3.7;
    const T = c.torso;
    add(T, tb(0.35, 0.29, 0.58, 0.22, 0.19), m.coat, 0, 0.3, 0);
    add(T, tb(0.3, 0.24, 0.3, 0.05, 0.05), m.plate, 0, 0.36, 0.125);                                         // light chest plate
    add(T, box(0.015, 0.5, 0.2), m.seam, -0.16, 0.28, 0);
    add(T, box(0.015, 0.5, 0.2), m.seam, 0.16, 0.28, 0);
    add(T, tb(0.28, 0.32, 0.18, 0.2, 0.22), m.coatB, 0, -0.06, 0);                                           // jacket hem
    belt(T, m, 0.28, 0.2, 0.02);
    add(T, tb(0.2, 0.24, 0.08, 0.19, 0.21), m.coatB, 0, 0.62, 0);
    const H = c.head;
    face(H, m, { w: 0.25, d: 0.25, eye: lit(0x3ff0ff, 1.4), brow: m.coatB, angry: 0.5 });
    add(H, tb(0.28, 0.28, 0.11, 0.28, 0.28), m.cap, 0, 0.31, -0.01);                                         // cap crown
    add(H, box(0.29, 0.03, 0.1), m.cap, 0, 0.255, 0.18);                                                    // brim
    add(H, box(0.285, 0.022, 0.275), m.seam, 0, 0.265, -0.01);                                              // the glowing band round the cap
    for (const s of [-1, 1]) add(H, box(0.03, 0.12, 0.2), m.hair, s * 0.14, 0.17, -0.04);
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
    c.head.rotation.y = Math.sin(t * 0.4 + c.seed) * 0.18;
    const a = c.seatArm || { sh: -0.45, el: -0.9, wr: 0 };                  // a rig can hold its arms differently (Yuna rests hers, guns level)
    c.j.shL.rotation.x = c.j.shR.rotation.x = a.sh;
    c.j.elL.rotation.x = c.j.elR.rotation.x = a.el;
    c.j.wrL.rotation.x = c.j.wrR.rotation.x = a.wr;
  }


  const kinds = { ruen, kyle, yuna, player, stranger, husk };
  // The clips a figure walks, runs and idles with, and the idle it holds in battle. Nobody holds a weapon, so everyone
  // walks and runs with the plain unarmed locomotion. The crew drop into the magic stance when a fight starts (their
  // strikes are brawling punches and hooks, their skills are casts); the husks keep a loose unarmed idle.
  const UNARMED = { idle: 'idleEase', walk: 'walkCalm', run: 'runCalm', battle: 'mgIdle' };
  const LOCO = { husk: { idle: 'idleEase', walk: 'walkCalm', run: 'runCalm', battle: 'idleUnarmed' } };

  // Builds one of the crew by name and returns its rig (the root is what the scene adds)
  function create(kind) {
    const c = kinds[kind](); c.name = kind;
    c.walk = 0; c.speed = 0;
    c.mocap = true; c.loco = LOCO[kind] || UNARMED; c.idleClip = c.loco.idle;   // standing figures use the clips; idleClip is what they do when still
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
    if (c.name === 'ruen') { c.orbit.rotation.y = t * 1.6; c.orb.position.y = Math.sin(t * 2.2) * 0.03; }
    if (c.name === 'yuna' && c.tail) { c.tail.rotation.x = -0.35 + Math.sin(t * 3.2) * 0.12 - speed * 0.2; }
  }

  return { create, update, play, clipLength };
})();
