// Nexus - items and credits: the things shops sell. Credits come from fights (and from selling scrap to a vendor); items are used from the battle menu's
// Items button and take that crew member's turn. Camps are for crafting gear from scrap, shops are for these.
const Items = (() => {
  const DEF = Tuning.items, IDS = Object.keys(DEF);
  let credits = 0; const inv = {}; for (const id of IDS) inv[id] = 0;
  // What a vendor sells depends on where the stall is: the Market has the basics, the Hub adds revives and grenades
  const stockAt = z => z < World.HUB_Z ? ['patch', 'stim', 'revive', 'flash'] : ['patch', 'stim'];
  function buy(id) { const d = DEF[id]; if (!d || credits < d.price) return false; credits -= d.price; inv[id]++; return true; }
  function sellScrap() { if (!Camp.spend(1)) return false; credits += Tuning.credits.scrapSell; return true; }
  function use(id) { if (inv[id] > 0) { inv[id]--; return true; } return false; }
  return {
    DEF, IDS, stockAt, buy, sellScrap, use, add: n => { credits += n; }, count: id => inv[id], any: () => IDS.some(id => inv[id] > 0),
    get credits() { return credits; },
    getState: () => ({ credits, inv: Object.assign({}, inv) }),
    setState(d) { credits = d.credits || 0; for (const id of IDS) inv[id] = (d.inv && d.inv[id]) || 0; },
  };
})();
