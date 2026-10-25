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

  function update(t, p) {
    drawMap(p, t);
  }

  return { init, update, setPaused };
})();
