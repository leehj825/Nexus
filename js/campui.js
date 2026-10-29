// Nexus - the camp's panel: the Camp button by the fire, the crafting list, and the scrap toast.
// Camp state (scrap, upgrades) lives in camp.js; this file only draws it and sends the player's choices back.
// Opening the panel freezes the avatar. The crew keep idling behind it, and the panel closes if the avatar walks off.
const CampUI = (() => {
  const $ = id => document.getElementById(id);
  const panel = $('camp'), list = $('campList'), btn = $('campBtn'), toast = $('toast');
  let shop = false, open = false, shown = '', seen = 0, toastTimer = 0;

  // Everything the list shows, as one string, so the list is only rebuilt when something in it changes
  const stateKey = () => Camp.found().join(',') + '|' + Camp.parts + '|' + Camp.UPGRADES.map(u => (Camp.isOwned(u.id) ? 1 : 0)).join('');

  function render() {
    list.textContent = '';
    for (const id of Growth.IDS) {                                                  // each crew member's next weapon and armour
      const head = document.createElement('li'); head.className = 'camp-char';
      head.innerHTML = '<b>' + Growth.NAME[id] + '</b><span>Lv ' + Growth.lv(id) + ' \u00b7 ' + Growth.ROLE[id] + '</span>';
      list.append(head);
      for (const slot of ['w', 'a']) {
        const u = Camp.nextGear(id, slot), li = document.createElement('li'), info = document.createElement('div'), name = document.createElement('b'), text = document.createElement('span'), btn = document.createElement('button');
        const label = slot === 'w' ? 'Weapon' : 'Armour', worn = Camp.wornName(id, slot);
        name.textContent = u ? u.name : worn; text.textContent = u ? label + ' \u00b7 ' + u.text + (worn ? ' (now ' + worn + ')' : '') : label + ' \u00b7 fully upgraded';
        info.append(name, text); btn.type = 'button';
        btn.textContent = u ? 'Craft \u25c6 ' + u.cost : 'Maxed'; btn.disabled = !u || Camp.parts < u.cost;
        if (u) btn.addEventListener('click', () => { if (Camp.buy(u.id)) { Sound.sfx('equip'); Combat.refreshAll(true); render(); } });
        li.classList.toggle('done', !u); li.append(info, btn); list.append(li);
      }
    }
    // Fast travel: any camp that has been found, from where the crew are standing now
    const here = Camp.nearCamp(Player.state()), tl = $('campTravel'); tl.textContent = '';
    const dest = Camp.siteList().filter(s => Camp.found().includes(s.id) && s.id !== here);
    $('campTravelH').hidden = tl.hidden = !dest.length || shop;
    for (const s of dest) {
      const li = document.createElement('li'), info = document.createElement('div'), nm = document.createElement('b'), go = document.createElement('button');
      nm.textContent = s.name; info.append(nm); go.type = 'button'; go.textContent = 'Go';
      go.addEventListener('click', () => { setOpen(false); Sound.sfx('travel'); Camp.travel(s.id); });
      li.append(info, go); tl.append(li);
    }
    shown = stateKey();
    $('campParts').textContent = Camp.parts;
  }

  function setOpen(on) {
    if (on && !open) Camp.rest(Camp.nearCamp(Player.state()));          // opening the camp is resting: the crew are healed and the game saves
    open = on; if (!on) shop = false;
    panel.hidden = !on;
    Player.setFrozen(on);
    if (on) render();
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
  }

  function init() {
    btn.addEventListener('click', () => setOpen(true));
    $('campClose').addEventListener('click', () => setOpen(false));
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' && open) setOpen(false);
      if (e.code === 'KeyC' && (open || !btn.hidden)) setOpen(!open);
    });
  }

  // Each frame: show the button only at the fire outside a battle, keep the counters and list current, toast new scrap
  function update() {
    const near = Camp.nearFire(Player.state()) && !Combat.active() && !Cutscene.active();
    if (open && !near && !shop) setOpen(false);
    btn.hidden = !near || open;
    $('parts').textContent = Camp.parts;
    if (Camp.parts > seen) showToast('+' + (Camp.parts - seen) + ' scrap');
    seen = Camp.parts;
    if (open && stateKey() !== shown) render();
  }

  return { init, update, isOpen: () => open };
})();
