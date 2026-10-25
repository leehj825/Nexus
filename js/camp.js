// Nexus - the fire at the heart of the scene: a burning oil drum with the crew sat around it, and the embers it throws up.
// The drum sits at the origin; everything else is placed relative to it, facing it.
const Camp = (() => {
  const crew = [];                                   // { name, rig }, updated each frame
  const colliders = [];                              // circles the player walks around
  let flames = [], embers = null, fireLight = null, fireGlow = null, glowBase = null;

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
    fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.glow(), color: 0xff7a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85, toneMapped: false }));
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

  function build(scene) {
    const root = new THREE.Group(); scene.add(root);
    drum(root);
    emberField(root);
    for (const s of SEATS) {
      const rig = Chars.create(s.who);
      rig.seatH = s.h;
      seat(root, s, rig);
      crew.push({ name: s.who, rig });
    }
    // The bystander on the right of the stall, standing a little apart from the fire
    const stranger = Chars.create('stranger');
    stranger.root.position.set(6.4, 0, -3.8); faceFire(stranger.root, 6.4, -3.8);
    stranger.root.rotation.y += 0.35; root.add(stranger.root);
    crew.push({ name: 'stranger', rig: stranger });
    colliders.push({ x: 6.4, z: -3.8, r: 0.45 });
    return root;
  }

  // Flicker the flames and the light, rise the embers, and pose the crew
  function update(t, dt) {
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
    for (const c of crew) Chars.update(c.rig, t, dt, 0);
  }

  return { build, update, crew, colliders, SEATS };
})();
