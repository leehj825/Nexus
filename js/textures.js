// Nexus - canvas-drawn textures: LED dot-matrix neon signs, the portal face, soft glows and awning stripes.
// Everything is drawn at build time, so the scene ships no image files.
const Tex = (() => {
  const cache = {};
  const once = (key, fn) => cache[key] || (cache[key] = fn());
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const make = c => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };

  // Soft white radial falloff: tint it with a material colour for halos, sparks and light pools
  const glow = () => once('glow', () => {
    const c = canvas(128, 128), g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.22, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return make(c);
  });

  // A solid square dot, so Points particles read as LED pixels
  const pixel = () => once('pixel', () => {
    const c = canvas(16, 16), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(3, 3, 10, 10);
    return make(c);
  });

  // A neon sign: the text is set on a coarse grid and shown as lit LED dots (unlit dots stay faintly visible), inside a neon frame
  function led(text, color, w, h, cols) {
    const rows = Math.round(cols * h / w), cw = w / cols, chh = h / rows;
    const small = canvas(cols, rows), s = small.getContext('2d');
    s.fillStyle = '#000'; s.fillRect(0, 0, cols, rows);
    s.fillStyle = '#fff'; s.font = `bold ${Math.floor(rows * 0.7)}px monospace`; s.textAlign = 'center'; s.textBaseline = 'middle';
    s.fillText(text, cols / 2, rows / 2 + 0.5);
    const px = s.getImageData(0, 0, cols, rows).data;
    const c = canvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#0b0912'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const on = px[(y * cols + x) * 4] > 128;
      g.globalAlpha = on ? 1 : 0.1;
      g.fillStyle = color;
      g.fillRect(x * cw + cw * 0.18, y * chh + chh * 0.18, cw * 0.64, chh * 0.64);
    }
    g.globalAlpha = 1; g.strokeStyle = color; g.lineWidth = Math.max(5, w * 0.03);
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
    return make(c);
  }

  // A plain neon-lit panel: a faint grid inside a bright frame
  function panel(color, w, h) {
    const c = canvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#0b0912'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.45; g.fillStyle = color; g.fillRect(w * 0.12, h * 0.12, w * 0.76, h * 0.76);
    g.globalAlpha = 1; g.strokeStyle = color; g.lineWidth = Math.max(5, w * 0.05);
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
    return make(c);
  }

  // The portal face: a dark core ringed by a square of blue LED pixels, with a few stray pixels inside
  const portal = () => once('portal', () => {
    const N = 24, s = 512, c = canvas(s, s), g = c.getContext('2d'), cell = s / N;
    g.fillStyle = '#05080f'; g.fillRect(0, 0, s, s);
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const ring = Math.min(x, y, N - 1 - x, N - 1 - y);
      const on = ring < 3 ? (ring === 0 || rnd() < 0.9) : rnd() < 0.09;
      if (!on) continue;
      g.fillStyle = ring < 3 ? '#9ff3ff' : '#2a7bff';
      g.globalAlpha = ring < 3 ? 1 : 0.8;
      g.fillRect(x * cell + cell * 0.14, y * cell + cell * 0.14, cell * 0.72, cell * 0.72);
    }
    return make(c);
  });

  // Awning stripes: vertical bands of two colours, repeated along the canopy
  const stripes = (a, b) => once('stripes' + a + b, () => {
    const c = canvas(256, 64), g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 32, 0, 32, 64); }
    return make(c);
  });

  return { glow, pixel, led, panel, portal, stripes };
})();
