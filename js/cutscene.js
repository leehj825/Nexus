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
    { shot: 'who', who: 'yuna', mood: 'firm', fx: { glitch: 0.1 }, note: 'Pulling a cracked terminal out of the plaza dust.', text: 'The logs say the core was never kept here. It was shipped out two days ago, through the Industrial Hub, and the Hub\'s gate is the only way through.' },
    { shot: 'who', who: 'ruen', mood: 'alert', fx: { aim: true }, note: 'Her orb swings away from the tower, down the avenue.', text: 'It\'s moving. I can feel it dragging away from us like a tide. Past the far wall. Past the gate.' },
    { shot: 'who', who: 'jin', mood: 'firm', fx: { aim: false }, text: 'Then they\'re gathering the pieces in one place. We follow the pull, and we keep Ruen in the middle.' },
    { shot: 'point', look: [World.GATE.x, 9, World.GATE.z], caption: 'The orb\'s pull swings away from the Spire, toward the checkpoint in the Market\'s far wall.' },
  ];
  const HUB_GATE = [
    { shot: 'point', look: [World.GATE.x, 9, World.GATE.z], fx: { glitch: 0.2 }, caption: 'Checkpoint 9 \u00b7 The Industrial Hub\nOne gate in the Market\'s far wall. Sentry drones hang over it in the haze, their lenses turning.' },
    { shot: 'who', who: 'yuna', mood: 'alert', note: 'Counting under her breath.', text: 'Sentry drones. Six, maybe eight. Whatever the Corporation shipped through here, they didn\'t want it found.' },
    { shot: 'who', who: 'kyle', mood: 'think', text: 'Can we go round?' },
    { shot: 'who', who: 'yuna', mood: 'firm', text: 'Round sixty metres of glass and steel? No. We go through, quietly.' },
    { shot: 'who', who: 'ruen', mood: 'worry', fx: { glitch: 0.5, resonance: 0.6 }, note: 'Watching their lights stutter.', text: 'Look at their lenses. They aren\'t tracking anything. The glitch has gotten into them too.' },
    { shot: 'who', who: 'jin', mood: 'firm', fx: { glitch: 0, resonance: 0.2 }, text: 'Then they\'re as dangerous as the husks and twice as hard to hear coming. We move together and we don\'t stop in the open.' },
    { shot: 'wide', caption: 'Beyond the gate the Hub burns orange under a ceiling of its own smoke. Somewhere in the glow, three chimneys breathe fire.' },
  ];
  const FOUNDRY_SIGHT = [
    { shot: 'point', look: [World.FOUNDRY.x, 16, World.FOUNDRY.z - 15], fx: { aim: true, resonance: 0.9, glitch: 0.2 }, caption: 'Through the smoke the Foundry rises: three chimneys, a furnace slit glowing like an open eye, and a shutter the size of a house.' },
    { shot: 'who', who: 'ruen', mood: 'alert', note: 'Her orb pointing without a tremor.', text: 'It\'s in there. Not like the tower. That one was a sleeping thing. This one is awake.' },
    { shot: 'who', who: 'yuna', mood: 'firm', text: 'Cranes still swinging, loaders still running. Nobody is driving any of them.' },
    { shot: 'who', who: 'kyle', mood: 'think', fx: { aim: false, resonance: 0.3 }, text: 'Machines working a shift that ended weeks ago.' },
    { shot: 'who', who: 'jin', mood: 'firm', text: 'Then they work for something else now. Stay close. We cross together.' },
  ];
  const FOUNDRY_SKIT = [
    { shot: 'point', look: [World.FOUNDRY.x, 6, World.FOUNDRY.z - 7], fx: { resonance: 0.8, glitch: 0.1 }, caption: 'The Foundry Gate\nA dead loading bay, warm from the furnace behind the wall. The crew stops for a breath before the shutter.' },
    { shot: 'who', who: 'ruen', mood: 'worry', note: 'Her orb dimmed in her hands.', text: 'It\'s louder here. Like someone whispering my name through the wall. I don\'t know how long I can keep pretending I can\'t hear it.' },
    { shot: 'who', who: 'kyle', mood: 'nod', note: 'Setting his shield down and stepping close.', text: 'You don\'t have to pretend with me. Hold onto my voice instead. If it gets too loud, tell me. I\'ll carry the gear, and I\'ll carry you if I have to.' },
    { shot: 'who', who: 'yuna', mood: 'firm', note: 'Eyes on the shutter\'s lock.', text: 'Feelings are fine. But there\'s a corporate lock in front of us and a furnace behind it. We need a plan, not a vigil.' },
    { shot: 'who', who: 'jin', mood: 'nod', text: 'Both. Yuna, find us a way through that shutter. Kyle, stay near Ruen. And Ruen: when it whispers, tell it we\'re coming.' },
    { shot: 'who', who: 'ruen', mood: 'nod', fx: { resonance: 0.4, glitch: 0 }, text: '...I will. Thank you. All of you.' },
    { shot: 'who', who: 'yuna', mood: 'firm', fx: { resonance: 0.2 }, note: 'Running her fingers over the lock plate.', text: 'It wants a corporate access node, and maintenance crews drop them like loose change. There should be three scattered through the works. Find them and I can talk this door open.' },
    { shot: 'point', look: [World.FOUNDRY.x, 14, World.FOUNDRY.z - 15], caption: 'Three access nodes lie somewhere in the Hub, each marked by a pale beam of light.' },
  ];
  const SHUTTER_OPEN = [
    { shot: 'point', look: [World.FOUNDRY.x, 5, World.FOUNDRY.z - 7], caption: 'Back at the shutter. Yuna presses the three nodes into the lock plate one after another.' },
    { shot: 'who', who: 'yuna', mood: 'alert', note: 'The plate flickers from red to amber.', text: 'Come on, sweet-talk, give me what I need... Handshake accepted. Stand back.' },
    { shot: 'who', who: 'kyle', mood: 'firm', note: 'Raising his shield as the door groans.', text: 'Whatever\'s holding that furnace is going to hear this. Ruen, behind me.' },
    { shot: 'point', look: [World.FOUNDRY.x, 4, World.FOUNDRY.z - 10], fx: { glitch: 0.3 }, caption: 'The shutter grinds upward. Heat rolls out across the plaza, and in the dark hall beyond something huge turns its head.' },
  ];
  const LOADER_SIGHT = [
    { shot: 'point', look: [World.FOUNDRY.x, 3, World.FOUNDRY.z - 24], fx: { glitch: 0.5, resonance: 0.8 }, caption: 'The Foundry floor\nA river of molten metal, a catwalk, and a loader the size of a house, its cockpit glowing pink where a pilot should be.' },
    { shot: 'who', who: 'yuna', mood: 'alert', note: 'Counting the exits.', text: 'Cargo loader, hazard stripes, no pilot. The grid took it over. It\'s guarding the pedestal.' },
    { shot: 'who', who: 'ruen', mood: 'worry', note: 'Her orb throbbing in her hand.', text: 'The core is behind it. I can feel it pulling at me through all that noise.' },
    { shot: 'who', who: 'kyle', mood: 'firm', text: 'Then it has to go through me first. Yuna, Jin, find its weak side.' },
    { shot: 'who', who: 'jin', mood: 'firm', fx: { glitch: 0, resonance: 0.3 }, text: 'Together. Kyle takes the sweep, Yuna keeps it off balance, and Ruen, hit it when you have the line.' },
  ];
  const CORE_SCENE = [
    { shot: 'point', look: [World.FOUNDRY.x, 2, World.FOUNDRY.z - 22], fx: { resonance: 1, glitch: 0.2 }, caption: 'The Loader Mech folds to the floor with a groan of tearing metal. On the pedestal behind it, a Data Core turns in the furnace light.' },
    { shot: 'who', who: 'ruen', mood: 'alert', fx: { aim: true }, note: 'Stepping forward, her orb burning white.', text: 'It\'s the same thing I felt in the alley. Quieter now. It knows us.' },
    { shot: 'who', who: 'kyle', mood: 'worry', text: 'Ruen. Careful. Whatever the Corporation does with it, it hurt them to move it.' },
    { shot: 'who', who: 'ruen', mood: 'nod', note: 'Laying her palm on the core. The light slows.', text: 'It doesn\'t want to hurt anyone. It wants to be somewhere quiet. And it\'s showing me where the rest of it is... Up. Up at the top of the city.' },
    { shot: 'who', who: 'yuna', mood: 'firm', text: 'The Spire. A freight lift behind the pedestal, still powered. They\'d have shipped the cores straight up.' },
    { shot: 'who', who: 'jin', mood: 'firm', fx: { aim: false, glitch: 0, resonance: 0.4 }, text: 'Then that is our road. We rest, we gather ourselves, and then we ride it to the top.' },
    { shot: 'point', look: [World.FOUNDRY.x, 18, World.FOUNDRY.z - 22], caption: 'The lift to the Corporate Spire waits in the dark.\n\nEnd of Act 2. Act 3, the Spire, comes next.' },
  ];
  // ---------------- Camp skits: one short scene the first time the crew rest at each camp. Finishing one deepens the bonds it names ----------------
  const SKITS = {
    market: {
      bonds: [['ruen', 'kyle', 2], ['ruen', 'yuna', 1]],
      steps: [
        { shot: 'wide', caption: 'Neon Market \u00b7 The plaza camp\nA barrel of burning scrap between two dead stalls. For the first time since the alley, nobody is running.' },
        { shot: 'who', who: 'ruen', mood: 'worry', note: 'Watching the empty stalls.', text: 'Those husks. Mox said they used to be somebody\'s neighbours. What if I know one of them and can\'t tell?' },
        { shot: 'who', who: 'kyle', mood: 'nod', text: 'Then you remember them as they were. That\'s all any of us can do. And you keep walking, because stopping doesn\'t bring them back.' },
        { shot: 'who', who: 'yuna', mood: 'firm', note: 'Checking a magazine, not looking up.', text: 'It\'s also all they\'d want, Ruen. Nobody wants to be mourned in the street while the thing that did it is still running.' },
        { shot: 'who', who: 'ruen', mood: 'nod', text: '...You two are terrible at comforting people, you know. Thank you.' },
        { shot: 'who', who: 'jin', mood: 'firm', text: 'Rest while it\'s quiet. We climb at first light.' },
      ],
    },
    hub: {
      bonds: [['you', 'yuna', 2], ['kyle', 'yuna', 1]],
      steps: [
        { shot: 'wide', caption: 'The Hub checkpoint\nThe gate drones hang silent overhead. Their lenses follow the crew without ever quite landing on them.' },
        { shot: 'who', who: 'yuna', mood: 'think', note: 'Looking up at the nearest drone.', text: 'I used to work on those. Sector patrols, two years of them, before I knew what the logs were hiding.' },
        { shot: 'who', who: 'jin', mood: 'alert', text: 'You never told us that.' },
        { shot: 'who', who: 'yuna', mood: 'firm', text: 'You never asked. And I didn\'t want to be the one who spent every night wondering what I helped build.' },
        { shot: 'who', who: 'kyle', mood: 'nod', text: 'Then you know how they think. That makes you the most useful person here.' },
        { shot: 'who', who: 'jin', mood: 'nod', text: 'It does. Whatever you carry, you don\'t carry it alone. That goes for all of us.' },
        { shot: 'who', who: 'yuna', mood: 'talk', text: '...Fine. But if the drones wake, I\'m choosing which one to shoot first.' },
      ],
    },
    spire: {
      bonds: [['ruen', 'yuna', 2], ['you', 'ruen', 1]],
      steps: [
        { shot: 'wide', caption: 'The Spire lobby camp\nA scrap fire in a hall of white marble. It looks like a stain, and nobody minds.' },
        { shot: 'who', who: 'ruen', mood: 'think', note: 'Looking at her hands.', text: 'Yuna, can I ask you something? Were you ever afraid of this place? When you worked for them?' },
        { shot: 'who', who: 'yuna', mood: 'firm', text: 'Every day. I told myself fear was just a diagnostic. A sign that something wanted attention.' },
        { shot: 'who', who: 'yuna', mood: 'talk', text: 'It turns out it was. And I spent two years ignoring it. I don\'t plan to do that again.' },
        { shot: 'who', who: 'ruen', mood: 'nod', text: 'Then maybe being afraid isn\'t the problem. It\'s what we do with it.' },
        { shot: 'who', who: 'yuna', mood: 'nod', text: '...Stay behind me when it starts. I mean it. And keep that orb ready.' },
      ],
    },
    atrium: {
      bonds: [['you', 'ruen', 2], ['you', 'kyle', 1], ['kyle', 'ruen', 1]],
      steps: [
        { shot: 'wide', caption: 'The Server Atrium camp\nUnder the glass dome, the tower of data hums its one long note. The crew sit with their backs to it.' },
        { shot: 'who', who: 'jin', mood: 'think', text: 'Ruen. Whatever happens up there, I need you to hear me. You\'re not a piece, and you aren\'t a key. You\'re the one who got us this far.' },
        { shot: 'who', who: 'ruen', mood: 'worry', text: 'I\'m scared of what I\'ll have to do. I think I\'ll have to hold the whole thing, Jin. All of it. And I don\'t know if I can.' },
        { shot: 'who', who: 'kyle', mood: 'firm', text: 'You won\'t hold it alone. I don\'t say much, but I\'ll say that.' },
        { shot: 'who', who: 'jin', mood: 'nod', text: 'You\'ve been the compass the whole way. Now we\'re yours.' },
        { shot: 'who', who: 'ruen', mood: 'nod', text: 'Then I can do it. Thank you. Both of you.' },
      ],
    },
    foundry: {
      bonds: [['you', 'kyle', 2], ['you', 'ruen', 1]],
      steps: [
        { shot: 'wide', caption: 'The Foundry plaza\nThe furnace breathes behind the wall. The crew take a last quiet breath before whatever waits inside.' },
        { shot: 'who', who: 'kyle', mood: 'think', note: 'Tightening a strap on his gauntlet.', text: 'Back in the old days we planned for the job. Now we plan for whatever the job turns into.' },
        { shot: 'who', who: 'jin', mood: 'nod', text: 'It never turned into this before. But I\'d still pick the same four people.' },
        { shot: 'who', who: 'kyle', mood: 'firm', text: 'So would I. Whatever comes out of that door, you take the lead and I\'ll hold the line. Same as always.' },
        { shot: 'who', who: 'ruen', mood: 'alert', note: 'Her orb glowing steadily.', text: 'It\'s strong in there. But I feel steady. I feel... like I\'m not the only one holding the rope.' },
        { shot: 'who', who: 'jin', mood: 'firm', text: 'You aren\'t. Let\'s go.' },
      ],
    },
  };
  // The lift: a short scene, a fade, and the Spire's lobby, where the arrival scene plays
  function rideLift() {
    begin(LIFT_SCENE, () => {
      Camp.fadeThen(() => { Player.teleport(World.ARRIVE.x, World.ARRIVE.z); Player.faceTowards(World.ARRIVE.x, World.ARRIVE.z - 20); Camp.restoreCrew(Player.state()); });
      const go = () => { if (active) setTimeout(go, 250); else begin(SPIRE_ARRIVAL, () => setStage(14), { anchor: 'here' }); };
      setTimeout(go, 1400);
    }, { anchor: 'here' });
  }
  // The end card: the story is told; the world stays open
  function showEnd() { const el = $('endcard'); if (el) el.hidden = false; Sound.sfx('win'); }
  const bondUp = list => { if (typeof Growth !== 'undefined') for (const [a, b, n] of list) Growth.addBond(a, b, n); };

  // ---------------- Act 3: the Corporate Spire ----------------
  const CEO_WHO = { name: 'The CEO', color: '#fff0c0' };
  const LIFT_SCENE = [
    { shot: 'point', look: [World.LIFT.x, 6, World.LIFT.z], caption: 'The freight lift hums, its cage still powered. Above it, a shaft runs up into a column of pale light.' },
    { shot: 'who', who: 'kyle', mood: 'think', text: 'Everything above this floor is theirs. No more husks. People who know exactly what they\'re doing.' },
    { shot: 'who', who: 'yuna', mood: 'firm', text: 'Enforcers, sentry drones, cameras that don\'t blink. Nobody breaks ranks up there, and nobody falls behind.' },
    { shot: 'who', who: 'ruen', mood: 'alert', note: 'Her orb steady, almost bright.', text: 'I can hear it clearly now. It isn\'t whispering any more. It\'s waiting.' },
    { shot: 'who', who: 'jin', mood: 'firm', text: 'Then we don\'t keep it waiting. All aboard.' },
    { shot: 'point', look: [World.LIFT.x, 22, World.LIFT.z], caption: 'The lift climbs through the dark. For a long time there is only the hum, and the glow above growing brighter.' },
  ];
  const SPIRE_ARRIVAL = [
    { shot: 'point', look: [World.ARRIVE.x, 8, World.ARRIVE.z - 18], fx: { glitch: 0.25, resonance: 0.6 }, caption: 'The Corporate Spire · The Lobby\nThe lift opens onto white marble, glass, and a silence that costs a great deal of money.' },
    { shot: 'who', who: 'yuna', mood: 'alert', text: 'Clean. Too clean. They\'ve been scrubbing this place while the rest of the city came apart.' },
    { shot: 'point', look: [World.ARRIVE.x, 8, World.ARRIVE.z - 18], fx: { glitch: 0.6 }, caption: 'Shards of light hang in the air like frozen sparks. The company\'s mark on the far wall tears along its seams, then knits itself shut.' },
    { shot: 'who', who: 'ruen', mood: 'worry', text: 'The singularity is bleeding through. The whole Spire is coming apart at the edges, and no one up here is allowed to say so.' },
    { shot: 'who', who: 'jin', mood: 'firm', fx: { glitch: 0.2 }, text: 'We keep the pace and we stay together. The atrium is straight ahead; the servers there run everything above us.' },
  ];
  const ATRIUM_SCENE = [
    { shot: 'point', look: [World.ATRIUM.x, 8, World.ATRIUM.z], fx: { resonance: 0.8 }, caption: 'The Server Atrium\nA dome of glass over a ring of light, and in the middle a tower of data humming like a held note.' },
    { shot: 'point', look: [World.ATRIUM.x, 6, World.ATRIUM.z], name: 'Recorded message', color: '#ffe3a0', text: 'Executive briefing, final session. The cores are aligned. At the summit the singularity will open, and every system, every sign and every person will answer to the new order.' },
    { shot: 'point', look: [World.ATRIUM.x, 6, World.ATRIUM.z], name: 'Recorded message', color: '#ffe3a0', text: 'Do not interfere. The CEO will be at the summit. This is not an invitation.' },
    { shot: 'who', who: 'yuna', mood: 'firm', text: 'That\'s the CEO\'s voice. They\'re going to merge with it and rewrite the city with themselves as the author.' },
    { shot: 'who', who: 'ruen', mood: 'worry', text: 'It isn\'t only the cores. They want me. The resonance, my intuition. I\'m the piece that tunes it.' },
    { shot: 'who', who: 'kyle', mood: 'firm', note: 'Stepping in front of her.', text: 'Then the first thing they\'ll find at the summit is me, standing in front of you.' },
    { shot: 'who', who: 'jin', mood: 'nod', fx: { resonance: 0.3 }, text: 'And me. And Yuna. All of us, or none. Rest at the camp if you need to, then we climb.' },
  ];
  const SUMMIT_SIGHT = [
    { shot: 'point', look: [World.SUMMIT.x, 10, World.SUMMIT.z], fx: { resonance: 1, glitch: 0.5 }, caption: 'The Summit\nAt the top of the city the sky is torn open: a ring of gold light turning over a platform, and at its heart, one small figure in white.' },
    { shot: 'who', who: 'ruen', mood: 'alert', text: 'That\'s the whole door. Every core, every piece, all of it in one place.' },
    { shot: 'who', who: 'yuna', mood: 'firm', text: 'And the CEO in the middle, as if they owned it.' },
    { shot: 'who', who: 'jin', mood: 'firm', fx: { glitch: 0.2 }, text: 'When it starts, spread out. Kyle takes the sweep. Yuna, keep the locks off us. Ruen, when the singularity opens, you ground it.' },
    { shot: 'who', who: 'ruen', mood: 'nod', text: 'I know what to do. I think I\'ve known since the alley.' },
  ];
  const CEO_CONFRONT = [
    { shot: 'point', look: [World.SUMMIT.x, 4, World.SUMMIT.z - 5], fx: { resonance: 1 }, caption: 'The platform hums. The CEO turns, unhurried, and the light bends round them.' },
    { shot: 'who', ...CEO_WHO, ceo: true, mood: 'talk', text: 'Four of you. I expected an army, and what arrives are the pieces I was missing. Thank you for bringing her.' },
    { shot: 'who', who: 'jin', mood: 'firm', text: 'She isn\'t a piece. And you aren\'t opening anything.' },
    { shot: 'who', ...CEO_WHO, ceo: true, mood: 'talk', text: 'You think you came to stop me. You came because the resonance pulled you here. Everything you did was already written.' },
    { shot: 'who', who: 'ruen', mood: 'firm', text: 'Then I\'m going to write something over it.' },
    { shot: 'point', look: [World.SUMMIT.x, 8, World.SUMMIT.z], fx: { glitch: 0.6 }, caption: 'The ring of light spins faster. The fight begins.' },
  ];
  const RESOLUTION = [
    { shot: 'point', look: [World.SUMMIT.x, 8, World.SUMMIT.z], fx: { glitch: 0.9, resonance: 1 }, caption: 'The CEO\'s light tears open. The singularity, shield grounded at last, shudders and bends toward the floor.' },
    { shot: 'point', look: [World.SUMMIT.x, 3, World.SUMMIT.z], ...CEO_WHO, mood: 'worry', text: 'You can\'t ground it. It will take the whole city with it.' },
    { shot: 'who', who: 'ruen', mood: 'firm', note: 'Stepping forward, her orb white-hot.', text: 'It was never meant to be a door. It\'s energy, and it needs somewhere to go. We give it back to the city\'s old grid, the dead one.' },
    { shot: 'who', who: 'kyle', mood: 'nod', text: 'Tell me what to do.' },
    { shot: 'who', who: 'ruen', mood: 'nod', text: 'Just stay close. All of you.' },
    { shot: 'who', who: 'jin', mood: 'firm', text: 'Ruen. We\'ve got you.' },
    { shot: 'point', look: [World.SUMMIT.x, 8, World.SUMMIT.z], fx: { glitch: 0.4, resonance: 1, aim: false }, caption: 'Ruen lays her hand on the heart of the light. Kyle\'s shield, Yuna\'s pulse, Jin\'s blade: they each give her something to lean on. Pale gold pours down through the floor into the dead grid, and in every district the lights flicker back on.' },
    { shot: 'point', look: [World.SUMMIT.x, 3, World.SUMMIT.z], ...CEO_WHO, mood: 'worry', text: 'Forty years of work.' },
    { shot: 'who', who: 'yuna', mood: 'firm', text: 'Forty years of other people\'s lives.' },
    { shot: 'point', look: [World.SUMMIT.x, 14, World.SUMMIT.z], fx: { glitch: 0, resonance: 0 }, caption: 'The Spire\'s hold on the city is broken. Far below, the signs stop spelling things that aren\'t ads.' },
  ];
  const EPILOGUE = [
    { shot: 'wide', caption: 'Epilogue\nThe megacity is changed for ever: free of the Corporation\'s grip, but wild and unpredictable.' },
    { shot: 'who', who: 'kyle', mood: 'talk', text: 'So. What now?' },
    { shot: 'who', who: 'yuna', mood: 'firm', text: 'Now we find out who else has a Core in their pocket, and what they plan to do with it.' },
    { shot: 'who', who: 'ruen', mood: 'nod', note: 'Listening, then smiling.', text: 'The whispering has stopped. For the first time since the alley, it\'s quiet.' },
    { shot: 'who', who: 'jin', mood: 'nod', text: 'Then we pack up the camp, and we walk.' },
    { shot: 'point', look: [World.SUMMIT.x, 30, World.SUMMIT.z - 40], caption: 'The crew of four, battered but unbroken, shoulders their gear and walks into the glowing, glitching horizon, ready for whatever comes next.' },
  ];
  const moodOf = st => st.mood || 'talk';
  const typed = () => steps && steps[i] ? (steps[i].text || steps[i].caption || steps[i].note || '') : '';

  // A shot's target camera pose
  function shotFor(st) {
    if (st.shot === 'who') {
      const rg = rigFor(st), p = rg ? rg.root.position : tmp.set(Player.state().x, 0, Player.state().z);
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

  const ceoRig = () => { const g = Combat.groupList().find(x => x.id === 'ceo'); return g ? g.rigs[0] : null; };
  const rigFor = st => st.rig || (st.ceo ? ceoRig() : st.who ? rigOf(st.who) : null);
  const rigOf = key => key === 'jin' ? Player.rig() : (Camp.crew.find(q => q.name === key) || {}).rig;
  // Everyone in the scene: the speaker acts out the line's mood, the rest turn their heads toward the speaker
  let npcRig = null;
  function acting(on) {
    const st = on && steps && steps[i] ? steps[i] : null, sp = st ? rigFor(st) : null;
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
  const QUEST = ['\u25c6 Speak with the crew', '\u25c6 Rest by the fire and feel for the resonance', '\u25c6 Go through the gate into the Neon Market', '\u25c6 Follow the orb up the avenue', '\u25c6 Reach the foot of the tower', '\u25c6 Follow the pull to the Industrial Hub gate', '\u25c6 Cross the Hub to the Foundry', '\u25c6 Reach the Foundry\'s shutter', '\u25c6 Find the three access nodes', '\u25c6 Return to the Foundry\'s shutter', '\u25c6 Enter the Foundry', '\u25c6 Defeat the Loader Mech', '\u25c6 Take the Data Core', '\u25c6 Ride the freight lift to the Corporate Spire', '\u25c6 Cross the Spire lobby to the server atrium', '\u25c6 Climb to the summit', '\u25c6 Face the CEO at the summit', '\u25c6 Defeat the CEO', '\u25c6 The city is free. The road goes on.'];
  function setQuest(n) {
    const q = $('qtext'); if (q) q.textContent = n === 2 && !Combat.alleyCleared() ? '\u25c6 Break through the husks guarding the gate' : QUEST[n]; if (n > 0) Sound.sfx('quest');
    const toast = $('toast'); if (toast && n > 0) { toast.textContent = 'Quest updated'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
  }
  const setStage = n => { stage = n; setQuest(n); Save.touch(); Save.save(); };
  // After a load: the story stage is set without the chime or the toast
  function restore(n) { stage = n; const q = $('qtext'); if (q) q.textContent = n === 2 && !Combat.alleyCleared() ? '\u25c6 Break through the husks guarding the gate' : QUEST[n]; }
  // The alley's husks are beaten and the gate opens: the quest line says so
  function gateOpened() {
    const toast = $('toast'); if (toast) { toast.textContent = 'The gate\'s barrier dissolves'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); }
    if (stage === 2) { const q = $('qtext'); if (q) q.textContent = QUEST[2]; Sound.sfx('quest'); }
  }
  // Each access node picked up: the toast and the quest line show the count
  function nodeTaken(n) { const q = $('qtext'); if (q && stage === 8) q.textContent = QUEST[8] + ' (' + n + '/3)'; const toast = $('toast'); if (toast) { toast.textContent = 'Access node ' + n + ' / 3'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1800); } }
  // The objective the map points at: the gate, then the tower
  function objective() {
    if (stage === 2) return Combat.alleyCleared() ? { x: 0, z: World.Z0 + 4, label: 'the gate' } : { x: 0, z: -14, label: 'the husks' };
    if (stage === 3 || stage === 4) return { x: World.TOWER.x, z: World.TOWER.z, label: 'the tower' };
    if (stage === 5) return { x: World.GATE.x, z: World.GATE.z + 6, label: 'the Hub gate' };
    if (stage === 6 || stage === 7 || stage === 9) return { x: World.FOUNDRY.x, z: World.FOUNDRY.z, label: stage === 9 ? 'the shutter' : 'the Foundry' };
    if (stage === 8) { const n = World.nextNode(Player.state()); return n ? { x: n.x, z: n.z, label: 'an access node' } : null; }
    if (stage === 10 || stage === 11) { const c = World.coreAt(); return c ? { x: c.x, z: c.z + 5, label: 'the Foundry floor' } : null; }
    if (stage === 13) return { x: World.LIFT.x, z: World.LIFT.z, label: 'the freight lift' };
    if (stage === 14) return { x: World.ATRIUM.x, z: World.ATRIUM.z, label: 'the server atrium' };
    if (stage === 15 || stage === 16 || stage === 17) return { x: World.SUMMIT.x, z: World.SUMMIT.z, label: 'the summit' };
    if (stage === 12) { const c = World.coreAt(); return c ? { x: c.x, z: c.z, label: 'the Data Core' } : null; }
    return null;
  }
  // Place triggers: each plays once, when the crew first reaches the place at that stage
  function checkTriggers() {
    const p = Player.state(), dT = Math.hypot(p.x - World.TOWER.x, p.z - World.TOWER.z);
    if (stage === 2 && p.z < World.Z0 - 6) begin(ARRIVAL, () => setStage(3), { anchor: 'here' });
    else if (stage === 3 && dT < 70) begin(TOWER_SIGHT, () => setStage(4), { anchor: 'here' });
    else if (stage === 4 && dT < 26) begin(REVEAL, () => setStage(5), { anchor: 'here' });
    else if (stage === 5 && Math.hypot(p.x - World.GATE.x, p.z - World.GATE.z) < 22) begin(HUB_GATE, () => setStage(6), { anchor: 'here' });
    else if (stage === 6 && Math.hypot(p.x - World.FOUNDRY.x, p.z - World.FOUNDRY.z) < 75) begin(FOUNDRY_SIGHT, () => setStage(7), { anchor: 'here' });
    else if (stage === 7 && Math.hypot(p.x - World.FOUNDRY.x, p.z - World.FOUNDRY.z) < 14) begin(FOUNDRY_SKIT, () => setStage(8), { anchor: 'here' });
    else if (stage === 8 && World.nodeCount() >= 3) setStage(9);
    else if (stage === 9 && Math.hypot(p.x - World.FOUNDRY.x, p.z - World.FOUNDRY.z) < 12) begin(SHUTTER_OPEN, () => { World.openShutter(); setStage(10); }, { anchor: 'here' });
    else if (stage === 10 && p.z < World.FOUNDRY.z - 9 && Math.abs(p.x - World.FOUNDRY.x) < 11) begin(LOADER_SIGHT, () => { World.armBoss(); setStage(11); }, { anchor: 'here' });
    else if (stage === 11 && World.bossDown()) { setStage(12); }
    else if (stage === 12 && World.coreAt() && Math.hypot(p.x - World.coreAt().x, p.z - World.coreAt().z) < 5) begin(CORE_SCENE, () => setStage(13), { anchor: 'here' });
    else if (stage === 14 && Math.hypot(p.x - World.ATRIUM.x, p.z - World.ATRIUM.z) < 26) begin(ATRIUM_SCENE, () => setStage(15), { anchor: 'here' });
    else if (stage === 15 && Math.hypot(p.x - World.SUMMIT.x, p.z - World.SUMMIT.z) < 62) begin(SUMMIT_SIGHT, () => setStage(16), { anchor: 'here' });
    else if (stage === 16 && Math.hypot(p.x - World.SUMMIT.x, p.z - World.SUMMIT.z) < 20) begin(CEO_CONFRONT, () => { World.armCeo(); setStage(17); }, { anchor: 'here' });
    else if (stage === 17 && World.ceoDown()) begin(RESOLUTION, () => begin(EPILOGUE, () => { setStage(18); showEnd(); }, { anchor: 'here' }), { anchor: 'here' });
  }
  const NPC_LINES = {
    vendor: ['Scrap is as good as credit here. Show me what you\'ve got.', 'Fresh circuits, honest prices. Mostly honest.', 'Nobody\'s buying tonight. The signs keep lying about what\'s open.'],
    hub: ['Work crews walked out three weeks ago. The machines didn\'t get the message.', 'Corporate drones used to check my pass. Now they just watch. That\'s worse.', 'Don\'t go near the Foundry shutter at night. Something hums behind it.', 'The Hub was loud once. Now you can hear the furnaces thinking.'],
    rumor: ['The signs started spelling things that aren\'t ads. I stopped reading them.', 'Drones sweep the upper sectors at dawn. If you\'re heading up, go before.', 'Those husks? Used to be somebody\'s neighbours. The grid took the rest.', 'There\'s a tower up the avenue that hums at night. Don\'t stand near it.', 'My cousin walked toward the white light. We stopped getting his messages.'],
  };
  // Talking to someone in the Market: a short exchange, and a vendor's counter opens the camp's crafting panel afterwards
  function chat(npc) {
    const pool = NPC_LINES[npc.shop ? 'vendor' : npc.hub ? 'hub' : 'rumor'], a = pool[Math.floor(Math.random() * pool.length)], b2 = NPC_LINES.rumor[Math.floor(Math.random() * NPC_LINES.rumor.length)];
    const list = [{ shot: 'who', rig: npc.rig, name: npc.name, color: '#9fe0d0', mood: 'talk', text: a }];
    if (npc.shop) list.push({ shot: 'who', rig: npc.rig, name: npc.name, color: '#9fe0d0', mood: 'nod', text: 'Take a look at the counter.' }); else list.push({ shot: 'who', rig: npc.rig, name: npc.name, color: '#9fe0d0', mood: 'worry', text: b2 });
    begin(list, () => { if (npc.shop) CampUI.openShop(); }, { anchor: 'npc', npc });
  }
  // What the interact button does right now: the story at the fire, or a chat with someone close by
  function interactable() {
    const p = Player.state();
    const camp = Camp.nearCamp(p);
    if (camp === 'fire') return { kind: 'story', label: LABEL[Math.min(stage, 2)] };
    if (camp && SKITS[camp] && !Camp.skitSeen(camp)) return { kind: 'skit', id: camp, label: 'Talk' };
    if (stage === 13 && World.liftAt(p)) return { kind: 'lift', label: 'Ride the lift' };
    const n = World.nearNpc(p, 2.8); return n ? { kind: 'npc', npc: n, label: n.shop ? 'Trade \u00b7 ' + n.name : 'Talk \u00b7 ' + n.name } : null;
  }
  function start() {
    if (active || Combat.active()) return;
    const it = interactable(); if (!it) return;
    if (it.kind === 'npc') return chat(it.npc);
    if (it.kind === 'lift') return rideLift();
    if (it.kind === 'skit') { Camp.markSkit(it.id); Camp.rest(it.id); return begin(SKITS[it.id].steps, () => { bondUp(SKITS[it.id].bonds); Save.save(); }, { anchor: 'here' }); }
    if (stage === 0) begin(CAMPFIRE, () => setStage(1));
    else begin(RESONANCE, () => { if (stage < 2) setStage(2); });
  }
  const LABEL = ['Talk', 'Resonance', 'Replay'];

  function init() {
    $('endKeep').addEventListener('click', () => { $('endcard').hidden = true; Save.save(); });
    $('endTitle').addEventListener('click', () => { Save.save(true); location.reload(); });
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

  return { init, update, updateUI, applyCamera, active: () => active, start, started: () => started, stage: () => stage, objective, nodeTaken, gateOpened, restore, debugStage: n => setStage(n) };
})();
