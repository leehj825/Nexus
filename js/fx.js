// Nexus - attack effects: sparks, impact rings, projectiles with trails, Ruen's data nova, Kyle's shield, pixel dissolves.
// Everything is additive sprites and a few flat rings, pooled and recycled, so a battle costs almost nothing to draw.
const FX = (() => {
  let scene = null;
  const live = [], pool = { glow: [], pixel: [] };
  const v = new THREE.Vector3();
  const rand = (a, b) => a + Math.random() * (b - a);

  function sprite(kind) {
    const s = pool[kind].pop() || new THREE.Sprite(new THREE.SpriteMaterial({ map: kind === 'glow' ? Tex.glow() : Tex.pixel(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    s.userData.kind = kind; s.visible = true; scene.add(s); return s;
  }
  function free(o) { scene.remove(o); if (o.isSprite) { o.visible = false; pool[o.userData.kind].push(o); } else { o.geometry !== ringGeo && o.geometry.dispose(); o.material.dispose(); } }
  const ringGeo = new THREE.RingGeometry(0.92, 1, 40);

  // A small thing that moves, grows and fades: the base of every effect. p: { pos, vel, grav, life, size0, size1, color, kind, drag }
  function particle(p) {
    const s = sprite(p.kind || 'glow'); s.position.copy(p.pos); s.material.color.set(p.color); s.material.opacity = 1; s.scale.setScalar(p.size0);
    live.push({ o: s, vel: p.vel || new THREE.Vector3(), grav: p.grav || 0, life: p.life, age: 0, s0: p.size0, s1: p.size1 === undefined ? p.size0 : p.size1, drag: p.drag || 0, fade: p.fade === undefined ? 1 : p.fade });
  }
  function init(s) { scene = s; }

  // Sparks and a flash where something is hit; heavy hits throw more
  function hit(pos, color, heavy) {
    if (!scene) return;
    const c = new THREE.Color(color), n = heavy ? 22 : 12;
    particle({ pos: v.copy(pos).setY(pos.y), color: 0xffffff, size0: heavy ? 1.8 : 1.1, size1: 0.1, life: 0.16 });
    for (let i = 0; i < n; i++) particle({ pos: pos.clone(), vel: new THREE.Vector3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(2.2, heavy ? 6.5 : 4.5)), grav: -7, color: i % 3 ? c : 0xffffff, size0: rand(0.12, 0.24), size1: 0.02, life: rand(0.3, 0.6), kind: 'pixel' });
    ring(pos, color, 0.2, heavy ? 2.2 : 1.5, 0.28, pos.y);
  }
  // A ring on the ground (or at height y) that spreads and fades
  function ring(pos, color, r0, r1, dur, y = 0.06) {
    if (!scene) return;
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, Math.max(0.06, y > 0.5 ? 0.06 : y), pos.z); m.scale.setScalar(r0); scene.add(m);
    live.push({ o: m, vel: new THREE.Vector3(), grav: 0, life: dur, age: 0, s0: r0, s1: r1, drag: 0, fade: 1, ring: true });
  }
  // A bolt flying from one point to another with a trail; cb runs on arrival
  function proj(from, to, color, dur, cb, size = 0.7) {
    if (!scene) { if (cb) cb(); return; }
    const head = sprite('glow'); head.material.color.set(color); head.scale.setScalar(size); head.position.copy(from);
    const trail = []; for (let i = 0; i < 5; i++) { const t = sprite('glow'); t.material.color.set(color); t.scale.setScalar(size * (0.8 - i * 0.14)); t.position.copy(from); trail.push(t); }
    live.push({ proj: true, head, trail, from: from.clone(), to: to.clone(), dur, age: 0, cb, o: head, life: dur, s0: size, s1: size, vel: new THREE.Vector3(), grav: 0, drag: 0, fade: 0 });
  }
  // Ruen's data nova: a sphere of light that swells and fades, rings, and pixels of data rising from the ground
  function nova(pos, color = 0x7fe9ff) {
    if (!scene) return;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.set(pos.x, 1.2, pos.z); scene.add(m); live.push({ o: m, vel: new THREE.Vector3(), grav: 0, life: 0.7, age: 0, s0: 0.3, s1: 5.2, drag: 0, fade: 1 });
    ring(pos, color, 0.4, 7, 0.7); ring(pos, 0xffffff, 0.2, 4.5, 0.45);
    for (let i = 0; i < 40; i++) { const a = rand(0, 6.28), r = rand(0.3, 3.5); particle({ pos: new THREE.Vector3(pos.x + Math.cos(a) * r, 0.1, pos.z + Math.sin(a) * r), vel: new THREE.Vector3(0, rand(1.5, 5), 0), color: i % 2 ? color : 0xffffff, size0: rand(0.1, 0.22), size1: 0.04, life: rand(0.6, 1.2), kind: 'pixel' }); }
    particle({ pos: new THREE.Vector3(pos.x, 1.2, pos.z), color: 0xffffff, size0: 3, size1: 9, life: 0.3 });
  }
  // Kyle's shield: a cyan dome that blinks in round him, and a ring
  function shield(pos, color = 0x3ff0ff) {
    if (!scene) return;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, wireframe: true }));
    m.position.set(pos.x, 1.0, pos.z); scene.add(m); live.push({ o: m, vel: new THREE.Vector3(), grav: 0, life: 0.7, age: 0, s0: 1.2, s1: 1.9, drag: 0, fade: 1 });
    particle({ pos: new THREE.Vector3(pos.x, 1.0, pos.z), color, size0: 2.5, size1: 3.6, life: 0.35 });
    ring(pos, color, 0.5, 2.4, 0.5);
  }
  // A husk coming apart into rising pixels
  function dissolve(pos, color = 0xff3fb4) {
    if (!scene) return;
    for (let i = 0; i < 36; i++) particle({ pos: new THREE.Vector3(pos.x + rand(-0.4, 0.4), rand(0.1, 1.8), pos.z + rand(-0.4, 0.4)), vel: new THREE.Vector3(rand(-0.3, 0.3), rand(0.8, 2.6), rand(-0.3, 0.3)), color: i % 3 ? color : 0xffffff, size0: rand(0.1, 0.2), size1: 0.03, life: rand(0.7, 1.4), kind: 'pixel' });
  }
  // A glow gathering round a caster
  function charge(pos, color = 0xc9a0ff) {
    for (let i = 0; i < 18; i++) { const a = rand(0, 6.28), r = rand(1.4, 2.2); particle({ pos: new THREE.Vector3(pos.x + Math.cos(a) * r, rand(0.2, 1.6), pos.z + Math.sin(a) * r), vel: new THREE.Vector3(-Math.cos(a) * r * 1.6, 0.4, -Math.sin(a) * r * 1.6), color, size0: 0.2, size1: 0.05, life: 0.6, kind: 'pixel' }); }
    ring(pos, color, 2.2, 0.3, 0.6);
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i]; e.age += dt;
      if (e.proj) {
        const u = Math.min(1, e.age / e.dur); e.head.position.lerpVectors(e.from, e.to, u);
        e.trail.forEach((t, k) => { const uu = Math.max(0, u - (k + 1) * 0.07); t.position.lerpVectors(e.from, e.to, uu); t.material.opacity = (1 - k / 5) * 0.8; });
        if (u >= 1) { free(e.head); e.trail.forEach(free); live.splice(i, 1); if (e.cb) e.cb(); }
        continue;
      }
      const u = e.age / e.life;
      if (u >= 1) { free(e.o); live.splice(i, 1); continue; }
      e.o.position.addScaledVector(e.vel, dt); e.vel.y += e.grav * dt; if (e.drag) e.vel.multiplyScalar(1 - e.drag * dt);
      e.o.scale.setScalar(e.s0 + (e.s1 - e.s0) * (e.ring ? u : u));
      if (e.fade) e.o.material.opacity = (e.o.material.userData && e.o.material.userData.base || 1) * (1 - u * u) * (e.o.isMesh ? 0.9 : 1);
    }
  }

  return { init, update, hit, ring, proj, nova, shield, dissolve, charge, count: () => live.length };
})();
