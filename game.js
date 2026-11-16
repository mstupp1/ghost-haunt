/* Ghost Haunt — survive the nights, gather wisps, scare pumpkins. Three.js r147 (global build). */
(() => {
  'use strict';

  const ARENA = 15, NIGHT_TIME = 45, PLAYER_R = 0.45, TAU = Math.PI * 2;
  const $ = id => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };

  // =====================================================================
  // Audio: everything is synthesised with WebAudio, no files to load.
  // =====================================================================
  const audio = (() => {
    let ctx = null, master, fxBus, musicBus, echo, noiseBuf, noteT = 0;
    let muted = store.get('ghost-haunt-muted', '0') === '1';
    const VOL = 0.7;
    const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : VOL;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      fxBus = ctx.createGain(); fxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.3; musicBus.connect(master);
      echo = ctx.createDelay(1); echo.delayTime.value = 0.36;
      const fb = ctx.createGain(); fb.gain.value = 0.4;
      const wet = ctx.createGain(); wet.gain.value = 0.5;
      echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // eerie drone: detuned saws through a slowly breathing lowpass
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 5;
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      lfo.frequency.value = 0.06; lfoG.gain.value = 110; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
      const dg = ctx.createGain(); dg.gain.value = 0.06; lp.connect(dg); dg.connect(musicBus);
      [55, 55.35, 82.41].forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); });
    }
    function env(g, t0, vol, attack, dur) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    }
    function tone({ type = 'sine', f = 440, f2 = 0, dur = 0.2, vol = 0.2, attack = 0.005, delay = 0, music = false, wet = false }) {
      if (!ctx || muted) return;
      const t0 = ctx.currentTime + delay;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      env(g, t0, vol, attack, dur);
      o.connect(g); g.connect(music ? musicBus : fxBus); if (wet) g.connect(echo);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise({ dur = 0.3, vol = 0.2, f = 1000, f2 = 0, q = 1, type = 'bandpass', delay = 0, attack = 0.005 }) {
      if (!ctx || muted) return;
      const t0 = ctx.currentTime + delay;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
      flt.frequency.setValueAtTime(f, t0);
      if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      const g = ctx.createGain(); env(g, t0, vol, attack, dur);
      s.connect(flt); flt.connect(g); g.connect(fxBus);
      s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
    }
    const midi = n => 440 * 2 ** ((n - 69) / 12);

    return {
      init,
      get muted() { return muted; },
      toggleMute() {
        muted = !muted; store.set('ghost-haunt-muted', muted ? '1' : '0');
        if (ctx) master.gain.setTargetAtTime(muted ? 0 : VOL, ctx.currentTime, 0.05);
        return muted;
      },
      music(level) { if (ctx) musicBus.gain.setTargetAtTime(level, ctx.currentTime, 0.6); },
      tickMusic(dt, intensity) {
        if (!ctx || muted) return;
        noteT -= dt;
        if (noteT > 0) return;
        noteT = rand(0.45, 1.3) / (0.8 + intensity * 0.7);
        tone({ type: 'triangle', f: midi(57 + pick(SCALE)), dur: 1.4, vol: 0.045, attack: 0.01, music: true, wet: true });
      },
      wisp(combo) {
        const f = midi(76 + SCALE[Math.min(combo, SCALE.length - 1)]);
        tone({ f, dur: 0.22, vol: 0.16, wet: true });
        tone({ type: 'triangle', f: f * 2, dur: 0.12, vol: 0.05 });
      },
      gold() { [0, 4, 7, 12].forEach((s, i) => tone({ type: 'triangle', f: midi(81 + s), dur: 0.25, vol: 0.12, delay: i * 0.06, wet: true })); },
      boo() {
        tone({ type: 'triangle', f: 300, f2: 95, dur: 0.6, vol: 0.32, attack: 0.03 });
        tone({ type: 'sine', f: 150, f2: 70, dur: 0.55, vol: 0.25, attack: 0.03 });
        noise({ dur: 0.5, vol: 0.22, f: 900, f2: 180, type: 'lowpass' });
      },
      echoBoo() { tone({ type: 'triangle', f: 220, f2: 90, dur: 0.45, vol: 0.16, attack: 0.03 }); },
      pop(pitch = 1) {
        noise({ dur: 0.14, vol: 0.22, f: 1800 * pitch, q: 2 });
        tone({ type: 'square', f: 420 * pitch, f2: 900 * pitch, dur: 0.09, vol: 0.06 });
      },
      hurt() {
        tone({ type: 'sawtooth', f: 220, f2: 55, dur: 0.35, vol: 0.22 });
        noise({ dur: 0.25, vol: 0.25, f: 500, type: 'lowpass' });
      },
      dash() { noise({ dur: 0.22, vol: 0.18, f: 500, f2: 3500, q: 1.5 }); },
      power() { [0, 5, 9, 12, 17].forEach((s, i) => tone({ type: 'square', f: midi(72 + s), dur: 0.12, vol: 0.05, delay: i * 0.05 })); },
      heal() { [0, 4, 7].forEach((s, i) => tone({ f: midi(72 + s), dur: 0.4, vol: 0.12, delay: i * 0.07, wet: true })); },
      screech() { tone({ type: 'square', f: 1700, f2: 2500, dur: 0.1, vol: 0.035 }); tone({ type: 'square', f: 1900, f2: 2800, dur: 0.1, vol: 0.03, delay: 0.12 }); },
      roar() { tone({ type: 'sawtooth', f: 95, f2: 45, dur: 0.9, vol: 0.28, attack: 0.05 }); noise({ dur: 0.8, vol: 0.2, f: 300, f2: 120, type: 'lowpass', attack: 0.05 }); },
      thud() { noise({ dur: 0.3, vol: 0.3, f: 160, type: 'lowpass' }); tone({ f: 80, f2: 40, dur: 0.3, vol: 0.3 }); },
      spawn() { noise({ dur: 0.35, vol: 0.06, f: 300, type: 'lowpass', attack: 0.08 }); },
      combo(m) { tone({ type: 'square', f: midi(67 + m * 2), dur: 0.1, vol: 0.06 }); tone({ type: 'square', f: midi(74 + m * 2), dur: 0.16, vol: 0.06, delay: 0.08 }); },
      dawn() { [57, 64, 69, 72, 76].forEach((n, i) => tone({ f: midi(n), dur: 2.4, vol: 0.09, attack: 0.4, delay: i * 0.12, wet: true })); },
      night() { [45, 52, 57].forEach((n, i) => tone({ type: 'triangle', f: midi(n), dur: 1.8, vol: 0.1, attack: 0.2, delay: i * 0.15, wet: true })); },
      die() { [64, 60, 57, 52].forEach((n, i) => tone({ type: 'triangle', f: midi(n), dur: 0.5, vol: 0.14, delay: i * 0.18, wet: true })); },
      click() { tone({ type: 'triangle', f: 880, dur: 0.06, vol: 0.06 }); },
    };
  })();

  // =====================================================================
  // Renderer, scene, camera
  // =====================================================================
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.prepend(renderer.domElement);

  const NIGHT_SKY = new THREE.Color(0x0d0b16), DAWN_SKY = new THREE.Color(0x4a2a4c);
  const scene = new THREE.Scene();
  scene.background = NIGHT_SKY.clone();
  scene.fog = new THREE.Fog(0x0d0b16, 16, 38);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 120);

  function canvasTex(size, draw) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size);
    return new THREE.CanvasTexture(c);
  }
  const dotTex = canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.65)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  const mistTex = canvasTex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  const groundTex = canvasTex(512, (g, s) => {
    g.fillStyle = '#1b281f'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = rand(20, 70);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, Math.random() < 0.5 ? 'rgba(40,30,24,0.45)' : 'rgba(34,52,36,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const cols = ['#24372a', '#16211a', '#2b3e2c', '#131d16', '#33402a', '#1f2f24'];
    for (let i = 0; i < 14000; i++) { g.fillStyle = pick(cols); g.fillRect(Math.random() * s, Math.random() * s, rand(1, 3), rand(1, 4)); }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(9, 9);
  groundTex.encoding = THREE.sRGBEncoding;
  groundTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // ---------- particles (one pooled Points object, additive soft dots) ----------
  const particles = (() => {
    const MAX = 1200;
    const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), size = new Float32Array(MAX), alpha = new Float32Array(MAX);
    const vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), maxLife = new Float32Array(MAX), size0 = new Float32Array(MAX), grav = new Float32Array(MAX), drag = new Float32Array(MAX);
    const geo = new THREE.BufferGeometry();
    const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    const aCol = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
    const aSize = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
    const aAlpha = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', aPos); geo.setAttribute('pcolor', aCol); geo.setAttribute('psize', aSize); geo.setAttribute('palpha', aAlpha);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute vec3 pcolor; attribute float psize; attribute float palpha; uniform float uScale;
        varying vec3 vColor; varying float vAlpha;
        void main() { vColor = pcolor; vAlpha = palpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vColor; varying float vAlpha;
        void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vAlpha;
          if (a < 0.01) discard; gl_FragColor = vec4(vColor, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false; points.renderOrder = 5;
    scene.add(points);
    let head = 0, live = 0;
    const c = new THREE.Color();
    return {
      emit(x, y, z, o = {}) {
        c.set(o.color ?? 0xffffff);
        const n = o.count ?? 10, sp = o.speed ?? 3, up = o.up ?? 1, flat = o.flat ? 0.08 : 1, spread = o.spread ?? 0;
        for (let k = 0; k < n; k++) {
          const i = head; head = (head + 1) % MAX;
          let dx = Math.random() * 2 - 1, dy = (Math.random() * 2 - 1) * flat, dz = Math.random() * 2 - 1;
          const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
          const s = sp * (0.35 + Math.random() * 0.65);
          vel[i * 3] = dx * s + (o.vx ?? 0); vel[i * 3 + 1] = dy * s * up + (o.lift ?? 0); vel[i * 3 + 2] = dz * s + (o.vz ?? 0);
          pos[i * 3] = x + dx * spread; pos[i * 3 + 1] = y + dy * spread; pos[i * 3 + 2] = z + dz * spread;
          life[i] = maxLife[i] = (o.life ?? 0.8) * (0.6 + Math.random() * 0.5);
          size0[i] = (o.size ?? 0.3) * (0.6 + Math.random() * 0.7);
          grav[i] = o.gravity ?? 0; drag[i] = o.drag ?? 2;
          const v = o.vary ?? 0.15;
          col[i * 3] = c.r * (1 - v + Math.random() * v); col[i * 3 + 1] = c.g * (1 - v + Math.random() * v); col[i * 3 + 2] = c.b * (1 - v + Math.random() * v);
        }
        live = MAX;
      },
      update(dt) {
        if (!live) return;
        let any = 0;
        for (let i = 0; i < MAX; i++) {
          if (life[i] <= 0) { alpha[i] = 0; continue; }
          any++;
          life[i] -= dt;
          const k = Math.max(0, life[i] / maxLife[i]), dr = Math.exp(-drag[i] * dt), j = i * 3;
          vel[j] *= dr; vel[j + 1] = vel[j + 1] * dr - grav[i] * dt; vel[j + 2] *= dr;
          pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
          if (pos[j + 1] < 0.03) { pos[j + 1] = 0.03; vel[j + 1] *= -0.35; vel[j] *= 0.7; vel[j + 2] *= 0.7; }
          alpha[i] = Math.min(1, k * 1.6);
          size[i] = size0[i] * (0.35 + 0.65 * k);
        }
        if (!any) live = 0;
        aPos.needsUpdate = aCol.needsUpdate = aSize.needsUpdate = aAlpha.needsUpdate = true;
      },
      resize() { mat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)); },
      clear() { life.fill(0); },
    };
  })();

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    // keep the arena readable on tall phones
    camera.fov = camera.aspect < 0.8 ? 62 : 50;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    particles.resize();
  }
  addEventListener('resize', resize);
  resize();

  // =====================================================================
  // World
  // =====================================================================
  const hemi = new THREE.HemisphereLight(0x8a90d0, 0x1a1428, 0.6);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xb8c8ff, 0.85);
  moon.position.set(-8, 14, 6); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.bias = -0.0005;
  Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 40 });
  scene.add(moon, moon.target);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(ARENA + 26, 72), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // sky: moon + stars
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), new THREE.MeshBasicMaterial({ color: 0xf2efd8, fog: false }));
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0x9fb0ff, transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
  moonHalo.scale.setScalar(16);
  const moonGroup = new THREE.Group(); moonGroup.add(moonHalo, moonDisc);
  moonGroup.position.set(-16, 17, -32); scene.add(moonGroup);
  {
    const n = 500, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = rand(0.12, 1.3), r = 70;
      p[i * 3] = Math.cos(a) * Math.cos(e) * r; p[i * 3 + 1] = Math.sin(e) * r; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, color: 0xcfd6ff, fog: false, transparent: true, opacity: 0.8 })));
  }

  // iron fence marks the edge of the haunt
  {
    const N = 120, R = ARENA + 0.35;
    const iron = new THREE.MeshStandardMaterial({ color: 0x2c2838, roughness: 0.5, metalness: 0.6 });
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1.15, 0.07), iron, N);
    const tips = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.2, 4), iron, N);
    const m = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU, x = Math.cos(a) * R, z = Math.sin(a) * R;
      m.makeTranslation(x, 0.575, z); posts.setMatrixAt(i, m);
      m.makeTranslation(x, 1.25, z); tips.setMatrixAt(i, m);
    }
    posts.castShadow = true;
    scene.add(posts, tips);
    [0.35, 0.95].forEach(h => {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(R, 0.03, 4, 160), iron);
      rail.rotation.x = Math.PI / 2; rail.position.y = h; scene.add(rail);
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA - 0.05, ARENA + 0.05, 128), new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.12 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
  }

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5b5a6a, roughness: 0.9 });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x46594a, roughness: 1 });
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x2a2219, roughness: 1 });
  const slabGeo = new THREE.BoxGeometry(0.9, 1.1, 0.25);
  const capGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.25, 20, 1, false, 0, Math.PI);
  const moundGeo = new THREE.SphereGeometry(0.6, 12, 6, 0, TAU, 0, Math.PI / 2);
  function tombstone(x, z, s, grave) {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(slabGeo, Math.random() < 0.3 ? mossMat : stoneMat); slab.position.y = 0.55;
    const cap = new THREE.Mesh(capGeo, slab.material); cap.rotation.set(Math.PI / 2, Math.PI / 2, 0); cap.position.y = 1.1;
    [slab, cap].forEach(m => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
    if (grave) {
      const mound = new THREE.Mesh(moundGeo, dirtMat); mound.scale.set(0.8, 0.25, 1.5); mound.position.set(0, 0, 0.95); mound.receiveShadow = true; g.add(mound);
    }
    g.scale.setScalar(s);
    g.position.set(x, 0, z); g.rotation.y = (Math.random() - 0.5) * 0.5; g.rotation.z = (Math.random() - 0.5) * 0.15;
    scene.add(g);
  }
  const crossBar = new THREE.BoxGeometry(0.16, 1.5, 0.16), crossArm = new THREE.BoxGeometry(0.8, 0.16, 0.16);
  function cross(x, z, s) {
    const g = new THREE.Group();
    const a = new THREE.Mesh(crossBar, stoneMat); a.position.y = 0.75;
    const b = new THREE.Mesh(crossArm, stoneMat); b.position.y = 1.1;
    [a, b].forEach(m => { m.castShadow = true; g.add(m); });
    g.scale.setScalar(s); g.position.set(x, 0, z); g.rotation.set(0, Math.random() * 0.6, (Math.random() - 0.5) * 0.3);
    scene.add(g);
  }
  // decor outside the fence
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * TAU, r = ARENA + 1.8 + Math.random() * 9;
    (Math.random() < 0.25 ? cross : tombstone)(Math.cos(a) * r, Math.sin(a) * r, 0.8 + Math.random() * 0.6);
  }
  // solid tombstones inside the arena: pumpkins collide, the ghost drifts through
  const obstacles = [];
  for (let tries = 0; obstacles.length < 8 && tries < 500; tries++) {
    const a = Math.random() * TAU, r = rand(3.5, ARENA - 2.5), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (obstacles.some(o => Math.hypot(o.x - x, o.z - z) < 4.2)) continue;
    const s = rand(0.85, 1.15);
    tombstone(x, z, s, false);
    obstacles.push({ x, z, r: 0.5 * s + 0.05 });
  }

  const barkMat = new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 1 });
  function tree(x, z) {
    const g = new THREE.Group(), s = rand(0.9, 1.4);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 4, 7), barkMat);
    trunk.position.y = 2; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, rand(1.3, 2), 5), barkMat);
      b.position.set(0, 2.4 + i * 0.35, 0); b.rotation.z = (i % 2 ? 1 : -1) * rand(0.6, 1.1);
      b.rotation.y = Math.random() * 6; b.translateY(0.8); b.castShadow = true; g.add(b);
    }
    g.scale.setScalar(s); g.position.set(x, 0, z); g.rotation.y = Math.random() * TAU; scene.add(g);
  }
  for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, r = ARENA + 4 + Math.random() * 8; tree(Math.cos(a) * r, Math.sin(a) * r); }

  // lanterns: warm flickering light at the fence
  const lanterns = [];
  {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x221e2a, roughness: 0.7, metalness: 0.4 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0xffc070 });
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + TAU / 8, r = ARENA + 1.1, g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.4, 6), postMat); post.position.y = 1.2; post.castShadow = true;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.3), glassMat); box.position.y = 2.5;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 4), postMat); roof.position.y = 2.8; roof.rotation.y = Math.PI / 4;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xffa040, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(2.2); halo.position.y = 2.5;
      const light = new THREE.PointLight(0xff9a3a, 1.3, 10, 2); light.position.y = 2.4;
      g.add(post, box, roof, halo, light);
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); scene.add(g);
      lanterns.push({ light, halo, seed: Math.random() * 100 });
    }
  }

  // low drifting mist
  const mists = [];
  {
    const mat = new THREE.MeshBasicMaterial({ map: mistTex, color: 0x9aa6d8, transparent: true, opacity: 0.16, depthWrite: false });
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2;
      const s = rand(6, 12); m.scale.set(s, s, 1);
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (ARENA + 10);
      m.position.set(Math.cos(a) * r, rand(0.15, 0.6), Math.sin(a) * r); m.renderOrder = 2;
      mists.push({ m, x: m.position.x, z: m.position.z, sp: rand(0.05, 0.15), ph: Math.random() * TAU });
      scene.add(m);
    }
  }

  // fireflies
  const flies = (() => {
    const n = 46, p = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) seeds.push({ x: rand(-ARENA - 6, ARENA + 6), z: rand(-ARENA - 6, ARENA + 6), y: rand(0.5, 2.6), ph: Math.random() * TAU, sp: rand(0.3, 0.8) });
    const g = new THREE.BufferGeometry(); const attr = new THREE.BufferAttribute(p, 3); g.setAttribute('position', attr);
    const mat = new THREE.PointsMaterial({ map: dotTex, size: 0.35, color: 0xd8ff8a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
    return {
      update(t) {
        for (let i = 0; i < n; i++) {
          const s = seeds[i];
          p[i * 3] = s.x + Math.sin(t * s.sp + s.ph) * 1.6;
          p[i * 3 + 1] = s.y + Math.sin(t * s.sp * 1.7 + s.ph) * 0.4;
          p[i * 3 + 2] = s.z + Math.cos(t * s.sp * 0.8 + s.ph) * 1.6;
        }
        attr.needsUpdate = true;
        mat.opacity = 0.55 + Math.sin(t * 3) * 0.2;
      },
    };
  })();

  const blobGeo = new THREE.CircleGeometry(0.6, 24);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  function makeBlob(s) {
    const b = new THREE.Mesh(blobGeo, blobMat); b.rotation.x = -Math.PI / 2; b.position.y = 0.025; b.scale.setScalar(s); scene.add(b); return b;
  }

  // =====================================================================
  // Player ghost
  // =====================================================================
  const player = new THREE.Group(); scene.add(player);
  const model = new THREE.Group(); player.add(model);
  const ghostMat = new THREE.MeshPhysicalMaterial({ color: 0xeef2ff, roughness: 0.55, emissive: 0x5d7bd8, emissiveIntensity: 0.35, sheen: 1, sheenColor: new THREE.Color(0x9fb8ff), side: THREE.DoubleSide });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0612, roughness: 0.25 });
  const glow = new THREE.PointLight(0x9fc4ff, 1.2, 6); glow.position.y = 1; player.add(glow);
  const booLight = new THREE.PointLight(0xbfe8ff, 0, 12); booLight.position.y = 1.2; player.add(booLight);
  const GHOST_SCALE = 0.55;
  const playerBlob = makeBlob(1);

  function fallbackGhostGeo() {
    const pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(Math.sin(t * Math.PI / 2) * (0.75 + t * 0.5 * t), 2.6 - t * 2.6)); }
    return new THREE.LatheGeometry(pts, 48);
  }
  function buildFallbackGhost() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(fallbackGhostGeo(), ghostMat); m.castShadow = true; g.add(m);
    [-0.25, 0.25].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), eyeMat); e.scale.set(0.11, 0.17, 0.05); e.position.set(x, 1.9, 0.72); g.add(e); });
    return g;
  }
  new THREE.GLTFLoader().load('assets/ghost.glb', gltf => {
    const g = gltf.scene;
    g.traverse(o => {
      if (!o.isMesh) return;
      const isEye = /eye/i.test(o.name) || /eye/i.test(o.material && o.material.name);
      o.material = isEye ? eyeMat : ghostMat;
      o.castShadow = true;
    });
    g.scale.setScalar(GHOST_SCALE); model.add(g);
  }, undefined, () => { const g = buildFallbackGhost(); g.scale.setScalar(GHOST_SCALE); model.add(g); });

  // BOO shockwaves (main + echo)
  function makeWave() {
    const w = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    w.rotation.x = -Math.PI / 2; w.position.y = 0.12; scene.add(w);
    return { mesh: w, t: 1, r: 1 };
  }
  const waves = [makeWave(), makeWave()];
  function fireWave(i, r) { waves[i].t = 0; waves[i].r = r; }

  // =====================================================================
  // Wisps
  // =====================================================================
  const wispGeo = new THREE.SphereGeometry(0.2, 16, 12);
  const wispMats = { normal: new THREE.MeshBasicMaterial({ color: 0x8fd8ff }), gold: new THREE.MeshBasicMaterial({ color: 0xffe08a }), bonus: new THREE.MeshBasicMaterial({ color: 0xc9b8ff }) };
  const wispColor = { normal: 0x8fd8ff, gold: 0xffd35a, bonus: 0xc9b8ff };
  const wisps = [];
  const WISP_COUNT = 7;

  function randomSpot(minFromPlayer, maxR = ARENA - 1.5) {
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * maxR, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - player.position.x, z - player.position.z) < minFromPlayer) continue;
      if (obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.8)) continue;
      return { x, z };
    }
    const a = Math.atan2(-player.position.z, -player.position.x) + rand(-0.8, 0.8);
    return { x: Math.cos(a) * maxR * 0.8, z: Math.sin(a) * maxR * 0.8 };
  }
  function makeWisp(kind, x, z, life) {
    const m = new THREE.Mesh(wispGeo, wispMats[kind]);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: wispColor[kind], transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(kind === 'gold' ? 2.4 : 1.5); m.add(halo);
    if (kind === 'gold') m.scale.setScalar(1.35);
    m.position.set(x, 0.9, z); scene.add(m);
    const w = { m, kind, life: life ?? Infinity, t: Math.random() * 6, vx: 0, vz: 0, base: kind === 'gold' ? 1.35 : 1 };
    wisps.push(w); return w;
  }
  function removeWisp(w) { scene.remove(w.m); w.m.children[0].material.dispose(); wisps.splice(wisps.indexOf(w), 1); }
  function resetWisps() {
    while (wisps.length) removeWisp(wisps[0]);
    for (let i = 0; i < WISP_COUNT; i++) { const s = randomSpot(3); makeWisp('normal', s.x, s.z); }
  }

  // =====================================================================
  // Enemies
  // =====================================================================
  const pumpkinMats = [0xff7a1a, 0xff8f2a, 0xf06a12].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: 0x401000, emissiveIntensity: 0.4 }));
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f5a1e });
  const faceMat = new THREE.MeshBasicMaterial({ color: 0xffd25a });
  const pumpkinGeo = (() => {
    const g = new THREE.SphereGeometry(0.55, 32, 20), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.07 * Math.cos(a * 8);
      p.setXYZ(i, x * k, y * 0.8, z * k);
    }
    g.computeVertexNormals(); return g;
  })();
  const eyeGeo = new THREE.ConeGeometry(0.1, 0.14, 3);
  const mouthGeo = new THREE.BoxGeometry(0.32, 0.07, 0.05);
  const stemGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6);

  function pumpkinMesh(mat) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(pumpkinGeo, mat); body.castShadow = true; body.position.y = 0.45; g.add(body);
    const stem = new THREE.Mesh(stemGeo, stemMat); stem.position.y = 0.95; stem.rotation.z = 0.25; g.add(stem);
    [-0.17, 0.17].forEach(x => { const e = new THREE.Mesh(eyeGeo, faceMat); e.position.set(x, 0.55, 0.5); e.rotation.x = Math.PI / 2; e.rotation.y = Math.PI; g.add(e); });
    const m = new THREE.Mesh(mouthGeo, faceMat); m.position.set(0, 0.32, 0.5); g.add(m);
    return { g, body };
  }

  const enemies = [];
  let king = null;

  function spawnPos(minD) {
    // prefer the rim so foes come from the darkness, sometimes rise from graves nearer in
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * TAU, r = Math.random() < 0.65 ? rand(ARENA - 2, ARENA - 0.8) : rand(5, ARENA - 2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - player.position.x, z - player.position.z) < minD) continue;
      if (obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 1)) continue;
      return { x, z };
    }
    const a = Math.atan2(-player.position.z, -player.position.x);
    return { x: Math.cos(a) * (ARENA - 1), z: Math.sin(a) * (ARENA - 1) };
  }

  function addEnemy(e, x, z) {
    e.g.position.set(x, 0, z);
    Object.assign(e, { vx: 0, vz: 0, stun: 0, dying: 0, flash: 0, spawn: e.spawnTime ?? 0.7, hop: Math.random() * 6 });
    e.g.scale.setScalar(0.001);
    scene.add(e.g); enemies.push(e);
    particles.emit(x, 0.2, z, { count: 14, color: 0x6b5a3a, speed: 2.2, up: 0.4, lift: 2, gravity: 6, life: 0.7, size: 0.28, vary: 0.4 });
    return e;
  }
  function spawnPumpkin() {
    const { g, body } = pumpkinMesh(pick(pumpkinMats)), p = spawnPos(7);
    const scale = rand(0.9, 1.1);
    return addEnemy({ type: 'pumpkin', g, body, scale, r: 0.5 * scale, hp: 1, dmg: 1, pts: 2,
      speed: rand(1.7, 2.5), flank: rand(-0.7, 0.7) }, p.x, p.z);
  }

  // bat
  const batMat = new THREE.MeshStandardMaterial({ color: 0x2c2040, roughness: 0.7, emissive: 0x1a0a2a, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  const batEyeMat = new THREE.MeshBasicMaterial({ color: 0xff4a5a });
  const wingGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.12); s.lineTo(0.75, 0.28); s.lineTo(0.66, -0.02); s.lineTo(0.5, 0.06); s.lineTo(0.38, -0.12); s.lineTo(0.22, -0.02); s.lineTo(0, -0.12); s.lineTo(0, 0.12);
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g;
  })();
  const markerGeo = new THREE.RingGeometry(0.42, 0.6, 32);
  function spawnBat() {
    const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), batMat); body.scale.set(1, 0.95, 1.2); body.castShadow = true; inner.add(body);
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), batMat); ear.position.set(0.1 * s, 0.22, 0.05); inner.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), batEyeMat); eye.position.set(0.08 * s, 0.06, 0.22); inner.add(eye);
    });
    const wl = new THREE.Mesh(wingGeo, batMat), wr = new THREE.Mesh(wingGeo, batMat);
    wl.scale.x = -1; wl.castShadow = wr.castShadow = true; inner.add(wl, wr);
    const marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xff4a5a, transparent: true, opacity: 0, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.04; scene.add(marker);
    const p = spawnPos(8);
    const e = addEnemy({ type: 'bat', g, inner, wl, wr, marker, blob: makeBlob(0.5), r: 0.4, hp: 1, dmg: 1, pts: 3, scale: 1,
      mode: 'orbit', timer: rand(2, 3.5), orbitA: Math.random() * TAU, orbitDir: Math.random() < 0.5 ? -1 : 1, orbitR: rand(4.5, 6.5),
      y: 2.4, aimX: 0, aimZ: 0, dirX: 0, dirZ: 0, spawnTime: 0.5 }, p.x, p.z);
    e.g.position.y = 2.4;
    return e;
  }

  // the Pumpkin King
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.8, roughness: 0.3, emissive: 0x6a4000, emissiveIntensity: 0.5 });
  function spawnKing() {
    const mat = pumpkinMats[0].clone(); mat.emissive.set(0x501400);
    const { g, body } = pumpkinMesh(mat);
    const crown = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.1, 16, 1, true), crownMat); crown.add(band);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU, spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), crownMat);
      spike.position.set(Math.cos(a) * 0.26, 0.13, Math.sin(a) * 0.26); crown.add(spike);
    }
    crown.position.y = 1.0; crown.rotation.z = 0.12; g.add(crown);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0, depthWrite: false }));
    lane.rotation.x = -Math.PI / 2; lane.position.y = 0.035; scene.add(lane);
    const p = spawnPos(9);
    const hp = 3 + Math.max(0, Math.floor((night - 3) / 3));
    king = addEnemy({ type: 'king', g, body, mat, lane, scale: 2.2, r: 1.15, hp, maxHp: hp, dmg: 2, pts: 30, speed: 1.35,
      mode: 'walk', timer: 3, dirX: 0, dirZ: 0, spawnTime: 1.4 }, p.x, p.z);
    audio.roar(); shake = Math.max(shake, 0.4);
    banner('The Pumpkin King', `BOO him ${hp} times. Sidestep his charge.`, true);
    $('boss').hidden = false;
    return king;
  }

  function disposeEnemy(e) {
    scene.remove(e.g);
    if (e.marker) { scene.remove(e.marker); e.marker.material.dispose(); }
    if (e.blob) scene.remove(e.blob);
    if (e.lane) { scene.remove(e.lane); e.lane.material.dispose(); }
    if (e === king) { king = null; $('boss').hidden = true; }
  }
  function clearEnemies() { enemies.forEach(disposeEnemy); enemies.length = 0; }

  // =====================================================================
  // Power-ups
  // =====================================================================
  const POWERS = {
    heart: { name: 'Heal', color: 0xff5a6e, css: '#ff5a6e' },
    speed: { name: 'Sugar Rush', color: 0xffd35a, css: '#ffd35a', dur: 7 },
    magnet: { name: 'Wisp Magnet', color: 0x8fd8ff, css: '#8fd8ff', dur: 9 },
    phantom: { name: 'Phantom', color: 0xc9b8ff, css: '#c9b8ff', dur: 5 },
  };
  const powerGeo = {
    heart: (() => {
      const s = new THREE.Shape();
      s.moveTo(0, -0.3); s.bezierCurveTo(-0.05, -0.2, -0.36, -0.05, -0.36, 0.13); s.bezierCurveTo(-0.36, 0.32, -0.12, 0.38, 0, 0.2);
      s.bezierCurveTo(0.12, 0.38, 0.36, 0.32, 0.36, 0.13); s.bezierCurveTo(0.36, -0.05, 0.05, -0.2, 0, -0.3);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }); g.center(); return g;
    })(),
    speed: (() => {
      const s = new THREE.Shape();
      s.moveTo(0.1, 0.38); s.lineTo(-0.18, -0.02); s.lineTo(0.01, -0.02); s.lineTo(-0.1, -0.38); s.lineTo(0.2, 0.06); s.lineTo(0.01, 0.06); s.lineTo(0.1, 0.38);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }); g.center(); return g;
    })(),
    magnet: new THREE.TorusGeometry(0.22, 0.08, 8, 20, Math.PI),
    phantom: (() => { const g = fallbackGhostGeo(); g.scale(0.22, 0.22, 0.22); g.translate(0, -0.3, 0); return g; })(),
  };
  const pickups = [];
  function spawnPickup(kind, x, z) {
    if (x === undefined) { const s = randomSpot(5); x = s.x; z = s.z; }
    const def = POWERS[kind], g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
    const mat = new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide });
    spin.add(new THREE.Mesh(powerGeo[kind], mat));
    if (kind === 'magnet') {
      spin.children[0].rotation.z = Math.PI;
      const tipMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf5, metalness: 0.7, roughness: 0.3 });
      [-0.22, 0.22].forEach(tx => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.17), tipMat); t.position.set(tx, -0.04, 0); spin.add(t); });
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: def.color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.8); g.add(halo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.65, 32), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.4, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.95; g.add(ring);
    g.position.set(x, 1, z); scene.add(g);
    pickups.push({ kind, g, spin, life: 12, t: 0 });
    particles.emit(x, 1, z, { count: 16, color: def.color, speed: 2, life: 0.6, size: 0.25 });
  }
  function removePickup(p) {
    scene.remove(p.g);
    p.g.traverse(o => { if (o.material) o.material.dispose(); });
    pickups.splice(pickups.indexOf(p), 1);
  }

  // power chips in the HUD
  const powerChips = {};
  Object.entries(POWERS).forEach(([k, def]) => {
    if (!def.dur) return;
    const el = document.createElement('div'); el.className = 'power'; el.style.setProperty('--pc', def.css); el.hidden = true;
    el.innerHTML = `${def.name}<div class="bar"><div class="fill"></div></div>`;
    $('powers').appendChild(el); powerChips[k] = { el, fill: el.querySelector('.fill') };
  });

  // =====================================================================
  // Blessings (between nights)
  // =====================================================================
  const BLESSINGS = [
    { id: 'booR', name: 'Louder BOO', desc: 'Your BOO reaches 20% farther.', color: '#8fd8ff', apply: () => { S.booR *= 1.2; } },
    { id: 'booCd', name: 'Quick Scare', desc: 'BOO recharges 20% faster.', color: '#8fd8ff', apply: () => { S.booCd *= 0.8; } },
    { id: 'speed', name: 'Swift Spirit', desc: 'Float 12% faster.', color: '#ffd35a', apply: () => { S.speed *= 1.12; } },
    { id: 'hp', name: 'Ectoplasm', desc: '+2 max HP, then heal to full.', color: '#ff5a6e', apply: () => { S.maxHp += 2; hp = S.maxHp; } },
    { id: 'heal', name: 'Graveyard Rest', desc: 'Restore 5 HP.', color: '#ff5a6e', when: () => hp < S.maxHp, apply: () => { hp = Math.min(S.maxHp, hp + 5); } },
    { id: 'pickup', name: 'Wisp Pull', desc: 'Grab wisps from 50% farther away.', color: '#c9b8ff', apply: () => { S.pickup *= 1.5; } },
    { id: 'dash', name: 'Phase Step', desc: 'Dash recharges 25% faster.', color: '#c9b8ff', apply: () => { S.dashCd *= 0.75; } },
    { id: 'combo', name: 'Lingering Chill', desc: 'Combos last 1 second longer.', color: '#ffd35a', apply: () => { S.comboWindow += 1; } },
    { id: 'cold', name: 'Cold Touch', desc: 'Dashing through pumpkins and bats scares them.', color: '#c9b8ff', once: true, apply: () => { S.coldTouch = true; } },
    { id: 'echo', name: 'Echo BOO', desc: 'Every BOO rings out a second time.', color: '#8fd8ff', once: true, apply: () => { S.echo = true; } },
    { id: 'lucky', name: 'Lucky Lantern', desc: 'Power-ups appear twice as often.', color: '#ffb36b', once: true, apply: () => { S.luck = 2; } },
  ];

  // =====================================================================
  // UI helpers
  // =====================================================================
  const fx = $('fx'), texts = [], tmpV = new THREE.Vector3();
  function floatText(x, y, z, str, cls = '') {
    if (texts.length > 28) { texts[0].el.remove(); texts.shift(); }
    const el = document.createElement('div'); el.className = 'ftext ' + cls; el.textContent = str; fx.appendChild(el);
    texts.push({ el, x, y, z, t: 0, life: cls.includes('big') ? 1.3 : 0.95 });
  }
  function updateTexts(dt) {
    for (let i = texts.length - 1; i >= 0; i--) {
      const f = texts[i]; f.t += dt; f.y += dt * 1.3;
      if (f.t >= f.life) { f.el.remove(); texts.splice(i, 1); continue; }
      tmpV.set(f.x, f.y, f.z).project(camera);
      const sx = (tmpV.x * 0.5 + 0.5) * innerWidth, sy = (-tmpV.y * 0.5 + 0.5) * innerHeight;
      const pop = f.t < 0.12 ? 0.6 + f.t / 0.12 * 0.6 : 1.2 - Math.min(0.2, (f.t - 0.12) * 1.5);
      f.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${pop})`;
      f.el.style.opacity = String(1 - smooth(f.life * 0.6, f.life, f.t));
    }
  }
  function clearTexts() { texts.forEach(f => f.el.remove()); texts.length = 0; }

  function banner(title, sub, warn) {
    const b = $('banner');
    $('bannerTitle').textContent = title; $('bannerSub').textContent = sub || '';
    b.classList.toggle('warn', !!warn);
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  const cache = new Map();
  function setText(id, v) { if (cache.get(id) !== v) { cache.set(id, v); $(id).textContent = v; } }
  function setScale(el, k) { el.style.transform = `scaleX(${clamp(k, 0, 1).toFixed(3)})`; }

  // =====================================================================
  // Game state
  // =====================================================================
  const BASE = { maxHp: 10, speed: 6.5, booCd: 3, booR: 4.5, dashCd: 2.2, pickup: 1.0, comboWindow: 2.5, coldTouch: false, echo: false, luck: 1 };
  let S = { ...BASE };
  let state = 'menu', prevState = 'play';
  let hp = 10, score = 0, night = 1, timeLeft = NIGHT_TIME;
  let combo = 0, comboT = 0, bestCombo = 0, lastMult = 1;
  let wispsGot = 0, scares = 0, nightsSurvived = 0;
  let booCd = 0, dashCd = 0, dashT = 0, invuln = 0, echoT = -1;
  let spawnT = 0, pickupT = 0, goldT = 0, kingDue = false;
  let shake = 0, hitStop = 0, booAnim = 1, deathT = 0, dawnT = 0, overT = 0, t = 0;
  const power = { speed: 0, magnet: 0, phantom: 0 };
  const taken = new Set();
  const vel = new THREE.Vector3();
  const dashDir = { x: 0, z: 1 };
  let best = +store.get('ghost-haunt-best', 0) || 0;
  let bestNight = +store.get('ghost-haunt-best-night', 0) || 0;

  const mult = () => Math.min(6, 1 + Math.floor(combo / 5));

  function showMenuBest() {
    const el = $('menuBest');
    el.hidden = best <= 0;
    el.textContent = `Best: ${best} · reached night ${Math.max(1, bestNight)}`;
  }
  showMenuBest();

  function setOverlays(which) {
    ['menu', 'dawnScreen', 'pauseScreen', 'overScreen'].forEach(id => { $(id).hidden = id !== which; });
    const inGame = which === null || which === 'pauseScreen';
    $('hud').hidden = !(inGame || which === 'dawnScreen' || which === 'overScreen');
    $('abilities').hidden = which !== null;
    $('touchCtl').hidden = which !== null;
  }

  function startRun() {
    audio.init(); audio.click();
    S = { ...BASE }; taken.clear();
    hp = S.maxHp; score = 0; night = 1; combo = 0; comboT = 0; bestCombo = 0; lastMult = 1;
    wispsGot = 0; scares = 0; nightsSurvived = 0;
    clearEnemies(); while (pickups.length) removePickup(pickups[0]); clearTexts(); particles.clear();
    player.position.set(0, 0, 0); player.rotation.set(0, 0, 0); model.scale.setScalar(1); vel.set(0, 0, 0);
    deathT = 0; player.visible = true;
    resetWisps();
    startNight();
  }

  function startNight() {
    timeLeft = NIGHT_TIME; booCd = 0; dashCd = 0; dashT = 0; invuln = 1; echoT = -1;
    spawnT = 0; pickupT = rand(8, 12) / S.luck; goldT = rand(9, 14);
    power.speed = power.magnet = power.phantom = 0;
    kingDue = night % 3 === 0;
    for (let i = 0; i < 2 + Math.min(night, 4); i++) spawnPumpkin();
    if (night >= 2) spawnBat();
    state = 'play'; setOverlays(null);
    audio.night(); audio.music(0.32);
    const subs = {
      1: 'Gather wisps. Survive until dawn.',
      2: 'Bats take wing. Watch for the red mark, then dodge.',
      3: 'Something big stirs beneath the pumpkin patch…',
    };
    banner(`Night ${night}`, subs[night] || (night % 3 === 0 ? 'The Pumpkin King returns, angrier.' : 'The graveyard grows restless.'));
  }

  function toDawn() {
    state = 'dawn'; dawnT = 0; nightsSurvived = night;
    enemies.forEach(e => { if (!e.dying) { e.dying = 0.001; burst(e); } });
    for (let i = wisps.length - 1; i >= 0; i--) if (wisps[i].kind !== 'normal') removeWisp(wisps[i]);
    const bonus = 20 * night + hp * 3;
    score += bonus;
    const healed = Math.min(2, S.maxHp - hp); hp += healed;
    combo = 0;
    $('dawnInfo').innerHTML = `Night ${night} survived. <strong>+${bonus}</strong> dawn bonus${healed ? `, healed ${healed} HP` : ''}.`;
    audio.dawn(); audio.music(0.12);
    floatText(player.position.x, 2.4, player.position.z, `+${bonus}`, 'gold big');
  }
  function showBlessings() {
    const pool = BLESSINGS.filter(b => !(b.once && taken.has(b.id)) && (!b.when || b.when()));
    const opts = shuffle(pool).slice(0, 3);
    const box = $('cards'); box.innerHTML = '';
    opts.forEach((b, i) => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'up'; el.style.setProperty('--uc', b.color);
      el.innerHTML = `<kbd class="desktop-only">${i + 1}</kbd><strong></strong><span></span>`;
      el.querySelector('strong').textContent = b.name; el.querySelector('span').textContent = b.desc;
      el.addEventListener('click', () => chooseBlessing(b));
      box.appendChild(el);
    });
    showBlessings.opts = opts;
    setOverlays('dawnScreen');
    setTimeout(() => { const f = box.querySelector('button'); if (f && matchMedia('(pointer: fine)').matches) f.focus({ preventScroll: true }); }, 50);
  }
  function chooseBlessing(b) {
    if (state !== 'dawnPick') return;
    b.apply(); taken.add(b.id); audio.power();
    night++; startNight();
  }

  function gameOver() {
    state = 'dying'; deathT = 0; overT = 0;
    audio.die(); audio.music(0.08);
    shake = 0.8; hitStop = 0.25;
    particles.emit(player.position.x, 1, player.position.z, { count: 80, color: 0xbfe0ff, speed: 6, life: 1.4, size: 0.4, lift: 1.5, drag: 1.5 });
  }
  function showGameOver() {
    state = 'over';
    const isBest = score > best;
    if (isBest) { best = score; store.set('ghost-haunt-best', best); }
    if (night > bestNight) { bestNight = night; store.set('ghost-haunt-best-night', bestNight); }
    $('oScore').textContent = score; $('oNights').textContent = nightsSurvived;
    $('oWisps').textContent = wispsGot; $('oScares').textContent = scares; $('oCombo').textContent = bestCombo;
    $('newBest').hidden = !isBest || score === 0;
    $('overBest').textContent = `Best: ${best} · reached night ${Math.max(1, bestNight)}`;
    setOverlays('overScreen');
    setTimeout(() => $('againBtn').focus({ preventScroll: true }), 50);
    showMenuBest();
  }

  function pause() {
    if (state !== 'play') return;
    prevState = state; state = 'paused'; setOverlays('pauseScreen'); audio.music(0.08);
    for (const k in keys) keys[k] = false;
    touch.id = null;
  }
  function resume() {
    if (state !== 'paused') return;
    state = prevState; setOverlays(null); audio.music(0.32); clock.getDelta();
  }
  function quitRun() {
    state = 'menu'; clearEnemies(); while (pickups.length) removePickup(pickups[0]); clearTexts();
    setOverlays('menu'); showMenuBest(); audio.music(0.2);
  }

  // ---------- combat ----------
  function addCombo() {
    combo++; comboT = S.comboWindow; bestCombo = Math.max(bestCombo, combo);
    const m = mult();
    if (m > lastMult) {
      floatText(player.position.x, 2.6, player.position.z, `Combo x${m}!`, 'gold big');
      audio.combo(m);
    }
    lastMult = m;
  }
  function burst(e) {
    const { x, z } = e.g.position, y = e.g.position.y + 0.5 * (e.scale || 1);
    if (e.type === 'bat') {
      particles.emit(x, y, z, { count: 26, color: 0xb07aff, speed: 4, life: 0.7, size: 0.3 });
    } else {
      const k = e.type === 'king' ? 3 : 1;
      particles.emit(x, y, z, { count: 26 * k, color: 0xff8a2a, speed: 5 * Math.sqrt(k), lift: 3, gravity: 10, life: 0.9, size: 0.32, drag: 1 });
      particles.emit(x, y, z, { count: 12 * k, color: 0xffd25a, speed: 3 * k, life: 0.5, size: 0.25 });
    }
  }
  function scare(e, viaBoo) {
    if (e.dying || e.spawn > 0) return 0;
    if (e.type === 'king') {
      e.hp--; e.flash = 0.25; e.stun = 0.8; e.mode = 'walk'; e.timer = 2.2; e.lane.material.opacity = 0;
      const dx = e.g.position.x - player.position.x, dz = e.g.position.z - player.position.z, d = Math.hypot(dx, dz) || 1;
      e.vx = dx / d * 9; e.vz = dz / d * 9;
      shake = Math.max(shake, 0.35); audio.thud();
      particles.emit(e.g.position.x, 1.5, e.g.position.z, { count: 30, color: 0xff8a2a, speed: 5, life: 0.6, size: 0.3 });
      if (e.hp <= 0) {
        e.dying = 0.001; burst(e); hitStop = 0.15; shake = 0.9; scares++;
        addCombo(); const pts = e.pts * mult(); score += pts;
        floatText(e.g.position.x, 3, e.g.position.z, `KING BUSTED +${pts}`, 'gold big');
        audio.roar(); audio.gold();
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * TAU, r = rand(1.5, 3.5);
          const x = clamp(e.g.position.x + Math.cos(a) * r, -ARENA + 1.5, ARENA - 1.5), z = clamp(e.g.position.z + Math.sin(a) * r, -ARENA + 1.5, ARENA - 1.5);
          makeWisp('bonus', x, z, 7);
        }
        spawnPickup('heart', e.g.position.x, e.g.position.z);
      } else floatText(e.g.position.x, 3, e.g.position.z, `${e.hp} left`, 'scare');
      return 1;
    }
    e.dying = 0.001; scares++; burst(e);
    addCombo();
    const pts = e.pts * mult(); score += pts;
    floatText(e.g.position.x, 1.4, e.g.position.z, `+${pts}`, 'scare');
    audio.pop(e.type === 'bat' ? 1.5 : 1);
    if (Math.random() < 0.08 * S.luck && pickups.length < 3) spawnPickup(pick(['heart', 'speed', 'magnet', 'phantom']), e.g.position.x, e.g.position.z);
    return 1;
  }
  function doBoo(r, isEcho) {
    let n = 0;
    enemies.forEach(e => {
      if (e.dying || e.spawn > 0) return;
      const dx = e.g.position.x - player.position.x, dz = e.g.position.z - player.position.z, d = Math.hypot(dx, dz) || 1;
      if (d < r + e.r * 0.5) n += scare(e, true);
      else if (d < r * 1.6 && e.type !== 'king') { e.stun = 0.5; e.vx = dx / d * 6; e.vz = dz / d * 6; }
    });
    if (n >= 3 && !isEcho) {
      const bonus = n * 5 * mult(); score += bonus;
      floatText(player.position.x, 2.8, player.position.z, `${n >= 5 ? 'MONSTER' : 'MEGA'} BOO! +${bonus}`, 'big');
    }
  }
  function boo() {
    if (state !== 'play' || booCd > 0) return;
    booCd = S.booCd; booAnim = 0; booLight.intensity = 4;
    fireWave(0, S.booR); audio.boo(); shake = Math.max(shake, 0.18);
    particles.emit(player.position.x, 0.6, player.position.z, { count: 50, color: 0xbfe8ff, speed: S.booR * 2.6, flat: true, life: 0.45, size: 0.3, drag: 3 });
    doBoo(S.booR, false);
    if (S.echo) echoT = 0.4;
  }
  function dash() {
    if (state !== 'play' || dashCd > 0) return;
    const [ix, iz] = readInput();
    let dx = ix, dz = iz;
    if (Math.hypot(dx, dz) < 0.2) { dx = Math.sin(player.rotation.y); dz = Math.cos(player.rotation.y); }
    const l = Math.hypot(dx, dz) || 1; dashDir.x = dx / l; dashDir.z = dz / l;
    dashT = 0.22; dashCd = S.dashCd;
    vel.set(dashDir.x * 18, 0, dashDir.z * 18);
    audio.dash();
  }
  function hurt(e) {
    hp -= e.dmg; invuln = 1.2; combo = 0; lastMult = 1;
    const dx = player.position.x - e.g.position.x, dz = player.position.z - e.g.position.z, d = Math.hypot(dx, dz) || 1;
    vel.set(dx / d * 10, 0, dz / d * 10);
    if (e.type !== 'king') { e.vx = -dx / d * 7; e.vz = -dz / d * 7; e.stun = 0.6; }
    else { e.mode = 'walk'; e.timer = 2; e.lane.material.opacity = 0; e.stun = 0.4; }
    shake = Math.max(shake, 0.55); hitStop = 0.07;
    audio.hurt();
    particles.emit(player.position.x, 1, player.position.z, { count: 24, color: 0x8fd8ff, speed: 4, life: 0.6, size: 0.3 });
    floatText(player.position.x, 2.2, player.position.z, `-${e.dmg}`, 'hurt');
    const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
    if (hp <= 0) { hp = 0; gameOver(); }
  }

  // =====================================================================
  // Input
  // =====================================================================
  const keys = {};
  const touch = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  function readInput() {
    let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    if (touch.id !== null) {
      const dx = touch.x - touch.ox, dy = touch.y - touch.oy, d = Math.hypot(dx, dy);
      if (d > 8) { ix = dx / Math.max(d, 50); iz = dy / Math.max(d, 50); }
    }
    const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
    return [ix, iz];
  }
  addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    keys[e.code] = true;
    if (e.repeat) return;
    audio.init();
    if (state === 'play') {
      if (e.code === 'Space' || e.code === 'KeyJ') boo();
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK') dash();
      else if (e.code === 'KeyP' || e.code === 'Escape') pause();
    } else if (state === 'paused') {
      if (e.code === 'KeyP' || e.code === 'Escape') resume();
    } else if (state === 'dawnPick') {
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (i >= 0 && showBlessings.opts[i]) chooseBlessing(showBlessings.opts[i]);
    } else if ((state === 'menu' || state === 'over') && e.code === 'Enter' && document.activeElement === document.body) {
      startRun();
    }
    if (e.code === 'KeyM') toggleMute();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  const stick = $('stick'), knob = $('knob');
  renderer.domElement.addEventListener('pointerdown', e => {
    if (state !== 'play') return;
    touch.id = e.pointerId; touch.ox = touch.x = e.clientX; touch.oy = touch.y = e.clientY;
    if (e.pointerType !== 'mouse') { stick.classList.add('on'); stick.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; knob.style.transform = ''; }
  });
  addEventListener('pointermove', e => {
    if (e.pointerId !== touch.id) return;
    touch.x = e.clientX; touch.y = e.clientY;
    const dx = touch.x - touch.ox, dy = touch.y - touch.oy, d = Math.hypot(dx, dy), k = d > 40 ? 40 / d : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  });
  const endTouch = e => { if (e.pointerId === touch.id) { touch.id = null; stick.classList.remove('on'); } };
  addEventListener('pointerup', endTouch); addEventListener('pointercancel', endTouch);
  $('booBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); boo(); });
  $('dashBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); dash(); });
  $('startBtn').addEventListener('click', startRun);
  $('againBtn').addEventListener('click', startRun);
  $('pauseBtn').addEventListener('click', e => { e.currentTarget.blur(); if (state === 'paused') resume(); else pause(); });
  $('resumeBtn').addEventListener('click', resume);
  $('quitBtn').addEventListener('click', quitRun);
  $('muteBtn').addEventListener('click', e => { audio.init(); toggleMute(); e.currentTarget.blur(); });
  function toggleMute() {
    const m = audio.toggleMute();
    $('muteWaves').toggleAttribute('hidden', m); $('muteX').toggleAttribute('hidden', !m);
  }
  if (audio.muted) { $('muteWaves').setAttribute('hidden', ''); $('muteX').removeAttribute('hidden'); }

  // =====================================================================
  // Update
  // =====================================================================
  function collideObstacles(pos, r, e) {
    for (const o of obstacles) {
      const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), min = o.r + r;
      if (d < min && d > 0.0001) {
        const nx = dx / d, nz = dz / d;
        pos.x = o.x + nx * min; pos.z = o.z + nz * min;
        if (e) {
          const vn = e.vx * nx + e.vz * nz;
          if (vn < 0) { e.vx -= vn * nx; e.vz -= vn * nz; }
          if (e.type === 'king' && e.mode === 'charge') {
            e.mode = 'walk'; e.timer = 2.5; e.stun = 1.4; e.lane.material.opacity = 0; e.vx = nx * 3; e.vz = nz * 3;
            shake = Math.max(shake, 0.5); audio.thud();
            particles.emit(o.x, 1, o.z, { count: 30, color: 0x9a96aa, speed: 4, lift: 2, gravity: 8, life: 0.7, size: 0.3 });
            floatText(pos.x, 3, pos.z, 'Dazed!', 'scare');
          }
        }
      }
    }
  }
  function keepInArena(pos, r) {
    const d = Math.hypot(pos.x, pos.z), max = ARENA - r;
    if (d > max) { pos.x *= max / d; pos.z *= max / d; return true; }
    return false;
  }

  function updatePlayer(dt) {
    const [ix, iz] = readInput();
    const spd = S.speed * (power.speed > 0 ? 1.45 : 1);
    if (dashT > 0) {
      dashT -= dt;
      particles.emit(player.position.x, 0.9, player.position.z, { count: 3, color: 0xc9b8ff, speed: 0.6, life: 0.45, size: 0.45, spread: 0.3 });
      if (dashT <= 0) vel.setLength(Math.min(vel.length(), spd));
    } else {
      const accel = spd * 4.6;
      vel.x += ix * accel * dt; vel.z += iz * accel * dt;
      vel.multiplyScalar(Math.pow(0.02, dt));
      if (vel.length() > spd && invuln < 0.9) vel.setLength(spd);
    }
    player.position.addScaledVector(vel, dt);
    if (keepInArena(player.position, 0.6)) { const n = Math.hypot(player.position.x, player.position.z); const vn = (vel.x * player.position.x + vel.z * player.position.z) / n; if (vn > 0) { vel.x -= vn * player.position.x / n; vel.z -= vn * player.position.z / n; } }
    if (vel.lengthSq() > 0.3) {
      const target = Math.atan2(vel.x, vel.z);
      let d = target - player.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      player.rotation.y += d * Math.min(1, dt * 8);
    }
    if (power.speed > 0 && vel.lengthSq() > 4 && Math.random() < 0.5) particles.emit(player.position.x, 0.4, player.position.z, { count: 1, color: 0xffd35a, speed: 0.4, life: 0.5, size: 0.3 });
  }

  function updateWisps(dt, active) {
    const px = player.position.x, pz = player.position.z;
    const reach = S.pickup, magnetR = power.magnet > 0 ? 7 : 0;
    for (let i = wisps.length - 1; i >= 0; i--) {
      const w = wisps[i];
      w.t += dt;
      const s = w.base * (1 + Math.sin(w.t * 5) * 0.12);
      w.m.scale.setScalar(s);
      w.m.position.y = 0.9 + Math.sin(w.t * 2) * 0.2;
      if (w.life !== Infinity) {
        w.life -= dt;
        w.m.visible = w.life > 2 || Math.floor(w.t * 10) % 2 === 0;
        if (w.life <= 0) { particles.emit(w.m.position.x, 0.9, w.m.position.z, { count: 8, color: wispColor[w.kind], speed: 1, life: 0.5, size: 0.2 }); removeWisp(w); continue; }
      }
      if (!active) continue;
      let dx = px - w.m.position.x, dz = pz - w.m.position.z;
      const d = Math.hypot(dx, dz) || 1;
      if (magnetR && d < magnetR) {
        const pull = Math.min(d, (12 - d) * dt);
        w.m.position.x += dx / d * pull; w.m.position.z += dz / d * pull;
        if (Math.random() < 0.15) particles.emit(w.m.position.x, w.m.position.y, w.m.position.z, { count: 1, color: 0x8fd8ff, speed: 0.3, life: 0.3, size: 0.2 });
      } else if (w.kind === 'gold' && d < 6) {
        // the gold wisp is shy: it drifts away, but slower than you
        w.m.position.x -= dx / d * 3.4 * dt; w.m.position.z -= dz / d * 3.4 * dt;
        keepInArena(w.m.position, 1.2);
        if (Math.random() < 0.3) particles.emit(w.m.position.x, w.m.position.y, w.m.position.z, { count: 1, color: 0xffd35a, speed: 0.5, life: 0.5, size: 0.25 });
      }
      dx = px - w.m.position.x; dz = pz - w.m.position.z;
      if (dx * dx + dz * dz < reach * reach) collectWisp(w);
    }
  }
  function collectWisp(w) {
    const { x, y, z } = w.m.position;
    addCombo();
    const base = w.kind === 'gold' ? 5 : 1, pts = base * mult();
    score += pts; wispsGot += base;
    floatText(x, y + 0.6, z, `+${pts}`, w.kind === 'gold' ? 'gold' : '');
    particles.emit(x, y, z, { count: w.kind === 'gold' ? 40 : 16, color: wispColor[w.kind], speed: w.kind === 'gold' ? 4 : 2.5, life: 0.6, size: 0.25 });
    if (w.kind === 'gold') audio.gold(); else audio.wisp(combo - 1);
    if (w.kind === 'normal') { const s = randomSpot(4); w.m.position.set(s.x, 0.9, s.z); w.t = 0; particles.emit(s.x, 0.9, s.z, { count: 8, color: 0x8fd8ff, speed: 1, life: 0.4, size: 0.2 }); }
    else removeWisp(w);
  }

  function updatePickups(dt, active) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.t += dt; p.life -= dt;
      p.spin.rotation.y += dt * 2.2;
      p.g.position.y = 1 + Math.sin(p.t * 2.5) * 0.15;
      p.g.visible = p.life > 3 || Math.floor(p.t * 8) % 2 === 0;
      if (p.life <= 0) { removePickup(p); continue; }
      if (!active) continue;
      const dx = player.position.x - p.g.position.x, dz = player.position.z - p.g.position.z;
      if (dx * dx + dz * dz < 1.25) {
        const def = POWERS[p.kind];
        if (p.kind === 'heart') { const h = Math.min(3, S.maxHp - hp); hp += h; audio.heal(); floatText(p.g.position.x, 2, p.g.position.z, h ? `+${h} HP` : 'Full HP', 'hurt'); }
        else { power[p.kind] = def.dur; audio.power(); floatText(p.g.position.x, 2, p.g.position.z, def.name + '!', 'power'); }
        particles.emit(p.g.position.x, 1, p.g.position.z, { count: 30, color: def.color, speed: 3.5, life: 0.6, size: 0.3 });
        removePickup(p);
      }
    }
  }

  function updateEnemies(dt, active) {
    const prog = 1 - timeLeft / NIGHT_TIME;
    const ramp = Math.min(1.9, 1 + (night - 1) * 0.08 + prog * 0.22);
    const px = player.position.x, pz = player.position.z;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i], g = e.g, pos = g.position;
      if (e.dying) {
        e.dying += dt;
        const k = e.type === 'king' ? 0.9 : 0.4;
        g.scale.setScalar(Math.max(0.001, e.scale * (1 + e.dying * 1.2) * (1 - e.dying / k)));
        g.rotation.y += dt * 16; pos.y += dt * 3;
        if (e.marker) e.marker.material.opacity = 0;
        if (e.blob) e.blob.visible = false;
        if (e.lane) e.lane.material.opacity = 0;
        if (e.dying > k) { disposeEnemy(e); enemies.splice(i, 1); }
        continue;
      }
      if (e.spawn > 0) {
        e.spawn -= dt;
        const st = e.spawnTime ?? 0.7, k = 1 - Math.max(0, e.spawn) / st;
        const back = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // easeOutBack
        g.scale.setScalar(Math.max(0.001, e.scale * back));
        if (e.type !== 'bat') { pos.y = -0.5 * (1 - k); g.rotation.y = Math.atan2(px - pos.x, pz - pos.z); }
        if (e.type !== 'bat' && Math.random() < 0.4) particles.emit(pos.x, 0.1, pos.z, { count: 1, color: 0x6b5a3a, speed: 1.5, lift: 1.5, gravity: 6, life: 0.5, size: 0.22, vary: 0.4 });
        continue;
      }
      if (!active) {
        // idle: hop in place, look at the ghost
        e.hop += dt * 5; if (e.type !== 'bat') pos.y = Math.abs(Math.sin(e.hop)) * 0.12;
        continue;
      }
      const dx = px - pos.x, dz = pz - pos.z, d = Math.hypot(dx, dz) || 1;

      if (e.flash > 0) { e.flash -= dt; if (e.mat) e.mat.emissive.setHex(e.flash > 0 ? 0xffffff : 0x501400); }

      if (e.type === 'bat') updateBat(e, dt, dx, dz, d, ramp);
      else if (e.stun > 0) {
        e.stun -= dt;
        const dr = Math.exp(-4 * dt); e.vx *= dr; e.vz *= dr;
        g.rotation.z = Math.sin(t * 40) * 0.12 * Math.min(1, e.stun * 2);
      } else {
        g.rotation.z = 0;
        if (e.type === 'king') updateKing(e, dt, dx, dz, d);
        else {
          let tx = dx / d, tz = dz / d;
          if (d > 3) { // fan out so they surround instead of forming a conga line
            const a = e.flank * Math.min(1, (d - 3) / 6), ca = Math.cos(a), sa = Math.sin(a);
            const rx = tx * ca - tz * sa, rz = tx * sa + tz * ca; tx = rx; tz = rz;
          }
          [tx, tz] = steerAround(pos, tx, tz, e.r);
          const sp = e.speed * ramp, k = Math.min(1, dt * 2.5);
          e.vx += (tx * sp - e.vx) * k; e.vz += (tz * sp - e.vz) * k;
        }
      }
      if (e.type !== 'bat') {
        pos.x += e.vx * dt; pos.z += e.vz * dt;
        collideObstacles(pos, e.r, e);
        if (keepInArena(pos, e.r) && e.type === 'king' && e.mode === 'charge') {
          e.mode = 'walk'; e.timer = 2.5; e.stun = 1.2; e.lane.material.opacity = 0; e.vx = -pos.x * 0.2; e.vz = -pos.z * 0.2;
          shake = Math.max(shake, 0.5); audio.thud(); floatText(pos.x, 3, pos.z, 'Dazed!', 'scare');
        }
        const hopSp = e.type === 'king' ? (e.mode === 'charge' ? 14 : 5) : 9;
        e.hop += dt * hopSp;
        pos.y = Math.abs(Math.sin(e.hop)) * (e.type === 'king' ? 0.35 : 0.25);
        if (e.vx * e.vx + e.vz * e.vz > 0.05 && !(e.type === 'king' && e.mode === 'windup')) {
          const target = Math.atan2(e.vx, e.vz);
          let da = target - g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
          g.rotation.y += da * Math.min(1, dt * 10);
        }
      }

      // contact
      if (state !== 'play') continue;
      const reach = e.r + PLAYER_R;
      const cdx = px - pos.x, cdz = pz - pos.z;
      if (cdx * cdx + cdz * cdz < reach * reach && (e.type !== 'bat' || pos.y < 1.6)) {
        if (e.type !== 'king' && (power.phantom > 0 || (dashT > 0 && S.coldTouch))) { scare(e); continue; }
        if (dashT > 0 || invuln > 0 || power.phantom > 0) continue;
        hurt(e);
      }
    }
    // separation so pumpkins don't stack
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i]; if (a.type === 'bat' || a.dying || a.spawn > 0) continue;
      for (let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j]; if (b.type === 'bat' || b.dying || b.spawn > 0) continue;
        const dx = b.g.position.x - a.g.position.x, dz = b.g.position.z - a.g.position.z, d = Math.hypot(dx, dz), min = a.r + b.r;
        if (d < min && d > 0.0001) {
          const push = (min - d) / d, wa = a.type === 'king' ? 0.1 : 0.5, wb = b.type === 'king' ? 0.1 : 0.5;
          a.g.position.x -= dx * push * wa; a.g.position.z -= dz * push * wa;
          b.g.position.x += dx * push * wb; b.g.position.z += dz * push * wb;
        }
      }
    }
  }
  // nudge a heading sideways around tombstones in the way, so chasers slide past instead of sticking
  function steerAround(pos, tx, tz, r) {
    let sx = tx, sz = tz;
    for (const o of obstacles) {
      const ox = o.x - pos.x, oz = o.z - pos.z, od = Math.hypot(ox, oz), reach = o.r + r + 1.3;
      if (od > reach) continue;
      const ahead = (ox * tx + oz * tz) / od;
      if (ahead < 0.2) continue;
      // obstacle counter-clockwise of heading -> steer clockwise, and vice versa
      const side = tx * oz - tz * ox > 0 ? -1 : 1, w = ahead * (1 - (od - o.r - r) / 1.3) * 1.8;
      sx += -tz * side * w; sz += tx * side * w;
    }
    const l = Math.hypot(sx, sz) || 1;
    return [sx / l, sz / l];
  }

  function updateBat(e, dt, dx, dz, d, ramp) {
    const pos = e.g.position;
    e.hop += dt * 22;
    const flap = Math.sin(e.hop) * 0.75;
    e.wr.rotation.z = flap; e.wl.rotation.z = -flap;
    let tx = pos.x, tz = pos.z, speed = 6, wantY = 2.4;
    if (e.stun > 0) {
      e.stun -= dt; pos.x += e.vx * dt; pos.z += e.vz * dt; e.vx *= Math.exp(-4 * dt); e.vz *= Math.exp(-4 * dt);
      if (e.mode !== 'orbit') { e.mode = 'orbit'; e.timer = rand(1.5, 2.5); }
      e.marker.material.opacity = 0;
    } else if (e.mode === 'orbit') {
      e.orbitA += dt * e.orbitDir * 0.9;
      tx = player.position.x + Math.cos(e.orbitA) * e.orbitR; tz = player.position.z + Math.sin(e.orbitA) * e.orbitR;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.mode = 'windup'; e.timer = 0.65;
        e.aimX = player.position.x + vel.x * 0.25; e.aimZ = player.position.z + vel.z * 0.25;
        const m = Math.hypot(e.aimX, e.aimZ); if (m > ARENA - 1) { e.aimX *= (ARENA - 1) / m; e.aimZ *= (ARENA - 1) / m; }
        audio.screech();
      }
    } else if (e.mode === 'windup') {
      e.timer -= dt; speed = 0;
      e.inner.position.y = Math.sin(t * 50) * 0.04;
      e.marker.position.set(e.aimX, 0.04, e.aimZ);
      e.marker.material.opacity = 0.35 + Math.sin(t * 30) * 0.25;
      if (e.timer <= 0) {
        const ax = e.aimX - pos.x, az = e.aimZ - pos.z, ad = Math.hypot(ax, az) || 1;
        e.dirX = ax / ad; e.dirZ = az / ad;
        e.mode = 'swoop'; e.timer = Math.min(1.6, ad / (10 * ramp) + 0.4);
      }
    } else if (e.mode === 'swoop') {
      e.timer -= dt; wantY = 0.85;
      const sp = 10 * ramp;
      pos.x += e.dirX * sp * dt; pos.z += e.dirZ * sp * dt;
      e.marker.material.opacity = Math.max(0, e.marker.material.opacity - dt * 2);
      if (e.timer <= 0) { e.mode = 'rise'; e.timer = 0.7; }
    } else if (e.mode === 'rise') {
      e.timer -= dt; tx = pos.x + e.dirX; tz = pos.z + e.dirZ; speed = 3;
      if (e.timer <= 0) { e.mode = 'orbit'; e.timer = rand(2, 3.5) / ramp; e.orbitA = Math.atan2(pos.z - player.position.z, pos.x - player.position.x); }
    }
    if (e.mode === 'orbit' || e.mode === 'rise') {
      const mx = tx - pos.x, mz = tz - pos.z, md = Math.hypot(mx, mz);
      if (md > 0.01) { const s = Math.min(md, speed * dt); pos.x += mx / md * s; pos.z += mz / md * s; }
    }
    keepInArena(pos, 0.5);
    pos.y += (wantY - pos.y) * Math.min(1, dt * (e.mode === 'swoop' ? 7 : 3));
    e.g.rotation.y = e.mode === 'swoop' ? Math.atan2(e.dirX, e.dirZ) : Math.atan2(dx, dz);
    e.inner.rotation.x = e.mode === 'swoop' ? 0.5 : 0;
    e.blob.position.set(pos.x, 0.03, pos.z);
    e.blob.scale.setScalar(0.4 + (2.5 - pos.y) * 0.15);
  }

  function updateKing(e, dt, dx, dz, d) {
    if (e.mode === 'walk') {
      let [tx, tz] = steerAround(e.g.position, dx / d, dz / d, e.r);
      const sp = e.speed * (1 + (e.maxHp - e.hp) * 0.15), k = Math.min(1, dt * 2);
      e.vx += (tx * sp - e.vx) * k; e.vz += (tz * sp - e.vz) * k;
      e.timer -= dt;
      if (e.timer <= 0 && d < 11) {
        e.mode = 'windup'; e.timer = 0.9; e.dirX = dx / d; e.dirZ = dz / d; e.vx = e.vz = 0;
        audio.roar();
      }
    } else if (e.mode === 'windup') {
      e.timer -= dt; e.vx = e.vz = 0;
      e.g.rotation.y = Math.atan2(e.dirX, e.dirZ);
      e.g.rotation.z = Math.sin(t * 45) * 0.06;
      const L = 9;
      e.lane.position.set(e.g.position.x + e.dirX * L / 2, 0.035, e.g.position.z + e.dirZ * L / 2);
      e.lane.scale.set(1, L, 1);
      e.lane.rotation.z = Math.atan2(-e.dirX, -e.dirZ); // aligns the plane's local +Y with the charge direction
      e.lane.material.opacity = 0.18 + (1 - e.timer / 0.9) * 0.3 + Math.sin(t * 30) * 0.06;
      if (e.timer <= 0) { e.mode = 'charge'; e.timer = 1.05; }
    } else if (e.mode === 'charge') {
      e.timer -= dt;
      e.vx = e.dirX * 9.5; e.vz = e.dirZ * 9.5;
      e.lane.material.opacity = Math.max(0, e.lane.material.opacity - dt * 1.5);
      if (Math.random() < 0.6) particles.emit(e.g.position.x, 0.2, e.g.position.z, { count: 2, color: 0x6b5a3a, speed: 2, lift: 1.5, gravity: 6, life: 0.5, size: 0.3, vary: 0.4 });
      if (e.timer <= 0) { e.mode = 'walk'; e.timer = rand(2.5, 4); e.lane.material.opacity = 0; }
    }
  }

  function updatePlay(dt) {
    timeLeft -= dt;
    booCd = Math.max(0, booCd - dt); dashCd = Math.max(0, dashCd - dt); invuln = Math.max(0, invuln - dt);
    for (const k in power) power[k] = Math.max(0, power[k] - dt);
    if (comboT > 0) { comboT -= dt; if (comboT <= 0) { combo = 0; lastMult = 1; } }
    if (echoT >= 0) { echoT -= dt; if (echoT < 0) { fireWave(1, S.booR * 0.7); audio.echoBoo(); doBoo(S.booR * 0.7, true); } }

    updatePlayer(dt);
    updateWisps(dt, true);
    updatePickups(dt, true);

    // spawning
    const prog = 1 - timeLeft / NIGHT_TIME;
    spawnT += dt;
    const interval = Math.max(0.75, (3.3 - night * 0.3) * (1 - prog * 0.4));
    let alive = 0, bats = 0;
    for (const e of enemies) if (!e.dying && e.type !== 'king') { alive++; if (e.type === 'bat') bats++; }
    const cap = Math.min(18, 3 + night * 2 + Math.floor(prog * 3));
    if (spawnT > interval && alive < cap && timeLeft > 2) {
      spawnT = 0;
      if (night >= 2 && bats < 1 + Math.floor(night / 2) && Math.random() < 0.3) spawnBat(); else spawnPumpkin();
      audio.spawn();
    }
    if (kingDue && NIGHT_TIME - timeLeft > 5) { kingDue = false; spawnKing(); }

    pickupT -= dt;
    if (pickupT <= 0) {
      pickupT = rand(13, 19) / S.luck;
      if (pickups.length < 3) spawnPickup(hp <= S.maxHp * 0.5 && Math.random() < 0.6 ? 'heart' : pick(['heart', 'speed', 'magnet', 'phantom']));
    }
    goldT -= dt;
    if (goldT <= 0) {
      goldT = rand(12, 18);
      if (!wisps.some(w => w.kind === 'gold')) {
        const s = randomSpot(7); makeWisp('gold', s.x, s.z, 9);
        particles.emit(s.x, 0.9, s.z, { count: 30, color: 0xffd35a, speed: 3, life: 0.7, size: 0.3 });
        floatText(s.x, 1.8, s.z, 'Golden wisp!', 'gold');
      }
    }

    updateEnemies(dt, true);
    audio.tickMusic(dt, Math.min(1, alive / 10));
    if (timeLeft <= 0 && state === 'play') toDawn();
  }

  // =====================================================================
  // Frame
  // =====================================================================
  const clock = new THREE.Clock();
  const camOffset = new THREE.Vector3(0, 9.5, 10);
  const camWant = new THREE.Vector3(), camLook = new THREE.Vector3();
  const skyC = new THREE.Color();
  let dawnMix = 0;

  function update(dt) {
    if (state === 'play') updatePlay(dt);
    else if (state === 'dawn' || state === 'dawnPick') {
      updateEnemies(dt, false); updateWisps(dt, false); updatePickups(dt, false);
      updatePlayer(dt);
      dawnT += dt;
      if (state === 'dawn' && dawnT > 1.6) { state = 'dawnPick'; showBlessings(); }
    } else if (state === 'dying') {
      deathT += dt; updateEnemies(dt, false); updateWisps(dt, false);
      model.scale.set(1 + deathT * 0.6, Math.max(0.01, 1 - deathT * 1.1), 1 + deathT * 0.6);
      player.rotation.y += dt * 10;
      if (deathT > 0.95) player.visible = false;
      if (deathT > 1.5) showGameOver();
    } else if (state === 'over' || state === 'menu') {
      updateEnemies(dt, false); updateWisps(dt, false);
    }
    // player cosmetics
    if (state !== 'dying' && state !== 'over') {
      const bob = Math.sin(t * 2.2) * 0.12;
      player.position.y = 0.45 + bob;
      player.rotation.z = Math.sin(t * 1.7) * 0.05 - vel.x * 0.02;
      player.rotation.x = vel.z * 0.02;
      booAnim = Math.min(1, booAnim + dt * 3.5);
      const sq = Math.sin(booAnim * Math.PI) * (1 - booAnim);
      const dashStretch = dashT > 0 ? 0.25 : 0;
      model.scale.set(1 + sq * 0.5 - dashStretch * 0.4, 1 - sq * 0.3 - dashStretch * 0.2, 1 + sq * 0.5 + dashStretch);
      player.visible = invuln <= 0 || dashT > 0 || Math.floor(t * 14) % 2 === 0;
      const phantom = power.phantom > 0;
      if (ghostMat.transparent !== phantom) { ghostMat.transparent = phantom; ghostMat.needsUpdate = true; }
      ghostMat.opacity = phantom ? 0.4 + Math.sin(t * 8) * 0.1 : 1;
      ghostMat.emissive.setHex(phantom ? 0x8a5ae0 : dashT > 0 ? 0x9a7aff : 0x5d7bd8);
      playerBlob.position.set(player.position.x, 0.025, player.position.z);
      playerBlob.scale.setScalar(1 - bob * 0.8);
    }
    booLight.intensity = Math.max(0, booLight.intensity - dt * 10);
    waves.forEach(w => {
      if (w.t < 1) {
        w.t += dt * 2.6;
        w.mesh.position.set(player.position.x, 0.12, player.position.z);
        const e = 1 - Math.pow(1 - Math.min(1, w.t), 3);
        w.mesh.scale.setScalar(0.4 + e * w.r);
        w.mesh.material.opacity = (1 - w.t) * 0.85;
      } else w.mesh.material.opacity = 0;
    });

    // world ambience
    lanterns.forEach(l => {
      const f = 0.85 + Math.sin(t * 9 + l.seed) * 0.08 + Math.sin(t * 23 + l.seed * 2) * 0.06 + (Math.random() < 0.02 ? -0.3 : 0);
      l.light.intensity = 1.3 * f; l.halo.material.opacity = 0.45 * f;
    });
    mists.forEach(m => { m.m.position.x = m.x + Math.sin(t * m.sp + m.ph) * 2; m.m.position.z = m.z + Math.cos(t * m.sp * 0.7 + m.ph) * 1.5; });
    flies.update(t);

    // sky slides toward dawn near the end of each night
    const wantDawn = state === 'play' ? smooth(0.72, 1, 1 - timeLeft / NIGHT_TIME) * 0.75
      : state === 'dawn' || state === 'dawnPick' ? 1 : state === 'paused' ? dawnMix : 0;
    dawnMix += (wantDawn - dawnMix) * Math.min(1, dt * 2);
    skyC.copy(NIGHT_SKY).lerp(DAWN_SKY, dawnMix);
    scene.background.copy(skyC); scene.fog.color.copy(skyC);
    hemi.intensity = 0.6 + dawnMix * 0.35;
    moonGroup.position.y = 17 - dawnMix * 9;

    // camera
    if (state === 'menu') {
      camera.position.set(Math.sin(t * 0.12) * 13, 7.5, Math.cos(t * 0.12) * 13);
      camera.lookAt(0, 1, 0);
    } else {
      const zoom = king && !king.dying ? 1.15 : 1;
      camWant.copy(player.position).addScaledVector(camOffset, zoom);
      camWant.x += vel.x * 0.25; camWant.z += vel.z * 0.25; camWant.y = camOffset.y * zoom;
      camera.position.lerp(camWant, Math.min(1, dt * 4));
      camLook.set(player.position.x + vel.x * 0.25, 0.8, player.position.z + vel.z * 0.25);
      camera.lookAt(camLook);
    }
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 1.8);
      const s = shake * shake * 0.6;
      camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s;
    }
    moon.position.set(player.position.x - 8, 14, player.position.z + 6);
    moon.target.position.set(player.position.x, 0, player.position.z);

    particles.update(dt);
    updateTexts(dt);
  }

  const hudEls = {
    hud: $('hud'), abBoo: $('abBoo'), abDash: $('abDash'), booBtn: $('booBtn'), dashBtn: $('dashBtn'),
    booCd: $('abBoo').querySelector('.cd'), dashCd: $('abDash').querySelector('.cd'),
  };
  function updateHud() {
    if (hudEls.hud.hidden) return;
    setText('hp', String(Math.max(0, hp)));
    setText('hpMax', String(S.maxHp));
    const hpk = Math.max(0, hp) / S.maxHp;
    setScale($('hpFill'), hpk);
    $('hpFill').classList.toggle('low', hpk <= 0.3);
    $('vignette').style.opacity = hpk <= 0.3 && state === 'play' ? String(0.6 + Math.sin(t * 6) * 0.4) : '0';
    setText('night', `Night ${night}`);
    const isDawn = state === 'dawn' || state === 'dawnPick';
    setText('time', isDawn ? 'Dawn' : `${Math.ceil(Math.max(0, timeLeft))}s`);
    setScale($('dawnFill'), isDawn ? 1 : 1 - timeLeft / NIGHT_TIME);
    setText('score', String(score));
    const m = mult();
    setText('mult', `x${m}`);
    $('combo').classList.toggle('on', combo > 0);
    setScale($('comboFill'), combo > 0 ? comboT / S.comboWindow : 0);
    for (const k in powerChips) {
      const c = powerChips[k], v = power[k];
      if (c.el.hidden !== !(v > 0)) c.el.hidden = !(v > 0);
      if (v > 0) setScale(c.fill, v / POWERS[k].dur);
    }
    const booK = booCd / S.booCd, dashK = dashCd / S.dashCd;
    hudEls.booCd.style.transform = `scaleX(${booK.toFixed(3)})`;
    hudEls.dashCd.style.transform = `scaleX(${dashK.toFixed(3)})`;
    hudEls.abBoo.classList.toggle('ready', booK === 0);
    hudEls.abDash.classList.toggle('ready', dashK === 0);
    hudEls.booBtn.style.setProperty('--cd', booK.toFixed(3));
    hudEls.dashBtn.style.setProperty('--cd', dashK.toFixed(3));
    if (king && !king.dying) setScale($('bossFill'), king.hp / king.maxHp);
  }

  function frame() {
    requestAnimationFrame(frame);
    let dt = Math.min(clock.getDelta(), 0.05);
    if (state === 'paused') { renderer.render(scene, camera); return; }
    if (hitStop > 0) { hitStop -= dt; dt *= 0.08; }
    t += dt;
    update(dt);
    updateHud();
    renderer.render(scene, camera);
  }
  setOverlays('menu');
  resetWisps();
  frame();

  // tiny hook for automated smoke tests
  window.__ghostHaunt = {
    get state() { return state; }, get score() { return score; }, get hp() { return hp; }, get night() { return night; },
    get enemies() { return enemies.map(e => e.type); },
    skipNight() { timeLeft = 0.01; }, spawnKing() { spawnKing(); }, spawnBat() { spawnBat(); }, hurt() { hurt({ dmg: 99, type: 'king', g: player, lane: { material: {} } }); },
  };
})();
