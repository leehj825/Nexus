// Nexus - cutscenes: the campfire scene "The Discovery" (Story.md, Act 1) and Act 2's "The Resonance", each played as a list of steps one after another.
// The Talk button at the fire plays whichever scene the story has reached; a step can also switch world effects on (fx: glitch, resonance, aim).
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

  const JIN_SPOT = [-1.0, 1.7];                                                  // where Jin stands for the scene (the others are seated round the fire)
  let steps = null, i = 0, shown = 0, active = false, ending = 0, t = 0, onDone = null, started = false;
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), goalP = new THREE.Vector3(), goalL = new THREE.Vector3(), tmp = new THREE.Vector3();
  const RESONANCE = [
    { shot: 'wide', fx: { glitch: 0, resonance: 0, aim: false }, caption: 'Act 2 \u00b7 Chasing the Glitch\nLater. The fire has burned low, and the city has gone strangely quiet.' },
    { shot: 'gate', fx: { glitch: 0.25 }, caption: 'Far above the alley, the neon signs stutter, one after another, as if something were pressing on the wires.' },
    { shot: 'who', who: 'ruen', mood: 'alert', fx: { resonance: 0.6 }, note: 'Pressing her fingers to her temple, her orb flaring.', text: 'There. Do you hear that? Not a sound, exactly... a hum, underneath everything.' },
    { shot: 'who', who: 'kyle', mood: 'worry', note: 'Moving to her side at once.', text: 'Ruen? Hey. Look at me. Stay with me.' },
    { shot: 'who', who: 'ruen', mood: 'worry', fx: { resonance: 1 }, text: 'I\'m here. It\'s just... there are more of them, Kyle. Other cores. I can feel each one, like pins on a map.' },
    { shot: 'orb', fx: { aim: true, resonance: 1, glitch: 0.4 }, caption: 'Her orb lifts from her palm and drifts toward the far end of the alley, steady as a compass needle. Pale rings spread down the street, one after another.' },
    { shot: 'who', who: 'ruen', mood: 'think', text: 'They are all up there. In the restricted sectors, high above the market. The resonance... it points the way.' },
    { shot: 'glitch', fx: { glitch: 0.8 }, caption: 'Above a shuttered stall, an advertising hologram stutters. Its smiling face tears sideways into something with far too many teeth, then snaps back.' },
    { shot: 'who', who: 'yuna', mood: 'alert', note: 'Her blaster half raised toward the hologram.', text: 'Did you see that? That wasn\'t a fault. Holograms don\'t do that unless something is pushing on the grid.' },
    { shot: 'who', who: 'jin', mood: 'firm', fx: { glitch: 0.5 }, note: 'Stepping between the crew and the flickering light, one hand on his blade.', text: 'Reality is bending around that core. The closer we get, the worse it will be. Stay sharp.' },
    { shot: 'who', who: 'ruen', mood: 'worry', fx: { aim: false, resonance: 0.4, glitch: 0.2 }, note: 'Her orb settles back into her hand, trembling.', text: 'It\'s whispering. Not words. It\'s more like it knows my name, and it keeps trying to say it.' },
    { shot: 'who', who: 'kyle', mood: 'firm', text: 'Then I\'m your anchor. Anything gets loud in your head, you grab my arm. Understood?' },
    { shot: 'who', who: 'ruen', mood: 'nod', note: 'A small, shaky smile.', text: '...Understood. Thank you, Kyle.' },
    { shot: 'who', who: 'yuna', mood: 'firm', fx: { glitch: 0.1, resonance: 0 }, text: 'Sentiment later. Corporate drones triangulate pulses like this. We move at first light, through the upper sectors, and we stay off the main grid.' },
    { shot: 'who', who: 'jin', mood: 'firm', text: 'The orb is our compass. Ruen calls the direction, I take the vanguard, Kyle the rear. Yuna, eyes on the grid.' },
    { shot: 'gate', fx: { glitch: 0.15, resonance: 0.3 }, caption: 'Beyond the gate, the district\'s signs flicker in sequence, as if the city itself were pointing the way.' },
  ];
  const moodOf = st => st.mood || 'talk';
  const typed = () => steps && steps[i] ? (steps[i].text || steps[i].caption || steps[i].note || '') : '';

  // A shot's target camera pose
  function shotFor(st) {
    if (st.shot === 'who') {
      const c = Camp.crew.find(q => q.name === st.who), p = c ? c.rig.root.position : tmp.set(Player.state().x, 0, Player.state().z);
      const sx = p.x, sz = p.z, h = c ? 1.15 : 1.4, d = Math.hypot(sx, sz) || 1, fx = -sx / d, fz = -sz / d, rx = -fz, rz = fx;
      goalP.set(sx - fx * 0.3 + rx * 2.5, h + 0.55, sz - fz * 0.3 + rz * 2.5);
      goalL.set(sx, h, sz);
    } else if (st.shot === 'fire') { goalP.set(1.6, 1.0, 3.6); goalL.set(0, 1.5, -0.5); }
    else if (st.shot === 'glitch') { goalP.set(0.8, 1.9, 2.2); goalL.set(-4.2, 2.6, -10.5); }
    else if (st.shot === 'orb') { const r = rigOf('ruen'), p = r ? r.root.position : tmp; goalP.set(p.x + 1.7, 1.55, p.z + 1.6); goalL.set(p.x - 0.4, 1.5, p.z - 2.8); }
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
  const orbRig = () => rigOf('ruen');
  function applyFx(fx) {
    if (!fx) return;
    if (fx.glitch !== undefined) City.setGlitch(fx.glitch);
    if (fx.resonance !== undefined) City.setResonance(fx.resonance);
    if (fx.aim !== undefined && orbRig()) Chars.setOrbAim(orbRig(), fx.aim);
  }
  function show() {
    const st = steps[i], who = st.who && WHO[st.who];
    applyFx(st.fx);
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
    Player.scriptTo(JIN_SPOT[0], JIN_SPOT[1], Math.atan2(-JIN_SPOT[0], -JIN_SPOT[1]));          // Jin takes his place by the fire, facing it
    const ex = Player.exploreView(); pos.copy(ex.pos); look.copy(ex.look);       // start the glide from where the camera is
    document.body.classList.add('cutscene'); $('dlg').hidden = false; show();
  }
  function finish() {                                                            // leave the scene: glide the camera home, then hand control back
    acting(false); applyFx({ glitch: 0, resonance: 0, aim: false }); $('dlg').hidden = true; ending = 1.4; document.body.classList.remove('cutscene'); document.body.classList.add('cutscene-out');
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
        Player.scriptTo(null); active = false; ending = 0; document.body.classList.remove('cutscene-out'); Player.setFrozen(false);
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

  // The story stage: 0 the campfire, 1 the resonance, 2 both seen (the button then replays the resonance)
  let stage = 0;
  const QUEST = ['\u25c6 Speak with the crew', '\u25c6 Follow the resonance up the alley', '\u25c6 Climb toward the upper sectors'];
  function setQuest(n) {
    const q = document.querySelector('.quest'); if (q) q.textContent = QUEST[n];
    const toast = $('toast'); if (toast && n > 0) { toast.textContent = 'Quest updated'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
  }
  function start() {
    if (active || Combat.active()) return;
    if (stage === 0) begin(CAMPFIRE, () => { stage = 1; started = true; setQuest(1); });
    else begin(RESONANCE, () => { stage = 2; setQuest(2); });
  }
  const LABEL = ['Talk', 'Resonance', 'Replay'];

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
    $('talkBtn').hidden = !near; $('talkBtn').textContent = LABEL[stage];
  }

  return { init, update, updateUI, applyCamera, active: () => active, start, started: () => started, stage: () => stage };
})();
