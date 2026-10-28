// Nexus - Perf: a debug overlay (frame rate, draw calls, triangles, memory, chunks, ATB gauges, with chunk borders and aggro radii drawn in the
// world) and adaptive quality. Quality 0 is the full look; 1 and 2 lower the pixel ratio, the bloom and the world's lights and load radius.
// Settings: Quality Auto / High / Low, Debug On / Off. The backtick key (or ?debug in the address) shows the overlay.
const Perf = (() => {
  const LEVELS = [{ pr: 1, bloom: 1, name: 'High' }, { pr: 0.75, bloom: 0.5, name: 'Medium' }, { pr: 0.6, bloom: 0, name: 'Low' }];
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  let renderer, composer, bloom, scene, apply;
  let mode = store.get('nexus.quality') || 'auto';                    // 'auto' | 'high' | 'low'
  let level = 0, debug = /[?&]debug/.test(location.search) || store.get('nexus.debug') === '1';
  let ema = 1 / 60, slowT = 0, fastT = 0, warm = 4, lastDrop = -999, clock = 0, hudT = 0, helpers = null, helperT = 0, calls = 0, tris = 0;
  let el = null;

  function init(r, c, b, sc, applyFn) {
    renderer = r; composer = c; bloom = b; scene = sc; apply = applyFn;
    renderer.info.autoReset = false;                                  // the composer renders several passes a frame; count them all
    el = document.createElement('pre'); el.id = 'perf'; el.hidden = !debug; document.body.appendChild(el);
    document.addEventListener('visibilitychange', () => { warm = 2; slowT = fastT = 0; });   // coming back to the tab is not slowness either
    window.addEventListener('keydown', e => { if (e.code === 'Backquote') setDebug(!debug); });
    setMode(mode, true);
  }
  function setLevel(l) {
    level = Math.max(0, Math.min(2, l)); const L = LEVELS[level];
    bloom.enabled = L.bloom > 0; bloom.strength = 0.8 * L.bloom;
    World.setDetail(level); apply();
  }
  function setMode(m, quiet) { mode = m; store.set('nexus.quality', m); slowT = fastT = 0; warm = 4; setLevel(m === 'high' ? 0 : m === 'low' ? 2 : level); if (!quiet) lastDrop = -999; }
  function setDebug(on) { debug = on; store.set('nexus.debug', on ? '1' : '0'); el.hidden = !on; if (!on) clearHelpers(); }

  // Called at the start of each rendered frame with the real (uncapped) frame time
  function begin(dt, paused) {
    renderer.info.reset();
    clock += dt;
    if (paused || document.hidden) return;                            // a pause is not slowness
    ema += (Math.min(dt, 0.5) - ema) * 0.05;                          // one long hitch barely moves the average; steady slowness does
    if (warm > 0) { warm -= dt; return; }                             // the first seconds build chunks and compile shaders
    if (mode !== 'auto') return;
    if (ema > 1 / 38) { slowT += dt; fastT = 0; } else if (ema < 1 / 56) { fastT += dt; slowT = 0; } else { slowT = fastT = 0; }
    if (slowT > 3 && level < 2) { setLevel(level + 1); lastDrop = clock; slowT = 0; warm = 2; }
    else if (fastT > 20 && level > 0 && clock - lastDrop > 90) { setLevel(level - 1); fastT = 0; warm = 2; }   // steady 60: try a better look again
  }
  function end(dt) {
    calls = renderer.info.render.calls; tris = renderer.info.render.triangles;
    if (!debug) return;
    hudT -= dt; if (hudT > 0) return; hudT = 0.25;
    const i = renderer.info, P = Player.state(), C = Combat.debugInfo ? Combat.debugInfo() : null;
    const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'n/a';
    let net = 0; try { for (const r of performance.getEntriesByType('resource')) net += r.transferSize || r.encodedBodySize || 0; } catch (e) {}
    const lines = [
      (ema > 0.1 ? (1 / ema).toFixed(1) : Math.round(1 / ema)) + ' fps  ' + (ema * 1000).toFixed(1) + ' ms   quality ' + LEVELS[level].name + (mode === 'auto' ? ' (auto)' : ' (' + mode + ')') + '  pr ' + renderer.getPixelRatio().toFixed(2),
      'draws ' + calls + '   tris ' + (tris / 1000).toFixed(1) + 'k   geo ' + i.memory.geometries + '   tex ' + i.memory.textures,
      'chunks ' + World.loaded() + '   lights ' + World.lights() + '   fx ' + FX.count() + '   heap ' + heap + '   loaded ' + (net / 1048576).toFixed(1) + ' MB',
      'pos ' + P.x.toFixed(1) + ', ' + P.z.toFixed(1),
    ];
    if (C && C.phase !== 'explore') {
      lines.push('battle ' + C.phase);
      for (const u of C.units) lines.push((u.foe ? ' foe ' : ' you ') + u.n.padEnd(6) + ' hp ' + String(u.hp).padStart(3) + ' atb ' + '#'.repeat(Math.round(u.atb * 10)).padEnd(10, '.') + (u.alive ? '' : ' down'));
    }
    el.textContent = lines.join('\n');
    drawHelpers(dt, P);
  }

  // Chunk borders (cyan) and the radius at which each husk group aggros (red) or can be engaged (yellow)
  function clearHelpers() { if (helpers) { scene.remove(helpers); helpers.traverse(o => { if (o.geometry) o.geometry.dispose(); }); helpers = null; } }
  function drawHelpers() {
    helperT -= 0.25; if (helperT > 0 && helpers) return; helperT = 1;
    clearHelpers();
    helpers = new THREE.Group(); const pts = [], red = [], yel = [];
    for (const r of World.chunkRects()) { const h = r.s / 2, y = 0.15; pts.push(r.x - h, y, r.z - h, r.x + h, y, r.z - h, r.x + h, y, r.z - h, r.x + h, y, r.z + h, r.x + h, y, r.z + h, r.x - h, y, r.z + h, r.x - h, y, r.z + h, r.x - h, y, r.z - h); }
    const circle = (arr, x, z, rad) => { for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, b = (k + 1) / 24 * Math.PI * 2; arr.push(x + Math.cos(a) * rad, 0.2, z + Math.sin(a) * rad, x + Math.cos(b) * rad, 0.2, z + Math.sin(b) * rad); } };
    for (const g of Combat.groupList()) { if (g.cleared) continue; if (g.aggro) circle(red, g.x, g.z, 4.4); circle(yel, g.x, g.z, g.radius || Combat.encounterR); }
    const add = (arr, color) => { if (!arr.length) return; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, toneMapped: false })); m.frustumCulled = false; helpers.add(m); };
    add(pts, 0x3ff0ff); add(red, 0xff3a5a); add(yel, 0xffd24a);
    scene.add(helpers);
  }

  return { init, begin, scale: () => LEVELS[level].pr, end, setMode, setDebug, level: () => level, mode: () => mode, debug: () => debug, name: () => LEVELS[level].name };
})();
