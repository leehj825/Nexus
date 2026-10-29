// Nexus - the shop panel: opened by talking to a vendor. Items cost credits; the vendor also buys scrap.
const ShopUI = (() => {
  const $ = id => document.getElementById(id);
  let open = false, stock = [];
  function render() {
    const list = $('shopList'); list.textContent = '';
    for (const id of stock) {
      const d = Items.DEF[id], li = document.createElement('li'), info = document.createElement('div'), nm = document.createElement('b'), tx = document.createElement('span'), btn = document.createElement('button');
      nm.textContent = d.name + '  \u00d7' + Items.count(id); tx.textContent = d.text; info.append(nm, tx);
      btn.type = 'button'; btn.textContent = 'Buy \u25cf ' + d.price; btn.disabled = Items.credits < d.price;
      btn.addEventListener('click', () => { if (Items.buy(id)) { Sound.sfx('coin'); render(); } });
      li.append(info, btn); list.append(li);
    }
    const sl = document.createElement('li'), si = document.createElement('div'), sn = document.createElement('b'), st = document.createElement('span'), sb = document.createElement('button');
    sn.textContent = 'Sell scrap'; st.textContent = 'The vendor pays ' + Tuning.credits.scrapSell + ' credits for each piece (the camp uses scrap for gear)'; si.append(sn, st);
    sb.type = 'button'; sb.textContent = 'Sell \u25c6 1'; sb.disabled = Camp.parts < 1; sb.addEventListener('click', () => { if (Items.sellScrap()) { Sound.sfx('sell'); render(); } });
    sl.append(si, sb); list.append(sl);
    $('shopCredits').textContent = Items.credits; $('shopScrap').textContent = Camp.parts;
  }
  function setOpen(on) { open = on; $('shop').hidden = !on; Player.setFrozen(on); if (on) { stock = Items.stockAt(Player.state().z); render(); } }
  function init() {
    $('shopClose').addEventListener('click', () => setOpen(false));
    window.addEventListener('keydown', e => { if (e.code === 'Escape' && open) setOpen(false); });
  }
  return { init, open: () => setOpen(true), isOpen: () => open };
})();
