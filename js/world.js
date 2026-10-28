// Nexus - the Neon Market: the district beyond the alley's gate, far larger than the alley, built from 32 m chunks that load as the
// player nears them and unload behind. Every chunk is generated from its grid coordinates, so the world is the same every visit.
//   grid: cx = -4..4 (x = cx * 32), r = 0..7 (rows running away from the gate, z = -30 - 32 * (r + 0.5)).
//   The outer ring is a wall of tall towers. Inside: city blocks, market plazas, container yards and one tall tower.
// Solid things are boxes and circles on the ground (collide()); lit windows are one InstancedMesh per chunk; neon signs are glowing
// planes, and a small pool of real lights follows the nearest signs so the lighting stays cheap however many are loaded.
const World = (() => {
  const CH = 32, COLS = 4, ROWS = 8, Z0 = -30;
  const DROP = 2.3 * CH, LIGHTS = 5;
  const SEE = 56;                                                                        // beyond this the fog has swallowed a character
  let LOAD = 1.6 * CH, lightsOn = LIGHTS;                                            // how far chunks load around the player, and how many lights are in use (the quality setting turns both down)
  const HALF_X = (COLS - 1) * CH + CH / 2 - 1.2, MIN_Z = Z0 - (ROWS - 1) * CH + 1.2;      // where the player may walk
  const chunks = new Map(), queue = [];
  let root = null, lights = [], lightT = 0, scene = null;
  const tmpP = new THREE.Vector3();
  const taken = new Set(), clearedPacks = new Set();
  const TOWER = { x: 0, z: Z0 - CH * (ROWS - 3 + 0.5) };                            // the landmark tower's chunk centre (the story's goal)                                                          // scrap already picked up, by key

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
    if (cx === 0 && r === 0) return 'plaza';
    if (cx === 0 && r === ROWS - 3) return 'tower';
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
    const facade = (x, z, w, d, h, y0) => {
      const litCols = [0xffc977, 0x6fe8ff, 0xff5fbf, 0xffe2a8, 0x9fffd0];
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
    // Lane markings down the middle of the streets either side of the chunk
    if (kind !== 'wall') for (let i = 0; i < 8; i++) box(g, 0.25, 0.02, 2.4, mat(0x3a3f55, { roughness: 1 }), X + CH / 2, 0.012, Z - CH / 2 + 2 + i * 4);
    const free = (x, z, rad) => !ch.boxes.some(b => x > b.x - b.hw - rad && x < b.x + b.hw + rad && z > b.z - b.hd - rad && z < b.z + b.hd + rad) && !ch.circles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + rad);
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
    if (kind !== 'wall' && kind !== 'plaza' && r >= 1 && rnd() < 0.6 && !clearedPacks.has(ch.key)) {
      for (let tries = 0; tries < 14; tries++) {
        const px = X + (rnd() - 0.5) * (CH - 10), pz = Z + (rnd() - 0.5) * (CH - 10);
        if (!free(px, pz, 3.2)) continue;
        const n = 2 + (rnd() < 0.5 ? 1 : 0), rigs = [];
        for (let i = 0; i < n; i++) {
          const rig = Chars.create(i === n - 1 && r >= 2 ? 'brute' : 'husk'), a = i / n * Math.PI * 2 + 0.6;   // the deeper patrols are led by a Brute
          rig.root.position.set(px + Math.cos(a) * 1.5, 0, pz + Math.sin(a) * 1.5); rig.root.rotation.y = rnd() * 6.28; g.add(rig.root); rigs.push(rig);
        }
        ch.pack = Combat.register({ id: 'w' + ch.key, x: px, z: pz, rigs, tier: Math.min(4, r), aggro: true, radius: 8, text: 'Husks! A patrol blocks the street.', onClear: () => clearedPacks.add(ch.key) });
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
      // Rigs are ~40 meshes each: past the fog's reach they are hidden rather than drawn
      for (const n of ch.npcs) n.rig.root.visible = Math.hypot(p.x - n.x, p.z - n.z) < SEE;
      if (ch.pack) for (const r of ch.pack.rigs) r.root.visible = Math.hypot(p.x - r.root.position.x, p.z - r.root.position.z) < SEE;
      if (Math.hypot(p.x - ch.X, p.z - ch.Z) > 48) continue;
      for (const n of ch.npcs) { const d = Math.hypot(p.x - n.x, p.z - n.z); Chars.setLook(n.rig, d < 5 ? tmpP.set(p.x, 1.5, p.z) : null); Chars.update(n.rig, t, dt, 0); }
      for (const v of ch.steam) v.sprites.forEach((sp, i) => {                                   // steam: puffs that rise, grow and fade, each on its own cycle
        const u = ((t * 0.35 + v.ph + i / v.sprites.length) % 1); sp.position.set(v.x + Math.sin(i * 2 + t) * 0.15, 0.3 + u * 3.2, v.z); sp.scale.setScalar(0.7 + u * 1.8); sp.material.opacity = (1 - u) * 0.22 * Math.min(1, u * 6);
      });
    }
    lightT -= dt;
    if (lightT <= 0) {
      lightT = 0.3; const all = [];
      for (const ch of chunks.values()) for (const s of ch.signs) all.push({ s, d: Math.hypot(s.x - p.x, s.z - p.z) });
      all.sort((a, b) => a.d - b.d);
      lights.forEach((l, i) => { const a = i < lightsOn ? all[i] : null; if (a && a.d < 30) { l.position.set(a.s.x, a.s.y, a.s.z); l.color.setHex(a.s.c); l.intensity = 1.5; } else l.intensity = 0; });
    }
  }

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
  const allNpcs = () => { const out = []; for (const ch of chunks.values()) for (const n of ch.npcs) out.push(n); return out; };
  function nearNpc(p, r) { let best = null, bd = r; for (const n of allNpcs()) { const d = Math.hypot(p.x - n.x, p.z - n.z); if (d < bd) { bd = d; best = n; } } return best; }

  return { init, update, collide, blocked, footprints, markTaken, nearNpc, npcs: allNpcs, TOWER, HALF_X, MIN_Z, Z0, CH, setDetail, chunkRects, lights: () => lightsOn, loaded: () => chunks.size };
})();
