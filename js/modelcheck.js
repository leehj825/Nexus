// Nexus - Model Check: a viewer, opened from the settings (gear) button, for confirming how the characters move.
// It builds its own small stage (floor grid, lights, orbit camera) and its own copy of every rig, then plays any motion-capture clip,
// the seated pose, a walk or a run on one character or on all of them side by side. The game is paused behind it.
// Controls: pick a character (or All), pick a clip, play / pause / scrub, slow it down, loop it, show the joints, show the wireframe,
// or let the tour run through every move in turn. Drag to orbit, wheel to zoom, double-click to reset the camera.
const ModelCheck = (() => {
  const $ = id => document.getElementById(id);
  const KINDS = [['ruen', 'Ruen'], ['kyle', 'Kyle'], ['yuna', 'Yuna'], ['ranger', 'Ranger'], ['player', 'Jin'], ['stranger', 'Stranger'], ['husk', 'Husk'], ['brute', 'Husk Brute'], ['loader', 'Loader Mech'], ['enforcer', 'Enforcer'], ['drone', 'Sentry Drone'], ['seraph', 'Seraph Drone'], ['ceo', 'The CEO']];
  const SPECIAL = [['@seat', 'Seated pose'], ['@walk', 'Walk (locomotion)'], ['@run', 'Run (locomotion)']];
  // The clips, grouped for the list: first matching rule wins
  const GROUPS = [
    ['Idle & rest', /^(idle|kneel|seatWork|pullPlant|plant)/], ['Magic', /^mg/], ['Greatsword', /^gs/], ['Brawl', /^brawl/],
    ['Locomotion', /^(walk|run|strafe)/], ['Combat', /^(attack|slash|kick|block|impact|die|dive|dodge|shoot)/],
  ];
  // The tour: a short run through the moves the game uses
  const TOUR = ['@seat', 'idleEase', '@walk', '@run', 'mgIdle', 'brawlPunch', 'brawlSwipe', 'block', 'impact', 'mgBolt', 'mgNova', 'mgHoly', 'die'];
  const PARENT = { torso: 'hips', head: 'torso', hipL: 'hips', kneeL: 'hipL', ankL: 'kneeL', hipR: 'hips', kneeR: 'hipR', ankR: 'kneeR',
    shL: 'torso', elL: 'shL', wrL: 'elL', shR: 'torso', elR: 'shR', wrR: 'elR' };

  let scene = null, camera = null, rigs = null, open = false, built = false;
  let who = 'all', sel = '@seat', t = 0, paused = false, loop = true, speed = 1, tour = false, tourAt = 0, wire = false, bones = false;
  let yaw = 0.5, pitch = 0.2, dist = 5.5, fresh = true;
  const target = new THREE.Vector3(0, 0.9, 0), tmp = new THREE.Vector3();

  function stage() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1c);
    scene.add(new THREE.HemisphereLight(0x9fb8ff, 0x261c16, 1.0));
    const key = new THREE.DirectionalLight(0xfff0dc, 1.1); key.position.set(3, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x3ff0ff, 0.8); rim.position.set(-4, 3, -4); scene.add(rim);
    const grid = new THREE.GridHelper(16, 32, 0x3ff0ff, 0x1f3040); grid.material.transparent = true; grid.material.opacity = 0.5; scene.add(grid);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.MeshBasicMaterial({ color: 0x0d1424 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.005; scene.add(floor);
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  }

  // One rig per character, each with a line-set that draws its joints
  function build() {
    stage();
    rigs = [];
    for (const [kind, label] of KINDS) {
      const rig = Chars.create(kind); scene.add(rig.root);
      // Drawn as a person's skeleton: the collar bones run from the neck joint out to each shoulder, the spine from the pelvis
      // up through the waist to the neck (in the rig the shoulders hang off the waist joint, which is only how they are driven)
      const pairs = []; for (const k in rig.j) pairs.push([k, k === 'shL' || k === 'shR' ? 'head' : PARENT[k]]);
      pairs.push(['@top', 'head']);                                    // the head bone runs up to the top of the head
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pairs.length * 6), 3));
      const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffd24a, depthTest: false, transparent: true }));
      lines.renderOrder = 10; lines.frustumCulled = false; lines.visible = false; scene.add(lines);
      const dots = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xff4a8a, size: 7, sizeAttenuation: false, depthTest: false }));
      dots.renderOrder = 11; dots.frustumCulled = false; dots.visible = false; scene.add(dots);
      rigs.push({ kind, label, rig, pairs, lines, dots, home: { kind: rig.kind, seatH: rig.seatH } });
    }
    built = true;
  }

  const clipNames = () => Object.keys(Mocap.clips).sort();
  function groupOf(name) { for (const [g, re] of GROUPS) if (re.test(name)) return g; return 'Other'; }

  function layout() {
    const shown = rigs.filter(r => who === 'all' || r.kind === who);
    rigs.forEach(r => { r.rig.root.visible = shown.includes(r); r.lines.visible = r.dots.visible = bones && r.rig.root.visible; });
    shown.forEach((r, i) => { r.rig.root.position.set((i - (shown.length - 1) / 2) * 1.5, 0, 0); r.rig.root.rotation.y = 0; });
    if (fresh) { dist = shown.length > 4 ? 10 : shown.length > 1 ? 7.5 : 4.2; fresh = false; }
    target.set(0, 0.9, 0);
  }

  // Starts the selected motion on every shown rig (a clip, the seated pose, or a locomotion cycle)
  function start() {
    t = 0;
    for (const r of rigs) {
      const c = r.rig; c.clip = null; c.walkT = 0;
      c.kind = r.home.kind === 'seated' && sel !== '@seat' && sel !== '@none' ? 'stand' : r.home.kind;
      if (sel === '@seat') { c.kind = 'seated'; c.seatH = c.seatH || 0.62; }
      else if (sel.charAt(0) !== '@') { c.kind = 'stand'; Chars.play(c, sel, !loop); }
      else c.kind = 'stand';
    }
    updateInfo();
  }

  function pose(dt) {
    const clip = sel.charAt(0) === '@' ? null : Mocap.clips[sel];
    t += dt;
    for (const r of rigs) {
      if (!r.rig.root.visible) continue;
      const c = r.rig, sp = sel === '@walk' ? 1.6 : sel === '@run' ? 4.5 : 0;
      if (clip && !c.clip && loop) Chars.play(c, sel);               // a one-shot that has finished starts again
      if (clip && c.clip && paused) c.clip.t = Math.min(c.clip.t, clip.d);
      Chars.update(c, t, dt, sp);
      if (bones) skeleton(r);
    }
  }

  function skeleton(r) {
    r.rig.root.updateMatrixWorld(true);
    const a = r.lines.geometry.attributes.position.array; let i = 0;
    for (const [k, p] of r.pairs) {
      if (k === '@top') { const o = r.rig.headTop || [0, 0.4, 0]; tmp.set(o[0], o[1], o[2]); r.rig.head.localToWorld(tmp); }
      else (r.rig.j[k]).getWorldPosition(tmp);
      a[i++] = tmp.x; a[i++] = tmp.y; a[i++] = tmp.z;
      (p === 'hips' ? r.rig.hips : r.rig.j[p]).getWorldPosition(tmp); a[i++] = tmp.x; a[i++] = tmp.y; a[i++] = tmp.z;
    }
    r.lines.geometry.attributes.position.needsUpdate = true;
  }

  function setWire(on) {
    wire = on;
    for (const r of rigs) r.rig.root.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.wireframe = on; } });
  }

  // ------------------------------- the panel -------------------------------
  function chips(box, items, active, pick) {
    box.textContent = '';
    for (const [id, label] of items) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.id = id;
      b.classList.toggle('on', id === active); b.addEventListener('click', () => pick(id)); box.append(b);
    }
  }
  function renderWho() { chips($('mcWho'), [['all', 'All'], ...KINDS], who, id => { who = id; fresh = true; layout(); start(); renderWho(); }); }
  function renderList() {
    const box = $('mcClips'), q = $('mcFilter').value.trim().toLowerCase();
    box.textContent = '';
    const groups = { 'Special': SPECIAL };
    for (const n of clipNames()) (groups[groupOf(n)] = groups[groupOf(n)] || []).push([n, n]);
    for (const g of Object.keys(groups)) {
      const items = groups[g].filter(([id, label]) => !q || label.toLowerCase().includes(q));
      if (!items.length) continue;
      const h = document.createElement('div'); h.className = 'mc-h'; h.textContent = g; box.append(h);
      const row = document.createElement('div'); row.className = 'mc-row'; box.append(row);
      chips(row, items, sel, id => { sel = id; tour = false; $('mcTour').classList.remove('on'); start(); renderList(); });
    }
  }
  function updateInfo() {
    const c = rigs && rigs.find(r => r.rig.root.visible);
    const clip = sel.charAt(0) === '@' ? null : Mocap.clips[sel];
    $('mcName').textContent = (SPECIAL.find(s => s[0] === sel) || [0, sel])[1];
    if (clip) { const ct = c && c.rig.clip ? c.rig.clip.t : 0; $('mcTime').textContent = ct.toFixed(2) + ' / ' + clip.d.toFixed(2) + ' s  ·  ' + Math.round(clip.n) + ' frames' + (clip.loop ? '  ·  loops' : ''); $('mcScrub').max = clip.d; $('mcScrub').value = Math.min(ct, clip.d); $('mcScrub').disabled = false; }
    else { $('mcTime').textContent = sel === '@seat' ? 'hand-posed, breathing' : 'looping cycle'; $('mcScrub').disabled = true; }
  }

  function wirePanel() {
    $('mcClose').addEventListener('click', close);
    $('mcPlay').addEventListener('click', () => { paused = !paused; $('mcPlay').textContent = paused ? '▶ Play' : '❚❚ Pause'; });
    $('mcRestart').addEventListener('click', start);
    $('mcLoop').addEventListener('change', e => { loop = e.target.checked; start(); });
    $('mcSpeed').addEventListener('input', e => { speed = +e.target.value; $('mcSpeedV').textContent = speed.toFixed(2) + '×'; });
    $('mcBones').addEventListener('change', e => { bones = e.target.checked; for (const r of rigs) r.lines.visible = r.dots.visible = bones && r.rig.root.visible; });
    $('mcWire').addEventListener('change', e => setWire(e.target.checked));
    $('mcFilter').addEventListener('input', renderList);
    $('mcTour').addEventListener('click', () => { tour = !tour; $('mcTour').classList.toggle('on', tour); if (tour) { tourAt = 0; sel = TOUR[0]; start(); renderList(); } });
    $('mcScrub').addEventListener('input', e => {
      paused = true; $('mcPlay').textContent = '▶ Play';
      for (const r of rigs) if (r.rig.root.visible) { if (!r.rig.clip) Chars.play(r.rig, sel, true); r.rig.clip.t = +e.target.value; r.rig.clip.hold = true; }
    });
    // Camera: one finger (or the left mouse button) orbits; two fingers pinch to zoom and drag to pan; the wheel zooms; a right or
    // middle mouse drag, or shift + drag, pans too
    const st = $('mcStage'), ptr = new Map(); let two = null;
    const pan = (dx, dy) => {                                          // screen pixels -> a move of the look-at point, in the camera's own right / up
      const k = dist * 2 * Math.tan(camera.fov * Math.PI / 360) / window.innerHeight;
      camera.updateMatrixWorld(); const r = tmp.setFromMatrixColumn(camera.matrixWorld, 0), u = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      target.addScaledVector(r, -dx * k).addScaledVector(u, dy * k); target.y = Math.max(-0.5, Math.min(2.5, target.y));
    };
    const pair = () => { const [a, b] = [...ptr.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    st.addEventListener('contextmenu', e => e.preventDefault());
    st.addEventListener('pointerdown', e => {
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, btn: e.button, shift: e.shiftKey }); try { st.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic or already-ended pointer */ }
      two = ptr.size === 2 ? pair() : null;
    });
    st.addEventListener('pointermove', e => {
      const p = ptr.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (ptr.size === 2) {
        p.x = e.clientX; p.y = e.clientY; const n = pair();
        if (two) { dist = Math.max(1.0, Math.min(16, dist * two.d / Math.max(n.d, 1))); pan(n.x - two.x, n.y - two.y); }
        two = n;
      } else if (ptr.size === 1) {
        p.x = e.clientX; p.y = e.clientY;
        if (p.btn === 2 || p.btn === 1 || p.shift) pan(dx, dy);
        else { yaw -= dx * 0.008; pitch = Math.max(-0.2, Math.min(1.3, pitch + dy * 0.006)); }
      }
    });
    const resetView = () => { yaw = 0.5; pitch = 0.2; fresh = true; layout(); };
    let lastTap = 0, moved = 0;
    const lift = e => {
      const p = ptr.get(e.pointerId); ptr.delete(e.pointerId); two = ptr.size === 2 ? pair() : null;
      if (e.pointerType === 'touch' && ptr.size === 0 && p && e.type === 'pointerup') {         // a quick second tap resets the view
        const now = performance.now(); if (now - lastTap < 320 && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 20) { resetView(); lastTap = 0; } else lastTap = now;
      }
    };
    st.addEventListener('pointerup', lift); st.addEventListener('pointercancel', lift);
    st.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(1.0, Math.min(16, dist * (1 + e.deltaY * 0.001))); }, { passive: false });
    st.addEventListener('dblclick', resetView);
  }

  let wired = false;
  function show() {
    if (!built) build();
    if (!wired) { wirePanel(); wired = true; }
    open = true; $('mcheck').hidden = false; document.body.classList.add('mcheck');
    layout(); renderWho(); renderList(); start();
  }
  function close() { open = false; $('mcheck').hidden = true; document.body.classList.remove('mcheck'); }

  function update(dt) {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h; camera.fov = h > w ? 55 : 40; camera.updateProjectionMatrix();
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(target);
    pose(paused ? 0 : dt * speed);
    if (tour && !paused) {
      const clip = sel.charAt(0) === '@' ? null : Mocap.clips[sel], len = clip ? clip.d : 3.5;
      if (t > Math.min(len, 5) + 0.3) { tourAt = (tourAt + 1) % TOUR.length; sel = TOUR[tourAt]; start(); renderList(); }
    }
    updateInfo();
  }

  function init() {
    $('btnSettings').addEventListener('click', () => { $('settings').hidden = false; });
    $('settingsClose').addEventListener('click', () => { $('settings').hidden = true; });
    const sync = () => { $('setMusic').textContent = Sound.music ? 'On' : 'Off'; $('setSfx').textContent = Sound.fx ? 'On' : 'Off'; };
    $('setMusic').addEventListener('click', () => { Sound.setMusic(!Sound.music); sync(); });
    $('setSfx').addEventListener('click', () => { Sound.setSfx(!Sound.fx); sync(); });
    const QN = { auto: 'Auto', high: 'High', low: 'Low' };
    const syncQ = () => { $('setQuality').textContent = QN[Perf.mode()] + (Perf.mode() === 'auto' ? ' (' + Perf.name() + ')' : ''); $('setDebug').textContent = Perf.debug() ? 'On' : 'Off'; };
    $('setQuality').addEventListener('click', () => { Perf.setMode({ auto: 'high', high: 'low', low: 'auto' }[Perf.mode()]); syncQ(); });
    $('setDebug').addEventListener('click', () => { Perf.setDebug(!Perf.debug()); syncQ(); });
    const syncD = () => { $('setDiff').textContent = Combat.DIFF[Combat.difficulty()].name; };
    $('setDiff').addEventListener('click', () => { Combat.setDifficulty({ easy: 'normal', normal: 'hard', hard: 'easy' }[Combat.difficulty()]); syncD(); });
    $('btnSettings').addEventListener('click', syncD); syncD();
    $('setSave').addEventListener('click', () => { const ok = Save.save(); $('setSave').textContent = ok ? 'Saved' : 'Not now'; setTimeout(() => { $('setSave').textContent = 'Save now'; }, 1500); });
    $('btnSettings').addEventListener('click', () => { sync(); syncQ(); }); sync(); syncQ();
    $('openModelCheck').addEventListener('click', () => { $('settings').hidden = true; show(); });
  }

  return { init, update, isOpen: () => open, get scene() { return scene; }, get camera() { return camera; } };
})();
