// Nexus - the player's avatar and the camera. The camera starts on the reference framing: it looks down the alley at the fire
// with the avatar in the lower left. WASD walks relative to where the camera looks; mouse look swings the view around the
// avatar while the pointer is locked. The camera gently follows the avatar so the framing holds as they walk.
const Player = (() => {
  const START = { x: -2.4, z: 2.4 };
  const CAM = { x: 1.0, y: 4.2, z: 9.0 }, LOOK = { x: 0.0, y: 1.3, z: -3.5 };   // reference framing
  const WALK = 2.3, RUN = 4.2, FOLLOW = 0.35;
  const keys = {};
  const pos = { x: START.x, z: START.z };
  let heading = Math.PI, speed = 0, yaw = 0, pitch = 0, avatar = null, locked = false;
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();

  function init(scene, canvas) {
    avatar = Chars.create('player');
    avatar.root.position.set(pos.x, 0, pos.z);
    avatar.root.rotation.y = heading;
    scene.add(avatar.root);
    window.addEventListener('keydown', e => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
      if (e.code.startsWith('Key')) keys[e.code.slice(3).toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
      if (e.code.startsWith('Key')) keys[e.code.slice(3).toLowerCase()] = false;
    });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    canvas.addEventListener('click', () => { if (!locked) canvas.requestPointerLock(); });
    document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; document.body.classList.toggle('locked', locked); });
    document.addEventListener('mousemove', e => {
      if (!locked) return;
      yaw = Math.max(-1.1, Math.min(1.1, yaw - e.movementX * 0.0025));
      pitch = Math.max(-0.6, Math.min(0.8, pitch + e.movementY * 0.002));
    });
  }

  // Keeps the avatar inside the alley and out of the props
  function collide(x, z) {
    const b = City.HALF - 0.9;
    x = Math.max(-b, Math.min(b, x));
    z = Math.max(City.FAR + 4, Math.min(9, z));
    for (const c of [...Camp.colliders, ...City.colliders]) {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.35;
      if (d < min && d > 0.0001) { x = c.x + dx / d * min; z = c.z + dz / d * min; }
    }
    return { x, z };
  }

  // The camera's basis: the view direction flattened onto the ground, from the camera's current yaw
  function basis() {
    const f = { x: look.x - camPos.x, z: look.z - camPos.z }, d = Math.hypot(f.x, f.z) || 1;
    return { fx: f.x / d, fz: f.z / d, rx: -f.z / d, rz: f.x / d };
  }

  function update(t, dt) {
    // Camera: the reference pose, eased toward the avatar's walk, turned by mouse yaw around the look point
    const fx = (pos.x - START.x) * FOLLOW, fz = (pos.z - START.z) * FOLLOW;
    look.set(LOOK.x + fx, LOOK.y, LOOK.z + fz);
    const ox = CAM.x - LOOK.x, oz = CAM.z - LOOK.z;
    camPos.set(look.x + ox * Math.cos(yaw) + oz * Math.sin(yaw), CAM.y - pitch * 2.5, look.z - ox * Math.sin(yaw) + oz * Math.cos(yaw));

    // Walking: W/S along the view, A/D across it
    const b = basis();
    let mx = 0, mz = 0;
    if (keys.w) { mx += b.fx; mz += b.fz; }
    if (keys.s) { mx -= b.fx; mz -= b.fz; }
    if (keys.d) { mx += b.rx; mz += b.rz; }
    if (keys.a) { mx -= b.rx; mz -= b.rz; }
    const m = Math.hypot(mx, mz);
    const v = m > 0 ? (keys.shift ? RUN : WALK) : 0;
    if (m > 0) {
      mx /= m; mz /= m;
      const next = collide(pos.x + mx * v * dt, pos.z + mz * v * dt);
      pos.x = next.x; pos.z = next.z;
      const target = Math.atan2(mx, mz);
      heading += Math.atan2(Math.sin(target - heading), Math.cos(target - heading)) * Math.min(1, dt * 10);
    }
    speed += (v - speed) * Math.min(1, dt * 8);
    avatar.root.position.set(pos.x, 0, pos.z);
    avatar.root.rotation.y = heading;
    Chars.update(avatar, t, dt, speed);
  }

  function applyCamera(cam) {
    cam.position.copy(camPos);
    cam.lookAt(look);
  }

  function state() { return { x: pos.x, z: pos.z, heading, speed, moving: speed > 0.1 }; }

  return { init, update, applyCamera, state };
})();
