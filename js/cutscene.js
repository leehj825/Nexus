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
  const center = new THREE.Vector3();                                           // where the scene is staged: the fire, or where the crew stand
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
  // Place scenes (Act 2, in the Neon Market): they play where the crew stands, with the crew gathered round Jin
  const ARRIVAL = [
    { shot: 'wide', fx: { glitch: 0.3 }, caption: 'The Neon Market\nHundreds of stalls hung with lanterns, and not one voice among them.' },
    { shot: 'who', who: 'yuna', mood: 'alert', note: 'Her blasters half drawn, eyes on the shuttered stalls.', text: 'Too quiet. Markets do not empty themselves. Stay off the open streets and keep your backs to a wall.' },
    { shot: 'who', who: 'kyle', mood: 'worry', note: 'Turning a stall\'s dead lantern in his gauntlet.', text: 'Looks like everyone left in a hurry. Half of these counters still have goods on them.' },
    { shot: 'who', who: 'ruen', mood: 'think', fx: { aim: true, resonance: 0.8 }, note: 'Her orb leans away from her, toward the far end of the avenue.', text: 'They didn\'t leave, Kyle. They were called. The hum is louder here, and every pin on my map is above us now.' },
    { shot: 'who', who: 'ruen', mood: 'alert', text: 'One of them is brighter than the rest. Straight up the avenue. It\'s... almost singing.' },
    { shot: 'who', who: 'jin', mood: 'firm', fx: { aim: false, glitch: 0.1, resonance: 0.2 }, note: 'Looking up the long avenue, one hand on his blade.', text: 'Then that is where we go. Yuna, take the shadows. Kyle, the rear. Ruen, keep that orb in your hand and tell me when it pulls.' },
    { shot: 'wide', fx: { glitch: 0, resonance: 0 }, caption: 'Husks drift between the stalls ahead. Whatever drew the crowd away left them behind.' },
  ];
  const TOWER_SIGHT = [
    { shot: 'tower', fx: { aim: true, resonance: 1, glitch: 0.3 }, caption: 'Through the haze over the rooftops, a tower rises, ringed with bands of pale light. Ruen\'s orb strains toward it like a leashed animal.' },
    { shot: 'who', who: 'ruen', mood: 'alert', note: 'Her voice small.', text: 'That\'s it. That\'s the brightest one. I can feel it from here, like a second heartbeat.' },
    { shot: 'who', who: 'yuna', mood: 'firm', note: 'Reading the base through a scope.', text: 'Corporate colours on the base, and a security ring I can count from here. They built a tower round it.' },
    { shot: 'who', who: 'kyle', mood: 'think', fx: { aim: false, resonance: 0.3, glitch: 0.1 }, text: 'If they built a tower round it, they know what it is. And they didn\'t think it was safe to leave alone.' },
    { shot: 'who', who: 'jin', mood: 'firm', text: 'Then we stop guessing. We go to the foot of that tower and find out what they were building. Eyes open.' },
  ];
  const REVEAL = [
    { shot: 'tower', fx: { resonance: 1, glitch: 0.5 }, caption: 'The Foot of the Spire\nThe light of the tower falls on the empty plaza like frost.' },
    { shot: 'who', who: 'ruen', mood: 'worry', fx: { aim: true }, note: 'Her hand pressed to the cold wall of the tower; her orb burns white.', text: 'It\'s here. Oh... it isn\'t a weapon. It was never a weapon.' },
    { shot: 'who', who: 'ruen', mood: 'think', fx: { glitch: 0.8 }, text: 'Each core is a piece of something larger. A seam in the world, torn open and cut into fragments. When they\'re brought together, they make a door.' },
    { shot: 'who', who: 'yuna', mood: 'alert', note: 'Staring at the logo burned into the plaza stone.', text: 'A localised singularity. The Corporation isn\'t guarding a relic. They\'re forcing a gateway, and they\'re using the cores for the key.' },
    { shot: 'who', who: 'kyle', mood: 'firm', note: 'Stepping close to Ruen.', text: 'And the hum in your head? That\'s the door calling. Which makes you the one thing it can\'t ignore.' },
    { shot: 'glitch', fx: { glitch: 1 }, caption: 'Across the plaza every sign and hologram tears at once, faces stretching into too many teeth. For a heartbeat the whole district looks like a held breath.' },
    { shot: 'who', who: 'jin', mood: 'firm', fx: { glitch: 0.4, aim: false }, note: 'Over the buzz, steady.', text: 'Then we are not here to steal a relic. We are here to stop a door from opening, and to bring Ruen out the other side.' },
    { shot: 'who', who: 'ruen', mood: 'nod', fx: { glitch: 0, resonance: 0.4 }, note: 'The orb steadies in her hand.', text: 'Together, then. Whatever is up there, I don\'t have to hear it alone.' },
    { shot: 'tower', fx: { glitch: 0.1 }, caption: 'The Corporate Spire waits at the top of the city.\n\nEnd of Act 2 for now. The climb continues in Act 3.' },
  ];
  const moodOf = st => st.mood || 'talk';
  const typed = () => steps && steps[i] ? (steps[i].text || steps[i].caption || steps[i].note || '') : '';

  // A shot's target camera pose
  function shotFor(st) {
    if (st.shot === 'who') {
      const rg = st.rig || rigOf(st.who), p = rg ? rg.root.position : tmp.set(Player.state().x, 0, Player.state().z);
      const sx = p.x, sz = p.z, h = rg === Player.rig() ? 1.4 : 1.2, d = Math.hypot(center.x - sx, center.z - sz) || 1, fx = (center.x - sx) / d, fz = (center.z - sz) / d, rx = -fz, rz = fx;
      goalP.set(sx - fx * 0.3 + rx * 2.5, h + 0.55, sz - fz * 0.3 + rz * 2.5);
      goalL.set(sx, h, sz);
    } else if (st.shot === 'fire') { goalP.set(1.6, 1.0, 3.6); goalL.set(0, 1.5, -0.5); }
    else if (st.shot === 'glitch') { goalP.set(0.8, 1.9, 2.2); goalL.set(-4.2, 2.6, -10.5); }
    else if (st.shot === 'orb') { const r = rigOf('ruen'), p = r ? r.root.position : tmp; goalP.set(p.x + 1.7, 1.55, p.z + 1.6); goalL.set(p.x - 0.4, 1.5, p.z - 2.8); }
    else if (st.shot === 'gate') { goalP.set(0.4, 2.4, 3.2); goalL.set(0, 2.0, -26); }
    else if (st.shot === 'tower') { goalP.set(center.x + 1.4, 2.6, center.z + 3.4); goalL.set(World.TOWER.x, 34, World.TOWER.z); }
    else if (st.shot === 'point') { goalP.set(center.x + 1.5, 2.2, center.z + 3.2); goalL.set(st.look[0], st.look[1], st.look[2]); }
    else { goalP.set(center.x + 3.6, 3.1, center.z + 6.4); goalL.set(center.x, 1.0, center.z - 0.4); }
    // a slow drift so a held shot is never dead still
    goalP.x += Math.sin(t * 0.25) * 0.18; goalP.y += Math.sin(t * 0.19) * 0.06;
  }

  const rigOf = key => key === 'jin' ? Player.rig() : (Camp.crew.find(q => q.name === key) || {}).rig;
  // Everyone in the scene: the speaker acts out the line's mood, the rest turn their heads toward the speaker
  let npcRig = null;
  function acting(on) {
    const st = on && steps && steps[i] ? steps[i] : null, sp = st ? (st.rig || (st.who ? rigOf(st.who) : null)) : null;
    const all = Object.keys(WHO).map(rigOf).filter(Boolean); if (npcRig) all.push(npcRig);
    for (const r of all) {
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
    const st = steps[i], who = st.name ? { name: st.name, color: st.color } : st.who && WHO[st.who];
    applyFx(st.fx);
    $('dlgCount').textContent = (i + 1) + ' / ' + steps.length;
    $('dlgName').textContent = who ? who.name : '';
    $('dlgName').style.color = who ? who.color : '';
    $('dlgNote').textContent = st.note || '';
    $('dlgNote').hidden = !st.note;
    $('dlg').classList.toggle('caption', !!st.caption);
    $('dlgText').textContent = ''; shown = 0;
  }

  // opts.anchor: 'camp' (at the fire: the crew are seated, Jin takes his spot) or 'here' (the crew gather round Jin where he stands);
  // opts.facing: the way they all face in a 'here' scene; opts.npc: someone being talked to (a chat: nobody is moved)
  function begin(list, done, opts = {}) {
    steps = list; i = 0; ending = 0; active = true; onDone = done || null; t = 0; npcRig = opts.npc ? opts.npc.rig : null;
    Player.setFrozen(true);
    const ps = Player.state();
    if (!opts.anchor || opts.anchor === 'camp') {
      center.set(0, 0, 0); Camp.seatAll();
      Player.scriptTo(JIN_SPOT[0], JIN_SPOT[1], Math.atan2(-JIN_SPOT[0], -JIN_SPOT[1]));          // Jin takes his place by the fire, facing it
    } else if (opts.anchor === 'here') {
      center.set(ps.x, 0, ps.z); Camp.gatherAt(ps.x, ps.z, opts.facing === undefined ? Math.PI : opts.facing); Player.scriptTo(ps.x, ps.z, opts.facing === undefined ? Math.PI : opts.facing);
    } else {                                                                                     // a chat: Jin turns to the speaker, everyone else stays put
      center.set(ps.x, 0, ps.z); const np = opts.npc.rig.root.position; Player.scriptTo(ps.x, ps.z, Math.atan2(np.x - ps.x, np.z - ps.z));
    }
    const ex = Player.exploreView(); pos.copy(ex.pos); look.copy(ex.look);       // start the glide from where the camera is
    document.body.classList.add('cutscene'); $('dlg').hidden = false; show();
  }
  function finish() {                                                            // leave the scene: glide the camera home, then hand control back
    acting(false); npcRig = null; Camp.release(); applyFx({ glitch: 0, resonance: 0, aim: false }); $('dlg').hidden = true; ending = 1.4; document.body.classList.remove('cutscene'); document.body.classList.add('cutscene-out');
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
    const before = Math.floor(shown / 3); shown = Math.min(typed().length, shown + dt * 48);
    if (Math.floor(shown / 3) !== before && shown < typed().length && steps[i] && !steps[i].caption) Sound.blip(steps[i].who || 'npc');          // a chirp every few letters, pitched by the speaker
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

  // The story stage: 0 the campfire, 1 the resonance (both at the fire), 2 go through the gate, 3 follow the orb up the avenue,
  // 4 reach the tower, 5 Act 2 done. Stages 2-4 each end with a scene that plays where the crew stands when they reach a place.
  let stage = 0;
  const QUEST = ['\u25c6 Speak with the crew', '\u25c6 Rest by the fire and feel for the resonance', '\u25c6 Go through the gate into the Neon Market', '\u25c6 Follow the orb up the avenue', '\u25c6 Reach the foot of the tower', '\u25c6 Act 2 complete: the climb to the Spire comes next'];
  function setQuest(n) {
    const q = $('qtext'); if (q) q.textContent = QUEST[n]; if (n > 0) Sound.sfx('quest');
    const toast = $('toast'); if (toast && n > 0) { toast.textContent = 'Quest updated'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
  }
  const setStage = n => { stage = n; setQuest(n); };
  // The objective the map points at: the gate, then the tower
  function objective() {
    if (stage === 2) return { x: 0, z: World.Z0 + 4, label: 'the gate' };
    if (stage === 3 || stage === 4) return { x: World.TOWER.x, z: World.TOWER.z, label: 'the tower' };
    return null;
  }
  // Place triggers: each plays once, when the crew first reaches the place at that stage
  function checkTriggers() {
    const p = Player.state(), dT = Math.hypot(p.x - World.TOWER.x, p.z - World.TOWER.z);
    if (stage === 2 && p.z < World.Z0 - 6) begin(ARRIVAL, () => setStage(3), { anchor: 'here' });
    else if (stage === 3 && dT < 70) begin(TOWER_SIGHT, () => setStage(4), { anchor: 'here' });
    else if (stage === 4 && dT < 26) begin(REVEAL, () => setStage(5), { anchor: 'here' });
  }
  const NPC_LINES = {
    vendor: ['Scrap is as good as credit here. Show me what you\'ve got.', 'Fresh circuits, honest prices. Mostly honest.', 'Nobody\'s buying tonight. The signs keep lying about what\'s open.'],
    rumor: ['The signs started spelling things that aren\'t ads. I stopped reading them.', 'Drones sweep the upper sectors at dawn. If you\'re heading up, go before.', 'Those husks? Used to be somebody\'s neighbours. The grid took the rest.', 'There\'s a tower up the avenue that hums at night. Don\'t stand near it.', 'My cousin walked toward the white light. We stopped getting his messages.'],
  };
  // Talking to someone in the Market: a short exchange, and a vendor's counter opens the camp's crafting panel afterwards
  function chat(npc) {
    const pool = NPC_LINES[npc.shop ? 'vendor' : 'rumor'], a = pool[Math.floor(Math.random() * pool.length)], b2 = NPC_LINES.rumor[Math.floor(Math.random() * NPC_LINES.rumor.length)];
    const list = [{ shot: 'who', rig: npc.rig, name: npc.name, color: '#9fe0d0', mood: 'talk', text: a }];
    if (npc.shop) list.push({ shot: 'who', rig: npc.rig, name: npc.name, color: '#9fe0d0', mood: 'nod', text: 'Take a look at the counter.' }); else list.push({ shot: 'who', rig: npc.rig, name: npc.name, color: '#9fe0d0', mood: 'worry', text: b2 });
    begin(list, () => { if (npc.shop) CampUI.openShop(); }, { anchor: 'npc', npc });
  }
  // What the interact button does right now: the story at the fire, or a chat with someone close by
  function interactable() {
    const p = Player.state();
    if (Camp.nearFire(p)) return { kind: 'story', label: LABEL[Math.min(stage, 2)] };
    const n = World.nearNpc(p, 2.8); return n ? { kind: 'npc', npc: n, label: n.shop ? 'Trade \u00b7 ' + n.name : 'Talk \u00b7 ' + n.name } : null;
  }
  function start() {
    if (active || Combat.active()) return;
    const it = interactable(); if (!it) return;
    if (it.kind === 'npc') return chat(it.npc);
    if (stage === 0) begin(CAMPFIRE, () => setStage(1));
    else begin(RESONANCE, () => { if (stage < 2) setStage(2); });
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
  // Each frame: the interact button at the fire or beside someone, and the place triggers
  function updateUI(campOpen) {
    const it = !Combat.active() && !active && !campOpen ? interactable() : null;
    $('talkBtn').hidden = !it; if (it) $('talkBtn').textContent = it.label;
    $('talkBtn').classList.toggle('solo', !!it && $('campBtn').hidden);
    if (!active && !campOpen && !Combat.active() && !Combat.engaging()) checkTriggers();
  }

  return { init, update, updateUI, applyCamera, active: () => active, start, started: () => started, stage: () => stage, objective, debugStage: n => setStage(n) };
})();
