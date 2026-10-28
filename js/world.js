// Nexus - the Neon Market: the district beyond the alley's gate, far larger than the alley, built from 32 m chunks that load as the
// player nears them and unload behind. Every chunk is generated from its grid coordinates, so the world is the same every visit.
//   grid: cx = -4..4 (x = cx * 32), r = 0..7 (rows running away from the gate, z = -30 - 32 * (r + 0.5)).
//   The outer ring is a wall of tall towers. Inside: city blocks, market plazas, container yards and one tall tower.
// Solid things are boxes and circles on the ground (collide()); lit windows are one InstancedMesh per chunk; neon signs are glowing
// planes, and a small pool of real lights follows the nearest signs so the lighting stays cheap however many are loaded.
const World = (() => {
  const CH = 32, COLS = 4, MROWS = 8, ROWS = 14, Z0 = -30;                           // the Market is rows 0-7; the Industrial Hub lies beyond it, rows 8-13
  const DROP = 2.3 * CH, LIGHTS = 5;
  const SEE = 56;                                                                        // beyond this the fog has swallowed a character
  let LOAD = 1.6 * CH, lightsOn = LIGHTS;                                            // how far chunks load around the player, and how many lights are in use (the quality setting turns both down)
  const HALF_X = (COLS - 1) * CH + CH / 2 - 1.2, MIN_Z = Z0 - (ROWS - 1) * CH + 1.2;      // where the player may walk
  const chunks = new Map(), queue = [];
  let root = null, lights = [], lightT = 0, scene = null;
  const tmpP = new THREE.Vector3(), FOG_MKT = new THREE.Color(0x070b16), FOG_HUB = new THREE.Color(0x1a0f08); let hubK = -1;
  const taken = new Set(), clearedPacks = new Set();
  let shutterOpen = false, bossArmed = false, bossDown = false, doorT = 0;             // the Foundry's story state: shutter, boss, and the core
  const NODE_CHUNKS = ['-2,9', '2,10', '-2,12'], nodesTaken = new Set();           // where the three access nodes lie, and which are picked up
  const TOWER = { x: 0, z: Z0 - CH * (MROWS - 3 + 0.5) };                            // the landmark tower's chunk centre (the story's goal)                                                          // scrap already picked up, by key

  const GATE = { x: 0, z: Z0 - CH * (MROWS - 0.5) };                                  // the checkpoint in the Market's far wall, the way into the Hub
  const FOUNDRY = { x: 0, z: Z0 - CH * (ROWS - 3 + 0.5) + 15 };                         // the plaza in front of the Foundry's shutter (the Hub's landmark)
  const HUB_Z = Z0 - CH * MROWS;                                                         // the Hub begins here

  // ---------- small helpers ----------
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash = (cx, r) => (cx * 73856093) ^ (r * 19349663) ^ 0x5bd1e995;
  const cache = {};
  const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return cache[k] || (cache[k] = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9, flatShading: true }, o))); };
  const emis = (c, k = 1) => mat('e' + c + k, { color: 0x0b0b10, emissive: c, emissiveIntensity: k, roughness: 0.5 });
  const unit = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  const SHELL = [0x1a1d3e, 0x20244a, 0x2a2748, 0x1a2c3c, 0x2c2038, 0x233244, 0x34294a];
  const NEON = [0xff3fb4, 0x3ff0ff, 0xff9a3a, 0x6dff9a, 0xb48aff, 0xffe27a];
  const NEON_CSS = ['#ff3fb4', '#3ff0ff', '#ff9a3a', '#6dff9a', '#b48aff', '#ffe27a'];
  const WORDS = ['BAR', 'NOODLE', 'DATA', 'PAWN', 'HOTEL', 'ARCADE', 'REPAIR', 'MEDS', 'SYNTH', 'RAMEN', 'CYBER', 'TAXI', '24H', 'OPEN', 'CHIPS', 'DRONE', 'LOTUS', 'NEXUS'];
  let signTex = null;
  const signTextures = () => signTex || (signTex = WORDS.map((w, i) => ({ tex: Tex.led(w, NEON_CSS[i % NEON_CSS.length], 384, 160, Math.max(14, w.length * 6)), c: NEON[i % NEON.length] })));
  const BIG = ['NEXUS CORP', 'SYNTH COLA', 'LIVE FOREVER', 'OMNI', 'DREAM BIG', 'BUY NOW'], bigCache = {};
  const bigTex = i => bigCache[i] || (bigCache[i] = { tex: Tex.led(BIG[i], NEON_CSS[i % NEON_CSS.length], 768, 320, 30), c: NEON[i % NEON.length] });
  const panelTex = {};
  const panelOf = i => panelTex[i] || (panelTex[i] = Tex.panel(NEON_CSS[i % NEON_CSS.length], 256, 256));

  // Static boxes and cylinders are not made into meshes one by one: they are queued on their chunk's group and merged into a single mesh
  // per material when the chunk is finished, so a chunk costs a few dozen draw calls however many things stand in it.
  const mq = new THREE.Matrix4(), mn = new THREE.Matrix3(), qq = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  function queue_(g, geo, m, x, y, z, sx, sy, sz, ry) {
    const b = g.userData.batch; if (!b) { const o = new THREE.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; }
    let e = b.get(m); if (!e) b.set(m, e = []);
    e.push([geo, x, y, z, sx, sy, sz, ry]); return null;
  }
  const box = (g, w, h, d, m, x, y, z, ry = 0) => queue_(g, unit, m, x, y, z, w, h, d, ry);
  const tube = (g, r, h, m, x, y, z) => queue_(g, cyl, m, x, y, z, r, h, r, 0);
  function flush(g) {
    for (const [m, list] of g.userData.batch) {
      let nv = 0, ni = 0; for (const e of list) { nv += e[0].attributes.position.count; ni += e[0].index.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni); let vo = 0, io = 0;
      for (const [geo, x, y, z, sx, sy, sz, ry] of list) {
        qq.setFromAxisAngle(yAxis, ry); mq.compose(pv.set(x, y, z), qq, sv.set(sx, sy, sz)); mn.getNormalMatrix(mq);
        const P = geo.attributes.position, N = geo.attributes.normal, n = P.count;
        for (let i = 0; i < n; i++) {
          pv.fromBufferAttribute(P, i).applyMatrix4(mq); pos[(vo + i) * 3] = pv.x; pos[(vo + i) * 3 + 1] = pv.y; pos[(vo + i) * 3 + 2] = pv.z;
          pv.fromBufferAttribute(N, i).applyMatrix3(mn).normalize(); nor[(vo + i) * 3] = pv.x; nor[(vo + i) * 3 + 1] = pv.y; nor[(vo + i) * 3 + 2] = pv.z;
        }
        for (let i = 0; i < geo.index.count; i++) idx[io + i] = geo.index.array[i] + vo;
        vo += n; io += geo.index.count;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
      const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; g.add(mesh);
    }
    g.userData.batch = null;
  }
  // A cylinder that is its own mesh (it moves: a landmark ring)
  function tubeSolid(g, r, h, m, x, y, z) { const o = new THREE.Mesh(cyl, m); o.scale.set(r, h, r); o.position.set(x, y, z); g.add(o); return o; }

  // ---------- one chunk ----------
  function kindOf(cx, r, rnd) {
    if (Math.abs(cx) === COLS || r === ROWS - 1) return 'wall';
    if (r === MROWS - 1) return cx === 0 ? 'gate' : 'wall';
    if (cx === 0 && r === 0) return 'plaza';
    if (cx === 0 && r === MROWS - 3) return 'tower';
    if (r >= MROWS) { if (cx === 0 && r === ROWS - 3) return 'foundry'; const v = rnd(); return v < 0.4 ? 'factory' : v < 0.65 ? 'tanks' : 'depot'; }
    const v = rnd(); return v < 0.5 ? 'block' : v < 0.78 ? 'market' : 'yard';
  }

  // ---------- people ----------
  const NAMES = ['Mox', 'Pell', 'Sable', 'Juno', 'Rook', 'Tamsin', 'Okoro', 'Vee', 'Dax', 'Lio'];
  function makeNpc(ch, rnd, x, z, rotY, shop) {
    const rig = Chars.create('stranger');
    rig.root.position.set(x, 0, z); rig.root.rotation.y = rotY; rig.root.scale.setScalar(0.92 + rnd() * 0.16);
    const hue = (rnd() - 0.5) * 0.9;
    rig.root.traverse(o => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.offsetHSL(hue, 0, (rnd() - 0.5) * 0.08); } });      // so no two look alike
    ch.group.add(rig.root); ch.circles.push({ x, z, r: 0.45 });
    const n = { rig, name: NAMES[Math.floor(rnd() * NAMES.length)], shop, x, z }; ch.npcs.push(n); return n;
  }

  function build(cx, r) {
    const rnd = mulberry(hash(cx, r)), kind = kindOf(cx, r, rnd);
    const X = cx * CH, Z = Z0 - CH * (r + 0.5), g = new THREE.Group(); g.userData.batch = new Map();
    const ch = { key: cx + ',' + r, cx, r, X, Z, kind, group: g, boxes: [], circles: [], signs: [], spin: [], scrap: [], npcs: [], steam: [] };
    const wins = [];                                                          // lit windows to instance: { x, y, z, ry, col }

    // Windows over the four faces of a tower: a grid of small lit panes, some off
    const facade = (x, z, w, d, h, y0, cols) => {
      const litCols = cols || [0xffc977, 0x6fe8ff, 0xff5fbf, 0xffe2a8, 0x9fffd0];
      for (const f of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const along = f[0] === 0 ? w : d, off = (f[0] === 0 ? d : w) / 2 + 0.05;
        for (let a = -along / 2 + 1.2; a < along / 2 - 0.8; a += 1.5) for (let y = y0 + 1.5; y < y0 + h - 1; y += 1.7) {
          if (rnd() < 0.58) continue;
          wins.push({ x: x + (f[0] === 0 ? a : f[0] * off), y, z: z + (f[0] === 0 ? f[1] * off : a), ry: f[0] === 0 ? 0 : Math.PI / 2, col: litCols[Math.floor(rnd() * litCols.length)] });
        }
      }
    };
    // A neon sign on a facade, facing out: a lit plane, a soft halo and a spot for a light from the pool
    const sign = (x, y, z, nx, nz, w, h, ti) => {
      const pool = signTextures(), t = pool[ti % pool.length];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t.tex, toneMapped: false, color: new THREE.Color(1.7, 1.7, 1.7) }));
      m.position.set(x + nx * 0.08, y, z + nz * 0.08); m.rotation.y = Math.atan2(nx, nz); g.add(m);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.glow(), color: t.c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
      halo.position.set(x + nx * 0.5, y, z + nz * 0.5); halo.scale.set(w * 2.2, h * 2.2, 1); g.add(halo);
      ch.signs.push({ x: x + nx * 1.4, y, z: z + nz * 1.4, c: t.c });
    };
    const solid = (x, z, hw, hd) => ch.boxes.push({ x, z, hw, hd });
    const post = (x, z, rr) => ch.circles.push({ x, z, r: rr });

    // A tall building: a main mass and sometimes a setback above it, with windows, a neon trim at street level and rooftop clutter
    const tower = (x, z, w, d, h, signs = 2) => {
      const m = mat(SHELL[Math.floor(rnd() * SHELL.length)], { roughness: 1 });
      box(g, w, h, d, m, x, h / 2, z); solid(x, z, w / 2, d / 2); facade(x, z, w, d, h, 0);
      let top = h;
      if (rnd() < 0.45 && h > 14) {
        const h2 = 6 + rnd() * 12, w2 = w * (0.5 + rnd() * 0.25), d2 = d * (0.5 + rnd() * 0.25);
        box(g, w2, h2, d2, mat(SHELL[Math.floor(rnd() * SHELL.length)], { roughness: 1 }), x, h + h2 / 2, z); facade(x, z, w2, d2, h2, h); top = h + h2;
      }
      const tc = NEON[Math.floor(rnd() * NEON.length)];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.18, top, 0.18, emis(tc, 0.7), x + sx * (w / 2 + 0.05), top / 2, z + sz * (d / 2 + 0.05));      // lit corner edges, so a tower reads against the sky
      for (const f of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {                          // a neon strip along the shopfront of each face
        const len = f[0] === 0 ? w : d; box(g, f[0] === 0 ? len : 0.1, 0.12, f[0] === 0 ? 0.1 : len, emis(tc, 0.9), x + f[0] * (w / 2 + 0.06), 3.1, z + f[1] * (d / 2 + 0.06));
      }
      for (let i = 0; i < signs; i++) {                                              // signs on the faces, standing out into the street
        const f = [[0, 1], [0, -1], [1, 0], [-1, 0]][Math.floor(rnd() * 4)], len = f[0] === 0 ? w : d, a = (rnd() - 0.5) * (len - 5);
        sign(x + (f[0] === 0 ? a : f[0] * w / 2), 4 + rnd() * 6, z + (f[0] === 0 ? f[1] * d / 2 : a), f[0], f[1], 2.2 + rnd() * 1.8, 1.2 + rnd() * 1.2, Math.floor(rnd() * 99));
      }
      if (h > 22 && rnd() < 0.7) {                                                  // a big billboard high on a face
        const f = [[0, 1], [0, -1], [1, 0], [-1, 0]][Math.floor(rnd() * 4)], bi = Math.floor(rnd() * BIG.length), bt = bigTex(bi), len = f[0] === 0 ? w : d;
        const bm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(8, len - 3), Math.min(8, len - 3) * 0.42), new THREE.MeshBasicMaterial({ map: bt.tex, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
        bm.position.set(x + f[0] * (w / 2 + 0.1), h * 0.66, z + f[1] * (d / 2 + 0.1)); bm.rotation.y = Math.atan2(f[0], f[1]); g.add(bm);
        ch.signs.push({ x: x + f[0] * (w / 2 + 2), y: h * 0.66, z: z + f[1] * (d / 2 + 2), c: bt.c });
      }
      for (let i = 0; i < 2 + Math.floor(rnd() * 3); i++) {                          // water tanks, vents and an antenna on the roof
        const px = x + (rnd() - 0.5) * w * 0.6, pz = z + (rnd() - 0.5) * d * 0.6;
        if (rnd() < 0.5) tube(g, 0.9, 1.6, mat(0x2a2e3c), px, top + 0.8, pz); else box(g, 1.4, 0.9, 1.4, mat(0x242836), px, top + 0.45, pz);
      }
      box(g, 0.12, 4 + rnd() * 3, 0.12, mat(0x1a1d27), x + w * 0.3, top + 2.5, z); box(g, 0.2, 0.2, 0.2, emis(0xff3a3a, 1.6), x + w * 0.3, top + 4.6, z);
    };
    // Street furniture: crates, barrels, dumpsters, a lamp post, a vending machine
    const clutter = (x, z) => {
      const v = rnd();
      if (v < 0.3) { const s = 0.6 + rnd() * 0.4; box(g, s, s, s, mat(0x5a3f25), x, s / 2, z, rnd()); box(g, s * 0.6, s * 0.6, s * 0.6, mat(0x4a3320), x + s * 0.2, s + s * 0.3, z, rnd()); post(x, z, s * 0.75); }
      else if (v < 0.5) { tube(g, 0.38, 1.0, mat(0x2a3b44, { metalness: 0.4 }), x, 0.5, z); if (rnd() < 0.5) tube(g, 0.3, 0.06, emis(0xff7a2a, 1.2), x, 1.02, z); post(x, z, 0.5); }
      else if (v < 0.68) { const q = rnd() < 0.5; box(g, q ? 3.2 : 1.8, 1.4, q ? 1.8 : 3.2, mat(0x34413f), x, 0.7, z); box(g, q ? 3.3 : 1.9, 0.1, q ? 1.9 : 3.3, mat(0x1a1d27), x, 1.45, z); solid(x, z, q ? 1.6 : 0.9, q ? 0.9 : 1.6); }
      else if (v < 0.88) { box(g, 0.14, 4.6, 0.14, mat(0x14171f), x, 2.3, z); box(g, 0.5, 0.18, 0.5, emis(NEON[Math.floor(rnd() * NEON.length)], 1.8), x, 4.7, z); post(x, z, 0.3); }
      else { box(g, 1.0, 2.2, 1.2, mat(0x243c86), x, 1.1, z); for (let i = 0; i < 3; i++) box(g, 0.9, 0.04, 0.02, emis(0xff9a4a, 0.6), x, 0.5 + i * 0.5, z + 0.62); post(x, z, 0.8); }
    };
    // Scrap: a couple of glowing parts lying about the streets (picked up by walking over them)
    const dropScrap = (n, spots) => { for (let i = 0; i < n; i++) { const [x, z] = spots(); const key = ch.key + ':' + i; if (taken.has(key)) continue; const h = Camp.addScrap(g, x, z, key); if (h) ch.scrap.push(h); } };
    // A spot in the streets round a block of size (w, d): the 5 m margin outside it
    const margin = (w, d) => () => { const s = rnd() < 0.5 ? -1 : 1, onX = rnd() < 0.5; return onX ? [X + s * (w / 2 + 1.6 + rnd() * 3), Z + (rnd() - 0.5) * (d + 6)] : [X + (rnd() - 0.5) * (w + 6), Z + s * (d / 2 + 1.6 + rnd() * 3)]; };

    const free = (x, z, rad) => !ch.boxes.some(b => x > b.x - b.hw - rad && x < b.x + b.hw + rad && z > b.z - b.hd - rad && z < b.z + b.hd + rad) && !ch.circles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + rad);
    if (kind === 'wall') {
      const h = 40 + rnd() * 30; tower(X, Z, CH - 0.4, CH - 0.4, h, 1);
    } else if (kind === 'block' || kind === 'tower') {
      const w = 18 + rnd() * 5, d = 18 + rnd() * 5, h = kind === 'tower' ? 52 + rnd() * 8 : 12 + rnd() * 22;
      tower(X + (rnd() - 0.5) * 3, Z + (rnd() - 0.5) * 3, w, d, h, kind === 'tower' ? 4 : 2 + Math.floor(rnd() * 2));
      if (kind === 'tower') {                                                       // the landmark: a spire with bands of light
        const top = h + 6; tube(g, 0.5, 18, mat(0x1a1d27), X, top + 9, Z);
        for (let i = 0; i < 5; i++) { const t = tubeSolid(g, 1.6 - i * 0.2, 0.18, emis(0x3ff0ff, 1.6), X, top + 2 + i * 3.4, Z); ch.spin.push(t); }
      }
      for (let i = 0; i < 7; i++) { const [x, z] = margin(w, d)(); clutter(x, z); }
      dropScrap(3, margin(w, d));
    } else if (kind === 'market' || kind === 'plaza') {
      box(g, CH - 1, 0.04, CH - 1, mat(kind === 'plaza' ? 0x1c2236 : 0x151a29, { roughness: 0.8 }), X, 0.02, Z);
      const nst = kind === 'plaza' ? 6 : 8, stripes = [['#b8232f', '#dcdcd6'], ['#1f6fb8', '#dcdcd6'], ['#b8802f', '#1e1a16'], ['#2fb87a', '#dcdcd6']];
      for (let i = 0; i < nst; i++) {
        const row = i % 2, col = Math.floor(i / 2), sx = X - 11 + col * 7.5 + (rnd() - 0.5), sz = Z + (row ? 7 : -7) + (rnd() - 0.5) * 2, face = row ? -1 : 1;
        if (kind === 'plaza' && Math.abs(sx - X) < 4.5 && Math.abs(sz - Z) < 9) continue;     // keep the plaza's centre open
        const st = stripes[Math.floor(rnd() * stripes.length)];
        box(g, 3.0, 1.1, 1.5, mat(0x33292a), sx, 0.55, sz); box(g, 2.6, 0.06, 1.1, mat(0x9a2330, { roughness: 1 }), sx, 1.13, sz);
        for (const px of [-1.4, 1.4]) box(g, 0.1, 2.7, 0.1, mat(0x14171f), sx + px, 1.35, sz + face * 0.8);
        const aw = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 2.6), new THREE.MeshStandardMaterial({ map: Tex.stripes(st[0], st[1]), roughness: 0.8, flatShading: true }));
        aw.position.set(sx, 2.8, sz + face * 0.5); aw.rotation.x = face * 0.12; g.add(aw);
        const lc = NEON[Math.floor(rnd() * NEON.length)]; box(g, 0.22, 0.34, 0.22, emis(lc, 2.0), sx, 2.55, sz + face * 1.6); ch.signs.push({ x: sx, y: 2.6, z: sz + face * 1.6, c: lc });
        for (let k = 0; k < 4; k++) box(g, 0.3, 0.25, 0.3, emis(NEON[(k + i) % NEON.length], 0.9), sx - 0.9 + k * 0.6, 1.3, sz);        // goods on the counter
        solid(sx, sz, 1.6, 0.9);
        if (rnd() < 0.55 && ch.npcs.length < 3) makeNpc(ch, rnd, sx, sz - face * 1.15, face > 0 ? 0 : Math.PI, true);          // a vendor behind the counter
      }
      for (let i = 0; i < 5; i++) clutter(X + (rnd() - 0.5) * (CH - 6), Z + (rnd() - 0.5) * (CH - 6));
      if (kind === 'plaza') {                                                       // the gate square: a holo-pillar in the middle, and the market's name over the way in
        tube(g, 0.5, 7, emis(0x3ff0ff, 1.1), X, 3.5, Z); post(X, Z, 0.9);
        for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.0 + i * 0.35, 0.05, 6, 28), emis(i % 2 ? 0xff3fb4 : 0x3ff0ff, 1.6)); t.rotation.x = Math.PI / 2; t.position.set(X, 1.6 + i * 1.8, Z); g.add(t); ch.spin.push(t); }
        const nm = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6), new THREE.MeshBasicMaterial({ map: Tex.led('NEON MARKET', '#ff3fb4', 1024, 256, 54), toneMapped: false, color: new THREE.Color(1.7, 1.7, 1.7) }));
        nm.position.set(0, 9.6, Z0 - 1.5); nm.rotation.y = 0; g.add(nm); ch.signs.push({ x: 0, y: 8, z: Z0 - 3, c: 0xff3fb4 });
        for (const sx of [-5.4, 5.4]) box(g, 0.5, 9.6, 0.5, mat(0x1a1d27), sx, 4.8, Z0 - 1.6);
      }
      dropScrap(4, () => [X + (rnd() - 0.5) * (CH - 6), Z + (rnd() - 0.5) * (CH - 6)]);
    } else if (kind === 'gate') {                                                      // the checkpoint in the Market's far wall: guard blocks either side of a 16 m way through
      const ORG = 0xff8a2a, steel = mat(0x2a2d33, { roughness: 0.7, metalness: 0.3 });
      box(g, CH - 1, 0.04, CH - 1, mat(0x151a29, { roughness: 0.8 }), X, 0.02, Z);
      for (const sx of [-1, 1]) {
        const bx = X + sx * 13.5; tower(bx, Z, 10, 14, 11, 1);
        box(g, 10.2, 0.4, 0.1, emis(ORG, 1.4), bx, 3.0, Z + 7.06);                                        // a work-light strip on each guard block
        ch.signs.push({ x: bx - sx * 3, y: 4, z: Z + 9, c: ORG });
      }
      for (const sx of [-7.4, 7.4]) { box(g, 1.0, 9.4, 1.0, steel, X + sx, 4.7, Z); post(X + sx, Z, 0.7); }
      box(g, 15.8, 1.1, 1.2, steel, X, 9.2, Z);
      const hz = new THREE.Mesh(new THREE.PlaneGeometry(15, 0.8), new THREE.MeshBasicMaterial({ map: Tex.stripes('#e8a020', '#15120e'), toneMapped: false })); hz.position.set(X, 9.2, Z + 0.62); g.add(hz);
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.8), new THREE.MeshBasicMaterial({ map: Tex.led('INDUSTRIAL HUB', '#ffb04a', 1024, 152, 78), toneMapped: false, color: new THREE.Color(1.7, 1.7, 1.7) }));
      nm.position.set(X, 11.4, Z + 0.1); g.add(nm); ch.signs.push({ x: X, y: 9, z: Z + 4, c: ORG });
      const nm2 = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: Tex.led('RESTRICTED', '#ff4a4a', 1024, 200, 44), toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
      nm2.position.set(X, 7.9, Z + 0.62); g.add(nm2);
      for (const [dx, dy, dz] of [[-9, 8.2, 5], [0, 7.4, 8], [9, 8.4, 4]]) {                        // sentry drones hanging over the gate: a spinning disc and a cyan lens
        ch.spin.push(tubeSolid(g, 0.75, 0.16, mat(0xd8dee6, { metalness: 0.4, roughness: 0.5 }), X + dx, dy, Z + dz));
        box(g, 0.34, 0.2, 0.34, emis(0x3ff0ff, 2.2), X + dx, dy - 0.2, Z + dz);
      }
      tube(g, 0.4, 0.9, mat(0x2a3b44, { metalness: 0.4 }), X - 11, 0.45, Z + 10); tube(g, 0.3, 0.06, emis(0xff7a2a, 1.6), X - 11, 0.92, Z + 10); post(X - 11, Z + 10, 0.5);     // a lit barrel
      ch.signs.push({ x: X - 11, y: 1.6, z: Z + 10, c: 0xff7a2a });
      makeNpc(ch, rnd, X - 9.4, Z + 10.4, -Math.PI / 2, false).hub = true;
      for (let i = 0; i < 4; i++) clutter(X + (rnd() < 0.5 ? -1 : 1) * (9 + rnd() * 5), Z + (rnd() - 0.5) * 26);
      dropScrap(3, () => [X + (rnd() - 0.5) * 24, Z + 8 + rnd() * 6]);
    } else if (kind === 'factory') {                                                    // a low, wide works with stacks, pipe runs and orange lights
      const ORG = 0xff8a2a, OC = [0xff9a3a, 0xffc977, 0xff7a2a], dark = [0x2b2622, 0x2e2a20, 0x232a2c, 0x30261f];
      box(g, CH - 1, 0.04, CH - 1, mat(0x13151c, { roughness: 1 }), X, 0.02, Z);
      const n = 1 + (rnd() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const w = 14 + rnd() * 6, d = 12 + rnd() * 5, h = 8 + rnd() * 8, x = X + (n === 1 ? (rnd() - 0.5) * 4 : (k ? 8 : -8)), z = Z + (rnd() - 0.5) * 4 - (n === 2 ? 3 : 0);
        const m = mat(dark[Math.floor(rnd() * dark.length)], { roughness: 1 });
        box(g, w, h, d, m, x, h / 2, z); solid(x, z, w / 2, d / 2); facade(x, z, w, d, h, 0, OC);
        for (let i = 0; i < Math.floor(w / 2.6); i++) box(g, 0.3, 0.5, d + 0.4, mat(0x1a1b1e), x - w / 2 + 1.3 + i * 2.6, h + 0.25, z);        // roof ribs
        for (let i = 0; i < 1 + Math.floor(rnd() * 2); i++) {                         // smokestacks, each capped with a glow
          const px = x - w * 0.3 + i * w * 0.5, pz = z - d * 0.2, sh = 9 + rnd() * 6;
          tube(g, 0.9, sh, mat(0x1d1b1a), px, h + sh / 2, pz); tube(g, 1.0, 0.3, emis(ORG, 1.8), px, h + sh + 0.1, pz); ch.signs.push({ x: px, y: h + sh, z: pz, c: ORG });
        }
        box(g, w, 0.55, 0.55, mat(0x3a3430), x, 5.4, z + d / 2 + 0.7); for (const px of [-0.4, 0.4]) box(g, 0.5, 5.4, 0.5, mat(0x3a3430), x + px * w, 2.7, z + d / 2 + 0.7);   // a pipe run along the front
        box(g, w + 0.2, 0.3, 0.1, emis(ORG, 1.1), x, 3.0, z + d / 2 + 0.07);
        ch.signs.push({ x: x, y: 4.2, z: z + d / 2 + 2, c: ORG });
      }
      for (let i = 0; i < 6; i++) clutter(X + (rnd() - 0.5) * (CH - 6), Z + (rnd() - 0.5) * (CH - 6));
      dropScrap(4, () => [X + (rnd() - 0.5) * (CH - 6), Z + (rnd() - 0.5) * (CH - 6)]);
    } else if (kind === 'tanks') {                                                      // a tank farm: big cylinders with glowing bands, joined by pipe bridges
      const ORG = 0xff8a2a, pos = [];
      box(g, CH - 1, 0.04, CH - 1, mat(0x12141b, { roughness: 1 }), X, 0.02, Z);
      for (let i = 0; i < 4 + Math.floor(rnd() * 2); i++) {
        const x = X - 10 + (i % 2) * 20 + (rnd() - 0.5) * 3, z = Z - 11 + Math.floor(i / 2) * 11 + (rnd() - 0.5) * 3, rr = 3.2 + rnd() * 1.6, h = 7 + rnd() * 7;
        if (pos.some(q => Math.hypot(q[0] - x, q[1] - z) < q[2] + rr + 2)) continue; pos.push([x, z, rr]);
        tube(g, rr, h, mat(0x3a3d44, { metalness: 0.4, roughness: 0.6 }), x, h / 2, z); tube(g, rr * 0.6, 0.5, mat(0x24262c), x, h + 0.25, z); post(x, z, rr + 0.2);
        for (const by of [0.3, 0.75]) tube(g, rr + 0.06, 0.22, emis(by > 0.5 ? ORG : 0xffb04a, 0.9), x, h * by, z);
        box(g, 0.3, h, 0.3, mat(0x1c1e22), x + rr * 0.8, h / 2, z + rr * 0.6);                           // a ladder column
      }
      for (let i = 0; i + 1 < pos.length; i++) {                                       // pipe bridges overhead, well above head height
        const a = pos[i], b = pos[i + 1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        box(g, Math.abs(a[0] - b[0]) + 0.5, 0.45, 0.45, mat(0x3a3430), mx, 5.2, a[1]); box(g, 0.45, 0.45, Math.abs(a[1] - b[1]) + 0.5, mat(0x3a3430), b[0], 5.2, mz);
      }
      if (pos.length) ch.signs.push({ x: pos[0][0], y: 5, z: pos[0][1] + pos[0][2] + 1.5, c: ORG });
      for (let i = 0; i < 6; i++) { const x = X + (rnd() - 0.5) * (CH - 6), z = Z + (rnd() - 0.5) * (CH - 6); if (!pos.some(q => Math.hypot(q[0] - x, q[1] - z) < q[2] + 2)) clutter(x, z); }
      dropScrap(4, () => { for (let t = 0; t < 8; t++) { const x = X + (rnd() - 0.5) * (CH - 6), z = Z + (rnd() - 0.5) * (CH - 6); if (!pos.some(q => Math.hypot(q[0] - x, q[1] - z) < q[2] + 1.5)) return [x, z]; } return [X + CH / 2 - 2, Z]; });
    } else if (kind === 'depot') {                                                      // stacked containers under a gantry crane, with a conveyor
      const ORG = 0xff8a2a, steel = mat(0x30343b, { metalness: 0.3, roughness: 0.7 }), cols = [0x6b2a24, 0x244a6b, 0x6b5a24, 0x4a3a2c];
      box(g, CH - 1, 0.04, CH - 1, mat(0x13151c, { roughness: 1 }), X, 0.02, Z);
      for (let i = 0; i < 5; i++) {
        const q = rnd() < 0.5, cw = q ? 6.2 : 2.5, cd = q ? 2.5 : 6.2, x = X - 10 + (i % 3) * 10 + (rnd() - 0.5) * 2, z = Z + (i < 3 ? -9 : 6) + (rnd() - 0.5) * 2, c = cols[Math.floor(rnd() * cols.length)];
        box(g, cw, 2.6, cd, mat(c, { roughness: 0.7, metalness: 0.2 }), x, 1.3, z); solid(x, z, cw / 2, cd / 2);
        for (let k = 0; k < Math.floor(rnd() * 3); k++) box(g, cw * 0.95, 2.6, cd * 0.95, mat(cols[Math.floor(rnd() * cols.length)], { roughness: 0.7, metalness: 0.2 }), x, 3.9 + k * 2.6, z);
      }
      const gz = Z + 0.5;                                                              // the gantry: two legs and a beam across the yard, with a warning lamp
      for (const sx of [-13, 13]) { box(g, 0.9, 15, 0.9, steel, X + sx, 7.5, gz); post(X + sx, gz, 0.7); }
      box(g, 27, 1.2, 1.4, steel, X, 15.4, gz); box(g, 2, 1.6, 1.6, mat(0x6b5a24), X + (rnd() - 0.5) * 12, 14.2, gz); box(g, 0.3, 0.3, 0.3, emis(0xff3a3a, 2.2), X + 13, 16.2, gz); ch.signs.push({ x: X + 13, y: 12, z: gz + 2, c: 0xff3a3a });
      box(g, 2.2, 0.7, 18, mat(0x1f2126), X + 4, 0.35, Z - 1); box(g, 0.12, 0.74, 18, emis(ORG, 0.9), X + 4 + 1.15, 0.36, Z - 1); ch.boxes.push({ x: X + 4, z: Z - 1, hw: 1.1, hd: 9 });
      ch.signs.push({ x: X - 4, y: 3, z: Z + 12, c: ORG });
      for (let i = 0; i < 6; i++) { const x = X + (rnd() - 0.5) * (CH - 6), z = Z + (rnd() - 0.5) * (CH - 6); if (free(x, z, 1.6)) clutter(x, z); }
      dropScrap(4, () => [X + (rnd() - 0.5) * (CH - 6), Z + 12 + (rnd() - 0.5) * 6]);
    } else if (kind === 'foundry') {                                                    // the Hub's landmark: a hollow furnace works, open to the sky, behind a sealed shutter
      const ORG = 0xff8a2a, w = 26, d = 22, h = 20, bz = Z - 3, front = bz + d / 2, steel = mat(0x2a2d33, { metalness: 0.3, roughness: 0.7 }), wallM = mat(0x2e2824, { roughness: 1 });
      box(g, CH - 1, 0.04, CH - 1, mat(0x181410, { roughness: 1 }), X, 0.02, Z);
      const wall = (cx, cy, cz, ww, hh, dd) => { box(g, ww, hh, dd, wallM, cx, cy, cz); };
      wall(X, h / 2, bz - d / 2 + 0.6, w, h, 1.2); solid(X, bz - d / 2 + 0.6, w / 2, 0.6);                               // back wall
      for (const sx of [-1, 1]) { wall(X + sx * (w / 2 - 0.6), h / 2, bz, 1.2, h, d); solid(X + sx * (w / 2 - 0.6), bz, 0.6, d / 2); }
      ch.cut = [];                                                                       // the front wall, which is hidden while the crew are inside so the camera can see in
      for (const sx of [-1, 1]) { const m = new THREE.Mesh(unit, wallM); m.scale.set(7.5, h, 1.2); m.position.set(X + sx * 9.25, h / 2, front - 0.6); g.add(m); ch.cut.push(m); solid(X + sx * 9.25, front - 0.6, 3.75, 0.6); }
      { const m = new THREE.Mesh(unit, wallM); m.scale.set(11, h - 9, 1.2); m.position.set(X, 9 + (h - 9) / 2, front - 0.6); g.add(m); ch.cut.push(m); }
      facade(X, bz, w, d, h, 0, [0xff9a3a, 0xffc977, 0xff7a2a]);
      for (const sx of [-8, 0, 8]) {
        tube(g, 1.7, 15, mat(0x1d1b1a), X + sx, h + 7.5, bz - 4); tube(g, 1.8, 0.4, emis(ORG, 2.0), X + sx, h + 15.1, bz - 4);
        ch.spin.push(tubeSolid(g, 2.4, 0.2, emis(0xffb04a, 1.6), X + sx, h + 9, bz - 4));
      }
      box(g, 14, 1.4, 0.2, emis(ORG, 2.4), X, 14, front + 0.1);                                           // the furnace glow through a slit over the door
      // The shutter: slats on a door that rises into the wall once it has been opened
      const door = new THREE.Group(); door.position.set(X, 0, front - 0.3); g.add(door); ch.door = door;
      const dm = new THREE.Mesh(new THREE.BoxGeometry(11, 8.5, 0.5), mat(0x1a1c20, { metalness: 0.5, roughness: 0.5 })); dm.position.y = 4.25; door.add(dm);
      for (let i = 0; i < 8; i++) { const sl = new THREE.Mesh(unit, steel); sl.scale.set(11, 0.12, 0.2); sl.position.set(0, 0.7 + i * 1.02, 0.32); door.add(sl); }
      const hzD = new THREE.Mesh(new THREE.PlaneGeometry(11, 0.9), new THREE.MeshBasicMaterial({ map: Tex.stripes('#e8a020', '#15120e'), toneMapped: false })); hzD.position.set(0, 8.9, 0.34); door.add(hzD);
      if (shutterOpen) door.position.y = 9.2; else ch.boxes.push(ch.doorBox = { x: X, z: front - 0.3, hw: 5.6, hd: 0.5 });
      const lg = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshBasicMaterial({ map: Tex.led('NEXUS CORP', '#ffb04a', 768, 144, 60), toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) })); lg.position.set(X, 16.5, front + 0.12); g.add(lg);
      const mk = new THREE.Mesh(new THREE.PlaneGeometry(13, 4), new THREE.MeshBasicMaterial({ map: Tex.stripes('#e8a020', '#15120e'), toneMapped: false, transparent: true, opacity: 0.9 })); mk.rotation.x = -Math.PI / 2; mk.position.set(X, 0.05, front + 3); g.add(mk);   // hazard stripes on the floor before the door
      for (const [lx, lz] of [[-12, front + 4], [12, front + 4], [-12, front + 12], [12, front + 12]]) { box(g, 0.14, 5, 0.14, mat(0x14171f), lx, 2.5, lz); box(g, 0.6, 0.2, 0.6, emis(ORG, 2.2), lx, 5.1, lz); post(lx, lz, 0.3); ch.signs.push({ x: lx, y: 5, z: lz, c: ORG }); }
      for (let i = 0; i < 5; i++) { const x = X + (rnd() < 0.5 ? -1 : 1) * (14 + rnd() * 1.5), z = Z + (rnd() - 0.5) * 24; if (free(x, z, 1.2)) clutter(x, z); }
      // Inside: a dark floor with a river of molten metal, a catwalk overhead, the Loader Mech and, behind it, a pedestal for the Data Core
      box(g, w - 2.4, 0.05, d - 1.2, mat(0x1a1714, { roughness: 1 }), X, 0.03, bz);
      box(g, w - 5, 0.07, 1.2, emis(ORG, 1.3), X, 0.06, bz - 3.5); box(g, 1.2, 0.07, 6, emis(ORG, 1.3), X + 5, 0.06, bz - 7);
      box(g, w - 2, 0.3, 2, steel, X, 7, bz - 8.5); for (const sx of [-1, 1]) { box(g, 0.3, 7, 0.3, steel, X + sx * 11, 3.5, bz - 8.5); }
      for (const sx of [-1, 1]) { box(g, 1.2, 4, 1.2, mat(0x34302c), X + sx * 10.4, 2, bz - 9); solid(X + sx * 10.4, bz - 9, 0.6, 0.6); }
      for (const [lx, lz] of [[-6, bz - 1], [6, bz - 1], [0, bz - 8]]) ch.signs.push({ x: X + lx, y: 5, z: lz, c: ORG });
      box(g, 2.4, 1.0, 2.4, steel, X, 0.5, bz - 8); solid(X, bz - 8, 1.2, 1.2);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), emis(0xfff0c0, 2.6)); core.position.set(X, 2.0, bz - 8); core.visible = false; g.add(core); ch.spin.push(core); ch.core = { mesh: core, x: X, z: bz - 8 };
      ch.coreSign = { x: X, y: 2.4, z: bz - 6.5, c: 0xfff0c0 };
      if (!bossDown) {
        const rig = Chars.create('loader'); rig.root.position.set(X, 0, bz - 3); rig.root.rotation.y = 0; g.add(rig.root);
        ch.pack = Combat.register({ id: 'boss', x: X, z: bz - 3, rigs: [rig], tier: 0, aggro: bossArmed, aggroR: 13, radius: 10, boss: true, text: 'The Loader Mech lurches to life!', onClear: () => { bossDown = true; } });
      }
      ch.hall = { x: X, z: bz, hw: w / 2 - 1.2, hd: d / 2 - 1.2, front };
      dropScrap(3, () => [X + (rnd() - 0.5) * 20, front + 4 + rnd() * 8]);
    } else {                                                                         // yard: containers, crates, barrels and a few fires
      box(g, CH - 1, 0.04, CH - 1, mat(0x141720, { roughness: 1 }), X, 0.02, Z);
      const cols = [0x6b2a24, 0x244a6b, 0x4a6b24, 0x6b5a24, 0x4a2a6b];
      for (let i = 0; i < 6; i++) {
        const q = rnd() < 0.5, cw = q ? 6.2 : 2.5, cd = q ? 2.5 : 6.2, x = X - 10 + (i % 3) * 10 + (rnd() - 0.5) * 3, z = Z - 8 + Math.floor(i / 3) * 16 + (rnd() - 0.5) * 3, c = cols[Math.floor(rnd() * cols.length)];
        box(g, cw, 2.6, cd, mat(c, { roughness: 0.7, metalness: 0.2 }), x, 1.3, z); solid(x, z, cw / 2, cd / 2);
        if (rnd() < 0.4) { box(g, cw * 0.9, 2.6, cd * 0.9, mat(cols[Math.floor(rnd() * cols.length)], { roughness: 0.7, metalness: 0.2 }), x, 3.9, z); }
        box(g, q ? cw : 0.05, 0.1, q ? 0.05 : cd, emis(NEON[Math.floor(rnd() * NEON.length)], 0.8), x, 2.2, z + (q ? cd / 2 + 0.03 : 0));
      }
      for (let i = 0; i < 9; i++) clutter(X + (rnd() - 0.5) * (CH - 6), Z + (rnd() - 0.5) * (CH - 6));
      dropScrap(4, () => [X + (rnd() - 0.5) * (CH - 6), Z + (rnd() - 0.5) * (CH - 6)]);
    }
    // An access node (stage 8 of the story): a cyan pylon with a ring, standing in the open
    if (NODE_CHUNKS.includes(ch.key) && !nodesTaken.has(ch.key)) {
      for (let tries = 0; tries < 40; tries++) {
        const nx = X + (rnd() - 0.5) * (CH - 8), nz = Z + (rnd() - 0.5) * (CH - 8);
        if (!free(nx, nz, 2)) continue;
        const grp = new THREE.Group(); grp.position.set(nx, 0, nz);
        const py = new THREE.Mesh(cyl, emis(0x3ff0ff, 1.8)); py.scale.set(0.3, 1.4, 0.3); py.position.y = 0.7; grp.add(py);
        const rg = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 20), emis(0x9ff7ff, 2)); rg.rotation.x = Math.PI / 2; rg.position.y = 1.0; grp.add(rg); ch.spin.push(rg);
        const beam = new THREE.Mesh(cyl, new THREE.MeshBasicMaterial({ color: 0x3ff0ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); beam.scale.set(0.5, 40, 0.5); beam.position.y = 20; grp.add(beam);
        grp.visible = false; g.add(grp); ch.node = { x: nx, z: nz, group: grp };
        ch.signs.push({ x: nx, y: 1.6, z: nz, c: 0x3ff0ff });
        break;
      }
    }
    // Lane markings down the middle of the streets either side of the chunk
    if (kind !== 'wall') for (let i = 0; i < 8; i++) box(g, 0.25, 0.02, 2.4, mat(0x3a3f55, { roughness: 1 }), X + CH / 2, 0.012, Z - CH / 2 + 2 + i * 4);
    // Street dressing: arches over the cross streets, parked vehicles, steam vents, and cables strung across the street
    if (kind !== 'wall') {
      if (rnd() < 0.45) {
        const ax = X + CH / 2, az = Z + (rnd() - 0.5) * 12, ac = NEON[Math.floor(rnd() * NEON.length)];
        for (const sx of [-4.6, 4.6]) { box(g, 0.45, 7.2, 0.45, mat(0x1a1d27), ax + sx, 3.6, az); post(ax + sx, az, 0.45); }
        box(g, 9.8, 0.5, 0.5, emis(ac, 1.3), ax, 7.3, az); for (const sx of [-3, 0, 3]) box(g, 0.3, 0.5, 0.3, emis(ac, 1.8), ax + sx, 6.6, az);
      }
      for (let i = 0; i < 2; i++) if (rnd() < 0.55) {
        const q = rnd() < 0.5, spot = kind === 'block' || kind === 'tower' ? margin(24, 24)() : [X + (rnd() - 0.5) * (CH - 8), Z + (rnd() - 0.5) * (CH - 8)], x = spot[0], pz = spot[1], pc = [0x3a2a4a, 0x2a3a4a, 0x4a3a2a, 0x2a2a30][Math.floor(rnd() * 4)];
        const hw = q ? 2.2 : 0.95, hd = q ? 0.95 : 2.2;
        if (!free(x, pz, 1)) continue;
        box(g, hw * 2, 0.8, hd * 2, mat(pc, { roughness: 0.5, metalness: 0.4 }), x, 0.6, pz); box(g, q ? 2.2 : 1.7, 0.6, q ? 1.7 : 2.2, mat(0x10131c, { roughness: 0.3, metalness: 0.5 }), x, 1.25, pz);
        box(g, q ? 0.06 : 1.6, 0.14, q ? 1.6 : 0.06, emis(0xfff0c0, 2.0), x + (q ? hw : 0), 0.7, pz + (q ? 0 : hd));       // headlights
        box(g, q ? 0.06 : 1.6, 0.1, q ? 1.6 : 0.06, emis(0xff3a3a, 1.4), x - (q ? hw : 0), 0.7, pz - (q ? 0 : hd));         // tail lights
        solid(x, pz, hw, hd);
      }
      for (let i = 0; i < 2; i++) {
        const vx = X + (rnd() - 0.5) * (CH - 6), vz = Z + (rnd() - 0.5) * (CH - 6);
        if (free(vx, vz, 1.4)) { box(g, 0.9, 0.12, 0.9, mat(0x2a2e3c, { metalness: 0.4 }), vx, 0.06, vz); ch.steam.push({ x: vx, z: vz, ph: rnd() * 10, sprites: Array.from({ length: 7 }, () => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.glow(), color: 0x8aa0b8, transparent: true, opacity: 0, depthWrite: false })); sp.scale.set(1.2, 1.2, 1); g.add(sp); return sp; }) }); }
      }
      for (let i = 0; i < 2; i++) {
        const cz = Z + (rnd() - 0.5) * (CH - 6), y0 = 9 + rnd() * 3, y1 = 9 + rnd() * 3, sag = 1.0 + rnd() * 1.4;
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(X + CH / 2 - 9, y0, cz), new THREE.Vector3(X + CH / 2, Math.min(y0, y1) - sag, cz + (rnd() - 0.5)), new THREE.Vector3(X + CH / 2 + 9, y1, cz)]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.035, 5, false), mat(0x06060a, { roughness: 0.6 })));
      }
    }
    // A husk patrol: two or three husks standing in the street, which Combat fights (tougher the further from the gate). Gone for good once beaten.
    if (kind !== 'wall' && kind !== 'plaza' && kind !== 'gate' && kind !== 'foundry' && r >= 1 && rnd() < 0.6 && !clearedPacks.has(ch.key)) {
      for (let tries = 0; tries < 14; tries++) {
        const px = X + (rnd() - 0.5) * (CH - 10), pz = Z + (rnd() - 0.5) * (CH - 10);
        if (!free(px, pz, 3.2)) continue;
        const n = 2 + (rnd() < 0.5 ? 1 : 0), rigs = [];
        for (let i = 0; i < n; i++) {
          const rig = Chars.create(i === n - 1 && r >= 2 && (r < MROWS || i > 0) ? 'brute' : 'husk'), a = i / n * Math.PI * 2 + 0.6;   // the deeper patrols are led by a Brute
          rig.root.position.set(px + Math.cos(a) * 1.5, 0, pz + Math.sin(a) * 1.5); rig.root.rotation.y = rnd() * 6.28; g.add(rig.root); rigs.push(rig);
        }
        ch.pack = Combat.register({ id: 'w' + ch.key, x: px, z: pz, rigs, tier: r >= MROWS ? Math.min(4, r - 5) : Math.min(4, r), aggro: true, radius: 8, text: r >= MROWS ? 'The works are crawling with husks.' : 'Husks! A patrol blocks the street.', onClear: () => clearedPacks.add(ch.key) });
        break;
      }
    }
    flush(g);
    // Instance the windows
    if (wins.length) {
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.6, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff }), wins.length), d = new THREE.Object3D(), c = new THREE.Color();
      wins.forEach((w, i) => { d.position.set(w.x, w.y, w.z); d.rotation.y = w.ry; d.updateMatrix(); inst.setMatrixAt(i, d.matrix); inst.setColorAt(i, c.setHex(w.col).multiplyScalar(0.5)); });
      inst.frustumCulled = false; g.add(inst); ch.inst = inst;
    }
    root.add(g); chunks.set(ch.key, ch);
  }

  function drop(ch) {
    if (ch.pack) Combat.unregister(ch.pack.id);
    for (const h of ch.scrap) Camp.dropScrap(h);
    root.remove(ch.group);
    ch.group.traverse(o => { if (o.isMesh && o.geometry !== unit && o.geometry !== cyl && !(o.material && o.material.map)) { /* shared materials stay cached */ } if (o.geometry && o.geometry !== unit && o.geometry !== cyl) o.geometry.dispose(); });
    if (ch.inst) ch.inst.dispose();
    chunks.delete(ch.key);
  }

  // ---------- public ----------
  function init(s) {
    scene = s; root = new THREE.Group(); scene.add(root);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry((COLS * 2 + 1) * CH, ROWS * CH + 4), mat(0x10131e, { roughness: 0.85, metalness: 0.05 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, Z0 - ROWS * CH / 2 + 1); root.add(ground);
    // The tower's beacon: a pale beam and bands of light that ignore the fog, so the story's goal can be seen from anywhere in the district
    const bm = new THREE.MeshBasicMaterial({ color: 0xbff6ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
    const beam = new THREE.Mesh(cyl, bm); beam.scale.set(2.2, 150, 2.2); beam.position.set(TOWER.x, 75, TOWER.z); root.add(beam);
    const bandM = new THREE.MeshBasicMaterial({ color: 0x9ff3ff, fog: false, toneMapped: false });
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(cyl, bandM); b.scale.set(3.4 - i * 0.3, 0.5, 3.4 - i * 0.3); b.position.set(TOWER.x, 66 + i * 4.5, TOWER.z); root.add(b); }
    // The Foundry's beacon: an orange column over the Hub (seen from the Market too), so the second goal is as easy to find as the first
    const fm = new THREE.MeshBasicMaterial({ color: 0xffa24a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
    const fb = new THREE.Mesh(cyl, fm); fb.scale.set(2.6, 150, 2.6); fb.position.set(FOUNDRY.x, 75, FOUNDRY.z - 15); root.add(fb);
    const fbandM = new THREE.MeshBasicMaterial({ color: 0xffb870, fog: false, toneMapped: false });
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(cyl, fbandM); b.scale.set(3.6 - i * 0.4, 0.5, 3.6 - i * 0.4); b.position.set(FOUNDRY.x, 60 + i * 5, FOUNDRY.z - 15); root.add(b); }
    for (let i = 0; i < LIGHTS; i++) { const l = new THREE.PointLight(0xffffff, 0, 12, 1.5); l.position.set(0, 3, -40); scene.add(l); lights.push(l); }
  }

  // Every frame: stream chunks around the player (one built per frame), spin the landmarks, and park the lights on the nearest signs
  function update(t, dt, p) {
    for (let cx = -COLS; cx <= COLS; cx++) for (let r = 0; r < ROWS; r++) {
      const key = cx + ',' + r, X = cx * CH, Z = Z0 - CH * (r + 0.5);
      if (Math.max(Math.abs(p.x - X), Math.abs(p.z - Z)) < LOAD && !chunks.has(key) && !queue.includes(key)) queue.push(key);
    }
    queue.sort((a, b) => { const f = k => { const [cx, r] = k.split(',').map(Number); return Math.hypot(p.x - cx * CH, p.z - (Z0 - CH * (r + 0.5))); }; return f(a) - f(b); });
    if (queue.length) { const [cx, r] = queue.shift().split(',').map(Number); build(cx, r); }
    if (!Combat.active()) for (const ch of [...chunks.values()]) if (Math.max(Math.abs(p.x - ch.X), Math.abs(p.z - ch.Z)) > DROP) drop(ch);
    for (const ch of chunks.values()) {
      for (const s of ch.spin) s.rotation.y += dt * 0.8;
      if (ch.node) {                                                                    // access nodes show once the story asks for them, and are picked up by walking close
        const on = typeof Cutscene !== 'undefined' && Cutscene.stage() >= 8 && !nodesTaken.has(ch.key);
        ch.node.group.visible = on;
        if (on && Math.hypot(p.x - ch.node.x, p.z - ch.node.z) < 1.8) { nodesTaken.add(ch.key); ch.node.group.visible = false; Sound.sfx('pickup'); Cutscene.nodeTaken(nodesTaken.size); }
      }
      if (ch.cut) {                                                                     // the Foundry: the front wall steps aside while the crew are inside, so the camera can see in
        const h = ch.hall, inside = Math.abs(p.x - h.x) < h.hw + 1 && p.z < h.front + 0.8 && p.z > h.z - h.hd, fighting = Combat.active() && Math.hypot(p.x - h.x, p.z - h.z) < 26;
        for (const m of ch.cut) m.visible = !(inside || fighting);
        if (ch.door && doorT > 0) { ch.door.position.y = Math.min(9.2, ch.door.position.y + dt * 4.5); if (ch.door.position.y >= 9.2) doorT = 0; }
        ch.core.mesh.visible = bossDown; if (bossDown && !ch.coreLit) { ch.coreLit = true; ch.signs.push(ch.coreSign); }
      }
      // Rigs are ~40 meshes each: past the fog's reach they are hidden rather than drawn
      for (const n of ch.npcs) n.rig.root.visible = Math.hypot(p.x - n.x, p.z - n.z) < SEE;
      if (ch.pack) for (const r of ch.pack.rigs) r.root.visible = Math.hypot(p.x - r.root.position.x, p.z - r.root.position.z) < SEE;
      if (Math.hypot(p.x - ch.X, p.z - ch.Z) > 48) continue;
      for (const n of ch.npcs) { const d = Math.hypot(p.x - n.x, p.z - n.z); Chars.setLook(n.rig, d < 5 ? tmpP.set(p.x, 1.5, p.z) : null); Chars.update(n.rig, t, dt, 0); }
      for (const v of ch.steam) v.sprites.forEach((sp, i) => {                                   // steam: puffs that rise, grow and fade, each on its own cycle
        const u = ((t * 0.35 + v.ph + i / v.sprites.length) % 1); sp.position.set(v.x + Math.sin(i * 2 + t) * 0.15, 0.3 + u * 3.2, v.z); sp.scale.setScalar(0.7 + u * 1.8); sp.material.opacity = (1 - u) * 0.22 * Math.min(1, u * 6);
      });
    }
    const hub = Math.max(0, Math.min(1, (HUB_Z + 10 - p.z) / 24));                              // beyond the gate the air turns the Hub's smoky amber
    if (hub !== hubK) { hubK = hub; scene.fog.color.lerpColors(FOG_MKT, FOG_HUB, hub); scene.background.copy(scene.fog.color); scene.fog.density = 0.03 + hub * 0.006; }
    lightT -= dt;
    if (lightT <= 0) {
      lightT = 0.3; const all = [];
      for (const ch of chunks.values()) for (const s of ch.signs) all.push({ s, d: Math.hypot(s.x - p.x, s.z - p.z) });
      all.sort((a, b) => a.d - b.d);
      lights.forEach((l, i) => { const a = i < lightsOn ? all[i] : null; if (a && a.d < 30) { l.position.set(a.s.x, a.s.y, a.s.z); l.color.setHex(a.s.c); l.intensity = 1.5; } else l.intensity = 0; });
    }
  }

  // The Foundry's story state
  function openShutter() {
    shutterOpen = true; doorT = 1;
    for (const ch of chunks.values()) if (ch.doorBox) { ch.boxes.splice(ch.boxes.indexOf(ch.doorBox), 1); ch.doorBox = null; }
  }
  function armBoss() { bossArmed = true; for (const ch of chunks.values()) if (ch.pack && ch.pack.id === 'boss') ch.pack.aggro = true; }
  // The nearest access node not yet taken that is loaded, for the map marker; the far ones are known from the grid
  function nextNode(p) {
    let best = null, bd = 1e9;
    for (const key of NODE_CHUNKS) {
      if (nodesTaken.has(key)) continue; const [cx, r] = key.split(',').map(Number), x = cx * CH, z = Z0 - CH * (r + 0.5), ch = chunks.get(key);
      const q = ch && ch.node ? ch.node : { x, z }, d = Math.hypot(p.x - q.x, p.z - q.z); if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  const coreAt = () => { for (const ch of chunks.values()) if (ch.core) return ch.core; return null; };

  // Quality levels 0 (full) to 2 (lean): fewer sign lights and a shorter load radius
  function setDetail(level) { lightsOn = [LIGHTS, 3, 1][level] ?? LIGHTS; LOAD = [1.6, 1.4, 1.2][level] * CH; lightT = 0; }
  const chunkRects = () => [...chunks.values()].map(ch => ({ x: ch.X, z: ch.Z, s: CH }));

  // Pushes a point out of every nearby box and circle
  function collide(x, z) {
    for (const ch of chunks.values()) {
      if (Math.abs(x - ch.X) > CH || Math.abs(z - ch.Z) > CH) continue;
      for (const b of ch.boxes) {
        const rr = 0.4, nx = Math.max(b.x - b.hw, Math.min(x, b.x + b.hw)), nz = Math.max(b.z - b.hd, Math.min(z, b.z + b.hd)), dx = x - nx, dz = z - nz, d = Math.hypot(dx, dz);
        if (d < rr) {
          if (d > 0.0001) { x = nx + dx / d * rr; z = nz + dz / d * rr; }
          else { const ex = b.hw - Math.abs(x - b.x), ez = b.hd - Math.abs(z - b.z); if (ex < ez) x = b.x + Math.sign(x - b.x || 1) * (b.hw + rr); else z = b.z + Math.sign(z - b.z || 1) * (b.hd + rr); }
        }
      }
      for (const c of ch.circles) {
        const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.35;
        if (d < min && d > 0.0001) { x = c.x + dx / d * min; z = c.z + dz / d * min; }
      }
    }
    return { x, z };
  }

  // Is a circle of radius rad at (x, z) in the way of a building or prop (or outside the district)? Used to place battle stages on open ground
  function blocked(x, z, rad) {
    if (z > Z0) return false;
    if (Math.abs(x) > HALF_X || z < MIN_Z) return true;
    for (const ch of chunks.values()) {
      if (Math.abs(x - ch.X) > CH || Math.abs(z - ch.Z) > CH) continue;
      if (ch.boxes.some(b => x > b.x - b.hw - rad && x < b.x + b.hw + rad && z > b.z - b.hd - rad && z < b.z + b.hd + rad)) return true;
      if (ch.circles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + rad)) return true;
    }
    return false;
  }

  // Footprints of the loaded buildings and the chunk grid, for the minimap
  const footprints = () => { const out = []; for (const ch of chunks.values()) for (const b of ch.boxes) out.push(b); return out; };
  const markTaken = key => taken.add(key);
  // Progress for the save: what was picked up, which patrols and nodes are gone, and the Foundry's state. Setting it rebuilds every loaded chunk.
  const getState = () => ({ taken: [...taken], packs: [...clearedPacks], nodes: [...nodesTaken], shutter: shutterOpen, bossDown, bossArmed });
  function setState(d) {
    taken.clear(); clearedPacks.clear(); nodesTaken.clear();
    (d.taken || []).forEach(k => taken.add(k)); (d.packs || []).forEach(k => clearedPacks.add(k)); (d.nodes || []).forEach(k => nodesTaken.add(k));
    shutterOpen = !!d.shutter; bossDown = !!d.bossDown; bossArmed = !!d.bossArmed; doorT = 0;
    for (const ch of [...chunks.values()]) drop(ch); queue.length = 0;
  }
  const allNpcs = () => { const out = []; for (const ch of chunks.values()) for (const n of ch.npcs) out.push(n); return out; };
  function nearNpc(p, r) { let best = null, bd = r; for (const n of allNpcs()) { const d = Math.hypot(p.x - n.x, p.z - n.z); if (d < bd) { bd = d; best = n; } } return best; }

  return { init, update, collide, blocked, footprints, markTaken, nearNpc, npcs: allNpcs, TOWER, GATE, FOUNDRY, HUB_Z, getState, setState, isTaken: k => taken.has(k), openShutter, armBoss, nextNode, coreAt, nodeCount: () => nodesTaken.size, bossDown: () => bossDown, shutterOpen: () => shutterOpen, HALF_X, MIN_Z, Z0, CH, setDetail, chunkRects, lights: () => lightsOn, loaded: () => chunks.size };
})();
