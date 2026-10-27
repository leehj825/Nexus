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
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.4, 0.75);   // strength, radius, threshold
  composer.addPass(bloom);
  composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));

  City.build(scene);
  Camp.build(scene);
  Player.init(scene, canvas, camera);
  HUD.init();
  Combat.init(scene, camera);
  window.nexus = { state: () => Player.state(), scene };          // read-only hook for debugging and automated checks

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    // Phones get a lower pixel ratio: the bloom is the costly part, and it reads the same at 1.5x
    const pr = Math.min(window.devicePixelRatio, h > w ? 1.5 : 2);
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

  let paused = false, t = 0, last = performance.now() / 1000;
  document.getElementById('btnPause').addEventListener('click', () => { paused = !paused; HUD.setPaused(paused); });
  window.addEventListener('keydown', e => { if (e.code === 'KeyP') document.getElementById('btnPause').click(); });

  function frame(ms) {
    const now = ms / 1000, dt = Math.min(0.05, now - last);
    last = now;
    const step = paused ? 0 : dt;
    t += step;
    City.update(t, step);
    Camp.update(t, step);
    Player.update(t, step);
    if (Combat.active()) Combat.applyCamera(camera); else Player.applyCamera(camera);
    Combat.update(step, camera);
    composer.render();
    HUD.update(t, Player.state());
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
