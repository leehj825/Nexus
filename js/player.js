// Nexus - the player's avatar, its movement, and the camera.
// Walking: WASD (relative to the view), or a tap / left click on the ground to walk to that spot.
// Looking: a third-person camera that orbits the avatar. Drag with one finger or either mouse button to turn it all the way round and
// tilt it, wheel or pinch to zoom, arrow keys to turn. A tap is a still, quick press; anything that moves is a look. The camera stays
// with the avatar wherever it goes and is pulled in when a wall would be in the way.
const Player = (() => {
  const START = { x: -2.4, z: 2.4 };
  const EYE = 1.5, DIST0 = 8, ELEV0 = 0.42, DMIN = 3.2, DMAX = 17, EMIN = 0.1, EMAX = 1.25;     // the orbit: eye height over the feet, start distance and elevation, and their limits
  const WALK = 3.0, RUN = 5.6;                                                 // m/s: a steady walk and a run (run mode is on by default, R or the Run button toggles it)
  const keys = {};
  const pos = { x: START.x, z: START.z };
  let heading = Math.PI, speed = 0, yaw = 0, elev = ELEV0, dist = DIST0, shown = DIST0, avatar = null, camera = null, view = null;
  let frozen = false, runMode = true, stick = { x: 0, y: 0 };                 // stick: the on-screen stick, -1..1 (y up is forward)
  const pointers = new Map();                                                 // every pointer on the canvas, by id
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), tgt = new THREE.Vector3(pos.x, EYE, pos.z); let pinch = 0;
  const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function init(scene, canvas, cam) {
    camera = cam; view = canvas;
    try { runMode = localStorage.getItem('nexus.run') !== '0'; } catch (e) {}
    setRun(runMode); initStick(); document.getElementById('btnRun').addEventListener('click', () => setRun(!runMode));
    avatar = Chars.create('player');
    avatar.root.position.set(pos.x, 0, pos.z);
    avatar.root.rotation.y = heading;
    scene.add(avatar.root);

    window.addEventListener('keydown', e => {
      if (e.code.startsWith('Arrow')) { keys[e.code] = true; if (!frozen) e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
      if (e.code.startsWith('Key')) { keys[e.code.slice(3).toLowerCase()] = true; if (e.code === 'KeyR' && !e.repeat) setRun(!runMode); }
    });
    window.addEventListener('keyup', e => {
      if (e.code.startsWith('Arrow')) keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
      if (e.code.startsWith('Key')) keys[e.code.slice(3).toLowerCase()] = false;
    });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { if (frozen) return; e.preventDefault(); dist = clamp(dist + e.deltaY * 0.01, DMIN, DMAX); }, { passive: false });
    canvas.addEventListener('pointerdown', e => {
      if (frozen) return;                                                        // a battle or a cutscene owns the camera
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, {
        id: e.pointerId, look: true,
        x: e.clientX, y: e.clientY, t: performance.now(), moved: 0,
      });
      if (pointers.size >= 2) for (const p of pointers.values()) p.look = true;     // a second finger means look
      document.body.classList.add('played');
    });
    canvas.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY; p.moved += Math.hypot(dx, dy);
      if (p.look) {
        const k = pointers.size > 1 ? 0.5 : 1;                                  // two fingers share one look
        yaw -= dx * 0.006 * k;
        elev = clamp(elev - dy * 0.004 * k, EMIN, EMAX);
      }
      if (pointers.size === 2) {                                                // a pinch zooms
        const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) dist = clamp(dist - (d - pinch) * 0.02, DMIN, DMAX);
        pinch = d;
      }
    });
    const end = e => {
      const p = pointers.get(e.pointerId); if (!p) return;
      pointers.delete(e.pointerId); pinch = 0;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  // Run mode: on by default; R or the Run button toggles it, and holding Shift swaps it for as long as it is held
  function setRun(on) { runMode = on; try { localStorage.setItem('nexus.run', on ? '1' : '0'); } catch (e) {} const b = document.getElementById('btnRun'); if (b) { b.classList.toggle('on', on); b.title = on ? 'Running (R)' : 'Walking (R)'; } }
  // The on-screen stick: drag the knob; the avatar goes the way it points, relative to the camera, and turns to face it (no strafing)
  function initStick() {
    const el = document.getElementById('stick'); if (!el) return;
    const knob = el.querySelector('i'), R = 46; let pid = null;
    const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (touch) document.body.classList.add('touch');
    const set = (cx, cy) => {
      const r = el.getBoundingClientRect(), dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2), d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
      stick.x = dx * k / R; stick.y = -dy * k / R; knob.style.transform = 'translate(' + (dx * k) + 'px,' + (dy * k) + 'px)';
    };
    el.addEventListener('pointerdown', e => { if (frozen) return; pid = e.pointerId; try { el.setPointerCapture(pid); } catch (err) {} set(e.clientX, e.clientY); document.body.classList.add('played'); e.preventDefault(); });
    el.addEventListener('pointermove', e => { if (e.pointerId === pid) set(e.clientX, e.clientY); });
    const up = e => { if (e.pointerId !== pid) return; pid = null; stick.x = stick.y = 0; knob.style.transform = ''; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    window.addEventListener('blur', () => { pid = null; stick.x = stick.y = 0; knob.style.transform = ''; });
  }

  // Keeps the avatar inside the alley (or the world beyond its gate) and out of the props. The alley is narrower than the world, and
  // the gate between them is a doorway: the allowed half-width closes in toward it and opens out again on the far side.
  function collide(x, z) {
    const b = City.HALF - 0.9, gz = City.FAR, gate = 3.2;
    const half = z > gz + 6 ? b : z > gz + 2 ? b + (gate - b) * (gz + 6 - z) / 4 : z > gz - 4.5 ? gate : z > gz - 8 ? gate + (World.HALF_X - gate) * (gz - 4.5 - z) / 3.5 : World.HALF_X;
    x = clamp(x, -half, half);
    z = clamp(z, World.MIN_Z, 9);
    if (!Combat.alleyCleared()) z = Math.max(z, gz + 3.2);                           // the gate's barrier holds until the husks that guard it are beaten
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
  function scriptTo(x, z, h) { script = x === null ? null : { x, z, h }; }
  function teleport(x, z) { pos.x = x; pos.z = z; }     // for scripted placement and debugging
  function setFrozen(on) { frozen = on; if (on) { stick.x = stick.y = 0; const k = document.querySelector('#stick i'); if (k) k.style.transform = ''; for (const k2 in keys) keys[k2] = false; } }

  // Is a camera at (x, y, z) inside a wall, a building or out of the street? The alley's walls are at +-HALF; the Market's are footprints on the ground
  function camBlocked(x, z, y) {
    if (z > City.FAR - 1) return Math.abs(x) > City.HALF - 0.5;
    return y < 40 && World.blocked(x, z, 0.5);
  }

  function update(t, dt) {
    // Camera: orbits the avatar. The arrow keys turn and tilt it; it keeps the avatar in view and is pulled in when a wall is in the way.
    if (!frozen) { yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 1.8 * dt; elev = clamp(elev + ((keys.ArrowDown ? -1 : 0) + (keys.ArrowUp ? 1 : 0)) * 0.9 * dt, EMIN, EMAX); }
    const k = Math.min(1, dt * 14);
    tgt.x += (pos.x - tgt.x) * k; tgt.z += (pos.z - tgt.z) * k; tgt.y = EYE;
    look.copy(tgt);
    const ce = Math.cos(elev), se = Math.sin(elev), sy = Math.sin(yaw), cy = Math.cos(yaw);
    let room = dist;                                                            // how far back the camera can go before a building is in the way
    for (let d = dist; d >= DMIN * 0.6; d -= 0.5) {
      const cx = tgt.x + sy * ce * d, cz = tgt.z + cy * ce * d;
      if (!camBlocked(cx, cz, tgt.y + se * d)) { room = d; break; }
      room = d - 0.5;
    }
    room = Math.max(1.6, room);
    shown = room < shown ? room : shown + (room - shown) * Math.min(1, dt * 4);     // in at once, out gently
    camPos.set(tgt.x + sy * ce * shown, tgt.y + se * shown, tgt.z + cy * ce * shown);

    // Direction, in priority: keys, then a tap target. A battle freezes the avatar.
    const b = basis();
    let mx = 0, mz = 0, v = 0, run = runMode !== !!keys.shift, power = 1;
    if (!frozen) {
      if (keys.w) { mx += b.fx; mz += b.fz; }
      if (keys.s) { mx -= b.fx; mz -= b.fz; }
      if (keys.d) { mx += b.rx; mz += b.rz; }
      if (keys.a) { mx -= b.rx; mz -= b.rz; }
      if (!(mx || mz)) {                                                      // the stick: its direction and how far it is pushed
        const sm = Math.hypot(stick.x, stick.y);
        if (sm > 0.12) { mx = b.fx * stick.y + b.rx * stick.x; mz = b.fz * stick.y + b.rz * stick.x; power = Math.min(1, sm / 0.85); }
      }
    }
    if (mx || mz) {
      const m = Math.hypot(mx, mz); mx /= m; mz /= m; v = (run ? RUN : WALK) * power;
    } else if (script) {
      const gx = script.x - pos.x, gz = script.z - pos.z, dist = Math.hypot(gx, gz);
      if (dist > 0.08) { mx = gx / dist; mz = gz / dist; v = Math.min(WALK * 1.4, dist * 4 + 0.6); }
      else { heading += Math.atan2(Math.sin(script.h - heading), Math.cos(script.h - heading)) * Math.min(1, dt * 6); }
    }
    if (v > 0) {
      const next = collide(pos.x + mx * v * dt, pos.z + mz * v * dt);
      pos.x = next.x; pos.z = next.z;
      const target = Math.atan2(mx, mz);
      heading += Math.atan2(Math.sin(target - heading), Math.cos(target - heading)) * Math.min(1, dt * 10);
    }
    speed += (v - speed) * Math.min(1, dt * 8);
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

  function faceTowards(x, z) { heading = Math.atan2(x - pos.x, z - pos.z); avatar.root.rotation.y = heading; }
  const getState = () => ({ x: pos.x, z: pos.z, heading, yaw, elev, dist });
  function setState(d) { pos.x = d.x; pos.z = d.z; heading = d.heading; yaw = d.yaw || 0; elev = d.elev || ELEV0; dist = shown = d.dist || DIST0; tgt.set(pos.x, EYE, pos.z); avatar.root.position.set(pos.x, 0, pos.z); avatar.root.rotation.y = heading; }

  function state() { return { x: pos.x, z: pos.z, heading, speed, moving: speed > 0.1 }; }

  return { init, update, applyCamera, state, getState, setState, faceTowards, exploreView, setFrozen, scriptTo, teleport, collidePoint: (x, z) => collide(x, z), rig };
})();
