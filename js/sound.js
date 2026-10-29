// Nexus - sound, all synthesized with the Web Sound API (the game ships no audio files).
//   Music: a generative synthwave loop in A minor (Am F C G): a pad, an arpeggio, a bass line and drums. Each layer has its own gain and the
//   mood (explore / market / battle / scene) crossfades between them; battle also runs faster.
//   Effects: hits, swings, blasts, casts, a nova, a shield, pickups, UI clicks, dialogue blips, and the fire's crackle.
// Browsers keep audio off until the page is touched, so the context is created on the first press or key.
const Sound = (() => {
  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, mood = 'explore', timer = 0;
  let musicOn = true, sfxOn = true, muted = false;
  try { muted = localStorage.getItem('nexus.muted') === '1'; if (localStorage.getItem('nexus.music') === '0') musicOn = false; if (localStorage.getItem('nexus.sfx') === '0') sfxOn = false; } catch (e) { /* storage can be blocked */ }
  const layers = {};                                                          // pad, arp, bass, kick, snare, hat: each a gain node
  const LEVEL = {
    explore: { pad: 0.5, arp: 0.22, bass: 0, kick: 0, snare: 0, hat: 0, clank: 0, bell: 0 },
    market: { pad: 0.45, arp: 0.32, bass: 0.35, kick: 0.3, snare: 0, hat: 0.14, clank: 0, bell: 0 },
    hub: { pad: 0.42, arp: 0.2, bass: 0.55, kick: 0.45, snare: 0, hat: 0.08, clank: 0.55, bell: 0 },          // the Industrial Hub: a heavy, driving pulse with metal hits
    spire: { pad: 0.5, arp: 0.34, bass: 0.22, kick: 0.1, snare: 0, hat: 0.1, clank: 0, bell: 0.55 },           // the Corporate Spire: cold, airy, glassy bells
    battle: { pad: 0.3, arp: 0.42, bass: 0.65, kick: 0.75, snare: 0.55, hat: 0.3, clank: 0, bell: 0 },
    scene: { pad: 0.5, arp: 0.08, bass: 0, kick: 0, snare: 0, hat: 0, clank: 0, bell: 0 },
  };
  const BPM = { explore: 88, market: 96, hub: 84, spire: 102, battle: 132, scene: 80 };
  // The notes, by zone: the alley and Market share one score; the Hub and Spire have their own (battles in a zone use its notes at battle speed)
  const R = -1;
  const SCORE = {
    default: { roots: [57, 53, 60, 55], chords: [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]], pad: 'sawtooth', padCut: 900, arpType: 'square', arpOct: 24, arpPat: [0, 1, 2, 1, 2, 0, 1, 2, 0, 2, 1, 2, 0, 1, 2, 1], bass: [0, 3, 6, 8, 11, 14], bassType: 'sawtooth', bassCut: 420 },
    hub: { roots: [50, 50, 53, 48], chords: [[0, 3, 7], [0, 3, 7], [0, 4, 7], [0, 4, 7]], pad: 'sawtooth', padCut: 520, arpType: 'sawtooth', arpOct: 12, arpPat: [0, R, R, 1, R, R, 2, R, 0, R, R, 1, R, 2, R, R], bass: [0, 2, 4, 6, 8, 10, 12, 14], bassType: 'sawtooth', bassCut: 300 },
    spire: { roots: [64, 60, 57, 62], chords: [[0, 4, 7, 11], [0, 4, 7, 11], [0, 3, 7, 10], [0, 4, 7, 10]], pad: 'triangle', padCut: 2600, arpType: 'triangle', arpOct: 36, arpPat: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 3, 2, 1, 0], bass: [0, 8], bassType: 'sine', bassCut: 500 },
  };
  let zone = 'default';
  const setZone = z => { zone = SCORE[z] ? z : 'default'; };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  let step = 0, nextT = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.5 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.9 : 0; sfxBus.connect(master);
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    for (const k of Object.keys(LEVEL.explore)) { layers[k] = ctx.createGain(); layers[k].gain.value = 0; layers[k].connect(musicBus); }
    setMood(mood, true);
    nextT = ctx.currentTime + 0.1; timer = setInterval(schedule, 40);
  }
  function setMood(m, now) {
    if (!LEVEL[m]) return; mood = m;
    if (!ctx) return;
    for (const k in layers) layers[k].gain.setTargetAtTime(LEVEL[m][k], ctx.currentTime, now ? 0.01 : 0.6);
  }

  // ---------- the score ----------
  function note(t, type, f, dur, vol, dest, cutoff, q = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cutoff; fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, dest, type, freq, q = 1) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    s.buffer = noiseBuf; fl.type = type; fl.frequency.value = freq; fl.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    while (nextT < ctx.currentTime + 0.18) {
      const P = SCORE[zone], s = step % 16, bar = Math.floor(step / 16) % 4, root = P.roots[bar], ch = P.chords[bar], sd = 60 / BPM[mood] / 4;
      if (s === 0) {                                                            // a new bar: the pad
        for (const dt of [-0.12, 0, 0.12]) for (const iv of ch) {
          const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
          o.type = P.pad; o.frequency.value = hz(root + iv); o.detune.value = dt * 100; fl.type = 'lowpass'; fl.frequency.value = P.padCut;
          g.gain.setValueAtTime(0.0001, nextT); g.gain.linearRampToValueAtTime(0.045, nextT + sd * 4); g.gain.linearRampToValueAtTime(0.0001, nextT + sd * 16);
          o.connect(fl); fl.connect(g); g.connect(layers.pad); o.start(nextT); o.stop(nextT + sd * 16 + 0.05);
        }
      }
      const arp = P.arpPat[s];                                                       // a figure over the chord (a rest where the pattern says so)
      if (arp >= 0) note(nextT, P.arpType, hz(root + P.arpOct + ch[arp % ch.length] + (s % 8 === 7 ? 12 : 0)), sd * 1.6, 0.06, layers.arp, 2200, 2);
      if (P.bass.includes(s)) note(nextT, P.bassType, hz(root - 24), sd * 2.2, zone === 'spire' ? 0.2 : 0.16, layers.bass, P.bassCut, 3);
      if (zone === 'hub' && [2, 6, 10, 13].includes(s)) { noise(nextT, 0.1, 0.22, layers.clank, 'bandpass', 640 + (s % 3) * 180, 7); note(nextT, 'square', 170 + (s % 3) * 40, 0.06, 0.05, layers.clank, 1500, 6); }     // metal hits off the beat
      if (zone === 'spire' && s % 4 === 0) { note(nextT, 'sine', hz(root + 36 + ch[(s / 4) % ch.length]), 1.6, 0.08, layers.bell, 7000); note(nextT, 'sine', hz(root + 48 + ch[(s / 4 + 1) % ch.length]), 1.0, 0.04, layers.bell, 8000); }   // glassy bells
      if (s % 4 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(140, nextT); o.frequency.exponentialRampToValueAtTime(40, nextT + 0.16); g.gain.setValueAtTime(0.5, nextT); g.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.22); o.connect(g); g.connect(layers.kick); o.start(nextT); o.stop(nextT + 0.25); }
      if (s === 4 || s === 12) noise(nextT, 0.16, 0.18, layers.snare, 'bandpass', 1900, 0.8);
      if (s % 2 === 1) noise(nextT, 0.04, 0.07, layers.hat, 'highpass', 7000);
      step++; nextT += sd;
    }
  }

  // ---------- effects ----------
  function sfx(name, o = {}) {
    if (!ctx || !sfxOn || muted) return; const t = ctx.currentTime + (o.delay || 0), d = sfxBus, vol = o.vol === undefined ? 1 : o.vol;
    switch (name) {
      case 'hit': noise(t, 0.12, 0.5 * vol, d, 'lowpass', 1400); note(t, 'sine', 110, 0.16, 0.5 * vol, d, 600); note(t, 'sine', 55, 0.22, 0.5 * vol, d, 300); break;
      case 'crit': noise(t, 0.2, 0.6 * vol, d, 'bandpass', 2600, 1.5); note(t, 'sine', 80, 0.3, 0.6 * vol, d, 500); break;
      case 'swing': noise(t, 0.18, 0.18 * vol, d, 'bandpass', 900 + (o.pitch || 0), 1.2); break;
      case 'blast': { const os = ctx.createOscillator(), g = ctx.createGain(); os.type = 'sawtooth'; os.frequency.setValueAtTime(1400, t); os.frequency.exponentialRampToValueAtTime(180, t + 0.18); g.gain.setValueAtTime(0.16 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); os.connect(g); g.connect(d); os.start(t); os.stop(t + 0.22); break; }
      case 'bolt': { const os = ctx.createOscillator(), g = ctx.createGain(); os.type = 'triangle'; os.frequency.setValueAtTime(300, t); os.frequency.exponentialRampToValueAtTime(1500, t + 0.25); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); os.connect(g); g.connect(d); os.start(t); os.stop(t + 0.32); break; }
      case 'cast': for (let i = 0; i < 6; i++) note(t + i * 0.12, 'sine', hz(69 + i * 3), 0.5, 0.1 * vol, d, 5000); break;
      case 'nova': noise(t, 0.9, 0.55 * vol, d, 'lowpass', 2600); note(t, 'sine', 60, 0.9, 0.7 * vol, d, 300); for (let i = 0; i < 5; i++) note(t + i * 0.04, 'sawtooth', hz(81 - i * 2), 0.6, 0.07 * vol, d, 4000); break;
      case 'shield': note(t, 'sine', 1320, 0.5, 0.18 * vol, d, 6000); note(t, 'sine', 1980, 0.4, 0.1 * vol, d, 6000); noise(t, 0.12, 0.1 * vol, d, 'highpass', 5000); break;
      case 'pickup': for (let i = 0; i < 3; i++) note(t + i * 0.07, 'square', hz(76 + i * 4), 0.14, 0.08 * vol, d, 5000); break;
      case 'click': note(t, 'square', 880, 0.05, 0.06 * vol, d, 4000); break;
      case 'quest': for (let i = 0; i < 4; i++) note(t + i * 0.1, 'triangle', hz(72 + [0, 4, 7, 12][i]), 0.5, 0.12 * vol, d, 5000); break;
      case 'die': { const os = ctx.createOscillator(), g = ctx.createGain(); os.type = 'sawtooth'; os.frequency.setValueAtTime(260, t); os.frequency.exponentialRampToValueAtTime(40, t + 0.7); g.gain.setValueAtTime(0.2 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75); os.connect(g); g.connect(d); os.start(t); os.stop(t + 0.8); noise(t, 0.5, 0.2 * vol, d, 'lowpass', 900); break; }
      case 'growl': { const os = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); os.type = 'sawtooth'; os.frequency.value = 70; l.frequency.value = 18; lg.gain.value = 25; l.connect(lg); lg.connect(os.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * vol, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); os.connect(g); g.connect(d); os.start(t); l.start(t); os.stop(t + 0.55); l.stop(t + 0.55); break; }
      case 'win': for (let i = 0; i < 5; i++) note(t + i * 0.11, 'square', hz(69 + [0, 4, 7, 12, 16][i]), 0.35, 0.1 * vol, d, 4500); break;
      case 'lose': for (let i = 0; i < 4; i++) note(t + i * 0.2, 'sawtooth', hz(64 - i * 3), 0.5, 0.1 * vol, d, 1500); break;
      case 'blip': note(t, 'square', o.f || 300, 0.045, 0.05 * vol, d, 3000); break;
      case 'glitch': for (let i = 0; i < 4; i++) noise(t + i * 0.05, 0.04, 0.2 * vol, d, 'bandpass', 800 + Math.random() * 3000, 4); break;
      case 'crackle': noise(t, 0.03, 0.08 * vol, d, 'highpass', 3000 + Math.random() * 2000); break;
    }
  }
  // Dialogue blips: a short chirp per few letters, pitched by who is speaking
  const VOICE = { jin: 220, ruen: 330, kyle: 150, yuna: 290 };
  function blip(who) { sfx('blip', { f: (VOICE[who] || 240) * (0.9 + Math.random() * 0.25), vol: 0.8 }); }

  // The fire's crackle, louder near it (called every frame with the player's position)
  let crackT = 0;
  function update(dt, p) {
    if (!ctx || muted) return;
    crackT -= dt; const d = Math.hypot(p.x, p.z);
    if (crackT <= 0 && d < 14) { sfx('crackle', { vol: Math.max(0, 1 - d / 14) * 1.4 }); crackT = 0.06 + Math.random() * 0.25; }
  }

  function setMuted(m) { muted = !!m; try { localStorage.setItem('nexus.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ } if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05); }
  function setMusic(on) { musicOn = !!on; try { localStorage.setItem('nexus.music', on ? '1' : '0'); } catch (e) { /* ignore */ } if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.1); }
  function setSfx(on) { sfxOn = !!on; try { localStorage.setItem('nexus.sfx', on ? '1' : '0'); } catch (e) { /* ignore */ } if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05); }

  // Sound must start from a user gesture
  function arm() { const go = () => { init(); window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); }; window.addEventListener('pointerdown', go); window.addEventListener('keydown', go); }
  arm();

  // When the app goes to the background (the tab is hidden, or the Android app pauses) the sound stops, and it comes back with the app
  let held = false;
  function suspend() { if (ctx && ctx.state === 'running') { held = true; ctx.suspend(); } }
  function resume() { if (ctx && held) { held = false; ctx.resume(); } }
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else resume(); });
  window.addEventListener('pagehide', suspend); window.addEventListener('pageshow', resume);
  window.nexusSuspend = suspend; window.nexusResume = resume;               // the Android app calls these when it is paused and resumed

  return { init, sfx, blip, setMood, setZone, update, setMuted, setMusic, setSfx, get muted() { return muted; }, get music() { return musicOn; }, get fx() { return sfxOn; }, get mood() { return mood; }, running: () => !!ctx && ctx.state === 'running' };
})();
