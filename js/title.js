// Nexus - the title screen: Continue (if there is a save) or New Game. Choosing one starts the game, and the first click also unlocks the sound.
const Title = (() => {
  const $ = id => document.getElementById(id);
  const where = s => s < 2 ? 'Act 1 \u00b7 The Underbelly' : s < 6 ? 'Act 2 \u00b7 The Neon Market' : s < 14 ? 'Act 2 \u00b7 The Industrial Hub' : 'Act 3 \u00b7 The Corporate Spire';
  function init(onLoad) {
    const el = $('title'), info = Save.info();
    $('tContinue').hidden = $('tInfo').hidden = !info;
    if (info) $('tInfo').textContent = where(info.stage) + ' \u00b7 saved ' + new Date(info.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    $('tNew').textContent = info ? 'New Game' : 'Start';
    const go = () => { el.hidden = true; document.body.classList.remove('titled'); Save.start(); };
    $('tContinue').addEventListener('click', () => { if (Save.load()) onLoad(); go(); });
    $('tNew').addEventListener('click', () => { if (info && !confirm('Start over? The saved game will be erased.')) return; Save.clear(); go(); });
    document.body.classList.add('titled');
  }
  return { init };
})();
