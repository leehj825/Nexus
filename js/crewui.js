// Nexus - the crew screen: level, XP, health, damage, skills, gear and bonds for each of the four. Opened from the Crew button or the I key.
const CrewUI = (() => {
  const $ = id => document.getElementById(id);
  const COLOR = { you: '#ffffff', ruen: '#c9a0ff', kyle: '#ffd27a', yuna: '#7ff7ff' };
  let open = false;

  function card(id) {
    const c = Growth.chars[id], need = Growth.need(c.lv), maxed = c.lv >= Growth.MAXLV;
    const info = Combat.partyInfo().find(u => u.id === id) || { hp: 0, hpMax: 0 };
    const dmg = Math.round(Growth.dmgMult(id) * Camp.damageMult(id) * 100);
    const el = document.createElement('div'); el.className = 'crew-card-one';
    const skills = Growth.SKILLS[id].map(s => '<li class="' + (c.lv >= s.lv ? 'on' : '') + '"><b>' + s.name + '</b><span>' + (c.lv >= s.lv ? s.text : 'Unlocks at Lv ' + s.lv) + '</span></li>').join('');
    const others = Growth.IDS.filter(o => o !== id);
    const bonds = others.map(o => { const lv = Growth.bondLevel(id, o), pts = Growth.bondPts(id, o), nxt = lv === 1 ? 3 : lv === 2 ? 8 : null; return '<li><b>' + Growth.NAME[o] + '</b><span>' + Growth.BOND_NAME[lv] + (nxt ? ' · ' + pts + ' / ' + nxt : ' · max') + '</span></li>'; }).join('');
    const links = Growth.LINKS.filter(l => l.lead === id || l.with === id).map(l => { const lv = Growth.bondLevel(l.lead, l.with); return '<li class="' + (lv >= 2 ? 'on' : '') + '"><b>' + l.name + '</b><span>' + (lv >= 2 ? l.text : 'Needs ' + Growth.NAME[l.lead] + ' and ' + Growth.NAME[l.with] + ' at Trusted') + '</span></li>'; }).join('');
    const perks = Growth.PERKS.map(q => { const n = Math.round(c.perk[q.id] / q.v); return n ? q.name + ' ×' + n : ''; }).filter(Boolean).join(' · ');
    const choose = c.pick > 0 ? '<div class="cc-sub">Choose a perk (' + c.pick + ' to pick)</div><div class="cc-perks">' + Growth.PERKS.map(q => '<button type="button" data-perk="' + q.id + '" data-who="' + id + '"><b>' + q.name + '</b><span>' + q.text + '</span></button>').join('') + '</div>' : '';
    const w = Camp.wornName(id, 'w') || 'starting weapon', a = Camp.wornName(id, 'a') || 'starting outfit';
    el.innerHTML = '<div class="cc-head"><b style="color:' + COLOR[id] + '">' + Growth.NAME[id] + '</b><span>' + Growth.ROLE[id] + ' · Lv ' + c.lv + '</span></div>'
      + '<div class="cc-xp"><i style="width:' + (maxed ? 100 : c.xp / need * 100) + '%"></i></div><div class="cc-xpt">' + (maxed ? 'Max level' : c.xp + ' / ' + need + ' XP') + '</div>'
      + '<div class="cc-stats"><span>Health <b>' + Math.round(info.hp) + ' / ' + info.hpMax + '</b></span><span>Damage <b>' + dmg + '%</b></span></div>'
      + '<div class="cc-sub">Gear</div><ul class="cc-list"><li><b>' + w + '</b><span>Weapon</span></li><li><b>' + a + '</b><span>Armour</span></li></ul>'
      + '<div class="cc-sub">Skills</div><ul class="cc-list">' + skills + '</ul>'
      + '<div class="cc-sub">Bonds</div><ul class="cc-list">' + bonds + '</ul>'
      + '<ul class="cc-list">' + links + '</ul>'
      + (perks ? '<div class="cc-xpt">Perks: ' + perks + '</div>' : '') + choose;
    return el;
  }
  // The job log: every side job taken, what it needs and what it pays
  function jobs() {
    const j = Quests.list(), el = document.createElement('div'); el.className = 'crew-card-one crew-jobs';
    el.innerHTML = '<div class="cc-head"><b>Jobs</b><span>' + j.filter(q => q.done).length + ' of ' + Quests.DEFS.length + ' done</span></div>'
      + (j.length ? '<ul class="cc-list">' + j.map(q => '<li class="' + (q.done ? '' : 'on') + '"><b>' + q.title + (q.ready ? ' \u2713 ready to hand in' : '') + '</b><span>' + q.who + ' \u00b7 ' + q.place + ' \u00b7 ' + q.prog + '</span></li>').join('') + '</ul>' : '<div class="cc-xpt">No jobs yet. People with a gold mark over their heads have work.</div>');
    return el;
  }
  function render() { const body = $('crewBody'); body.textContent = ''; for (const id of Growth.IDS) body.append(card(id)); body.append(jobs()); }
  // A perk button on a card: spend one pending pick on it, then redraw the screen
  function onPerk(e) { const b = e.target.closest && e.target.closest('button[data-perk]'); if (!b) return; if (Growth.choosePerk(b.dataset.who, b.dataset.perk)) { Save.save(); render(); } }
  function setOpen(on) { if (on && (Combat.engaging() || Cutscene.active())) return; open = on; $('crew').hidden = !on; Player.setFrozen(on); if (on) render(); }

  function init() {
    $('btnCrew').addEventListener('click', () => setOpen(!open));
    $('crewBody').addEventListener('click', onPerk);
    $('crewClose').addEventListener('click', () => setOpen(false));
    window.addEventListener('keydown', e => { if (e.code === 'KeyI' && !CampUI.isOpen()) setOpen(!open); else if (e.code === 'Escape' && open) setOpen(false); });
  }
  return { init, isOpen: () => open };
})();
