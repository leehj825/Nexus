// Nexus - growth: each of the four earns XP from fights and levels up (more health, harder hits, a faster gauge), learns skills at set levels,
// and builds bonds with the others (raised by fighting together and by camp skits, which unlock link attacks).
// This file keeps the numbers; combat.js reads them, and the crew screen shows them.
const Growth = (() => {
  const IDS = ['you', 'ruen', 'kyle', 'yuna'];
  const NAME = { you: 'Jin', ruen: 'Ruen', kyle: 'Kyle', yuna: 'Yuna' };
  const ROLE = { you: 'Vanguard', ruen: 'Hacker', kyle: 'Protector', yuna: 'Ranger' };
  const MAXLV = 10;
  const chars = {}; for (const id of IDS) chars[id] = { lv: 1, xp: 0, perk: { hp: 0, dmg: 0, rate: 0 }, pick: 0 };     // pick: perks still to choose
  // Each level gained gives a perk to choose: a stronger crew member in one way, and perks stack
  const PERKS = [{ id: 'hp', name: 'Vigour', text: '+8% health', v: 0.08 }, { id: 'dmg', name: 'Edge', text: '+6% damage', v: 0.06 }, { id: 'rate', name: 'Quickening', text: '+10% gauge speed', v: 0.10 }];
  const choosePerk = (id, kind) => { const c = chars[id], p = PERKS.find(q => q.id === kind); if (!p || c.pick <= 0) return false; c.perk[kind] += p.v; c.pick--; return true; };
  const need = lv => Tuning.xp.base + Tuning.xp.step * (lv - 1);        // XP from this level to the next
  const hpMult = lv => 1 + Tuning.growth.hp * (lv - 1), dmgMult = lv => 1 + Tuning.growth.dmg * (lv - 1), rateMult = lv => 1 + Tuning.growth.rate * (lv - 1);

  // The skills, by level. 'cmd' is the label the battle menu shows; combat.js runs it.
  const SKILLS = {
    you: [{ lv: 3, id: 'arc', name: 'Arc Slash', text: 'A sweeping blow that hits every foe' }, { lv: 6, id: 'edge', name: 'Resonant Edge', text: 'A heavy single cut for 3x damage' }, { lv: 8, id: 'rising', name: 'Rising Cut', text: 'One heavy rising cut for about 36 damage' }],
    ruen: [{ lv: 3, id: 'mend', name: 'Mend', text: 'Heals the whole crew' }, { lv: 6, id: 'storm', name: 'Data Storm', text: 'A slower, far bigger Data Burst' }, { lv: 8, id: 'surge', name: 'Data Surge', text: 'Fills every other crew member\'s gauge by a quarter' }],
    kyle: [{ lv: 3, id: 'bulwark', name: 'Bulwark', text: 'The whole crew braces against damage' }, { lv: 6, id: 'shock', name: 'Shockwave', text: 'Hits every foe and pushes their gauges back' }, { lv: 8, id: 'taunt', name: 'Taunt', text: 'The husks turn on Kyle for six seconds' }],
    yuna: [{ lv: 3, id: 'weak', name: 'Weak Point', text: 'A shot that makes the foe hit 30% softer' }, { lv: 6, id: 'barrage', name: 'Barrage', text: 'Five shots at random foes' }, { lv: 8, id: 'snipe', name: 'Snipe', text: 'One aimed shot for about 40 damage' }],
  };
  const has = (id, skill) => { const s = SKILLS[id].find(q => q.id === skill); return !!s && chars[id].lv >= s.lv; };
  const unlocked = id => SKILLS[id].filter(s => chars[id].lv >= s.lv);

  // Bonds between pairs: points -> level 1 (0), 2 (3), 3 (8). Level 2 unlocks the pair's link attack, level 3 makes it hit harder.
  const bonds = {};
  const pairKey = (a, b) => [a, b].sort().join('-');
  const addBond = (a, b, n) => { const k = pairKey(a, b); bonds[k] = (bonds[k] || 0) + n; };
  const bondPts = (a, b) => bonds[pairKey(a, b)] || 0;
  const bondLevel = (a, b) => { const p = bondPts(a, b); return p >= Tuning.bond.l3 ? 3 : p >= Tuning.bond.l2 ? 2 : 1; };
  const BOND_NAME = ['', 'Allies', 'Trusted', 'Bound'];
  const LINKS = [                                                // who leads the link, the partner it needs, the label
    { lead: 'you', with: 'yuna', id: 'crossfire', name: 'Crossfire', text: 'Jin and Yuna strike together and stagger the foe' },
    { lead: 'ruen', with: 'kyle', id: 'aegis', name: 'Aegis Burst', text: 'Ruen\'s burst under Kyle\'s shield: hits all, Kyle guards' },
    { lead: 'kyle', with: 'you', id: 'vow', name: 'Iron Vow', text: 'Kyle and Jin brace and strike together' },
  ];
  // The party fought together: every pair grows closer
  const fought = () => { for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) addBond(IDS[i], IDS[j], 1); };

  // Gives the same XP to everyone. Returns what changed: [{ id, from, to, skills: [names] }]
  function award(xp) {
    const ups = [];
    for (const id of IDS) {
      const c = chars[id]; if (c.lv >= MAXLV) continue;
      const from = c.lv; c.xp += xp;
      while (c.lv < MAXLV && c.xp >= need(c.lv)) { c.xp -= need(c.lv); c.lv++; }
      if (c.lv >= MAXLV) c.xp = 0;
      c.pick += c.lv - from;
      if (c.lv > from) ups.push({ id, from, to: c.lv, skills: SKILLS[id].filter(s => s.lv > from && s.lv <= c.lv).map(s => s.name) });
    }
    return ups;
  }
  // Bond scenes already played, by key
  const told = {};
  // Challenge mode: after the ending, the foes are tougher and pay more. Saved with the game.
  let chal = false;
  const getState = () => ({ chars: JSON.parse(JSON.stringify(chars)), bonds: Object.assign({}, bonds), told: Object.assign({}, told), chal });
  function setState(d) {
    for (const id of IDS) if (d.chars && d.chars[id]) Object.assign(chars[id], d.chars[id]);
    for (const k in bonds) delete bonds[k]; Object.assign(bonds, d.bonds || {});
    for (const k in told) delete told[k]; Object.assign(told, d.told || {});
    chal = !!d.chal;
  }
  return {
    IDS, NAME, ROLE, MAXLV, chars, need, SKILLS, LINKS, BOND_NAME, PERKS, choosePerk, told: k => !!told[k], markTold: k => { told[k] = true; }, challenge: () => chal, setChallenge: on => { chal = !!on; }, has, unlocked, award, addBond, bondPts, bondLevel, fought, getState, setState,
    lv: id => chars[id].lv, hpMult: id => hpMult(chars[id].lv) * (1 + chars[id].perk.hp), dmgMult: id => dmgMult(chars[id].lv) * (1 + chars[id].perk.dmg), rateMult: id => rateMult(chars[id].lv) * (1 + chars[id].perk.rate),
  };
})();
