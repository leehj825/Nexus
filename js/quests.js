// Nexus - side jobs. Named people around the city ask the crew for favours: bring scrap, clear a district of foes, carry a package.
// A giver is a World NPC with a `tag`; talking to one goes through Quests.talkTo(npc) (called from cutscene.js), which returns the lines to
// say and what to do afterwards. Progress, rewards and the log are kept here and saved with the game.
const Quests = (() => {
  const NAME_OF = { market: 'the Market', hub: 'the Hub', spire: 'the Spire' };
  // kind: 'scrap' (hand in n pieces), 'sweep' (defeat n foes in `zone` after accepting), 'courier' (carry the pouch from `giver` to `to`)
  const DEFS = [
    { id: 'scrap1', giver: 'rook', who: 'Rook', zone: 'market', kind: 'scrap', n: 4, title: 'Spare Parts', reward: { cr: 90 },
      ask: ['My stall runs on salvage and the lanes are picked clean. Bring me four pieces of scrap and I\'ll make it worth your while.', 'Scrap is lying about in the lanes, glinting. You\'ll know it when you see it.'],
      wait: 'Four pieces of scrap. You\'ll find them in the lanes.', done: 'That\'s the good stuff. Here, as promised. Come back if you need anything.' },
    { id: 'sweep1', giver: 'tamsin', who: 'Tamsin', zone: 'market', kind: 'sweep', n: 6, title: 'Clear the Lanes', reward: { cr: 100, items: { patch: 2 } },
      ask: ['The husks keep coming back to the east lanes. Put six of them down and my customers might return.', 'Hit them in the open, where you can all fight. Don\'t go in blind.'],
      wait: 'Six husks, and the lanes are mine again.', done: 'I can hear my own stall again. Take these, they\'re all I\'ve got that isn\'t nailed down.' },
    { id: 'courier1', giver: 'juno', who: 'Juno', to: 'dax', toWho: 'Dax', zone: 'market', kind: 'courier', title: 'A Package for the Hub', reward: { cr: 70, items: { stim: 1 } },
      ask: ['I\'ve a sealed pouch for Dax at the Hub checkpoint. The checkpoint\'s been a mess since the shutdown. Take it? He\'ll pay you.', 'Don\'t open it. Please. Just get it to Dax, past the gate.'],
      wait: 'Dax is by the camp at the Hub checkpoint, past the gate.', done: 'Juno sent this? That\'s the part I\'ve been waiting on for a month. Here, for the trouble.', turnIn: 'Dax takes the pouch. "Good. Hold on."' },
    { id: 'sweep2', giver: 'okoro', who: 'Okoro', zone: 'hub', kind: 'sweep', n: 6, title: 'Quiet the Works', reward: { cr: 200, items: { revive: 1 } },
      ask: ['The machines on the floor won\'t stop. Whoever clears six of them from the works gets this crew\'s thanks. And a bit more.', 'Don\'t let them pin you in the narrow aisles.'],
      wait: 'Six machines off the floor and the shift can restart.', done: 'The floor\'s quiet for the first time in weeks. You\'ve earned this.' },
    { id: 'scrap2', giver: 'ivo', who: 'Ivo', zone: 'hub', kind: 'scrap', n: 5, title: 'Foundry Stock', reward: { cr: 170 },
      ask: ['The smelters are out of feed. Bring five scrap and I\'ll push it through for you. Cash up front on delivery.', 'Salvage is all over the works, and the factories have it in piles.'],
      wait: 'Five pieces of scrap for the smelters.', done: 'That\'ll keep the smelters hot another shift. Here\'s your cut.' },
    { id: 'sweep3', giver: 'vee', who: 'Vee', zone: 'spire', kind: 'sweep', n: 6, title: 'Sweep the Halls', reward: { cr: 320, items: { revive: 1, flash: 1 } },
      ask: ['I\'m staff, not security, and the security systems have decided I\'m a threat. Clear six of them out of the halls, will you?', 'They fire first and ask nothing. Keep your guard up.'],
      wait: 'Six security units, and I can go back to my desk.', done: 'They\'ve stopped following me. I can\'t pay much, but take this. And thank you.' },
    { id: 'scrap3', giver: 'thea', who: 'Thea', zone: 'spire', kind: 'scrap', n: 6, title: 'Cold Storage', reward: { cr: 280 },
      ask: ['The Spire\'s servers run hot and the cooling lines are failing. Six pieces of scrap will patch them. I\'ll pay properly.', 'The halls here are scattered with salvage. Careful with the drones.'],
      wait: 'Six pieces of scrap for the cooling lines.', done: 'The lines are holding. Take the payment, you\'ve saved a floor of servers.' },
    // Follow-ups: offered once the first job from the same person is done (`after`)
    { id: 'sweep4', giver: 'dax', who: 'Dax', zone: 'hub', kind: 'sweep', n: 5, after: 'courier1', title: 'The Checkpoint Pushback', reward: { cr: 160, items: { patch: 2 } },
      ask: ['The husks found the pouch route. Clear five from the checkpoint lanes and the pouches can keep moving.', 'They come out of the works at dusk. Hold the choke points.'],
      wait: 'Five husks off the checkpoint lanes.', done: 'The route is clear. You\'ve earned this.' },
    { id: 'scrap4', giver: 'rook', who: 'Rook', zone: 'market', kind: 'scrap', n: 6, after: 'scrap1', title: 'Bigger Salvage', reward: { cr: 150, items: { stim: 1 } },
      ask: ['The stall wants more now that word got round. Six pieces of scrap and there\'s a stim in it for you.', 'The bigger pieces are down by the old arches.'],
      wait: 'Six pieces of scrap for the stall.', done: 'Now that\'s a proper haul. Here, and my thanks.' },
    { id: 'sweep5', giver: 'vee', who: 'Vee', zone: 'spire', kind: 'sweep', n: 8, after: 'sweep3', title: 'The Drone Corridor', reward: { cr: 380, items: { revive: 1 } },
      ask: ['They\'ve moved the drones into the east corridor. Eight of them down and the staff can use the lifts again.', 'The drones fly in pairs. Break one at a time.'],
      wait: 'Eight security units from the east corridor.', done: 'The corridor\'s ours. Thank you. Take this before someone notices it\'s gone.' },
  ];
  const byId = id => DEFS.find(d => d.id === id);
  const st = {};                                                                                // id -> { s: 'active' | 'done', n }
  const status = id => (st[id] && st[id].s) || 'new';

  const toast = text => { const t = document.getElementById('toast'); if (t) { t.textContent = text; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); } };
  const zoneAt = z => z < World.SPIRE_Z - 2 ? 'spire' : z < World.HUB_Z - 2 ? 'hub' : 'market';
  // The job a giver has on offer: their first job not yet done whose follow-up condition is met
  const offerFor = tag => DEFS.find(q => q.giver === tag && status(q.id) !== 'done' && (!q.after || status(q.after) === 'done'));
  const lastDone = tag => DEFS.filter(q => q.giver === tag && status(q.id) === 'done').pop();
  const ready = d => { const s = st[d.id]; if (!s || s.s !== 'active') return false; if (d.kind === 'scrap') return Camp.parts >= d.n; if (d.kind === 'sweep') return s.n >= d.n; return false; };

  function give(d) {
    const r = d.reward; if (r.cr) Items.add(r.cr);
    for (const k of Object.keys(r.items || {})) Items.give(k, r.items[k]);
    const bits = []; if (r.cr) bits.push(r.cr + ' credits'); for (const k of Object.keys(r.items || {})) bits.push(r.items[k] + ' × ' + Tuning.items[k].name);
    toast('Job done: ' + d.title + ' · ' + bits.join(', ')); Sound.sfx('quest');
  }
  function accept(d) { st[d.id] = { s: 'active', n: 0 }; toast('New job: ' + d.title); Sound.sfx('quest'); }
  function finish(d) { if (d.kind === 'scrap') Camp.spend(d.n); st[d.id] = { s: 'done', n: d.n || 0 }; give(d); Save.save(); }
  const L = (text, mood) => ({ text, mood: mood || 'talk' });

  // What a person says when talked to, and what happens after. Null when they have no job business.
  function talkTo(npc) {
    if (!npc.tag) return null;
    const c = DEFS.find(q => q.to === npc.tag && status(q.id) === 'active');
    if (c) return { lines: [L(c.turnIn || 'You\'re carrying something for me?'), L(c.done, 'nod')], done: () => finish(c) };
    const d = offerFor(npc.tag);
    if (!d) return lastDone(npc.tag) ? { lines: [L('Thanks again. The crew\'s always welcome here.', 'nod')], done: null } : null;
    const s = status(d.id);
    if (s === 'new') return { lines: [L(d.ask[0]), L(d.ask[1], 'nod')], done: () => accept(d) };
    if (ready(d)) return { lines: [L(d.done, 'nod')], done: () => finish(d) };
    return { lines: [L(d.wait)], done: null };
  }
  // A marker over a giver's head: gold diamond for a job on offer, a brighter one when it can be handed in; none otherwise
  function mark(npc) {
    if (!npc.tag) return 0;
    const c = DEFS.find(q => q.to === npc.tag && status(q.id) === 'active'); if (c) return 2;
    const d = offerFor(npc.tag); if (!d) return 0;
    const s = status(d.id); return s === 'new' ? 1 : s === 'active' && ready(d) ? 2 : 0;
  }
  function defeated(n, z) {
    const zn = zoneAt(z), done = [];
    for (const d of DEFS) if (d.kind === 'sweep' && d.zone === zn && status(d.id) === 'active' && st[d.id].n < d.n) { st[d.id].n = Math.min(d.n, st[d.id].n + n); if (st[d.id].n >= d.n) done.push(d); }
    for (const d of done) toast('Job ready to hand in: ' + d.title + ' · return to ' + d.who);
  }
  // For the crew screen: every job that has been taken, with where it stands
  function list() {
    return DEFS.filter(d => status(d.id) !== 'new').map(d => {
      const s = status(d.id); let prog = '';
      if (s === 'done') prog = 'Done';
      else if (d.kind === 'scrap') prog = Math.min(Camp.parts, d.n) + ' / ' + d.n + ' scrap';
      else if (d.kind === 'sweep') prog = st[d.id].n + ' / ' + d.n + ' foes';
      else prog = 'Deliver to ' + d.toWho;
      return { title: d.title, who: d.who, place: NAME_OF[d.zone], prog, done: s === 'done', ready: s === 'active' && ready(d), text: s === 'done' ? d.done : d.ask[0] };
    });
  }
  return {
    DEFS, talkTo, mark, defeated, list, status,
    getState: () => JSON.parse(JSON.stringify(st)),
    setState(d) { for (const k of Object.keys(st)) delete st[k]; Object.assign(st, d || {}); },
  };
})();
