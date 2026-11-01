// Nexus - the journal: what the crew carry (items), the foes they have met, the jobs they have taken, and the choices they have made in
// the story. Opened from the book button or the J key. Read only: the items are used in battle and the jobs are handed in as before.
const Journal = (() => {
  const $ = id => document.getElementById(id);
  let open = false, tab = 'items';
  // What each foe does, shown once the crew has met it
  const FOES = [
    { name: 'Husk', text: 'A hunched street husk. It lashes at the crew and winds up Crushes.' },
    { name: 'Husk Brute', text: 'Big and slow. Its heavy Crush hits hard, and only Stagger breaks it.' },
    { name: 'Enforcer', text: 'Raises a shield that halves the damage it takes. Stagger or Shockwave breaks it.' },
    { name: 'Sentry Drone', text: 'A floating security drone that shoots from the air.' },
    { name: 'Seraph Drone', text: 'Heals and shields the others. Break it first.' },
    { name: 'Siphon', text: 'Drains a crew member\'s gauge with each hit. Ruen\'s magic hurts it most.' },
    { name: 'Crawler', text: 'Quick and low. Its lash pins a crew member for a moment. Yuna\'s shots hurt it most.' },
    { name: 'Loader Mech', text: 'The Foundry\'s guardian. Its sweep hits the whole crew.' },
    { name: 'The CEO', text: 'Fights in three forms. Only Ruen\'s Data Burst can ground the singularity\'s shield.' },
  ];
  // The story choices, in words, for the Story tab
  const CHOICES = {
    'orb:tonight': 'You followed the orb that same night.',
    'orb:daylight': 'You waited for daylight before following the orb.',
    'spire:shutdown': 'You shut the Spire down for good.',
    'spire:keep': 'You kept the Spire\'s systems for the city.',
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function itemsTab() {
    const rows = Items.IDS.map(id => ({ id, n: Items.count(id), def: Tuning.items[id] })).filter(r => r.def);
    return '<div class="crew-card-one"><div class="cc-head"><b>Credits</b><span>' + Items.credits + '</span></div></div>'
      + rows.map(r => '<div class="crew-card-one' + (r.n ? '' : ' j-none') + '"><div class="cc-head"><b>' + esc(r.def.name) + '</b><span>× ' + r.n + '</span></div><div class="cc-xpt">' + esc(r.def.text) + '</div></div>').join('');
  }
  function foesTab() {
    return FOES.map(f => Growth.sawFoe(f.name)
      ? '<div class="crew-card-one"><div class="cc-head"><b>' + esc(f.name) + '</b></div><div class="cc-xpt">' + esc(f.text) + '</div></div>'
      : '<div class="crew-card-one j-none"><div class="cc-head"><b>???</b></div><div class="cc-xpt">Not met yet.</div></div>').join('');
  }
  function jobsTab() {
    const j = Quests.list();
    if (!j.length) return '<div class="crew-card-one"><div class="cc-xpt">No jobs yet. Talk to the people in the streets.</div></div>';
    return j.map(q => '<div class="crew-card-one' + (q.done ? ' j-none' : '') + '"><div class="cc-head"><b>' + esc(q.title) + (q.ready ? ' ✓ ready to hand in' : '') + '</b><span>' + esc(q.who) + '</span></div><div class="cc-xpt">' + esc(q.place) + ' · ' + esc(q.prog) + '</div></div>').join('');
  }
  function storyTab() {
    const f = Cutscene.flags(), made = Object.keys(f).map(k => CHOICES[k + ':' + f[k]]).filter(Boolean);
    return '<div class="crew-card-one"><div class="cc-head"><b>Act</b><span>' + Cutscene.stage() + '</span></div></div>'
      + (made.length ? made.map(t => '<div class="crew-card-one"><div class="cc-xpt">' + esc(t) + '</div></div>').join('') : '<div class="crew-card-one"><div class="cc-xpt">No choices made yet.</div></div>');
  }
  function render() {
    document.querySelectorAll('.j-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const body = $('journalBody');
    body.innerHTML = tab === 'items' ? itemsTab() : tab === 'foes' ? foesTab() : tab === 'jobs' ? jobsTab() : storyTab();
  }
  function setOpen(on) { if (on && (Combat.engaging() || Cutscene.active())) return; open = on; $('journal').hidden = !on; Player.setFrozen(on); if (on) render(); }

  function init() {
    $('btnJournal').addEventListener('click', () => setOpen(!open));
    $('journalClose').addEventListener('click', () => setOpen(false));
    document.querySelectorAll('.j-tabs button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    window.addEventListener('keydown', e => { if (e.code === 'KeyJ' && !CampUI.isOpen() && !CrewUI.isOpen()) setOpen(!open); else if (e.code === 'Escape' && open) setOpen(false); });
  }
  return { init, isOpen: () => open };
})();
