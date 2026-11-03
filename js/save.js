// Nexus - saving: one slot in localStorage. Each module that has progress registers a getter and a setter; Save collects them into one
// object and writes it when the game is calm (not in a battle or a scene), on a timer, at camps and story points, and when the page is hidden.
// Loading hands each module its part back, in the order they were registered (the world first, the player last).
const Save = (() => {
  const KEY = 'nexus.save', VERSION = 1;
  const parts = [];                                              // { name, get, set }
  let dirty = false, timer = 0, lastOk = 0;
  const store = {
    get: () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set: v => { try { localStorage.setItem(KEY, v); return true; } catch (e) { return false; } },
    del: () => { try { localStorage.removeItem(KEY); } catch (e) {} },
  };
  const register = (name, get, set) => parts.push({ name, get, set });
  const has = () => { const s = store.get(); if (!s) return false; try { return JSON.parse(s).v === VERSION; } catch (e) { return false; } };
  const calm = () => !Combat.active() && !Combat.engaging() && !Cutscene.active();

  let frozen = false;                                            // set once a New Game+ save is written: the page is about to reload, so nothing may overwrite it
  function save(force) {
    if (frozen || (!force && !calm())) return false;
    const data = { v: VERSION, at: Date.now() };
    for (const p of parts) data[p.name] = p.get();
    const ok = store.set(JSON.stringify(data)); if (ok) { dirty = false; lastOk = Date.now(); }
    return ok;
  }
  function load() {
    const s = store.get(); if (!s) return false;
    let data; try { data = JSON.parse(s); } catch (e) { return false; }
    if (data.v !== VERSION) return false;
    for (const p of parts) if (data[p.name] !== undefined) p.set(data[p.name]);
    return true;
  }
  const clear = () => store.del();
  const touch = () => { dirty = true; };
  function update(dt) {
    timer += dt;
    if (timer > 15) { timer = 0; if (started) save(); }
  }
  function init() {
    document.addEventListener('visibilitychange', () => { if (document.hidden && started) save(); });
    window.addEventListener('pagehide', () => { if (started) save(); });
  }
  let started = false;
  // The summary the title screen shows: when, and how far the story has got
  function info() { const s = store.get(); if (!s) return null; try { const d = JSON.parse(s); return { at: d.at, stage: d.story ? d.story.stage : 0 }; } catch (e) { return null; } }
  // Writes a save made of only the given parts (the rest start fresh): used by New Game+
  const writeOnly = parts => { const ok = store.set(JSON.stringify(Object.assign({ v: VERSION, at: Date.now() }, parts))); if (ok) frozen = true; return ok; };
  return { register, has, save, load, clear, touch, update, init, info, writeOnly, start: () => { started = true; }, lastSaved: () => lastOk };
})();
