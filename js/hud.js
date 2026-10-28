// Nexus - the HUD: status bars, the zone title, the round minimap and the control hints, laid out as in the reference shot.
// Health and stamina are placeholders until combat and the stat system exist.
const HUD = (() => {
  const $ = id => document.getElementById(id);
  const MAP = 220, SCALE = 7;                         // minimap pixels per world metre
  const map = $('map'), g = map.getContext('2d');
  let dots = null;

  // The district's building lights, scattered once so the minimap reads as a city block
  function cityDots() {
    const out = []; let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 520; i++) out.push({ x: (rnd() - 0.5) * 60, z: (rnd() - 0.5) * 60, lit: rnd() < 0.6 });
    return out;
  }

  function drawMap(p, t) {
    dots = dots || cityDots();
    const cx = MAP / 2, cy = MAP / 2;
    g.clearRect(0, 0, MAP, MAP);
    g.save();
    g.beginPath(); g.arc(cx, cy, MAP / 2 - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#0c0b06'; g.fillRect(0, 0, MAP, MAP);
    // World to map: centred on the avatar, north (−z) up
    const toX = x => cx + (x - p.x) * SCALE, toY = z => cy + (z - p.z) * SCALE;
    g.fillStyle = '#ffc55a';
    for (const d of dots) {
      if (!d.lit) continue;
      const x = toX(d.x), y = toY(d.z);
      g.globalAlpha = 0.85; g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    g.globalAlpha = 1;
    // The buildings of the Neon Market round the player (they load as they near), as dim blocks
    g.fillStyle = '#4a3a1a'; g.globalAlpha = 0.9;
    for (const b of World.footprints()) { const x0 = toX(b.x - b.hw), y0 = toY(b.z - b.hd); if (x0 < MAP && y0 < MAP && x0 + b.hw * 2 * SCALE > 0 && y0 + b.hd * 2 * SCALE > 0) g.fillRect(x0, y0, b.hw * 2 * SCALE, b.hd * 2 * SCALE); }
    g.globalAlpha = 1;
    // People in the Market (small cyan dots) and the story objective (a gold diamond, pinned to the rim when it is off the map)
    g.fillStyle = '#7ff7ff'; for (const n of World.npcs()) g.fillRect(toX(n.x) - 2, toY(n.z) - 2, 4, 4);
    const ob = Cutscene.objective();
    if (ob) {
      let ox = toX(ob.x), oy = toY(ob.z); const dx = ox - cx, dy = oy - cy, dd = Math.hypot(dx, dy), lim = MAP / 2 - 12;
      if (dd > lim) { ox = cx + dx / dd * lim; oy = cy + dy / dd * lim; }
      g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(ox, oy - 7); g.lineTo(ox + 6, oy); g.lineTo(ox, oy + 7); g.lineTo(ox - 6, oy); g.closePath(); g.fill();
      const qd = document.getElementById('qdist'); if (qd) qd.textContent = Math.round(Math.hypot(p.x - ob.x, p.z - ob.z)) + ' m to ' + ob.label;
    } else { const qd = document.getElementById('qdist'); if (qd && qd.textContent) qd.textContent = ''; }
    // Landmarks: the fire (orange), the gate (blue), the crew (small yellow squares)
    g.fillStyle = '#ff9a3a'; g.fillRect(toX(0) - 3, toY(0) - 3, 6, 6);
    g.fillStyle = '#4aa8ff'; g.beginPath(); g.arc(toX(0), toY(-26), 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe08a';
    for (const [x, z] of [[-1.9, -0.9], [1.5, -1.2], [2.7, 0.4]]) g.fillRect(toX(x) - 2, toY(z) - 2, 4, 4);
    g.restore();
    // The avatar: a white arrow at the centre, pointing where it faces
    g.save(); g.translate(cx, cy); g.rotate(p.heading + Math.PI);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
    // The rim
    g.strokeStyle = 'rgba(255, 200, 110, 0.55)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, MAP / 2 - 2, 0, Math.PI * 2); g.stroke();
  }

  function setPaused(on) {
    $('pauseTag').hidden = !on;
    $('btnPause').classList.toggle('on', on);
  }

  function init() {
    $('btnSound').addEventListener('click', e => e.currentTarget.classList.toggle('muted'));
    $('btnMap').addEventListener('click', e => e.currentTarget.classList.toggle('on'));
  }

  let zone = '';
  function update(t, p) {
    drawMap(p, t);
    const z = p.z < World.Z0 - 1 ? 'Neon Market \u00b7 Night' : 'Neon District \u00b7 Night';             // the zone title follows the player through the gate
    if (z !== zone) { zone = z; const el = document.querySelector('.zone span'); if (el) el.innerHTML = z.replace('\u00b7', '&middot;'); }
  }

  return { init, update, setPaused };
})();
