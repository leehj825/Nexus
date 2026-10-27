// Nexus - the camp's panel: the Camp button by the fire, the crafting list, and the scrap toast.
// Camp state (scrap, upgrades) lives in camp.js; this file only draws it and sends the player's choices back.
// Opening the panel freezes the avatar. The crew keep idling behind it, and the panel closes if the avatar walks off.
const CampUI = (() => {
  const $ = id => document.getElementById(id);
  const panel = $('camp'), list = $('campList'), btn = $('campBtn'), toast = $('toast');
  let open = false, shown = '', seen = 0, toastTimer = 0;

  // Everything the list shows, as one string, so the list is only rebuilt when something in it changes
  const stateKey = () => Camp.parts + '|' + Camp.UPGRADES.map(u => (Camp.isOwned(u.id) ? 1 : 0)).join('');

  function render() {
    list.textContent = '';
    for (const u of Camp.UPGRADES) {
      const li = document.createElement('li');
      const done = Camp.isOwned(u.id);
      const info = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = u.name;
      const text = document.createElement('span');
      text.textContent = u.text;
      info.append(name, text);
      const buy = document.createElement('button');
      buy.type = 'button';
      buy.textContent = done ? 'Installed' : 'Craft ◆ ' + u.cost;
      buy.disabled = done || Camp.parts < u.cost;
      buy.addEventListener('click', () => { if (Camp.buy(u.id)) render(); });
      li.classList.toggle('done', done);
      li.append(info, buy);
      list.append(li);
    }
    shown = stateKey();
    $('campParts').textContent = Camp.parts;
  }

  function setOpen(on) {
    open = on;
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
    const near = Camp.nearFire(Player.state()) && !Combat.active();
    if (open && !near) setOpen(false);
    btn.hidden = !near || open;
    $('parts').textContent = Camp.parts;
    if (Camp.parts > seen) showToast('+' + (Camp.parts - seen) + ' scrap');
    seen = Camp.parts;
    if (open && stateKey() !== shown) render();
  }

  return { init, update };
})();
