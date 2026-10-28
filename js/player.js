// Nexus - the player's avatar, its movement, and the camera.
// Walking: WASD (relative to the view), or a tap / left click on the ground to walk to that spot.
// Looking: drag with one finger or the left mouse button, drag with the right mouse button, or drag with two fingers.
// A tap is a still, quick press; anything that moves is a look. The camera starts on the reference framing and follows the
// avatar gently so the framing holds as it walks.
const Player = (() => {
  const START = { x: -2.4, z: 2.4 };
  const CAM = { x: 1.0, y: 4.2, z: 9.0 }, LOOK = { x: 0.0, y: 1.3, z: -3.5 };   // reference framing
  const WALK = 2.3, RUN = 4.2, FOLLOW = 0.35, ARRIVE = 0.12;
  const TAP_MOVE = 10, TAP_TIME = 450;                                        // px and ms: how still and how quick a tap is
  const keys = {};
  const pos = { x: START.x, z: START.z };
  let heading = Math.PI, speed = 0, yaw = 0, pitch = 0, avatar = null, camera = null, view = null;
  let goal = null, marker = null, frozen = false;
  const pointers = new Map();                                                 // every pointer on the canvas, by id
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
      if (e.code.startsWith('Key')) { keys[e.code.slice(3).toLowerCase()] = true; goal = null; marker.visible = false; }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
      if (e.code.startsWith('Key')) keys[e.code.slice(3).toLowerCase()] = false;
    });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      if (frozen) return;                                                        // a battle or a cutscene owns the camera
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, {
        id: e.pointerId, look: e.pointerType === 'mouse' && e.button === 2,
        x: e.clientX, y: e.clientY, t: performance.now(), moved: 0,
      });
      if (pointers.size >= 2) for (const p of pointers.values()) p.look = true;     // a second finger means look
      document.body.classList.add('played');
    });
    canvas.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY; p.moved += Math.hypot(dx, dy);
      if (!p.look && p.moved > TAP_MOVE) p.look = true;                        // once it moves, it is a drag: look
      if (p.look) {
        const k = pointers.size > 1 ? 0.5 : 1;                                  // two fingers share one look
        yaw = clamp(yaw - dx * 0.006 * k, -1.1, 1.1);
        pitch = clamp(pitch + dy * 0.004 * k, -0.6, 0.8);
      }
    });
    const end = e => {
      const p = pointers.get(e.pointerId); if (!p) return;
      pointers.delete(e.pointerId);
      const tap = !p.look && p.moved < TAP_MOVE && performance.now() - p.t < TAP_TIME && pointers.size === 0;
      if (tap) walkTo(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
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

  // Keeps the avatar inside the alley (or the world beyond its gate) and out of the props. The alley is narrower than the world, and
  // the gate between them is a doorway: the allowed half-width closes in toward it and opens out again on the far side.
  function collide(x, z) {
    const b = City.HALF - 0.9, gz = City.FAR, gate = 3.2;
    const half = z > gz + 6 ? b : z > gz + 2 ? b + (gate - b) * (gz + 6 - z) / 4 : z > gz - 4.5 ? gate : z > gz - 8 ? gate + (World.HALF_X - gate) * (gz - 4.5 - z) / 3.5 : World.HALF_X;
    x = clamp(x, -half, half);
    z = clamp(z, World.MIN_Z, 9);
    for (const c of [...Camp.colliders, ...City.colliders]) {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.35;
      if (d < min && d > 0.0001) { x = c.x + dx / d * min; z = c.z + dz / d * min; }
    }
    if (z < gz + 8) { const w = World.collide(x, z); x = w.x; z = w.z; }
    return { x, z };
  }

  // The camera's ground basis: the view direction flattened onto the ground, and its right-hand side
  function basis() {
    const f = { x: look.x - camPos.x, z: look.z - camPos.z }, d = Math.hypot(f.x, f.z) || 1;
    return { fx: f.x / d, fz: f.z / d, rx: -f.z / d, rz: f.x / d };
  }

  function exploreView() { return { pos: camPos, look }; }
  function rig() { return avatar; }
  // A scripted walk (cutscenes): the avatar walks to (x, z) on its own, then turns to face `heading`. Pass null to hand control back.
  let script = null;
  function scriptTo(x, z, h) { script = x === null ? null : { x, z, h }; if (script) { goal = null; marker.visible = false; } }
  function teleport(x, z) { pos.x = x; pos.z = z; goal = null; marker.visible = false; }     // for scripted placement and debugging
  function setFrozen(on) { frozen = on; if (on) { goal = null; marker.visible = false; for (const k in keys) keys[k] = false; } }

  function update(t, dt) {
    // Camera: the reference pose, eased toward the avatar's walk, turned by the look yaw around the look point
    const away = Math.hypot(pos.x - START.x, pos.z - START.z), fol = FOLLOW + (1 - FOLLOW) * clamp((away - 6) / 14, 0, 1);      // the alley keeps its framing; out in the world the camera follows fully
    look.set(LOOK.x + (pos.x - START.x) * fol, LOOK.y, LOOK.z + (pos.z - START.z) * fol);
    const ox = CAM.x - LOOK.x, oz = CAM.z - LOOK.z;
    camPos.set(look.x + ox * Math.cos(yaw) + oz * Math.sin(yaw), CAM.y - pitch * 2.5, look.z - ox * Math.sin(yaw) + oz * Math.cos(yaw));

    // Direction, in priority: keys, then a tap target. A battle freezes the avatar.
    const b = basis();
    let mx = 0, mz = 0, v = 0, run = !!keys.shift;
    if (!frozen) {
      if (keys.w) { mx += b.fx; mz += b.fz; }
      if (keys.s) { mx -= b.fx; mz -= b.fz; }
      if (keys.d) { mx += b.rx; mz += b.rz; }
      if (keys.a) { mx -= b.rx; mz -= b.rz; }
    }
    if (mx || mz) {
      const m = Math.hypot(mx, mz); mx /= m; mz /= m; v = run ? RUN : WALK;
    } else if (script) {
      const gx = script.x - pos.x, gz = script.z - pos.z, dist = Math.hypot(gx, gz);
      if (dist > 0.08) { mx = gx / dist; mz = gz / dist; v = Math.min(WALK * 1.4, dist * 4 + 0.6); }
      else { heading += Math.atan2(Math.sin(script.h - heading), Math.cos(script.h - heading)) * Math.min(1, dt * 6); }
    } else if (goal && !frozen) {
      const gx = goal.x - pos.x, gz = goal.z - pos.z, dist = Math.hypot(gx, gz);
      if (dist < ARRIVE) { goal = null; marker.visible = false; }
      else { mx = gx / dist; mz = gz / dist; v = WALK; }
    }
    if (v > 0) {
      const next = collide(pos.x + mx * v * dt, pos.z + mz * v * dt);
      pos.x = next.x; pos.z = next.z;
      const target = Math.atan2(mx, mz);
      heading += Math.atan2(Math.sin(target - heading), Math.cos(target - heading)) * Math.min(1, dt * 10);
    }
    speed += (v - speed) * Math.min(1, dt * 8);
    if (marker.visible) marker.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
    // In a battle the avatar is posed and placed by Combat
    if (!avatar.combat) {
      avatar.root.position.set(pos.x, 0, pos.z);
      avatar.root.rotation.y = heading;
      Chars.update(avatar, t, dt, speed);
    }
  }

  function applyCamera(cam) {
    cam.position.copy(camPos);
    cam.lookAt(look);
  }

  function state() { return { x: pos.x, z: pos.z, heading, speed, moving: speed > 0.1 }; }

  return { init, update, applyCamera, state, exploreView, setFrozen, scriptTo, teleport, collidePoint: (x, z) => collide(x, z), rig };
})();
