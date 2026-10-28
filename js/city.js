// Nexus - the neon alley: stacked blocks with lit windows on both sides, LED signs, overhead cables, street clutter,
// and the blue portal in a dark gate at the far end. The walls bound the player; the props are colliders.
const City = (() => {
  const HALF = 8.5;                                  // the alley runs x = -HALF .. HALF
  const FAR = -26;                                   // the gate sits here
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];

  const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9, flatShading: true }, o));
  const emis = (c, k = 1) => new THREE.MeshStandardMaterial({ color: 0x0b0b10, emissive: c, emissiveIntensity: k, roughness: 0.5, flatShading: true });
  const put = (parent, geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o; };
  const box = (parent, w, h, d, m, x, y, z, ry = 0) => put(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z, ry);
  // A pipe lying flat: along x when ry is 0, along z when ry is PI/2
  const pipe = (parent, r, len, m, x, z, ry = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), m); o.rotation.set(0, ry, Math.PI / 2); o.position.set(x, r, z); parent.add(o); return o; };

  // Colliders are circles on the ground; buzzers are signs that flicker; the portal drifts
  const colliders = [];
  const buzzers = [];
  let portalDust = null, portalGlow = null, portalFace = null, portalLight = null, gateK = 0, gateGoal = 0;      // the portal is a sealed barrier until the alley's ambush is beaten: gateK 0 sealed .. 1 open
  let glitchK = 0, resonK = 0, holo = null, rings = [], ringT = 0;

  // Blocks along both walls: each shows a grid of windows, some lit in warm, cyan and pink
  function blocks(root) {
    const shell = [0x10122a, 0x141633, 0x1a1830, 0x0f1b26];
    const shellGeo = new THREE.BoxGeometry(8, 1, 9);
    const litCols = [0xffc977, 0x6fe8ff, 0xff5fbf, 0xffe2a8];
    const wins = [];
    for (const s of [-1, 1]) {
      for (let z = FAR - 4; z < 12; z += 9) {
        const h = 14 + rnd() * 12, m = mat(pick(shell), { roughness: 1 });
        const b = put(root, shellGeo, m, s * (HALF + 4), h / 2, z + 4.5);
        b.scale.y = h;
        for (let y = 1.4; y < h - 1; y += 1.6) for (let k = 0; k < 6; k++) {
          if (rnd() < 0.55) continue;
          wins.push({ x: s * (HALF + 0.04), y, z: z + 1 + k * 1.35, col: pick(litCols) });
        }
      }
      box(root, 1.2, 0.2, 60, mat(0x0a0c14), s * (HALF - 0.4), 0.1, -8);     // shopfront plinth
    }
    // Instanced windows: one draw call for all of them, each tinted on its own
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.6, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }), wins.length);
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    wins.forEach((w, i) => {
      dummy.position.set(w.x, w.y, w.z); dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix); inst.setColorAt(i, col.setHex(w.col).multiplyScalar(0.5));
    });
    root.add(inst);
  }

  // A neon sign on a wall: a plane facing into the alley, a soft halo, and a coloured light that spills onto the street
  function sign(root, s, tex, w, h, y, z, color, lightK = 1.2) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8) }));
    plane.position.set(s * (HALF - 0.08), y, z); plane.rotation.y = -s * Math.PI / 2; root.add(plane);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.glow(), color, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6, transparent: true }));
    halo.position.set(s * (HALF - 0.4), y, z); halo.scale.set(w * 2.2, h * 2.2, 1); root.add(halo);
    const light = new THREE.PointLight(color, lightK, 11, 1.5);
    light.position.set(s * (HALF - 1.2), y, z); root.add(light);
    buzzers.push({ mesh: plane, halo, light, base: lightK, phase: rnd() * 10, dim: 1 });
  }

  function signs(root) {
    sign(root, -1, Tex.led('8.8', '#ff3fb4', 512, 320, 34), 3.4, 2.1, 5.0, -6.4, 0xff3fb4, 1.8);
    sign(root, -1, Tex.led('F:', '#ff3fb4', 256, 640, 12), 1.3, 3.2, 8.4, -8.2, 0xff3fb4, 1.1);
    sign(root, -1, Tex.panel('#38f0ff', 512, 384), 2.4, 1.8, 5.0, -11.5, 0x38f0ff, 1.1);
    sign(root, -1, Tex.led('>>', '#ff8a3d', 256, 128, 14), 1.0, 0.5, 3.2, 1.8, 0xff8a3d, 0.7);
    sign(root, 1, Tex.led('OUT', '#ff9a3a', 256, 768, 12), 1.3, 3.9, 6.8, -4.8, 0xff9a3a, 1.6);
    sign(root, 1, Tex.panel('#3ff0ff', 256, 512), 1.1, 2.2, 7.2, -9.2, 0x3ff0ff, 1.1);
    sign(root, 1, Tex.led('1:45', '#3ff0ff', 512, 256, 26), 2.6, 1.3, 4.9, -2.6, 0x3ff0ff, 1.4);
    sign(root, 1, Tex.led('EAT', '#ff9a3a', 320, 200, 16), 2.4, 1.5, 4.3, -0.6, 0xff9a3a, 1.2);
  }

  // Cables strung across the alley and between the walls, sagging a little
  function cables(root) {
    const m = mat(0x06060a, { roughness: 0.6 });
    for (let i = 0; i < 9; i++) {
      const z = FAR + 3 + i * 4.2 + rnd() * 1.5, side = i % 2 ? 1 : -1;
      const y0 = 8 + rnd() * 3, y1 = 7 + rnd() * 3, sag = 1.2 + rnd() * 1.4;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-HALF - 0.5, y0, z), new THREE.Vector3(0, y1 - sag, z + side * 0.6), new THREE.Vector3(HALF + 0.5, y1, z)]);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 5, false), m));
    }
  }

  // Ground, dumpsters, vending machines, a striped stall, a container, crates, rubble and pipes
  function props(root) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 60), mat(0x10131e, { roughness: 0.85, metalness: 0.05 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -8); root.add(ground);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 60), mat(0x1f2436, { roughness: 0.85, metalness: 0.05 }));
    path.rotation.x = -Math.PI / 2; path.position.set(0, 0.01, -8); root.add(path);

    // Dumpsters: a big grey one in the foreground left, a rust-brown one further back
    const grey = mat(0x34413f), dark = mat(0x1a1d27), rust = mat(0x3a2b26);
    box(root, 1.8, 1.5, 3.4, grey, -6.5, 0.75, 1.8);
    box(root, 1.9, 0.12, 3.5, dark, -6.5, 1.52, 1.8);
    for (let i = 0; i < 3; i++) box(root, 0.2, 0.1, 3.5, dark, -6.9 + i * 0.4, 1.6, 1.8);
    box(root, 1.9, 1.2, 2.4, rust, -6.4, 0.6, -3.2, 0.2);
    box(root, 2.0, 0.1, 2.5, dark, -6.4, 1.22, -3.2, 0.2);
    colliders.push({ x: -6.5, z: 1.8, r: 1.9 }, { x: -6.4, z: -3.2, r: 1.6 });

    // Vending machines: blue on the left, brown with a lit strip on the right
    box(root, 1.0, 2.2, 1.2, mat(0x243c86), -7.5, 1.1, -7.6);
    for (let i = 0; i < 4; i++) box(root, 0.02, 0.04, 0.9, emis(0xff9a4a, 0.5), -8.02, 0.5 + i * 0.5, -7.6);
    box(root, 1.0, 2.2, 1.2, mat(0x4a3424), 7.5, 1.1, -5.2);
    for (let i = 0; i < 4; i++) box(root, 0.02, 0.04, 0.9, emis(0x3ff0ff, 0.6), 8.02, 0.5 + i * 0.5, -5.2);
    colliders.push({ x: -7.5, z: -7.6, r: 0.9 }, { x: 7.5, z: -5.2, r: 0.9 });

    // The stall on the right: a counter with red cloth, under a striped awning on two poles
    box(root, 1.4, 1.1, 2.6, mat(0x33292a), 6.6, 0.55, 0.2);
    box(root, 1.0, 0.06, 1.5, mat(0x9a2330, { roughness: 1 }), 6.6, 1.13, 0.2);
    box(root, 0.25, 0.25, 1.6, mat(0x6b1a24), 5.9, 1.25, 0.2);
    box(root, 0.12, 2.8, 0.12, dark, 5.6, 1.4, -1.3);
    box(root, 0.12, 2.8, 0.12, dark, 5.6, 1.4, 1.7);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 3.4), new THREE.MeshStandardMaterial({ map: Tex.stripes('#b8232f', '#dcdcd6'), roughness: 0.8, flatShading: true }));
    awning.position.set(6.6, 2.85, 0.2); awning.rotation.set(0, 0, -0.1); root.add(awning);
    colliders.push({ x: 6.6, z: 0.2, r: 1.0 });

    // A cyan-lit container in the front right, with a green display panel and a cyan seam
    box(root, 2.2, 1.9, 3.2, mat(0x252c3a, { roughness: 0.7, metalness: 0.2 }), 6.2, 0.95, 6.3, -0.12);
    box(root, 0.04, 0.7, 1.4, emis(0x6dff9a, 1.2), 5.07, 1.2, 6.3, 0);
    box(root, 0.04, 0.12, 2.8, emis(0x3ff0ff, 1.0), 5.07, 0.4, 6.3, 0);
    colliders.push({ x: 6.2, z: 6.3, r: 1.5 });

    // Crates scattered around the path
    const wood = mat(0x5a3f25), dk = mat(0x2e2219);
    for (const [x, z, s] of [[-3.4, 3.6, 0.7], [-3.6, 2.7, 0.6], [4.1, 3.6, 0.7], [4.9, 4.9, 0.6], [-5.2, -5.6, 0.7]]) {
      box(root, s, s, s, wood, x, s / 2, z, rnd() * 0.5);
      box(root, s + 0.04, 0.06, s + 0.04, dk, x, s, z);
      colliders.push({ x, z, r: s * 0.7 });
    }
    // Rubble in front of the dumpster: low rocks
    for (let i = 0; i < 9; i++) {
      const r = 0.16 + rnd() * 0.2, rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat(0x262a36, { roughness: 1 }));
      rock.position.set(-4.4 + rnd() * 1.6, r * 0.5, 1.0 + rnd() * 2.8);
      rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); rock.scale.y = 0.6; root.add(rock);
    }
    // Pipes lying on the ground
    const pm = mat(0x262a36, { roughness: 0.5, metalness: 0.5 });
    pipe(root, 0.26, 2.8, pm, -4.2, -5.6, 0.1);
    pipe(root, 0.28, 3.8, pm, 4.6, 4.2, Math.PI / 2);
    pipe(root, 0.22, 3.0, pm, -3.2, 4.6, 0.8);
  }

  // The far gate: two monoliths and a lintel framing the portal, which glows blue and drifts with particles
  function gate(root) {
    const stone = mat(0x161a28, { roughness: 1 });
    for (const x of [-4.4, 4.4]) {
      box(root, 2.4, 11, 2.4, stone, x, 5.5, FAR + 1);
      box(root, 2.9, 0.6, 2.9, mat(0x1d2234), x, 11.2, FAR + 1);
    }
    box(root, 11.2, 1.8, 2.4, stone, 0, 9.6, FAR + 1);
    box(root, 6.6, 1.4, 2.0, mat(0x1a1f2e), 0, 0.7, FAR + 1.5);            // a dais in front of the portal
    for (const x of [-3.5, 3.5]) box(root, 0.5, 4.8, 0.5, emis(0x2a7bff, 0.9), x, 2.4, FAR + 2.4);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 6.0), new THREE.MeshBasicMaterial({ map: Tex.portal(), toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
    face.material.transparent = true; face.position.set(0, 4.4, FAR + 0.3); root.add(face); portalFace = face;
    portalGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.glow(), color: 0x2a7bff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
    portalGlow.position.set(0, 4.4, FAR + 0.6); portalGlow.scale.set(13, 13, 1); root.add(portalGlow);
    const light = new THREE.PointLight(0x2a7bff, 3.0, 26, 1.4); light.position.set(0, 4.0, FAR + 4); root.add(light); portalLight = light;
    // Particles: square blue pixels drifting up in front of the frame
    const N = 160, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (rnd() - 0.5) * 6; pos[i * 3 + 1] = 1 + rnd() * 6; pos[i * 3 + 2] = FAR + 1 + rnd() * 1.4; vel[i * 3 + 1] = 0.2 + rnd() * 0.4; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    portalDust = new THREE.Points(g, new THREE.PointsMaterial({ map: Tex.pixel(), color: 0x8ff0ff, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    portalDust.userData = { pos, vel };
    root.add(portalDust);
    colliders.push({ x: -4.4, z: FAR + 1, r: 1.4 }, { x: 4.4, z: FAR + 1, r: 1.4 });
  }

  // The glitch hologram: a crude figure made of flat additive slabs that tear sideways and grow spikes as the glitch builds (Act 2)
  function glitchHolo(root) {
    holo = new THREE.Group(); holo.position.set(-4.2, 0, -10.5); holo.rotation.y = 0.5; holo.visible = false; root.add(holo);
    const mk = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const cols = [new THREE.Color(0xff3fb4), new THREE.Color(0x3ff0ff)];
    const parts = [[0, 3.55, 0.5, 0.55, 0.55], [0, 2.85, 0.9, 0.9, 0.35], [0, 2.2, 1.0, 0.9, 0.35], [0, 1.45, 0.6, 1.1, 0.35], [-0.75, 2.6, 0.25, 1.3, 0.25], [0.75, 2.6, 0.25, 1.3, 0.25], [-0.25, 0.6, 0.3, 1.2, 0.3], [0.25, 0.6, 0.3, 1.2, 0.3]];
    holo.userData.slabs = parts.map((p, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p[2], p[3]), mk(cols[i % 2])); m.position.set(p[0], p[1], 0); holo.add(m);
      return { m, x: p[0], y: p[1], ph: i * 1.7 };
    });
    holo.userData.spikes = [];
    for (let i = 0; i < 9; i++) {                                                   // the "too many teeth": thin spikes that only show once it turns monstrous
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7 + (i % 3) * 0.25, 4), mk(cols[(i + 1) % 2]));
      sp.position.set(-0.5 + i * 0.125, 3.45 + (i % 2) * 0.1, 0.08); sp.rotation.z = Math.PI + (i - 4) * 0.25; holo.add(sp); holo.userData.spikes.push(sp);
    }
    // rings that spread from the gate down the alley: the resonance Ruen feels
    const rm = new THREE.MeshBasicMaterial({ color: 0x3ff0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 48), rm.clone()); r.rotation.x = -Math.PI / 2; r.position.set(0, 0.06, FAR + 1); r.visible = false; root.add(r); rings.push({ r, age: -1 });
    }
  }
  const setGlitch = k => { glitchK = Math.max(0, Math.min(1, k)); };
  const setResonance = k => { resonK = Math.max(0, Math.min(1, k)); };
  function updateGlitch(t, dt) {
    if (holo) {
      holo.visible = glitchK > 0.05;
      if (holo.visible) {
        const j = glitchK, hash = n => Math.sin(n * 91.7 + Math.floor(t * 14) * 12.9898) * 43758.5453 % 1;
        for (const sl of holo.userData.slabs) {
          const tear = Math.abs(hash(sl.ph)) > 0.82 - j * 0.3 ? hash(sl.ph + 3) * 0.9 * j : 0;       // a slab jumps sideways in bursts
          sl.m.position.x = sl.x + tear; sl.m.position.y = sl.y + Math.sin(t * 3 + sl.ph) * 0.03;
          sl.m.material.opacity = (0.25 + 0.5 * Math.abs(Math.sin(t * 9 + sl.ph * 2))) * Math.min(1, j * 1.6) * (Math.abs(hash(sl.ph + 7)) > 0.9 ? 0.15 : 1);
          sl.m.scale.set(1 + j * 0.5 * Math.abs(hash(sl.ph + 1)), 1 + j * 0.8 * Math.abs(hash(sl.ph + 2)), 1);
        }
        holo.userData.spikes.forEach((sp, i) => { sp.visible = j > 0.45 && Math.abs(hash(i + 20)) < j; });
        holo.scale.setScalar(1 + (Math.abs(hash(5)) > 0.9 ? 0.25 * j : 0));
      }
    }
    ringT -= dt;
    if (resonK > 0.05 && ringT <= 0) { ringT = 1.5 / (0.5 + resonK); const r = rings.find(q => q.age < 0); if (r) { r.age = 0; r.r.visible = true; } }
    for (const q of rings) if (q.age >= 0) {
      q.age += dt; const u = q.age / 4.5;
      if (u >= 1) { q.age = -1; q.r.visible = false; continue; }
      q.r.scale.setScalar(1 + u * 30); q.r.material.opacity = (1 - u) * 0.55 * Math.min(1, resonK * 2);
    }
  }

  // Builds the alley into the scene and sets its light: low cool ambient, a faint key from above, and the neon doing most of the work
  function build(scene) {
    const root = new THREE.Group(); scene.add(root);
    blocks(root); signs(root); cables(root); props(root); gate(root); glitchHolo(root);
    scene.add(new THREE.AmbientLight(0x1b2338, 0.55));
    scene.add(new THREE.HemisphereLight(0x2a3a60, 0x06060a, 0.35));
    const moon = new THREE.DirectionalLight(0x6a7ac0, 0.22); moon.position.set(-6, 14, 8); scene.add(moon);
    return root;
  }

  // Keeps the signs buzzing and the portal breathing and drifting
  function update(t, dt) {
    updateGlitch(t, dt);
    for (const b of buzzers) {
      // Mostly steady, with the odd stutter as a failing tube does
      const stutter = Math.sin(t * 23 + b.phase * 5) > 0.9995 || Math.sin(t * 7.3 + b.phase) < -0.9985;
      const fail = glitchK > 0 && Math.sin(Math.floor(t * 10) * 3.7 + b.phase * 11) > 1 - glitchK * 0.9;                // under the glitch whole signs cut out in bursts
      const k = stutter || fail ? 0.2 + 0.3 * (b.phase % 1) : 1;
      b.mesh.material.color.setScalar(k * 1.8);   // above 1 so the neon blooms
      b.halo.material.opacity = 0.6 * k;
      b.light.intensity = b.base * (0.9 + 0.1 * Math.sin(t * 2 + b.phase)) * k;
    }
    if (gateK !== gateGoal) {                                                       // the barrier dissolves, and the doorway opens onto the Market
      gateK += Math.sign(gateGoal - gateK) * Math.min(Math.abs(gateGoal - gateK), dt * 0.45);
      portalFace.material.opacity = 1 - gateK; portalFace.visible = gateK < 0.995;
      portalLight.intensity = 3.0 * (1 - 0.75 * gateK); portalDust.material.opacity = 0.9 * (1 - 0.6 * gateK);
    }
    if (portalDust) {
      const { pos, vel } = portalDust.userData;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3] += Math.sin(t * 1.3 + i) * 0.2 * dt;
        if (pos[i * 3 + 1] > 7.5) { pos[i * 3 + 1] = 0.6; pos[i * 3] = (rnd() - 0.5) * 6; }
      }
      portalDust.geometry.attributes.position.needsUpdate = true;
      portalGlow.material.opacity = (0.62 + Math.sin(t * 2.1) * 0.08) * (1 - 0.7 * gateK);
    }
  }

  return { build, update, colliders, HALF, FAR, setGate: open => { gateGoal = open ? 1 : 0; }, gateOpen: () => gateK >= 0.5, setGlitch, setResonance, glitch: () => glitchK };
})();
