/* Ghost Haunt audio — everything is synthesised with WebAudio, no files to load. */
window.GhostAudio = (() => {
  'use strict';
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };

  let ctx = null, master, fxBus, musicBus, echo, noiseBuf, droneLp;
  let muted = store.get('ghost-haunt-muted', '0') === '1';
  const VOL = 0.65;
  const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29, 31];
  // per-sound throttle so a hundred simultaneous hits don't turn into a wall of noise
  const last = {};
  const gate = (k, gap) => { if (!ctx) return false; const n = ctx.currentTime; if (last[k] && n - last[k] < gap) return false; last[k] = n; return true; };

  // music: a simple pulsing bass + arpeggio sequencer whose intensity follows the action
  let step = 0, nextStep = 0, intensity = 0, musicOn = false, bpm = 112, moodRoot = 45;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : VOL;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ctx.destination);
    fxBus = ctx.createGain(); fxBus.gain.value = 0.9; fxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.25; musicBus.connect(master);
    echo = ctx.createDelay(1); echo.delayTime.value = 0.32;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const wet = ctx.createGain(); wet.gain.value = 0.45;
    echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // eerie drone underneath everything
    droneLp = ctx.createBiquadFilter(); droneLp.type = 'lowpass'; droneLp.frequency.value = 220; droneLp.Q.value = 5;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 90; lfo.connect(lfoG); lfoG.connect(droneLp.frequency); lfo.start();
    const dg = ctx.createGain(); dg.gain.value = 0.05; droneLp.connect(dg); dg.connect(musicBus);
    [55, 55.4, 82.41].forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(droneLp); o.start(); });
  }
  function env(g, t0, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  function tone({ type = 'sine', f = 440, f2 = 0, dur = 0.2, vol = 0.2, attack = 0.005, delay = 0, at = 0, music = false, wet = false }) {
    if (!ctx || muted) return;
    const t0 = at || ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    env(g, t0, vol, attack, dur);
    o.connect(g); g.connect(music ? musicBus : fxBus); if (wet) g.connect(echo);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise({ dur = 0.3, vol = 0.2, f = 1000, f2 = 0, q = 1, type = 'bandpass', delay = 0, at = 0, attack = 0.005, music = false }) {
    if (!ctx || muted) return;
    const t0 = at || ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f, t0);
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain(); env(g, t0, vol, attack, dur);
    s.connect(flt); flt.connect(g); g.connect(music ? musicBus : fxBus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }
  const midi = n => 440 * 2 ** ((n - 69) / 12);

  // a minor-ish groove; bass on every beat, arpeggio density rises with intensity
  const BASS = [0, 0, 3, 0, -2, -2, 0, 5];
  const ARP = [12, 15, 19, 22, 24, 22, 19, 15];
  function scheduleMusic() {
    if (!ctx || muted || !musicOn) return;
    const spb = 60 / bpm / 2; // eighth notes
    if (nextStep < ctx.currentTime) nextStep = ctx.currentTime + 0.05;
    while (nextStep < ctx.currentTime + 0.25) {
      const s = step % 16, bar = Math.floor(step / 16) % 8, root = moodRoot + BASS[bar];
      if (s % 2 === 0) tone({ type: 'triangle', f: midi(root - 12), dur: spb * 1.6, vol: 0.13 + intensity * 0.05, music: true, at: nextStep });
      if (s % 4 === 0) noise({ dur: 0.12, vol: 0.05 + intensity * 0.12, f: 120, type: 'lowpass', music: true, at: nextStep });
      if (intensity > 0.3 && s % 4 === 2) noise({ dur: 0.06, vol: 0.03 + intensity * 0.05, f: 7000, type: 'highpass', music: true, at: nextStep });
      if (intensity > 0.15 && (s % 2 === 1 || intensity > 0.6)) {
        const n = root + ARP[(s + bar) % ARP.length];
        tone({ type: 'square', f: midi(n), dur: spb * 0.9, vol: 0.012 + intensity * 0.022, music: true, at: nextStep, wet: s % 4 === 1 });
      }
      if (s === 0 && bar % 2 === 0) tone({ type: 'sine', f: midi(root + 24 + pick([0, 3, 7])), dur: spb * 6, vol: 0.03, attack: 0.2, music: true, at: nextStep, wet: true });
      nextStep += spb; step++;
    }
  }

  return {
    init,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted; store.set('ghost-haunt-muted', muted ? '1' : '0');
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : VOL, ctx.currentTime, 0.05);
      return muted;
    },
    music(level) { if (ctx) musicBus.gain.setTargetAtTime(level, ctx.currentTime, 0.4); },
    setMusic(on) { musicOn = on; if (on && ctx) nextStep = ctx.currentTime + 0.1; },
    setIntensity(k, frenzy) {
      intensity += (k - intensity) * 0.05;
      bpm = frenzy ? 140 : 108 + intensity * 20;
      moodRoot = frenzy ? 44 : 45;
      if (ctx && droneLp) droneLp.frequency.setTargetAtTime(frenzy ? 520 : 220, ctx.currentTime, 0.8);
    },
    tick() { scheduleMusic(); },

    // ---------- SFX ----------
    gem(n) {
      if (!gate('gem', 0.035)) return;
      const f = midi(84 + SCALE[n % SCALE.length]);
      tone({ f, dur: 0.12, vol: 0.07 });
      tone({ type: 'triangle', f: f * 2, dur: 0.06, vol: 0.025 });
    },
    coin() { if (!gate('coin', 0.05)) return; tone({ type: 'square', f: 1320, dur: 0.06, vol: 0.05 }); tone({ type: 'square', f: 1760, dur: 0.12, vol: 0.05, delay: 0.06 }); },
    hit() { if (!gate('hit', 0.045)) return; noise({ dur: 0.07, vol: 0.12, f: rand(1400, 2400), q: 2 }); },
    kill() { if (!gate('kill', 0.04)) return; noise({ dur: 0.1, vol: 0.13, f: rand(700, 1300), q: 1.5 }); tone({ type: 'square', f: rand(300, 380), f2: 90, dur: 0.09, vol: 0.04 }); },
    bolt() { if (!gate('bolt', 0.07)) return; tone({ type: 'sine', f: 900, f2: 1700, dur: 0.1, vol: 0.05 }); },
    aura() { if (!gate('aura', 0.3)) return; noise({ dur: 0.25, vol: 0.04, f: 500, f2: 200, type: 'lowpass' }); },
    candle() { if (!gate('candle', 0.5)) return; tone({ type: 'triangle', f: 660, f2: 990, dur: 0.3, vol: 0.06, wet: true }); },
    zap() { if (!gate('zap', 0.06)) return; noise({ dur: 0.18, vol: 0.2, f: 3500, f2: 800, q: 0.8 }); tone({ type: 'sawtooth', f: 1200, f2: 120, dur: 0.15, vol: 0.06 }); },
    swish() { if (!gate('swish', 0.08)) return; noise({ dur: 0.22, vol: 0.12, f: 600, f2: 2600, q: 2 }); },
    shatter() { if (!gate('shatter', 0.08)) return; noise({ dur: 0.18, vol: 0.12, f: 4000, q: 3 }); tone({ type: 'sine', f: 300, f2: 120, dur: 0.25, vol: 0.06 }); },
    wail() { if (!gate('wail', 0.1)) return; tone({ type: 'sawtooth', f: 520, f2: 880, dur: 0.18, vol: 0.04 }); noise({ dur: 0.18, vol: 0.08, f: 1500, f2: 3000, q: 1 }); },
    moon() { if (!gate('moon', 0.1)) return; tone({ type: 'sine', f: 180, f2: 50, dur: 0.5, vol: 0.18 }); noise({ dur: 0.4, vol: 0.14, f: 900, f2: 150, type: 'lowpass' }); },
    enemyShot() { if (!gate('eshot', 0.12)) return; tone({ type: 'square', f: 260, f2: 520, dur: 0.12, vol: 0.03 }); },
    hurt() {
      if (!gate('hurt', 0.12)) return;
      tone({ type: 'sawtooth', f: 220, f2: 60, dur: 0.3, vol: 0.18 });
      noise({ dur: 0.2, vol: 0.2, f: 500, type: 'lowpass' });
    },
    dash() { noise({ dur: 0.25, vol: 0.18, f: 500, f2: 3800, q: 1.5 }); },
    levelUp() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone({ type: 'square', f: midi(67 + s), dur: 0.16, vol: 0.06, delay: i * 0.045, wet: true })); },
    pickCard() { [0, 7, 12].forEach((s, i) => tone({ type: 'triangle', f: midi(76 + s), dur: 0.2, vol: 0.1, delay: i * 0.05 })); },
    evolve() {
      [0, 4, 7, 11, 12, 16, 19, 24].forEach((s, i) => tone({ type: 'triangle', f: midi(64 + s), dur: 0.5, vol: 0.11, delay: i * 0.07, wet: true }));
      tone({ type: 'sawtooth', f: 65, f2: 130, dur: 1.2, vol: 0.12, attack: 0.1 });
    },
    heal() { [0, 4, 7].forEach((s, i) => tone({ f: midi(72 + s), dur: 0.35, vol: 0.1, delay: i * 0.07, wet: true })); },
    power() { [0, 5, 9, 12, 17].forEach((s, i) => tone({ type: 'square', f: midi(72 + s), dur: 0.12, vol: 0.05, delay: i * 0.05 })); },
    freeze() { [24, 19, 15, 12].forEach((s, i) => tone({ type: 'sine', f: midi(72 + s), dur: 0.5, vol: 0.08, delay: i * 0.06, wet: true })); noise({ dur: 0.6, vol: 0.1, f: 6000, type: 'highpass' }); },
    nuke() { tone({ type: 'sawtooth', f: 60, f2: 30, dur: 1.4, vol: 0.3, attack: 0.02 }); noise({ dur: 1.2, vol: 0.35, f: 1500, f2: 80, type: 'lowpass' }); },
    boo() {
      tone({ type: 'triangle', f: 320, f2: 80, dur: 0.9, vol: 0.32, attack: 0.03 });
      tone({ type: 'sine', f: 150, f2: 45, dur: 1.1, vol: 0.3, attack: 0.03 });
      noise({ dur: 0.9, vol: 0.3, f: 1200, f2: 120, type: 'lowpass' });
    },
    ready() { tone({ type: 'triangle', f: midi(79), dur: 0.15, vol: 0.08 }); tone({ type: 'triangle', f: midi(86), dur: 0.3, vol: 0.08, delay: 0.1, wet: true }); },
    chest() {
      noise({ dur: 0.3, vol: 0.15, f: 300, type: 'lowpass' });
      [0, 4, 7, 12, 16].forEach((s, i) => tone({ type: 'triangle', f: midi(72 + s), dur: 0.3, vol: 0.09, delay: 0.25 + i * 0.08, wet: true }));
    },
    tick2() { tone({ type: 'square', f: 1100, dur: 0.03, vol: 0.03 }); },
    roar() { tone({ type: 'sawtooth', f: 95, f2: 40, dur: 1.0, vol: 0.28, attack: 0.05 }); noise({ dur: 0.9, vol: 0.22, f: 300, f2: 100, type: 'lowpass', attack: 0.05 }); },
    shriek() { tone({ type: 'sawtooth', f: 700, f2: 1400, dur: 0.6, vol: 0.1, attack: 0.05, wet: true }); tone({ type: 'sawtooth', f: 710, f2: 1350, dur: 0.6, vol: 0.08, attack: 0.05 }); },
    thud() { noise({ dur: 0.3, vol: 0.3, f: 160, type: 'lowpass' }); tone({ f: 80, f2: 40, dur: 0.3, vol: 0.3 }); },
    alarm() { [0, 0.25, 0.5].forEach(d => tone({ type: 'square', f: 440, f2: 330, dur: 0.2, vol: 0.06, delay: d })); },
    bossDie() { [52, 48, 45, 40, 36].forEach((n, i) => tone({ type: 'sawtooth', f: midi(n), dur: 0.5, vol: 0.12, delay: i * 0.12 })); noise({ dur: 1.5, vol: 0.3, f: 800, f2: 60, type: 'lowpass' }); },
    die() { [64, 60, 57, 52, 48].forEach((n, i) => tone({ type: 'triangle', f: midi(n), dur: 0.6, vol: 0.14, delay: i * 0.2, wet: true })); },
    click() { tone({ type: 'triangle', f: 880, dur: 0.06, vol: 0.06 }); },
    reroll() { [0, 3, 6, 9].forEach((s, i) => tone({ type: 'square', f: midi(70 + s), dur: 0.05, vol: 0.04, delay: i * 0.03 })); },
  };
})();
