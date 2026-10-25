// Nexus - entry point: the renderer, the lit alley with the fire and the crew, the player camera and the HUD, in one loop.
(() => {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b14);
  scene.fog = new THREE.FogExp2(0x070b16, 0.03);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);

  City.build(scene);
  Camp.build(scene);
  Player.init(scene, canvas, camera);
  HUD.init();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
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
    Player.applyCamera(camera);
    renderer.render(scene, camera);
    HUD.update(t, Player.state());
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
