// Nexus - the player's avatar, its movement, and the camera.
// Walking: WASD (relative to the view), or a click / tap on the ground to walk there. Looking: right-drag with the mouse, or
// drag with one finger. A quick tap is a move; a drag is a look. The camera starts on the reference framing and follows the
// avatar gently so the framing holds as it walks.
const Player = (() => {
  const START = { x: -2.4, z: 2.4 };
  const CAM = { x: 1.0, y: 4.2, z: 9.0 }, LOOK = { x: 0.0, y: 1.3, z: -3.5 };   // reference framing
  const WALK = 2.3, RUN = 4.2, FOLLOW = 0.35, ARRIVE = 0.12;
  const TAP_MOVE = 10, TAP_TIME = 450;                                        // px and ms: how still and how quick a tap is
  const keys = {};
  const pos = { x: START.x, z: START.z };
  let heading = Math.PI, speed = 0, yaw = 0, pitch = 0, avatar = null, camera = null, view = null;
  let goal = null, marker = null;
  let drag = null;                                                            // the pointer currently on the canvas
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();
  const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function init(scene, canvas, cam) {
    camera = cam; view = canvas;
    avatar = Chars.create('player');
    avatar.root.position.set(pos.x, 0, pos.z);
    avatar.root.rotation.y = heading;
    scene.add(avatar.root);

    // The walk target: a flat cyan ring on the ground that pulses until the avatar arrives
    marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24), new THREE.MeshBasicMaterial({ color: 0x3ff0ff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.03; marker.visible = false; scene.add(marker);

    window.addEventListener('keydown', e => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
      if (e.code.startsWith('Key')) { keys[e.code.slice(3).toLowerCase()] = true; goal = null; }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
      if (e.code.startsWith('Key')) keys[e.code.slice(3).toLowerCase()] = false;
    });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

    // The pointer: mouse buttons and touch share one path. Right button or a touch drag looks; left click or a tap walks.
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      canvas.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, type: e.pointerType, button: e.button, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, look: e.pointerType === 'mouse' && e.button === 2 };
      document.body.classList.add('played');
    });
    canvas.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.hypot(dx, dy);
      if (!drag.look && drag.type === 'touch' && drag.moved > TAP_MOVE) drag.look = true;
      if (drag.look) {
        yaw = clamp(yaw - dx * 0.006, -1.1, 1.1);
        pitch = clamp(pitch + dy * 0.004, -0.6, 0.8);
      }
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const tap = !drag.look && drag.moved < TAP_MOVE && performance.now() - drag.t < TAP_TIME;
      drag = null;
      if (tap) walkTo(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', () => { drag = null; });
  }

  // Turns a screen point into a point on the ground and sets it as the walk target
  function walkTo(sx, sy) {
    const r = view.getBoundingClientRect();
    ndc.set((sx - r.left) / r.width * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(ground, hit)) return;
    goal = { x: hit.x, z: hit.z };
    marker.position.set(goal.x, 0.03, goal.z); marker.visible = true;
  }

  // Keeps the avatar inside the alley and out of the props
  function collide(x, z) {
    const b = City.HALF - 0.9;
    x = clamp(x, -b, b);
    z = clamp(z, City.FAR + 4, 9);
    for (const c of [...Camp.colliders, ...City.colliders]) {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.35;
      if (d < min && d > 0.0001) { x = c.x + dx / d * min; z = c.z + dz / d * min; }
    }
    return { x, z };
  }

  // The camera's ground basis: the view direction flattened onto the ground, and its right-hand side
  function basis() {
    const f = { x: look.x - camPos.x, z: look.z - camPos.z }, d = Math.hypot(f.x, f.z) || 1;
    return { fx: f.x / d, fz: f.z / d, rx: -f.z / d, rz: f.x / d };
  }

  function update(t, dt) {
    // Camera: the reference pose, eased toward the avatar's walk, turned by the look yaw around the look point
    look.set(LOOK.x + (pos.x - START.x) * FOLLOW, LOOK.y, LOOK.z + (pos.z - START.z) * FOLLOW);
    const ox = CAM.x - LOOK.x, oz = CAM.z - LOOK.z;
    camPos.set(look.x + ox * Math.cos(yaw) + oz * Math.sin(yaw), CAM.y - pitch * 2.5, look.z - ox * Math.sin(yaw) + oz * Math.cos(yaw));

    // Direction: keys win over a tap target; a tap target is walked to, then cleared
    const b = basis();
    let mx = 0, mz = 0;
    if (keys.w) { mx += b.fx; mz += b.fz; }
    if (keys.s) { mx -= b.fx; mz -= b.fz; }
    if (keys.d) { mx += b.rx; mz += b.rz; }
    if (keys.a) { mx -= b.rx; mz -= b.rz; }
    let run = !!keys.shift;
    if (!mx && !mz && goal) {
      const gx = goal.x - pos.x, gz = goal.z - pos.z, dist = Math.hypot(gx, gz);
      if (dist < ARRIVE) { goal = null; marker.visible = false; }
      else { mx = gx / dist; mz = gz / dist; run = false; }
    }
    const m = Math.hypot(mx, mz);
    const v = m > 0 ? (run ? RUN : WALK) : 0;
    if (m > 0) {
      mx /= m; mz /= m;
      const next = collide(pos.x + mx * v * dt, pos.z + mz * v * dt);
      pos.x = next.x; pos.z = next.z;
      const target = Math.atan2(mx, mz);
      heading += Math.atan2(Math.sin(target - heading), Math.cos(target - heading)) * Math.min(1, dt * 10);
    }
    speed += (v - speed) * Math.min(1, dt * 8);
    if (marker.visible) marker.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
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
