// Nexus - entry point: the renderer, the lit alley with the fire and the crew, the player camera and the HUD, in one loop.
// The frame goes through a small post chain: scene -> bloom (the neon, the fire and the portal glow) -> gamma to sRGB.
(() => {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  // The composer works in linear light, and the last pass encodes to sRGB, so the renderer itself stays linear
  renderer.outputEncoding = THREE.LinearEncoding;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b14);
  scene.fog = new THREE.FogExp2(0x070b16, 0.03);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);

  const composer = new THREE.EffectComposer(renderer);
  const renderPass = new THREE.RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.4, 0.75);   // strength, radius, threshold
  composer.addPass(bloom);
  composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));

  City.build(scene);
  Camp.build(scene);
  World.init(scene);
  FX.init(scene);
  Player.init(scene, canvas, camera);
  HUD.init();
  Combat.init(scene, camera);
  CampUI.init();
  CrewUI.init();
  ShopUI.init();
  ModelCheck.init();
  Cutscene.init();
  // Saving: each part of the game registers what it keeps; the world goes first and the player last, so the avatar lands in a loaded world
  let gateWas = false, gateFirst = true;
  Save.init();
  Save.register('world', World.getState, World.setState);
  Save.register('combat', Combat.getState, d => { Combat.setState(d); gateFirst = true; });   // gateWatch sets the gate on the next frame, once the story is loaded too
  Save.register('camp', Camp.getState, Camp.setState);
  Save.register('items', Items.getState, Items.setState);
  Save.register('quests', Quests.getState, Quests.setState);
  Save.register('growth', Growth.getState, d => { Growth.setState(d); Combat.refreshAll(false); });
  Save.register('story', () => ({ stage: Cutscene.stage() }), d => Cutscene.restore(d.stage));
  Save.register('player', Player.getState, d => { Player.setState(d); Camp.restoreCrew(Player.state()); });
  Title.init(() => {});
  window.nexus = { state: () => Player.state(), scene, camera, renderer };          // read-only hook for debugging and automated checks

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    // Phones get a lower pixel ratio: the bloom is the costly part, and it reads the same at 1.5x
    const pr = Math.min(window.devicePixelRatio, h > w ? 1.5 : 2) * (typeof Perf !== "undefined" ? Perf.scale() : 1);   // and the quality level scales it down further
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    // Portrait screens (phones) take a wider lens so the fire and the crew still fit
    camera.fov = h > w ? 58 : 46;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();
  Perf.init(renderer, composer, bloom, scene, resize);

  let paused = false, t = 0, last = performance.now() / 1000;
  document.getElementById('btnPause').addEventListener('click', () => { paused = !paused; HUD.setPaused(paused); });
  window.addEventListener('keydown', e => { if (e.code === 'KeyP') document.getElementById('btnPause').click(); });

  // The score follows the situation; the fire crackles near the camp; glitches crackle too; buttons click
  let lastMood = '', glitchT = 0;
  function soundtrack(dt) {
    const p = Player.state(), zn = p.z < World.SPIRE_Z - 2 ? 'spire' : p.z < World.HUB_Z - 2 ? 'hub' : p.z < World.Z0 - 2 ? 'market' : 'explore';
    const m = Cutscene.active() ? 'scene' : Combat.active() ? 'battle' : zn;
    if (m !== lastMood) { lastMood = m; Sound.setMood(m); }
    Sound.setZone(zn === 'hub' || zn === 'spire' ? zn : 'default');
    City.setZoneCorruption({ market: 0.12, hub: 0.3, spire: 0.45 }[zn] || 0);      // the districts past the Market are corrupt even without a story glitch
    Sound.update(dt, p);
    glitchT -= dt; if (glitchT <= 0 && City.glitch() > 0.25) { Sound.sfx('glitch', { vol: City.glitch() }); glitchT = 0.5 + Math.random() * 1.2; }
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button')) Sound.sfx('click'); });
  // The gate: sealed by a barrier until the alley's husks are beaten, then it dissolves. Bumping into it says why.
  let gateHint = 0;
  function gateWatch(dt) {
    // The gate opens only when the story has reached the Act 2 stage past the Resonance, so the crew cannot walk on without the talk
    const cleared = Combat.alleyCleared(), open = cleared && Cutscene.stage() >= 2;
    if (open !== gateWas) {
      gateWas = open;
      if (gateFirst) City.setGate(open, true); else { City.setGate(open); if (open) { Sound.sfx('door'); Cutscene.gateOpened(); } }
    }
    gateFirst = false;
    gateHint -= dt;
    if (!open && gateHint <= 0 && Player.state().z < City.FAR + 10) {                   // the barrier stops the crew about 9 m short of the gate: that is where the hint is said
      gateHint = 6; const toast = document.getElementById('toast');
      const msg = cleared ? 'The barrier holds. Go back to the crew at the fire.' : 'The gate is sealed. Something is guarding it.';
      if (toast) { toast.textContent = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
    }
  }
  function frame(ms) {
    const now = ms / 1000, raw = now - last, dt = Math.min(0.05, raw);
    last = now;
    Perf.begin(raw, paused || ModelCheck.isOpen());
    if (ModelCheck.isOpen()) {                                   // the viewer has the screen: the game stands still behind it
      ModelCheck.update(dt);
      renderPass.scene = ModelCheck.scene; renderPass.camera = ModelCheck.camera;
      composer.render();
      requestAnimationFrame(frame);
      return;
    }
    renderPass.scene = scene; renderPass.camera = camera;
    const step = paused ? 0 : dt;
    t += step;
    City.update(t, step);
    gateWatch(step);
    Camp.update(t, step);
    World.update(t, step, Player.state());
    FX.update(step);
    soundtrack(step);
    Player.update(t, step);
    Cutscene.update(step);
    if (Cutscene.active()) Cutscene.applyCamera(camera, step || 0.016);
    else if (Combat.active()) Combat.applyCamera(camera); else Player.applyCamera(camera);
    Combat.update(step, camera);
    composer.render();
    Perf.end(raw);
    Save.update(step);
    const site = Camp.nearCamp(Player.state());
    if (site && !Combat.active() && Camp.discover(site)) { const toast = document.getElementById('toast'), s = Camp.siteList().find(q => q.id === site); if (toast) { toast.textContent = 'Camp found: ' + s.name; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); } Sound.sfx('quest'); }
    HUD.update(t, Player.state());
    CampUI.update();
    Cutscene.updateUI(CampUI.isOpen());
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
