// Nexus - cutscenes: the campfire scene "The Discovery" (Story.md, Act 1), played as a list of steps one after another.
// A step is a camera shot plus either a caption (narration over the scene) or a line of dialogue (a speaker, an optional stage direction,
// the words). The camera glides from shot to shot; tap, click, Space or Enter shows the rest of a line, then moves on; Esc or Skip ends it.
// While it plays the avatar is frozen, the HUD is hidden and bars frame the picture. At the end the quest moves on.
const Cutscene = (() => {
  const $ = id => document.getElementById(id);
  const WHO = {
    jin: { name: 'Jin', color: '#ffffff' }, ruen: { name: 'Ruen', color: '#c9a0ff' },
    kyle: { name: 'Kyle', color: '#ffd27a' }, yuna: { name: 'Yuna', color: '#7ff7ff' },
  };
  // The scene. shot: 'wide' (the whole camp), 'who' (the speaker), 'fire' (low on the flames), 'gate' (up the alley)
  const CAMPFIRE = [
    { shot: 'wide', caption: 'Sector 9 · the Underbelly\nDeep night. A deserted alley, lit only by neon.' },
    { shot: 'fire', caption: 'An energy barrel burns between the crew. Somewhere above, the pulse from the vault still hums through the walls.' },
    { shot: 'who', who: 'jin', mood: 'wipe', note: 'Jin wipes down his glowing blade, the cyan edge catching the firelight.' },
    { shot: 'who', who: 'kyle', mood: 'worry', note: 'Looking over with concern, keeping himself between Ruen and the dark end of the alley.', text: 'You holding up okay, Ruen? The energy pulse from that vault was intense.' },
    { shot: 'who', who: 'ruen', mood: 'worry', note: 'Staring at her fluctuating data-orb, unsettled.', text: 'I\'m alright, Kyle. But... I don\'t know exactly what that material is. I just know it\'s incredibly dangerous.' },
    { shot: 'who', who: 'ruen', mood: 'worry', text: 'My sensors can\'t even parse the data structure, but my intuition is telling me we shouldn\'t take it lightly.' },
    { shot: 'who', who: 'kyle', mood: 'nod', text: 'Then we don\'t. Whatever it is, you tell me where to stand and I\'ll stand there.' },
    { shot: 'wide', caption: 'Far down the alley, a drone\'s searchlight sweeps across the wet walls and moves on.' },
    { shot: 'who', who: 'yuna', mood: 'alert', note: 'Holstering her dual blasters, chiming in with her own pragmatic perspective.', text: 'If it\'s radiating that much volatile energy, every corporate drone in the sector will be tracking it soon.' },
    { shot: 'who', who: 'yuna', mood: 'firm', text: 'We can\'t just sit here guessing what it is. We need a secure route out of the lower levels.' },
    { shot: 'who', who: 'jin', mood: 'firm', note: 'Standing up, the neon light catching his katana.', text: 'Yuna\'s right. I\'ll take the vanguard. Kyle, watch the rear.' },
    { shot: 'who', who: 'ruen', mood: 'alert', note: 'Her orb flickers, then steadies, as if it were pointing.', text: '...Wait. Do you feel that? It pulls, like a compass. Up. Toward the restricted sectors.' },
    { shot: 'who', who: 'jin', mood: 'firm', text: 'Then that is our road. Let\'s move before they lock down the grid.' },
    { shot: 'gate', caption: 'The crew douses the light and shoulders their gear. Ahead, the alley climbs toward the glow of the upper city.' },
  ];

  let steps = null, i = 0, shown = 0, active = false, ending = 0, t = 0, onDone = null, started = false;
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), goalP = new THREE.Vector3(), goalL = new THREE.Vector3(), tmp = new THREE.Vector3();
  const moodOf = st => st.mood || 'talk';
  const typed = () => steps && steps[i] ? (steps[i].text || steps[i].caption || steps[i].note || '') : '';

  // A shot's target camera pose
  function shotFor(st) {
    if (st.shot === 'who') {
      const c = Camp.crew.find(q => q.name === st.who), p = c ? c.rig.root.position : tmp.set(Player.state().x, 0, Player.state().z);
      const sx = p.x, sz = p.z, h = c ? 1.15 : 1.4, d = Math.hypot(sx, sz) || 1, fx = -sx / d, fz = -sz / d, rx = -fz, rz = fx;
      goalP.set(sx + fx * 2.5 + rx * 1.3, h + 0.7, sz + fz * 2.5 + rz * 1.3);
      goalL.set(sx, h, sz);
    } else if (st.shot === 'fire') { goalP.set(1.6, 1.0, 3.6); goalL.set(0, 1.5, -0.5); }
    else if (st.shot === 'gate') { goalP.set(0.4, 2.4, 3.2); goalL.set(0, 2.0, -26); }
    else { goalP.set(3.6, 3.1, 6.4); goalL.set(0, 1.0, -0.4); }
    // a slow drift so a held shot is never dead still
    goalP.x += Math.sin(t * 0.25) * 0.18; goalP.y += Math.sin(t * 0.19) * 0.06;
  }

  const rigOf = key => key === 'jin' ? Player.rig() : (Camp.crew.find(q => q.name === key) || {}).rig;
  // Everyone in the scene: the speaker acts out the line's mood, the rest turn their heads toward the speaker
  function acting(on) {
    const st = on && steps && steps[i] ? steps[i] : null, sp = st && st.who ? rigOf(st.who) : null;
    for (const key of Object.keys(WHO)) {
      const r = rigOf(key); if (!r) continue;
      if (st && r === sp) { Chars.setTalk(r, moodOf(st), shown < typed().length); Chars.setLook(r, null); }
      else { Chars.setTalk(r, null); Chars.setLook(r, sp ? tmp2.copy(sp.root.position).setY(1.4) : null); }
    }
  }
  const tmp2 = new THREE.Vector3();
  function show() {
    const st = steps[i], who = st.who && WHO[st.who];
    $('dlgCount').textContent = (i + 1) + ' / ' + steps.length;
    $('dlgName').textContent = who ? who.name : '';
    $('dlgName').style.color = who ? who.color : '';
    $('dlgNote').textContent = st.note || '';
    $('dlgNote').hidden = !st.note;
    $('dlg').classList.toggle('caption', !!st.caption);
    $('dlgText').textContent = ''; shown = 0;
  }

  function begin(list, done) {
    steps = list; i = 0; ending = 0; active = true; onDone = done || null; t = 0;
    Player.setFrozen(true);
    const ex = Player.exploreView(); pos.copy(ex.pos); look.copy(ex.look);       // start the glide from where the camera is
    document.body.classList.add('cutscene'); $('dlg').hidden = false; show();
  }
  function finish() {                                                            // leave the scene: glide the camera home, then hand control back
    acting(false); $('dlg').hidden = true; ending = 1.4; document.body.classList.remove('cutscene'); document.body.classList.add('cutscene-out');
  }
  function advance() {
    if (!active || ending) return;
    const full = typed();
    if (shown < full.length) { shown = full.length; return; }
    if (++i >= steps.length) finish(); else show();
  }
  function skip() { if (active && !ending) finish(); }

  function update(dt) {
    t += dt;
    if (!active) return;
    if (ending) {
      ending -= dt;
      if (ending <= 0) {
        active = false; ending = 0; document.body.classList.remove('cutscene-out'); Player.setFrozen(false);
        const done = onDone; onDone = null; if (done) done();
      }
      return;
    }
    shown = Math.min(typed().length, shown + dt * 48);
    $('dlgText').textContent = typed().slice(0, Math.floor(shown)); acting(true);
    $('dlgNext').style.visibility = shown >= typed().length ? 'visible' : 'hidden';
  }

  // The camera: glide toward the current shot (or, on the way out, toward the exploration camera)
  function applyCamera(cam, dt = 0.016) {
    if (ending) { const ex = Player.exploreView(); goalP.copy(ex.pos); goalL.copy(ex.look); }
    else shotFor(steps[i]);
    const k = 1 - Math.exp(-dt * (ending ? 4.5 : 2.6));
    pos.lerp(goalP, k); look.lerp(goalL, k);
    cam.position.copy(pos); cam.lookAt(look);
  }

  function start() { if (active || Combat.active()) return; begin(CAMPFIRE, () => { started = true; CutsceneHook.afterCampfire(); }); }
  const CutsceneHook = {
    afterCampfire() {
      const q = document.querySelector('.quest'); if (q) q.textContent = '◆ Follow the resonance up the alley';
      const toast = $('toast'); if (toast) { toast.textContent = 'Quest updated'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
    },
  };

  function init() {
    $('talkBtn').addEventListener('click', start);
    $('dlg').addEventListener('click', e => { if (e.target.id === 'dlgSkip') skip(); else advance(); });
    window.addEventListener('keydown', e => {
      if (!active) { if (e.code === 'KeyT' && !$('talkBtn').hidden) start(); return; }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') { e.preventDefault(); advance(); }
      else if (e.code === 'Escape') skip();
    });
  }
  // Each frame: the Talk button shows at the fire when nothing else is going on
  function updateUI(campOpen) {
    const near = Camp.nearFire(Player.state()) && !Combat.active() && !active && !campOpen;
    $('talkBtn').hidden = !near;
  }

  return { init, update, updateUI, applyCamera, active: () => active, start, started: () => started };
})();
