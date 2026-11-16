/* Ghost Haunt — an endless-night horde survivor. Three.js r147 (global build). */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const $ = id => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };
  const fmtTime = s => { s = Math.max(0, Math.floor(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const fmtNum = n => Math.floor(n).toLocaleString('en-US');
  const audio = window.GhostAudio, ICON = window.GhostIcons.get;
  const coarse = matchMedia('(pointer: coarse)').matches;

  // ---------- settings ----------
  const settings = {
    bloom: store.get('ghost-haunt-bloom', coarse ? '0' : '1') === '1',
    numbers: store.get('ghost-haunt-numbers', '1') === '1',
    shake: store.get('ghost-haunt-shake', '1') === '1',
  };
  const SETTING_LABELS = { bloom: 'Glow effects', numbers: 'Damage numbers', shake: 'Screen shake' };

  // =====================================================================
  // Renderer, scene, camera, post-processing
  // =====================================================================
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.body.prepend(renderer.domElement);

  const NIGHT_SKY = new THREE.Color(0x0d0b16), FRENZY_SKY = new THREE.Color(0x2c0612), FREEZE_SKY = new THREE.Color(0x0d1a2c);
  const scene = new THREE.Scene();
  scene.background = NIGHT_SKY.clone();
  scene.fog = new THREE.Fog(0x0d0b16, 26, 60);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 160);
  const CAM_OFFSET = new THREE.Vector3(0, 17, 13);

  let composer = null, bloomPass = null;
  function buildComposer() {
    if (composer || !THREE.EffectComposer || !THREE.UnrealBloomPass) return;
    try {
      const gl2 = renderer.capabilities.isWebGL2;
      const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: gl2 ? 4 : 0 });
      composer = new THREE.EffectComposer(renderer, rt);
      composer.addPass(new THREE.RenderPass(scene, camera));
      bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.5, 0.7);
      composer.addPass(bloomPass);
      composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
    } catch (err) { console.warn('Bloom unavailable', err); composer = null; settings.bloom = false; }
  }
  function renderFrame() {
    if (settings.bloom && composer) composer.render(); else renderer.render(scene, camera);
  }

  // how far the camera can see around the ghost: spawn just outside it, recycle beyond it
  const view = { r: 20, spawnR: 22, despawnR: 34 };
  function measureView() {
    camera.position.copy(CAM_OFFSET); camera.lookAt(0, 0.8, 0); camera.updateMatrixWorld();
    const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    let r = 0;
    [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([x, y]) => {
      ray.setFromCamera({ x, y }, camera);
      if (ray.ray.intersectPlane(plane, hit)) r = Math.max(r, Math.hypot(hit.x, hit.z));
    });
    view.r = Math.min(r || 22, 30);
    view.spawnR = view.r + 2.5;
    view.despawnR = view.spawnR + 9;
  }

  // =====================================================================
  // Textures
  // =====================================================================
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
  // a disc with a bright rim: auras, pools, warning circles
  const discTex = canvasTex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.3)');
    gr.addColorStop(0.92, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  const GROUND_TILE = 6;
  const groundTex = canvasTex(512, (g, s) => {
    g.fillStyle = '#1b281f'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = rand(20, 70);
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, i % 2 ? 'rgba(40,30,24,0.45)' : 'rgba(34,52,36,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    const cols = ['#24372a', '#16211a', '#2b3e2c', '#131d16', '#33402a', '#1f2f24'];
    for (let i = 0; i < 16000; i++) { g.fillStyle = pick(cols); g.fillRect(Math.random() * s, Math.random() * s, rand(1, 3), rand(1, 4)); }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.encoding = THREE.sRGBEncoding;
  groundTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // =====================================================================
  // Particles: one pooled Points object of additive soft dots
  // =====================================================================
  const particles = (() => {
    const MAX = 4000;
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
          if (a < 0.01) discard; gl_FragColor = vec4(vColor * 1.25, a); }`,
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
          if (life[i] <= 0) { if (alpha[i] !== 0) alpha[i] = 0; continue; }
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

  // =====================================================================
  // 2D overlay: damage numbers, floating callouts, the ghost's HP bar, off-screen arrows
  // =====================================================================
  const fx2d = (() => {
    const cv = $('fx2d'), g = cv.getContext('2d');
    let dpr = 1, W = 0, H = 0;
    const items = [], MAX = 160, v = new THREE.Vector3();
    const STYLES = {
      dmg: { color: '#ffffff', size: 15, life: 0.6, rise: 1.4 },
      crit: { color: '#ffd35a', size: 21, life: 0.75, rise: 1.8 },
      hurt: { color: '#ff5a6e', size: 22, life: 0.9, rise: 1.4 },
      heal: { color: '#7dff9a', size: 20, life: 1, rise: 1.4 },
      gold: { color: '#ffd35a', size: 22, life: 1.1, rise: 1.6 },
      big: { color: '#ffffff', size: 30, life: 1.4, rise: 1.2 },
      bigGold: { color: '#ffd35a', size: 34, life: 1.6, rise: 1.2 },
      info: { color: '#c9b8ff', size: 20, life: 1.2, rise: 1.3 },
    };
    function resize() {
      dpr = Math.min(devicePixelRatio, 2); W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    function add(x, y, z, text, style = 'dmg') {
      if (items.length >= MAX) {
        // drop the oldest small number first so callouts survive
        const i = items.findIndex(it => it.st === STYLES.dmg);
        items.splice(i >= 0 ? i : 0, 1);
      }
      items.push({ x, y, z, text: String(text), st: STYLES[style] || STYLES.dmg, t: 0, jx: (Math.random() - 0.5) * 0.5 });
    }
    function project(x, y, z) {
      v.set(x, y, z).project(camera);
      return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H, v.z];
    }
    function draw(dt, extras) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i], st = it.st;
        it.t += dt;
        if (it.t >= st.life) { items.splice(i, 1); continue; }
        const [sx, sy, sz] = project(it.x + it.jx, it.y + it.t * st.rise, it.z);
        if (sz > 1) continue;
        const pop = it.t < 0.1 ? 0.5 + it.t / 0.1 * 0.75 : 1.25 - Math.min(0.25, (it.t - 0.1) * 2);
        const a = 1 - smooth(st.life * 0.6, st.life, it.t);
        g.globalAlpha = a;
        g.font = `${Math.round(st.size * pop)}px "Lilita One", "Arial Black", sans-serif`;
        g.lineWidth = Math.max(3, st.size * 0.22); g.strokeStyle = 'rgba(10,6,20,0.85)';
        g.strokeText(it.text, sx, sy); g.fillStyle = st.color; g.fillText(it.text, sx, sy);
      }
      g.globalAlpha = 1;
      if (extras) extras(g, W, H, project);
    }
    return { resize, add, draw, clear() { items.length = 0; g.clearRect(0, 0, cv.width, cv.height); } };
  })();

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 0.8 ? 64 : 50;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, settings.bloom ? 1.5 : 2));
    renderer.setSize(innerWidth, innerHeight);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
    particles.resize(); fx2d.resize();
    measureView();
  }
  if (settings.bloom) buildComposer();
  addEventListener('resize', resize);
  resize();

  // =====================================================================
  // World: an endless graveyard. Decor lives in one tile that wraps around the ghost.
  // =====================================================================
  const hemi = new THREE.HemisphereLight(0x8a90d0, 0x1a1428, 0.65);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xb8c8ff, 0.9);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.bias = -0.0005;
  Object.assign(moon.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 60 });
  scene.add(moon, moon.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  groundTex.repeat.set(260 / GROUND_TILE, 260 / GROUND_TILE);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // sky: moon + stars, both ride along with the ghost
  const skyGroup = new THREE.Group(); scene.add(skyGroup);
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(3, 40), new THREE.MeshBasicMaterial({ color: 0xf2efd8, fog: false }));
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0x9fb0ff, transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
  moonHalo.scale.setScalar(20);
  const moonGroup = new THREE.Group(); moonGroup.add(moonHalo, moonDisc);
  moonGroup.position.set(-22, 24, -55); skyGroup.add(moonGroup);
  {
    const n = 600, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = rand(0.15, 1.3), r = 100;
      p[i * 3] = Math.cos(a) * Math.cos(e) * r; p[i * 3 + 1] = Math.sin(e) * r; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    skyGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.45, color: 0xcfd6ff, fog: false, transparent: true, opacity: 0.8 })));
  }

  // seeded random so the graveyard layout is the same every run
  let seed = 1337;
  const srand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const srange = (a, b) => a + srand() * (b - a);

  const TILE = 72;
  const decor = [];
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5b5a6a, roughness: 0.9 });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x46594a, roughness: 1 });
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x2a2219, roughness: 1 });
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 1 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2c2838, roughness: 0.5, metalness: 0.6 });
  const slabGeo = new THREE.BoxGeometry(0.9, 1.1, 0.25);
  const capGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.25, 20, 1, false, 0, Math.PI);
  const moundGeo = new THREE.SphereGeometry(0.6, 12, 6, 0, TAU, 0, Math.PI / 2);
  const crossBar = new THREE.BoxGeometry(0.16, 1.5, 0.16), crossArm = new THREE.BoxGeometry(0.8, 0.16, 0.16);

  function placeDecor(g, x, z) {
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g); decor.push({ g, bx: x, bz: z });
  }
  function tombstone(x, z) {
    const g = new THREE.Group(), mat = srand() < 0.3 ? mossMat : stoneMat;
    const slab = new THREE.Mesh(slabGeo, mat); slab.position.y = 0.55;
    const cap = new THREE.Mesh(capGeo, mat); cap.rotation.set(Math.PI / 2, Math.PI / 2, 0); cap.position.y = 1.1;
    g.add(slab, cap);
    if (srand() < 0.5) { const mound = new THREE.Mesh(moundGeo, dirtMat); mound.scale.set(0.8, 0.25, 1.5); mound.position.set(0, 0, 0.95); g.add(mound); }
    g.scale.setScalar(srange(0.8, 1.25)); g.rotation.set(0, srange(-0.3, 0.3), srange(-0.1, 0.1));
    placeDecor(g, x, z);
  }
  function cross(x, z) {
    const g = new THREE.Group();
    const a = new THREE.Mesh(crossBar, stoneMat); a.position.y = 0.75;
    const b = new THREE.Mesh(crossArm, stoneMat); b.position.y = 1.1;
    g.add(a, b); g.scale.setScalar(srange(0.8, 1.3)); g.rotation.set(0, srange(0, 0.6), srange(-0.15, 0.15));
    placeDecor(g, x, z);
  }
  function tree(x, z) {
    const g = new THREE.Group(), s = srange(0.9, 1.5);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 4, 7), barkMat); trunk.position.y = 2; g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, srange(1.3, 2), 5), barkMat);
      b.position.set(0, 2.4 + i * 0.35, 0); b.rotation.z = (i % 2 ? 1 : -1) * srange(0.6, 1.1);
      b.rotation.y = srand() * 6; b.translateY(0.8); g.add(b);
    }
    g.scale.setScalar(s); g.rotation.y = srand() * TAU; placeDecor(g, x, z);
  }
  function fence(x, z) {
    const g = new THREE.Group(), n = Math.floor(srange(4, 8));
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.07), ironMat); p.position.set(i * 0.45, 0.55, 0); g.add(p);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), ironMat); tip.position.set(i * 0.45, 1.2, 0); g.add(tip);
    }
    [0.35, 0.9].forEach(h => { const r = new THREE.Mesh(new THREE.BoxGeometry((n - 1) * 0.45, 0.05, 0.05), ironMat); r.position.set((n - 1) * 0.225, h, 0); g.add(r); });
    g.rotation.y = srand() * TAU; placeDecor(g, x, z);
  }
  function crypt(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2, 3), stoneMat); base.position.y = 1;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.1, 1.1, 4, 1), stoneMat); roof.position.y = 2.55; roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 1.3);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.05), new THREE.MeshBasicMaterial({ color: 0x0a0812 })); door.position.set(0, 0.7, 1.51);
    const glowL = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0x7dff9a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    glowL.scale.setScalar(2.2); glowL.position.set(0, 0.7, 1.7);
    g.add(base, roof, door, glowL); g.rotation.y = srand() * TAU; placeDecor(g, x, z);
  }
  function rocks(x, z) {
    const g = new THREE.Group();
    for (let i = 0, n = Math.floor(srange(2, 5)); i < n; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(srange(0.2, 0.45), 0), stoneMat);
      r.position.set(srange(-0.6, 0.6), 0.1, srange(-0.6, 0.6)); r.rotation.set(srand() * 3, srand() * 3, 0); g.add(r);
    }
    placeDecor(g, x, z);
  }
  {
    const spots = [];
    const free = (x, z, d) => spots.every(s => Math.hypot(s[0] - x, s[1] - z) > d);
    const place = (fn, n, gap) => {
      for (let k = 0, tries = 0; k < n && tries < 2000; tries++) {
        const x = srand() * TILE, z = srand() * TILE;
        if (!free(x, z, gap)) continue;
        spots.push([x, z]); fn(x, z); k++;
      }
    };
    place(crypt, 3, 8); place(tree, 16, 4); place(tombstone, 46, 2.2); place(cross, 16, 2); place(fence, 7, 3); place(rocks, 14, 2);
  }

  // low drifting mist and fireflies, also wrapped around the ghost
  const mists = [];
  {
    const mat = new THREE.MeshBasicMaterial({ map: mistTex, color: 0x9aa6d8, transparent: true, opacity: 0.08, depthWrite: false });
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2;
      const s = srange(7, 14); m.scale.set(s, s, 1); m.renderOrder = 2;
      m.position.y = srange(0.15, 0.6);
      mists.push({ m, bx: srand() * TILE, bz: srand() * TILE, sp: srange(0.05, 0.15), ph: srand() * TAU });
      scene.add(m);
    }
  }
  const flies = (() => {
    const n = 70, p = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) seeds.push({ x: srand() * TILE, z: srand() * TILE, y: srange(0.5, 2.6), ph: srand() * TAU, sp: srange(0.3, 0.8) });
    const g = new THREE.BufferGeometry(); const attr = new THREE.BufferAttribute(p, 3); g.setAttribute('position', attr);
    const mat = new THREE.PointsMaterial({ map: dotTex, size: 0.35, color: 0xd8ff8a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
    return {
      update(t, px, pz) {
        for (let i = 0; i < n; i++) {
          const s = seeds[i];
          p[i * 3] = wrap(s.x, px) + Math.sin(t * s.sp + s.ph) * 1.6;
          p[i * 3 + 1] = s.y + Math.sin(t * s.sp * 1.7 + s.ph) * 0.4;
          p[i * 3 + 2] = wrap(s.z, pz) + Math.cos(t * s.sp * 0.8 + s.ph) * 1.6;
        }
        attr.needsUpdate = true;
        mat.opacity = 0.55 + Math.sin(t * 3) * 0.2;
      },
    };
  })();
  // nearest copy of a tiled coordinate to the ghost
  function wrap(b, p) { return b + TILE * Math.round((p - b) / TILE); }

  const skyC = new THREE.Color();
  function updateWorld(t, px, pz) {
    for (const d of decor) d.g.position.set(wrap(d.bx, px), 0, wrap(d.bz, pz));
    for (const m of mists) m.m.position.set(wrap(m.bx, px) + Math.sin(t * m.sp + m.ph) * 2, m.m.position.y, wrap(m.bz, pz) + Math.cos(t * m.sp * 0.7 + m.ph) * 1.5);
    flies.update(t, px, pz);
    ground.position.set(Math.round(px / GROUND_TILE) * GROUND_TILE, 0, Math.round(pz / GROUND_TILE) * GROUND_TILE);
    skyGroup.position.set(px, 0, pz);
    moon.position.set(px - 10, 18, pz + 8);
    moon.target.position.set(px, 0, pz);
  }
  // frenzy (0..1) reddens the night, freeze (0..1) chills it
  function updateSky(frenzy, freeze) {
    skyC.copy(NIGHT_SKY).lerp(FRENZY_SKY, frenzy).lerp(FREEZE_SKY, freeze);
    scene.background.copy(skyC); scene.fog.color.copy(skyC);
    moonDisc.material.color.setRGB(0.95, 0.94 - frenzy * 0.6, 0.85 - frenzy * 0.65);
    moonHalo.material.color.setRGB(0.62 + frenzy * 0.38, 0.69 - frenzy * 0.5, 1 - frenzy * 0.7);
    hemi.color.setRGB(0.54 + frenzy * 0.3, 0.56 - frenzy * 0.25, 0.82 - frenzy * 0.35);
  }

  // =====================================================================
  // Player ghost
  // =====================================================================
  const player = new THREE.Group(); scene.add(player);
  const model = new THREE.Group(); player.add(model);
  const ghostMat = new THREE.MeshPhysicalMaterial({ color: 0xeef2ff, roughness: 0.55, emissive: 0x5d7bd8, emissiveIntensity: 0.4, sheen: 1, sheenColor: new THREE.Color(0x9fb8ff), side: THREE.DoubleSide });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0612, roughness: 0.25 });
  const playerGlow = new THREE.PointLight(0x9fc4ff, 1.4, 8); playerGlow.position.y = 1; player.add(playerGlow);
  const GHOST_SCALE = 0.55;
  const blobGeo = new THREE.CircleGeometry(0.6, 20);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  const playerBlob = new THREE.Mesh(blobGeo, blobMat); playerBlob.rotation.x = -Math.PI / 2; playerBlob.position.y = 0.025; scene.add(playerBlob);

  function ghostLathe() {
    const pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(Math.sin(t * Math.PI / 2) * (0.75 + t * 0.5 * t), 2.6 - t * 2.6)); }
    return new THREE.LatheGeometry(pts, 32);
  }
  function buildFallbackGhost() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(ghostLathe(), ghostMat); m.castShadow = true; g.add(m);
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

  // =====================================================================
  // Enemy rendering: every foe type is one InstancedMesh built from merged, vertex-coloured parts.
  // Per-vertex `glow` lights eyes and faces; per-vertex `wing` flaps in the shader; per-instance
  // `aFlash` turns a foe white when hit.
  // =====================================================================
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  function mergeParts(parts) {
    const pos = [], nor = [], col = [], glow = [], wing = [], idx = [];
    let base = 0;
    for (const pt of parts) {
      const g = pt.geo.clone();
      const r = pt.r || [0, 0, 0], p = pt.p || [0, 0, 0], s = pt.s ?? 1;
      _q.setFromEuler(_e.set(r[0], r[1], r[2]));
      if (Array.isArray(s)) _s.set(s[0], s[1], s[2]); else _s.setScalar(s);
      _m.compose(_p.set(p[0], p[1], p[2]), _q, _s); g.applyMatrix4(_m);
      if (!g.attributes.normal) g.computeVertexNormals();
      const P = g.attributes.position, N = g.attributes.normal, n = P.count;
      _c.set(pt.color);
      for (let i = 0; i < n; i++) {
        pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i));
        col.push(_c.r, _c.g, _c.b); glow.push(pt.glow || 0); wing.push(pt.wing || 0);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
      else for (let i = 0; i < n; i++) idx.push(i + base);
      base += n;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    out.setAttribute('glow', new THREE.Float32BufferAttribute(glow, 1));
    out.setAttribute('wing', new THREE.Float32BufferAttribute(wing, 1));
    out.setIndex(idx); out.computeBoundingSphere();
    return out;
  }

  const shaderTime = { value: 0 };
  function enemyMaterial(opts = {}) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, ...opts });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = shaderTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime; attribute float glow; attribute float wing; attribute float aFlash; attribute float aPhase;
          varying float vGlow; varying float vFlash;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vGlow = glow; vFlash = aFlash;
          if (wing != 0.0) {
            float fa = sin(uTime * 22.0 + aPhase) * 0.85 * wing;
            float fc = cos(fa), fs = sin(fa);
            transformed.xy = vec2(fc * transformed.x - fs * transformed.y, fs * transformed.x + fc * transformed.y);
          }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying float vGlow; varying float vFlash;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += vColor.rgb * vGlow * 2.2;`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.97, 0.94), vFlash);`);
    };
    return m;
  }

  // ---------- shared shapes ----------
  const pumpkinBody = (() => {
    const g = new THREE.SphereGeometry(0.55, 20, 12), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.08 * Math.cos(a * 8);
      p.setXYZ(i, x * k, y * 0.8, z * k);
    }
    g.computeVertexNormals(); return g;
  })();
  const triEye = new THREE.ConeGeometry(0.1, 0.14, 3);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 12, 9);
  const cone4 = new THREE.ConeGeometry(1, 1, 4);
  const wingShape = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.12); s.lineTo(0.75, 0.28); s.lineTo(0.66, -0.02); s.lineTo(0.5, 0.06); s.lineTo(0.38, -0.12); s.lineTo(0.22, -0.02); s.lineTo(0, -0.12); s.lineTo(0, 0.12);
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g;
  })();
  const ghostBody = (() => { const g = ghostLathe(); g.scale(0.5, 0.5, 0.5); return g; })();

  function pumpkinParts(body, face, stem, glow = 1) {
    return [
      { geo: pumpkinBody, color: body, p: [0, 0.45, 0] },
      { geo: new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6), color: stem, p: [0, 0.95, 0], r: [0, 0, 0.25] },
      { geo: triEye, color: face, glow, p: [-0.17, 0.55, 0.5], r: [Math.PI / 2, Math.PI, 0] },
      { geo: triEye, color: face, glow, p: [0.17, 0.55, 0.5], r: [Math.PI / 2, Math.PI, 0] },
      { geo: box, color: face, glow, p: [0, 0.32, 0.5], s: [0.34, 0.07, 0.06] },
      { geo: box, color: face, glow, p: [-0.1, 0.37, 0.5], s: [0.06, 0.06, 0.05] },
      { geo: box, color: face, glow, p: [0.1, 0.37, 0.5], s: [0.06, 0.06, 0.05] },
    ];
  }
  function batParts(body, eye) {
    return [
      { geo: sphere, color: body, s: [0.22, 0.21, 0.26] },
      { geo: cone4, color: body, p: [-0.1, 0.22, 0.05], s: [0.06, 0.16, 0.06] },
      { geo: cone4, color: body, p: [0.1, 0.22, 0.05], s: [0.06, 0.16, 0.06] },
      { geo: sphere, color: eye, glow: 1.4, p: [-0.08, 0.06, 0.22], s: 0.045 },
      { geo: sphere, color: eye, glow: 1.4, p: [0.08, 0.06, 0.22], s: 0.045 },
      { geo: wingShape, color: body, wing: 1, p: [0.05, 0, 0] },
      { geo: wingShape, color: body, wing: -1, p: [-0.05, 0, 0], r: [0, Math.PI, 0] },
    ];
  }

  const GEO = {
    pumpkin: mergeParts(pumpkinParts(0xff7a1a, 0xffc94a, 0x3f5a1e)),
    brute: mergeParts([
      ...pumpkinParts(0x6a5a7a, 0x7dff9a, 0x2a3a1a, 1.4),
      { geo: box, color: 0x3a3048, p: [0, 0.75, -0.2], s: [0.7, 0.1, 0.3], r: [0.4, 0, 0] },
    ]),
    bat: mergeParts(batParts(0x2c2040, 0xff4a5a)),
    wraith: mergeParts([
      { geo: ghostBody, color: 0x8a1a3a, glow: 0.18 },
      { geo: sphere, color: 0xffe14a, glow: 1.5, p: [-0.13, 0.95, 0.36], s: [0.06, 0.09, 0.03] },
      { geo: sphere, color: 0xffe14a, glow: 1.5, p: [0.13, 0.95, 0.36], s: [0.06, 0.09, 0.03] },
      { geo: box, color: 0x200810, p: [0, 0.75, 0.38], s: [0.16, 0.12, 0.04] },
    ]),
    spider: mergeParts([
      { geo: sphere, color: 0x251a33, p: [0, 0.35, -0.2], s: [0.38, 0.3, 0.45] },
      { geo: sphere, color: 0x33244a, p: [0, 0.3, 0.25], s: [0.22, 0.18, 0.2] },
      { geo: sphere, color: 0x9a1aff, glow: 0.5, p: [0, 0.55, -0.25], s: [0.14, 0.04, 0.2] },
      ...[-1, 1].flatMap(sd => [0.05, 0.25, -0.15, -0.35].map((z, i) => ({ geo: box, color: 0x1a1226, p: [sd * 0.38, 0.3, z], s: [0.5, 0.05, 0.05], r: [0, sd * (i - 1.5) * 0.25, sd * -0.5] }))),
      ...[-0.07, 0.07, -0.12, 0.12].map((x, i) => ({ geo: sphere, color: 0xff2a4a, glow: 1.5, p: [x, i < 2 ? 0.38 : 0.34, 0.42], s: 0.035 })),
    ]),
    eye: mergeParts([
      { geo: new THREE.SphereGeometry(0.42, 16, 12), color: 0xf0e8e0 },
      { geo: new THREE.SphereGeometry(0.2, 12, 8), color: 0xff2a6a, glow: 1.2, p: [0, 0, 0.3], s: [1, 1, 0.5] },
      { geo: new THREE.SphereGeometry(0.09, 8, 6), color: 0x050208, p: [0, 0, 0.39], s: [1, 1, 0.4] },
      { geo: wingShape, color: 0x4a2a5a, wing: 1, p: [0.3, 0.05, 0], s: 0.9 },
      { geo: wingShape, color: 0x4a2a5a, wing: -1, p: [-0.3, 0.05, 0], r: [0, Math.PI, 0], s: 0.9 },
    ]),
    lantern: mergeParts([
      { geo: new THREE.CylinderGeometry(0.06, 0.09, 1.6, 6), color: 0x221e2a, p: [0, 0.8, 0] },
      { geo: box, color: 0xffb050, glow: 1.6, p: [0, 1.75, 0], s: [0.32, 0.4, 0.32] },
      { geo: cone4, color: 0x221e2a, p: [0, 2.08, 0], s: [0.3, 0.24, 0.3], r: [0, Math.PI / 4, 0] },
      { geo: box, color: 0x221e2a, p: [0, 0.03, 0], s: [0.4, 0.06, 0.4] },
    ]),
    king: mergeParts([
      ...pumpkinParts(0xff6a10, 0xffe070, 0x3f5a1e, 1.5),
      { geo: new THREE.CylinderGeometry(0.26, 0.28, 0.1, 16, 1, true), color: 0xffc83a, glow: 0.4, p: [0, 1.0, 0], r: [0, 0, 0.12] },
      ...[0, 1, 2, 3, 4].map(i => ({ geo: cone4, color: 0xffc83a, glow: 0.4, p: [Math.cos(i / 5 * TAU) * 0.26, 1.13, Math.sin(i / 5 * TAU) * 0.26], s: [0.06, 0.18, 0.06] })),
    ]),
    queen: mergeParts([
      { geo: ghostBody, color: 0x4a2a8a, glow: 0.3 },
      { geo: sphere, color: 0xff3aa0, glow: 1.8, p: [-0.13, 0.95, 0.36], s: [0.07, 0.1, 0.03] },
      { geo: sphere, color: 0xff3aa0, glow: 1.8, p: [0.13, 0.95, 0.36], s: [0.07, 0.1, 0.03] },
      ...[0, 1, 2, 3, 4, 5, 6].map(i => ({ geo: cone4, color: 0xc9b8ff, glow: 0.8, p: [Math.cos(i / 7 * TAU) * 0.2, 1.38, Math.sin(i / 7 * TAU) * 0.2], s: [0.045, 0.22, 0.045] })),
    ]),
  };

  // stats are per spawn at minute 0; hp scales with time
  const KINDS = {
    pumpkin: { name: 'Pumpkin', hp: 8, speed: 2.7, dmg: 5, xp: 1, r: 0.42, scale: 0.85, pts: 10, ai: 'chase', color: 0xff8a2a, cap: 520 },
    bat: { name: 'Bat', hp: 5, speed: 4.4, dmg: 4, xp: 1, r: 0.35, scale: 1.1, pts: 10, ai: 'bat', fly: 1.1, color: 0xb07aff, cap: 360, side: THREE.DoubleSide },
    wraith: { name: 'Wraith', hp: 26, speed: 2.3, dmg: 9, xp: 3, r: 0.48, scale: 1, pts: 25, ai: 'wraith', fly: 0.2, color: 0xff4a6a, cap: 220 },
    spider: { name: 'Spider', hp: 15, speed: 5.4, dmg: 7, xp: 2, r: 0.42, scale: 1.05, pts: 20, ai: 'spider', color: 0x9a7aff, cap: 220 },
    eye: { name: 'Hex Eye', hp: 24, speed: 3.2, dmg: 6, xp: 4, r: 0.45, scale: 1, pts: 30, ai: 'eye', fly: 1.3, color: 0xff5a8a, cap: 90, side: THREE.DoubleSide },
    brute: { name: 'Gourd Brute', hp: 150, speed: 1.9, dmg: 16, xp: 12, r: 0.9, scale: 2, pts: 90, ai: 'chase', heavy: true, color: 0x7dff9a, cap: 70 },
    lantern: { name: 'Lantern', hp: 1, speed: 0, dmg: 0, xp: 0, r: 0.4, scale: 1, pts: 5, ai: 'static', color: 0xffb050, cap: 24, prop: true },
    king: { name: 'The Pumpkin King', hp: 1100, speed: 2.5, dmg: 22, xp: 0, r: 1.35, scale: 2.8, pts: 2500, ai: 'king', color: 0xff8a2a, cap: 4, boss: true },
    queen: { name: 'The Wraith Queen', hp: 950, speed: 3, dmg: 18, xp: 0, r: 1.2, scale: 2.5, pts: 3000, ai: 'queen', fly: 0.5, color: 0xc9b8ff, cap: 4, boss: true },
  };

  const herds = {};
  const WHITE = new THREE.Color(1, 1, 1);
  for (const id in KINDS) {
    const k = KINDS[id], geo = GEO[id], cap = k.cap;
    const flash = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    const phase = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFlash', flash); geo.setAttribute('aPhase', phase);
    const mesh = new THREE.InstancedMesh(geo, enemyMaterial({ side: k.side || THREE.FrontSide }), cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, WHITE); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0;
    mesh.castShadow = !!(k.boss || k.prop);
    scene.add(mesh);
    herds[id] = { mesh, flash, phase, n: 0, cap };
  }
  const shadows = new THREE.InstancedMesh(new THREE.CircleGeometry(0.6, 16).rotateX(-Math.PI / 2), blobMat, 1400);
  shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); shadows.frustumCulled = false; shadows.count = 0; shadows.renderOrder = 1;
  scene.add(shadows);

  // =====================================================================
  // Enemies: data + spatial grid
  // =====================================================================
  const enemies = [];
  let nextEnemyId = 1;
  const FAMILIES = 8; // one hit-cooldown slot per weapon family

  function makeEnemy(id, x, z, o = {}) {
    const k = KINDS[id];
    const e = {
      id, k, ai: k.ai, uid: nextEnemyId++, x, z, y: k.fly || 0, vx: 0, vz: 0, kx: 0, kz: 0,
      hp: k.hp, maxHp: k.hp, dmg: k.dmg, speed: k.speed, r: k.r, scale: k.scale, xp: k.xp, pts: k.pts,
      flash: 0, dying: 0, slow: 0, burn: 0, phase: Math.random() * TAU, rot: Math.random() * TAU, t: Math.random() * 10,
      timer: rand(1, 3), mode: 'walk', elite: false, boss: !!k.boss, life: Infinity, spawn: 0.3, hitAt: new Float32Array(FAMILIES).fill(-9),
      dirX: 0, dirZ: 0, ang: 0,
    };
    Object.assign(e, o);
    enemies.push(e);
    return e;
  }

  const G_CELL = 2.5, G_N = 40, G_HALF = G_N * G_CELL / 2;
  const gHead = new Int32Array(G_N * G_N), gNext = new Int32Array(4096);
  let gOx = 0, gOz = 0;
  const near = []; // reusable query result
  const cellOf = (v, o) => { const c = Math.floor((v - o) / G_CELL); return c < 0 ? 0 : c >= G_N ? G_N - 1 : c; };
  function gridBuild(px, pz) {
    gHead.fill(-1); gOx = px - G_HALF; gOz = pz - G_HALF;
    const n = Math.min(enemies.length, gNext.length);
    for (let i = 0; i < n; i++) {
      const e = enemies[i];
      if (e.dying) continue;
      const c = cellOf(e.z, gOz) * G_N + cellOf(e.x, gOx);
      gNext[i] = gHead[c]; gHead[c] = i;
    }
  }
  // fills `near` with live enemies whose centre is within r (+ their radius) of x,z
  function gridQuery(x, z, r) {
    near.length = 0;
    const x0 = cellOf(x - r - 1.4, gOx), x1 = cellOf(x + r + 1.4, gOx), z0 = cellOf(z - r - 1.4, gOz), z1 = cellOf(z + r + 1.4, gOz);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      for (let i = gHead[cz * G_N + cx]; i >= 0; i = gNext[i]) {
        const e = enemies[i];
        if (e.dying) continue;
        const dx = e.x - x, dz = e.z - z, rr = r + e.r;
        if (dx * dx + dz * dz <= rr * rr) near.push(e);
      }
    }
    return near;
  }
  function nearestEnemies(x, z, n, maxR, out = []) {
    out.length = 0;
    const list = gridQuery(x, z, maxR);
    for (const e of list) if (!e.k.prop) out.push(e);
    for (const e of out) e._d = (e.x - x) ** 2 + (e.z - z) ** 2;
    out.sort((a, b) => a._d - b._d);
    if (out.length > n) out.length = n;
    return out;
  }

  // =====================================================================
  // Enemy projectiles (instanced glowing orbs)
  // =====================================================================
  const orbs = [];
  const ORB_CAP = 500;
  const orbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4a8a, toneMapped: false }), ORB_CAP);
  orbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); orbMesh.frustumCulled = false; orbMesh.count = 0; scene.add(orbMesh);
  const orbCore = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), ORB_CAP);
  orbCore.instanceMatrix.setUsage(THREE.DynamicDrawUsage); orbCore.frustumCulled = false; orbCore.count = 0; scene.add(orbCore);
  function fireOrb(x, z, ang, speed, dmg, y = 0.8) {
    if (orbs.length >= ORB_CAP) return;
    orbs.push({ x, z, y, vx: Math.cos(ang) * speed, vz: Math.sin(ang) * speed, life: 6, dmg });
  }

  // =====================================================================
  // Soul gems (XP): instanced, colour by value, merge when there are too many
  // =====================================================================
  const gems = [];
  const GEM_CAP = 800;
  const gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), GEM_CAP);
  gemMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); gemMesh.setColorAt(0, WHITE); gemMesh.frustumCulled = false; gemMesh.count = 0; scene.add(gemMesh);
  const GEM_TIERS = [
    { min: 0, color: new THREE.Color(0x4aa8ff), s: 0.85 },
    { min: 4, color: new THREE.Color(0x4aff8a), s: 1.05 },
    { min: 15, color: new THREE.Color(0xff3a5a), s: 1.3 },
    { min: 60, color: new THREE.Color(0xd86aff), s: 1.65 },
  ];
  const gemTier = v => { let t = 0; for (let i = 0; i < GEM_TIERS.length; i++) if (v >= GEM_TIERS[i].min) t = i; return t; };
  function dropGem(x, z, v) {
    if (v <= 0) return;
    if (gems.length >= GEM_CAP) {
      // fold into the furthest gem so nothing is lost
      let far = gems[0], fd = -1;
      for (let i = 0; i < gems.length; i += 7) { const g = gems[i], d = (g.x - player.position.x) ** 2 + (g.z - player.position.z) ** 2; if (d > fd) { fd = d; far = g; } }
      far.v += v; far.tier = gemTier(far.v); return;
    }
    gems.push({ x: x + rand(-0.25, 0.25), z: z + rand(-0.25, 0.25), v, tier: gemTier(v), pull: false, sp: 0, t: Math.random() * 6, pop: 0.25 });
  }

  // =====================================================================
  // Item pickups: candy, soul vacuum, frost hourglass, doom bell, gold, chests
  // =====================================================================
  const ITEMS = {
    candy: { name: 'Soul Candy', color: 0xff5a8a },
    vacuum: { name: 'Soul Vacuum', color: 0x5fb6ff },
    clock: { name: 'Frost Hourglass', color: 0x9fe8ff },
    bell: { name: 'Doom Bell', color: 0xffd35a },
    coin: { name: 'Gold', color: 0xffd35a },
    bag: { name: 'Gold Pile', color: 0xffd35a },
    chest: { name: 'Treasure', color: 0xffd35a },
  };
  const itemMats = {};
  const imat = (c, emi = 0.45, metal = 0.2) => itemMats[c + ':' + emi] || (itemMats[c + ':' + emi] = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: emi, roughness: 0.35, metalness: metal }));
  function itemMesh(kind) {
    const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
    const add = (geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r); if (Array.isArray(s)) m.scale.set(...s); else m.scale.setScalar(s); spin.add(m); return m; };
    if (kind === 'candy') {
      add(new THREE.SphereGeometry(0.22, 14, 10), imat(0xff5a8a), [0, 0, 0], [0, 0, 0], [1.3, 1, 1]);
      add(new THREE.ConeGeometry(0.16, 0.22, 8), imat(0xfff0f5), [0.36, 0, 0], [0, 0, Math.PI / 2]);
      add(new THREE.ConeGeometry(0.16, 0.22, 8), imat(0xfff0f5), [-0.36, 0, 0], [0, 0, -Math.PI / 2]);
    } else if (kind === 'vacuum') {
      add(new THREE.TorusGeometry(0.24, 0.08, 8, 20, Math.PI), imat(0x5fb6ff), [0, 0.05, 0], [0, 0, Math.PI]);
      add(new THREE.BoxGeometry(0.17, 0.14, 0.17), imat(0xe8ecf5, 0.2, 0.7), [-0.24, 0.08, 0]);
      add(new THREE.BoxGeometry(0.17, 0.14, 0.17), imat(0xe8ecf5, 0.2, 0.7), [0.24, 0.08, 0]);
    } else if (kind === 'clock') {
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), imat(0x2a4a6a), [0, 0.3, 0]);
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), imat(0x2a4a6a), [0, -0.3, 0]);
      add(new THREE.ConeGeometry(0.17, 0.27, 12), imat(0x9fe8ff, 0.8), [0, 0.13, 0], [Math.PI, 0, 0]);
      add(new THREE.ConeGeometry(0.17, 0.27, 12), imat(0x9fe8ff, 0.8), [0, -0.13, 0]);
    } else if (kind === 'bell') {
      add(new THREE.CylinderGeometry(0.12, 0.3, 0.42, 14, 1, true), imat(0xffc83a, 0.5, 0.8), [0, 0, 0]);
      add(new THREE.SphereGeometry(0.12, 10, 8), imat(0xffc83a, 0.5, 0.8), [0, 0.2, 0]);
      add(new THREE.SphereGeometry(0.07, 8, 6), imat(0x5a3a10), [0, -0.24, 0]);
    } else if (kind === 'coin' || kind === 'bag') {
      const n = kind === 'bag' ? 5 : 1;
      for (let i = 0; i < n; i++) add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), imat(0xffd35a, 0.55, 0.9), [i ? rand(-0.2, 0.2) : 0, i * 0.07 - 0.1, i ? rand(-0.2, 0.2) : 0], [Math.PI / 2, 0, 0]);
    } else if (kind === 'chest') {
      add(new THREE.BoxGeometry(0.8, 0.45, 0.55), imat(0x6a3a1a, 0.15, 0.1), [0, -0.1, 0]);
      add(new THREE.CylinderGeometry(0.28, 0.28, 0.8, 12, 1, false, 0, Math.PI), imat(0x7a4a22, 0.15, 0.1), [0, 0.12, 0], [0, 0, Math.PI / 2]);
      add(new THREE.BoxGeometry(0.84, 0.06, 0.6), imat(0xffc83a, 0.6, 0.9), [0, 0.12, 0]);
      add(new THREE.BoxGeometry(0.12, 0.16, 0.08), imat(0xffc83a, 0.6, 0.9), [0, 0.05, 0.3]);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: ITEMS[kind].color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(kind === 'chest' ? 3 : 1.6); g.add(halo);
    return { g, spin, halo };
  }
  const items = [];
  function dropItem(kind, x, z) {
    const { g, spin, halo } = itemMesh(kind);
    g.position.set(x, 0.8, z); scene.add(g);
    const it = { kind, g, spin, halo, x, z, t: 0, life: kind === 'chest' ? Infinity : 40 };
    items.push(it);
    particles.emit(x, 0.8, z, { count: 16, color: ITEMS[kind].color, speed: 2.5, life: 0.6, size: 0.3 });
    return it;
  }
  function removeItem(it) {
    scene.remove(it.g); it.halo.material.dispose();
    it.g.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    items.splice(items.indexOf(it), 1);
  }

  // =====================================================================
  // Arsenal: weapons, evolutions and passives
  // =====================================================================
  const WEAPONS = {
    wisp: { fam: 0, name: 'Wisp Bolt', color: '#8fd8ff', unit: 'bolt', evo: 'soulstorm', partner: 'haste',
      blurb: 'Fires homing wisps at the nearest foe.',
      base: { dmg: 10, cd: 1.15, amount: 1, pierce: 1, speed: 13, area: 1, duration: 1.6 },
      up: [{ amount: 1 }, { dmg: 5 }, { amount: 1 }, { pierce: 1 }, { amount: 1 }, { dmg: 5 }, { pierce: 1, dmg: 5 }] },
    aura: { fam: 1, name: 'Chill Aura', color: '#9fe8ff', evo: 'dread', partner: 'maxhp',
      blurb: 'A freezing aura hurts and slows every foe that comes close.',
      base: { dmg: 6, cd: 0.55, area: 2.2, knock: 0.6, amount: 0 },
      up: [{ area: 0.35 }, { dmg: 3 }, { cd: -0.08 }, { area: 0.35 }, { dmg: 3 }, { area: 0.35 }, { dmg: 4, cd: -0.06 }] },
    candles: { fam: 2, name: 'Candle Ring', color: '#ffb36b', unit: 'candle', evo: 'hellfire', partner: 'duration',
      blurb: 'Candles orbit you, burning anything they touch.',
      base: { dmg: 12, cd: 4.5, amount: 2, area: 2.6, speed: 3.2, duration: 3 },
      up: [{ amount: 1 }, { speed: 0.6, area: 0.3 }, { dmg: 6 }, { duration: 0.8 }, { amount: 1 }, { area: 0.4 }, { dmg: 8 }] },
    lightning: { fam: 3, name: 'Hex Bolt', color: '#c9b8ff', unit: 'strike', evo: 'coven', partner: 'amount',
      blurb: 'Lightning strikes random foes on screen.',
      base: { dmg: 22, cd: 2.4, amount: 2, area: 1.3 },
      up: [{ amount: 1 }, { dmg: 10 }, { area: 0.4 }, { amount: 1 }, { dmg: 12 }, { cd: -0.4 }, { amount: 2 }] },
    scythe: { fam: 4, name: 'Reaper Scythe', color: '#e8ecf5', unit: 'scythe', evo: 'harvest', partner: 'might',
      blurb: 'A thrown scythe that slices through foes, then flies back.',
      base: { dmg: 20, cd: 2.2, amount: 1, area: 1, speed: 13, duration: 1.8 },
      up: [{ amount: 1 }, { dmg: 8 }, { area: 0.25 }, { amount: 1 }, { dmg: 10 }, { speed: 2, area: 0.25 }, { amount: 1 }] },
    flask: { fam: 5, name: 'Ecto Flask', color: '#7dff9a', unit: 'flask', evo: 'marsh', partner: 'magnet',
      blurb: 'Lobbed flasks leave bubbling pools of ectoplasm.',
      base: { dmg: 7, cd: 4, amount: 1, area: 1.6, duration: 2.6 },
      up: [{ amount: 1 }, { area: 0.3, dmg: 3 }, { duration: 0.6 }, { amount: 1 }, { area: 0.4, dmg: 3 }, { duration: 0.6 }, { amount: 1, dmg: 4 }] },
    wail: { fam: 6, name: 'Banshee Wail', color: '#ff8ad8', unit: 'direction', evo: 'shriek', partner: 'speed',
      blurb: 'A piercing shriek slashes the foes in front of you.',
      base: { dmg: 16, cd: 1.35, amount: 1, area: 1, knock: 2 },
      up: [{ amount: 1 }, { dmg: 8 }, { area: 0.2 }, { dmg: 8 }, { amount: 1 }, { area: 0.2 }, { amount: 1, dmg: 8 }] },
    moon: { fam: 7, name: 'Moonfall', color: '#dfe6ff', unit: 'beam', evo: 'bloodmoon', partner: 'luck',
      blurb: 'Moonbeams crash down on the thickest crowds.',
      base: { dmg: 45, cd: 3.6, amount: 1, area: 1.8 },
      up: [{ dmg: 15 }, { amount: 1 }, { area: 0.4 }, { dmg: 20 }, { amount: 1 }, { cd: -0.6 }, { amount: 1, area: 0.4 }] },
    // evolutions: replace their base weapon once it is maxed and its partner passive is owned
    soulstorm: { fam: 0, evolved: true, name: 'Soul Storm', color: '#8fd8ff', blurb: 'An endless torrent of piercing, homing wisps.',
      base: { dmg: 16, cd: 0.12, amount: 1, pierce: 3, speed: 17, area: 1.2, duration: 1.6 } },
    dread: { fam: 1, evolved: true, name: 'Dread Halo', color: '#ff6ad8', blurb: 'A vast halo of dread. Foes slain inside it heal you.',
      base: { dmg: 14, cd: 0.4, area: 4.2, knock: 1, amount: 0 } },
    hellfire: { fam: 2, evolved: true, name: 'Hellfire Halo', color: '#ff6a2a', blurb: 'Six eternal flames orbit you without rest.',
      base: { dmg: 24, cd: 0, amount: 6, area: 3.3, speed: 4, duration: Infinity } },
    coven: { fam: 3, evolved: true, name: 'Witch Storm', color: '#b48aff', blurb: 'A lightning storm whose bolts chain between foes.',
      base: { dmg: 40, cd: 1.6, amount: 6, area: 2, chain: 3 } },
    harvest: { fam: 4, evolved: true, name: "Death's Harvest", color: '#e8ecf5', blurb: 'Eight giant scythes spiral outward in every direction.',
      base: { dmg: 42, cd: 2.4, amount: 8, area: 1.9, speed: 10, duration: 2 } },
    marsh: { fam: 5, evolved: true, name: 'Plague Marsh', color: '#5aff5a', blurb: 'Huge pools that creep toward the nearest foes.',
      base: { dmg: 14, cd: 3.2, amount: 4, area: 2.8, duration: 5 } },
    shriek: { fam: 6, evolved: true, name: 'Shriek of the Damned', color: '#ff5ab8', blurb: 'A full-circle scream that blasts every foe away.',
      base: { dmg: 42, cd: 1.05, amount: 1, area: 1.7, knock: 5 } },
    bloodmoon: { fam: 7, evolved: true, name: 'Blood Moon', color: '#ff3a4a', blurb: 'Crimson beams rain down and scorch the earth.',
      base: { dmg: 95, cd: 2.6, amount: 5, area: 3 } },
  };
  for (const id in WEAPONS) { const w = WEAPONS[id]; w.id = id; w.max = w.evolved ? 1 : w.up.length + 1; }
  const BASE_WEAPONS = Object.keys(WEAPONS).filter(id => !WEAPONS[id].evolved);

  const PASSIVES = {
    might: { name: 'Grim Ring', color: '#ff6a5a', max: 5, desc: '+10% damage.' },
    haste: { name: 'Grave Clock', color: '#8fd8ff', max: 5, desc: 'Weapons recharge 8% faster.' },
    area: { name: 'Wailing Bell', color: '#c9b8ff', max: 5, desc: '+10% attack area.' },
    duration: { name: 'Hourglass', color: '#ffb36b', max: 5, desc: 'Effects last 12% longer.' },
    amount: { name: 'Twin Candle', color: '#ffd35a', max: 2, desc: '+1 projectile for every weapon.' },
    maxhp: { name: 'Ectoplasm', color: '#7dff9a', max: 5, desc: '+20 max HP.' },
    speed: { name: 'Swift Shroud', color: '#9fe8ff', max: 5, desc: 'Float 10% faster.' },
    magnet: { name: 'Soul Lantern', color: '#5fb6ff', max: 5, desc: 'Collect gems from 35% farther away.' },
    luck: { name: 'Four-Leaf Clover', color: '#7dff9a', max: 5, desc: '+10% luck: more crits, drops and choices.' },
    armor: { name: 'Iron Coffin', color: '#c8c4dc', max: 5, desc: 'Take 1 less damage from every hit.' },
    regen: { name: 'Graveberry', color: '#ff5a8a', max: 5, desc: 'Regenerate 0.3 HP per second.' },
    growth: { name: 'Old Tome', color: '#ffd35a', max: 5, desc: '+10% XP from soul gems.' },
  };
  for (const id in PASSIVES) PASSIVES[id].id = id;
  const MAX_SLOTS = 6;

  function describeUp(def, lvl) {
    const d = def.up[lvl - 2], out = [];
    for (const k in d) {
      const v = d[k];
      if (k === 'amount') out.push(`+${v} ${def.unit || 'projectile'}${v > 1 ? 's' : ''}`);
      else if (k === 'dmg') out.push(`+${v} damage`);
      else if (k === 'cd') out.push(`${Math.round(-v / def.base.cd * 100)}% faster`);
      else if (k === 'area') out.push(`+${Math.round(v / def.base.area * 100)}% area`);
      else if (k === 'pierce') out.push(`+${v} pierce`);
      else if (k === 'duration') out.push(`+${v}s duration`);
      else if (k === 'speed') out.push(`+${Math.round(v / def.base.speed * 100)}% speed`);
    }
    return out.join(', ') + '.';
  }

  // ---------- player stats derived from passives ----------
  let P = {};
  const owned = { weapons: [], passives: [] }; // [{id, lvl, ...}]
  const plv = id => { const p = owned.passives.find(x => x.id === id); return p ? p.lvl : 0; };
  function computeStats() {
    P = {
      might: 1 + 0.1 * plv('might'), cd: 1 - 0.08 * plv('haste'), area: 1 + 0.1 * plv('area'), duration: 1 + 0.12 * plv('duration'),
      amount: plv('amount'), maxHp: 100 + 20 * plv('maxhp'), speed: 6.2 * (1 + 0.1 * plv('speed')), magnet: 2.9 * (1 + 0.35 * plv('magnet')),
      luck: 1 + 0.1 * plv('luck'), armor: plv('armor'), regen: 0.3 * plv('regen'), growth: 1 + 0.1 * plv('growth'),
    };
    for (const w of owned.weapons) w.st = weaponStats(w);
  }
  function weaponStats(w) {
    const def = WEAPONS[w.id], st = { ...def.base };
    if (!def.evolved) for (let i = 0; i < w.lvl - 1; i++) for (const k in def.up[i]) st[k] = (st[k] || 0) + def.up[i][k];
    st.dmg *= P.might; st.cd *= P.cd; st.area *= P.area;
    if (st.duration !== undefined) st.duration *= P.duration;
    if (st.amount > 0) st.amount += P.amount;
    return st;
  }
  const famWeapon = fam => owned.weapons.find(w => WEAPONS[w.id].fam === fam);

  // =====================================================================
  // Damage
  // =====================================================================
  let gameTime = 0; // seconds of play; used for hit cooldowns
  function hit(e, dmg, fam, nx = 0, nz = 0, knock = 0) {
    if (e.dying || e.spawn > 0.15) return false;
    const crit = Math.random() < 0.05 + (P.luck - 1) * 0.4;
    if (crit) dmg *= 2;
    dmg = Math.max(1, Math.round(dmg * (0.9 + Math.random() * 0.2)));
    const dealt = Math.min(dmg, e.hp);
    e.hp -= dmg; e.flash = 0.1;
    if (knock && !e.boss && !e.k.prop) { const kk = e.k.heavy ? knock * 0.3 : knock; e.kx += nx * kk; e.kz += nz * kk; }
    const w = famWeapon(fam); if (w) w.dmg += dealt;
    stats.damage += dealt;
    if (settings.numbers && !e.k.prop) fx2d.add(e.x, (e.y || 0) + 1.1 * e.scale * 0.6 + 0.6, e.z, dmg, crit ? 'crit' : 'dmg');
    audio.hit();
    if (e.hp <= 0) { kill(e, fam); return true; }
    return false;
  }
  // hit with a per-enemy cooldown for this weapon family (orbiting / lingering weapons)
  function hitCd(e, dmg, fam, cd, nx, nz, knock) {
    if (gameTime - e.hitAt[fam] < cd) return false;
    e.hitAt[fam] = gameTime;
    return hit(e, dmg, fam, nx, nz, knock);
  }

  // =====================================================================
  // Weapon visuals and runtime objects
  // =====================================================================
  const add = m => { scene.add(m); return m; };
  const glowMat = (color, opacity = 1, tex = null) => new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const flatDisc = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const timers = [];
  const later = (t, fn) => timers.push({ t, fn });

  // ---- wisp bolts (instanced) ----
  const bolts = [], BOLT_CAP = 260;
  const boltMesh = add(new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9fdcff, toneMapped: false }), BOLT_CAP));
  const boltCore = add(new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), BOLT_CAP));
  [boltMesh, boltCore].forEach(m => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; });

  // ---- aura disc ----
  const auraMesh = add(new THREE.Mesh(flatDisc, glowMat(0x9fe8ff, 0.5, discTex)));
  auraMesh.visible = false; auraMesh.renderOrder = 3;

  // ---- candles ----
  const candleGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.42, 10);
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xfff3dc, emissive: 0xffd8a0, emissiveIntensity: 0.4, roughness: 0.6 });
  const candles = [];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(candleGeo, candleMat); g.add(body);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    flame.position.y = 0.38; flame.scale.set(0.5, 0.75, 1); g.add(flame);
    g.visible = false; add(g); candles.push({ g, flame });
  }

  // ---- lightning ribbons ----
  const BOLT_SEG = 12;
  const zaps = [];
  for (let i = 0; i < 40; i++) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((BOLT_SEG + 1) * 2 * 3), idx = [];
    for (let s = 0; s < BOLT_SEG; s++) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
    const m = add(new THREE.Mesh(geo, glowMat(0xd8c8ff, 1))); m.frustumCulled = false; m.visible = false; m.renderOrder = 6;
    zaps.push({ m, pos, t: 1 });
  }
  const zapLight = add(new THREE.PointLight(0xc9b8ff, 0, 14, 2));
  function drawZap(x0, y0, z0, x1, y1, z1, color, width = 0.22) {
    const z = zaps.find(q => !q.m.visible) || zaps[0];
    const { pos } = z;
    for (let s = 0; s <= BOLT_SEG; s++) {
      const k = s / BOLT_SEG, j = s === 0 || s === BOLT_SEG ? 0 : 0.55;
      const x = lerp(x0, x1, k) + rand(-j, j), y = lerp(y0, y1, k), zz = lerp(z0, z1, k) + rand(-j, j) * 0.5;
      const w = width * (1 - k * 0.4);
      pos.set([x - w, y, zz, x + w, y, zz], s * 6);
    }
    z.m.geometry.attributes.position.needsUpdate = true; z.m.geometry.computeBoundingSphere();
    z.m.material.color.set(color); z.m.material.opacity = 1; z.m.visible = true; z.t = 0;
  }

  // ---- scythes ----
  const scytheGeo = (() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.75, -0.2, Math.PI * 1.05, false);
    s.absarc(0.16, -0.08, 0.58, Math.PI * 1.05, -0.2, true);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false, curveSegments: 18 });
    g.translate(0, 0, -0.025); g.rotateX(-Math.PI / 2);
    const handle = new THREE.BoxGeometry(0.08, 0.05, 1.1); handle.translate(0.7, 0, 0.45);
    return mergeParts([{ geo: g, color: 0xdfe6f5, glow: 0.35 }, { geo: handle, color: 0x3a2a40 }]);
  })();
  const scytheMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.25, emissive: 0x6a7aa0, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  const scythes = [], scytheMeshes = [];
  for (let i = 0; i < 40; i++) { const m = add(new THREE.Mesh(scytheGeo, scytheMat)); m.visible = false; m.castShadow = true; scytheMeshes.push(m); }

  // ---- flasks + pools ----
  const flaskGeo = mergeParts([
    { geo: new THREE.SphereGeometry(0.16, 10, 8), color: 0x7dff9a, glow: 0.9 },
    { geo: new THREE.CylinderGeometry(0.05, 0.06, 0.16, 8), color: 0xbfffcf, p: [0, 0.17, 0] },
    { geo: new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8), color: 0x6a4a2a, p: [0, 0.27, 0] },
  ]);
  const flaskMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: 0x2a8a3a, emissiveIntensity: 0.6 });
  const flasks = [], flaskMeshes = [];
  for (let i = 0; i < 16; i++) { const m = add(new THREE.Mesh(flaskGeo, flaskMat)); m.visible = false; flaskMeshes.push(m); }
  const pools = [], poolMeshes = [];
  for (let i = 0; i < 40; i++) { const m = add(new THREE.Mesh(flatDisc, glowMat(0x5aff7a, 0.6, discTex))); m.visible = false; m.renderOrder = 2; poolMeshes.push(m); }

  // ---- wail arcs ----
  const arcs = [];
  for (let i = 0; i < 12; i++) {
    const m = add(new THREE.Mesh(new THREE.RingGeometry(0.35, 1, 32, 1, -0.6, 1.2).rotateX(-Math.PI / 2), glowMat(0xff8ad8, 0.8)));
    m.visible = false; m.renderOrder = 4; arcs.push({ m, t: 1, full: false });
  }
  const ringGeoFull = new THREE.RingGeometry(0.55, 1, 64).rotateX(-Math.PI / 2);
  const ringGeoArc = arcs[0].m.geometry;

  // ---- moonbeams ----
  const beams = [];
  for (let i = 0; i < 16; i++) {
    const warn = add(new THREE.Mesh(flatDisc, glowMat(0xdfe6ff, 0.5, discTex))); warn.visible = false; warn.renderOrder = 3;
    const col = add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 30, 24, 1, true), glowMat(0xdfe6ff, 0.6))); col.visible = false; col.renderOrder = 6;
    beams.push({ warn, col, t: 0, active: false });
  }

  // ---- player-side shockwave rings (BOO, level up) ----
  const shocks = [];
  for (let i = 0; i < 6; i++) { const m = add(new THREE.Mesh(ringGeoFull, glowMat(0xffffff, 0))); m.visible = false; m.renderOrder = 4; shocks.push({ m, t: 1, r: 1, dur: 0.6 }); }
  function shockwave(x, z, r, color, dur = 0.6) {
    const s = shocks.find(q => !q.m.visible) || shocks[0];
    s.m.position.set(x, 0.15, z); s.m.material.color.set(color); s.t = 0; s.r = r; s.dur = dur; s.m.visible = true;
  }

  // =====================================================================
  // Weapon firing
  // =====================================================================
  const tmpList = [];
  function pickTargets(n, maxR) {
    // n distinct nearest foes, cycling if there are fewer
    const list = nearestEnemies(player.position.x, player.position.z, n, maxR, tmpList);
    return list;
  }
  function randomOnScreen(n) {
    const list = gridQuery(player.position.x, player.position.z, view.r * 0.95).filter(e => !e.k.prop);
    return shuffle(list).slice(0, n);
  }

  const FIRE = {
    wisp(w, st, evo) {
      const targets = pickTargets(Math.max(1, st.amount), view.r).slice();
      for (let i = 0; i < st.amount; i++) {
        later(i * 0.07, () => {
          if (bolts.length >= BOLT_CAP) return;
          const tg = targets.length ? targets[i % targets.length] : null;
          const a = tg && !tg.dying ? Math.atan2(tg.z - player.position.z, tg.x - player.position.x) : faceAngle() + rand(-0.4, 0.4);
          bolts.push({ x: player.position.x, z: player.position.z, a, sp: st.speed, life: st.duration, dmg: st.dmg, pierce: st.pierce, hits: [], tg, fam: 0, evo, size: st.area });
          audio.bolt();
        });
      }
      if (!targets.length && !evo) w.t = 0.4; // nothing to shoot: check again soon
    },
    aura(w, st, evo) {
      const px = player.position.x, pz = player.position.z;
      let healed = 0;
      for (const e of gridQuery(px, pz, st.area).slice()) {
        const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz) || 1;
        e.slow = Math.max(e.slow, 0.5);
        if (hit(e, st.dmg, 1, dx / d, dz / d, st.knock) && evo && healed < 3) { healed++; heal(1, false); }
      }
      audio.aura();
    },
    candles(w, st) { w.active = st.duration; audio.candle(); },
    lightning(w, st, evo) {
      const list = randomOnScreen(st.amount);
      list.forEach((e, i) => later(i * 0.06, () => strike(e.x, e.z, st, evo ? 0xb48aff : 0xd8c8ff, st.chain || 0, [e.uid])));
      if (!list.length) w.t = 0.4;
    },
    scythe(w, st, evo) {
      if (evo) {
        const a0 = Math.random() * TAU, ox = player.position.x, oz = player.position.z;
        for (let i = 0; i < st.amount; i++) scythes.push({ mode: 'spiral', ox, oz, a0: a0 + i / st.amount * TAU, t: 0, life: st.duration, st, x: ox, z: oz, spin: 0 });
        audio.swish(); return;
      }
      const targets = pickTargets(st.amount, view.r).slice();
      for (let i = 0; i < st.amount; i++) {
        later(i * 0.12, () => {
          const tg = targets[i % Math.max(1, targets.length)];
          const a = tg && !tg.dying ? Math.atan2(tg.z - player.position.z, tg.x - player.position.x) : faceAngle() + i * 0.6;
          scythes.push({ mode: 'boomerang', x: player.position.x, z: player.position.z, vx: Math.cos(a) * st.speed, vz: Math.sin(a) * st.speed, t: 0, life: st.duration, st, spin: 0, back: false });
          audio.swish();
        });
      }
    },
    flask(w, st, evo) {
      const list = randomOnScreen(st.amount);
      for (let i = 0; i < st.amount; i++) {
        let tx, tz;
        if (list[i]) { tx = list[i].x; tz = list[i].z; }
        else { const a = Math.random() * TAU, r = rand(3, 8); tx = player.position.x + Math.cos(a) * r; tz = player.position.z + Math.sin(a) * r; }
        later(i * 0.1, () => flasks.push({ x0: player.position.x, z0: player.position.z, x1: tx, z1: tz, t: 0, dur: 0.55, st, evo }));
      }
    },
    wail(w, st, evo) {
      const fa = faceAngle();
      if (evo) { wailHit(fa, Math.PI, st, true); return; }
      const dirs = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
      for (let i = 0; i < Math.min(4, st.amount); i++) later(i * 0.09, () => wailHit(faceAngle() + dirs[i], 0.62, st, false));
    },
    moon(w, st, evo) {
      const spots = moonTargets(st.amount);
      spots.forEach((s, i) => later(i * 0.12, () => moonbeam(s.x, s.z, st, evo)));
    },
  };
  FIRE.soulstorm = (w, st) => FIRE.wisp(w, st, true);
  FIRE.dread = (w, st) => FIRE.aura(w, st, true);
  FIRE.hellfire = (w, st) => { w.active = Infinity; };
  FIRE.coven = (w, st) => FIRE.lightning(w, st, true);
  FIRE.harvest = (w, st) => FIRE.scythe(w, st, true);
  FIRE.marsh = (w, st) => FIRE.flask(w, st, true);
  FIRE.shriek = (w, st) => FIRE.wail(w, st, true);
  FIRE.bloodmoon = (w, st) => FIRE.moon(w, st, true);

  function strike(x, z, st, color, chain, hitIds) {
    drawZap(x + rand(-1.5, 1.5), 14, z - 4, x, 0.1, z, color, 0.25);
    zapLight.position.set(x, 2, z); zapLight.color.set(color); zapLight.intensity = 5;
    particles.emit(x, 0.3, z, { count: 18, color, speed: 5, flat: true, life: 0.4, size: 0.3 });
    shockwave(x, z, st.area, color, 0.3);
    audio.zap();
    let next = null, nd = 1e9;
    for (const e of gridQuery(x, z, st.area).slice()) {
      const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz) || 1;
      hit(e, st.dmg, 3, dx / d, dz / d, 1.5);
    }
    if (chain > 0) {
      for (const e of gridQuery(x, z, 6)) {
        if (e.k.prop || hitIds.includes(e.uid)) continue;
        const d = (e.x - x) ** 2 + (e.z - z) ** 2;
        if (d < nd) { nd = d; next = e; }
      }
      if (next) {
        const nx = next.x, nz = next.z; hitIds.push(next.uid);
        later(0.07, () => { drawZap(x, 0.8, z, nx, 0.8, nz, color, 0.12); strike(nx, nz, st, color, chain - 1, hitIds); });
      }
    }
  }

  function wailHit(ang, half, st, full) {
    const px = player.position.x, pz = player.position.z, range = 3.6 * st.area;
    const a = arcs.find(q => !q.m.visible) || arcs[0];
    a.m.geometry = full ? ringGeoFull : ringGeoArc;
    a.m.position.set(px, 0.6, pz); a.m.rotation.y = -ang; a.t = 0; a.range = range; a.m.visible = true; a.full = full;
    a.m.material.color.set(full ? 0xff5ab8 : 0xff8ad8);
    for (const e of gridQuery(px, pz, range).slice()) {
      const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz) || 1;
      if (!full && Math.abs(angDiff(Math.atan2(dz, dx), ang)) > half + e.r / d) continue;
      hit(e, st.dmg, 6, dx / d, dz / d, st.knock * 3);
    }
    particles.emit(px + Math.cos(ang) * range * 0.6, 0.8, pz + Math.sin(ang) * range * 0.6, { count: full ? 40 : 14, color: full ? 0xff5ab8 : 0xff8ad8, speed: full ? 8 : 4, flat: true, life: 0.35, size: 0.3 });
    audio.wail();
  }

  function moonTargets(n) {
    const pool = gridQuery(player.position.x, player.position.z, view.r * 0.9).filter(e => !e.k.prop);
    const out = [];
    for (let i = 0; i < n; i++) {
      if (!pool.length) { const a = Math.random() * TAU, r = rand(2, 9); out.push({ x: player.position.x + Math.cos(a) * r, z: player.position.z + Math.sin(a) * r }); continue; }
      // sample a few foes and aim at whichever has the most company
      let best = null, bestN = -1;
      for (let s = 0; s < 6; s++) {
        const e = pick(pool);
        let c = 0; for (const o of pool) if ((o.x - e.x) ** 2 + (o.z - e.z) ** 2 < 6) c++;
        if (c > bestN && !out.some(q => (q.x - e.x) ** 2 + (q.z - e.z) ** 2 < 4)) { bestN = c; best = e; }
      }
      best = best || pick(pool);
      out.push({ x: best.x, z: best.z });
    }
    return out;
  }
  function moonbeam(x, z, st, evo) {
    const b = beams.find(q => !q.active) || beams[0];
    const color = evo ? 0xff3a4a : 0xdfe6ff;
    Object.assign(b, { x, z, st, evo, t: 0, active: true, hit: false });
    b.warn.material.color.set(color); b.col.material.color.set(color);
    b.warn.position.set(x, 0.06, z); b.warn.visible = true; b.col.visible = false;
  }

  function faceAngle() { return Math.atan2(face.z, face.x); }

  // ---------- per-frame weapon update ----------
  function updateWeapons(dt) {
    const px = player.position.x, pz = player.position.z;
    for (const w of owned.weapons) {
      const st = w.st, def = WEAPONS[w.id];
      // continuous effects
      if (def.fam === 2 && w.active > 0) {
        w.active -= dt; w.ang = (w.ang || 0) + st.speed * dt;
      }
      w.t -= dt;
      if (w.t <= 0) {
        if (def.fam === 2 && w.active > 0) { w.t = 0.25; continue; } // candles still circling
        w.t = st.cd;
        FIRE[w.id](w, st);
      }
    }
    // candles / hellfire
    const cw = famWeapon(2);
    let ci = 0;
    if (cw && cw.active > 0) {
      const st = cw.st, n = Math.min(12, st.amount), evo = WEAPONS[cw.id].evolved;
      const fade = cw.active < 0.4 ? cw.active / 0.4 : 1;
      for (let i = 0; i < n; i++, ci++) {
        const a = cw.ang + i / n * TAU, cx = px + Math.cos(a) * st.area, cz = pz + Math.sin(a) * st.area;
        const c = candles[ci];
        c.g.visible = true; c.g.position.set(cx, 0.9 + Math.sin(gameTime * 4 + i) * 0.12, cz); c.g.scale.setScalar(fade * (evo ? 1.3 : 1));
        c.flame.material.color.set(evo ? 0xff4a1a : 0xffa040);
        c.flame.scale.set(0.5 + Math.random() * 0.1, 0.75 + Math.random() * 0.2, 1);
        if (Math.random() < (evo ? 0.6 : 0.3)) particles.emit(cx, 1.3, cz, { count: 1, color: evo ? 0xff4a1a : 0xffa040, speed: 0.4, lift: 1.2, life: 0.4, size: evo ? 0.4 : 0.25 });
        for (const e of gridQuery(cx, cz, 0.5 * (evo ? 1.4 : 1)).slice()) {
          const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz) || 1;
          hitCd(e, st.dmg, 2, 0.45, dx / d, dz / d, 2);
        }
      }
    }
    for (; ci < candles.length; ci++) candles[ci].g.visible = false;

    // aura visual
    const aw = famWeapon(1);
    auraMesh.visible = !!aw;
    if (aw) {
      const evo = WEAPONS[aw.id].evolved;
      auraMesh.position.set(px, 0.08, pz);
      auraMesh.scale.setScalar(aw.st.area * (1 + Math.sin(gameTime * 3) * 0.03));
      auraMesh.rotation.y += dt * 0.6;
      auraMesh.material.color.set(evo ? 0xff6ad8 : 0x9fe8ff);
      auraMesh.material.opacity = 0.35 + Math.max(0, (aw.t / aw.st.cd) - 0.6) * 0.8;
      if (Math.random() < 0.4) { const a = Math.random() * TAU, r = aw.st.area * Math.sqrt(Math.random()); particles.emit(px + Math.cos(a) * r, 0.2, pz + Math.sin(a) * r, { count: 1, color: evo ? 0xff6ad8 : 0x9fe8ff, speed: 0.3, lift: 0.8, life: 0.7, size: 0.22 }); }
    }

    // bolts
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= dt;
      if (b.life <= 0) { bolts.splice(i, 1); continue; }
      if (!b.tg || b.tg.dying) { b.tg = null; if (b.evo || Math.random() < 0.1) { const l = nearestEnemies(b.x, b.z, 1, 9, tmpList); if (l[0] && !b.hits.includes(l[0].uid)) b.tg = l[0]; } }
      if (b.tg) {
        const want = Math.atan2(b.tg.z - b.z, b.tg.x - b.x), turn = (b.evo ? 9 : 5) * dt;
        b.a += clamp(angDiff(want, b.a), -turn, turn);
      }
      b.x += Math.cos(b.a) * b.sp * dt; b.z += Math.sin(b.a) * b.sp * dt;
      if (Math.random() < 0.7) particles.emit(b.x, 0.9, b.z, { count: 1, color: 0x8fd8ff, speed: 0.2, life: 0.3, size: 0.28 * b.size });
      for (const e of gridQuery(b.x, b.z, 0.25 * b.size)) {
        if (b.hits.includes(e.uid)) continue;
        b.hits.push(e.uid);
        hit(e, b.dmg, 0, Math.cos(b.a), Math.sin(b.a), 1.2);
        if (--b.pierce < 0) { b.life = 0; break; }
        if (b.tg === e) b.tg = null;
      }
    }

    // scythes
    for (let i = scythes.length - 1; i >= 0; i--) {
      const s = scythes[i], st = s.st;
      s.t += dt; s.spin += dt * 16;
      if (s.mode === 'spiral') {
        const rr = 0.8 + st.speed * s.t, a = s.a0 + s.t * 2.2;
        s.x = s.ox + Math.cos(a) * rr; s.z = s.oz + Math.sin(a) * rr;
      } else {
        const out = st.duration * 0.45;
        if (s.t < out) { const k = 1 - s.t / out; s.x += s.vx * k * dt; s.z += s.vz * k * dt; }
        else {
          const dx = px - s.x, dz = pz - s.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(st.speed * 1.6, (s.t - out) * st.speed * 2.5);
          s.x += dx / d * sp * dt; s.z += dz / d * sp * dt;
          if (d < 0.9) s.t = 99;
        }
      }
      if (s.t > (s.mode === 'spiral' ? s.life : st.duration + 2.5)) { scythes.splice(i, 1); continue; }
      for (const e of gridQuery(s.x, s.z, 0.75 * st.area).slice()) {
        const dx = e.x - s.x, dz = e.z - s.z, d = Math.hypot(dx, dz) || 1;
        hitCd(e, st.dmg, 4, 0.3, dx / d, dz / d, 2.5);
      }
      if (Math.random() < 0.5) particles.emit(s.x, 0.9, s.z, { count: 1, color: 0xdfe6ff, speed: 0.3, life: 0.25, size: 0.3 * st.area });
    }
    for (let i = 0; i < scytheMeshes.length; i++) {
      const m = scytheMeshes[i], s = scythes[i];
      m.visible = !!s;
      if (s) { m.position.set(s.x, 0.9, s.z); m.rotation.set(0, -s.spin, 0); m.scale.setScalar(s.st.area * (s.mode === 'spiral' ? 0.9 : 1)); }
    }

    // flasks in flight
    for (let i = flasks.length - 1; i >= 0; i--) {
      const f = flasks[i];
      f.t += dt / f.dur;
      if (f.t >= 1) {
        flasks.splice(i, 1);
        if (pools.length < poolMeshes.length) pools.push({ x: f.x1, z: f.z1, r: f.st.area, life: f.st.duration, max: f.st.duration, dmg: f.st.dmg, tick: 0, evo: f.evo, color: f.evo ? 0x5aff5a : 0x7dff9a, fam: 5 });
        particles.emit(f.x1, 0.3, f.z1, { count: 22, color: 0x7dff9a, speed: 4, lift: 2, gravity: 8, life: 0.6, size: 0.3 });
        audio.shatter();
      }
    }
    for (let i = 0; i < flaskMeshes.length; i++) {
      const m = flaskMeshes[i], f = flasks[i];
      m.visible = !!f;
      if (f) { m.position.set(lerp(f.x0, f.x1, f.t), 0.9 + Math.sin(f.t * Math.PI) * 3, lerp(f.z0, f.z1, f.t)); m.rotation.z = f.t * 9; }
    }
    // pools (ecto + blood moon scorch)
    for (let i = pools.length - 1; i >= 0; i--) {
      const p = pools[i];
      p.life -= dt;
      if (p.life <= 0) { pools.splice(i, 1); continue; }
      if (p.evo && p.fam === 5) {
        const l = nearestEnemies(p.x, p.z, 1, 8, tmpList);
        if (l[0]) { const dx = l[0].x - p.x, dz = l[0].z - p.z, d = Math.hypot(dx, dz) || 1; p.x += dx / d * 1.6 * dt; p.z += dz / d * 1.6 * dt; }
      }
      p.tick -= dt;
      if (p.tick <= 0) {
        p.tick = 0.35;
        for (const e of gridQuery(p.x, p.z, p.r).slice()) { e.slow = Math.max(e.slow, 0.4); hit(e, p.dmg, p.fam, 0, 0, 0); }
      }
      if (Math.random() < 0.35) { const a = Math.random() * TAU, r = p.r * Math.sqrt(Math.random()); particles.emit(p.x + Math.cos(a) * r, 0.1, p.z + Math.sin(a) * r, { count: 1, color: p.color, speed: 0.3, lift: 1, life: 0.6, size: 0.25 }); }
    }
    for (let i = 0; i < poolMeshes.length; i++) {
      const m = poolMeshes[i], p = pools[i];
      m.visible = !!p;
      if (p) {
        const grow = Math.min(1, (p.max - p.life) * 6), fade = Math.min(1, p.life * 2);
        m.position.set(p.x, 0.05, p.z); m.scale.setScalar(p.r * grow); m.material.color.set(p.color); m.material.opacity = 0.65 * fade;
        m.rotation.y += dt;
      }
    }

    // wail arcs
    for (const a of arcs) {
      if (!a.m.visible) continue;
      a.t += dt / 0.28;
      if (a.t >= 1) { a.m.visible = false; continue; }
      a.m.scale.setScalar(a.range * (0.55 + 0.45 * Math.sin(a.t * Math.PI / 2)));
      a.m.material.opacity = 0.85 * (1 - a.t);
      a.m.position.set(player.position.x, 0.6, player.position.z);
    }

    // moonbeams
    for (const b of beams) {
      if (!b.active) continue;
      b.t += dt;
      const warnT = 0.55, r = b.st.area;
      if (b.t < warnT) {
        const k = b.t / warnT;
        b.warn.scale.setScalar(r * (0.3 + 0.7 * k)); b.warn.material.opacity = 0.3 + 0.4 * Math.sin(b.t * 30) * 0.5 + 0.2;
      } else {
        if (!b.hit) {
          b.hit = true; b.warn.visible = false; b.col.visible = true;
          for (const e of gridQuery(b.x, b.z, r).slice()) { const dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz) || 1; hit(e, b.st.dmg, 7, dx / d, dz / d, 3); }
          particles.emit(b.x, 0.3, b.z, { count: b.evo ? 50 : 34, color: b.evo ? 0xff3a4a : 0xdfe6ff, speed: 7, flat: true, life: 0.5, size: 0.4 });
          particles.emit(b.x, 0.5, b.z, { count: 16, color: 0xffffff, speed: 2, lift: 6, life: 0.6, size: 0.3 });
          shockwave(b.x, b.z, r * 1.3, b.evo ? 0xff3a4a : 0xdfe6ff, 0.4);
          addShake(0.12); audio.moon();
          if (b.evo && pools.length < poolMeshes.length) pools.push({ x: b.x, z: b.z, r: r * 0.8, life: 2, max: 2, dmg: b.st.dmg * 0.15, tick: 0.2, evo: true, color: 0xff5a2a, fam: 7 });
        }
        const k = (b.t - warnT) / 0.35;
        if (k >= 1) { b.active = false; b.col.visible = false; continue; }
        b.col.position.set(b.x, 15, b.z); b.col.scale.set(r * 0.55 * (1 - k * 0.6), 1, r * 0.55 * (1 - k * 0.6)); b.col.material.opacity = 0.75 * (1 - k);
      }
    }

    // lightning ribbons + flash light
    for (const z of zaps) {
      if (!z.m.visible) continue;
      z.t += dt / 0.18;
      if (z.t >= 1) z.m.visible = false; else z.m.material.opacity = 1 - z.t;
    }
    zapLight.intensity = Math.max(0, zapLight.intensity - dt * 30);

    // shock rings
    for (const s of shocks) {
      if (!s.m.visible) continue;
      s.t += dt / s.dur;
      if (s.t >= 1) { s.m.visible = false; continue; }
      const e = 1 - Math.pow(1 - s.t, 3);
      s.m.scale.setScalar(0.3 + e * s.r); s.m.material.opacity = (1 - s.t) * 0.9;
    }

    // instanced bolts
    let n = 0;
    for (const b of bolts) {
      _m.makeScale(b.size, b.size, b.size).setPosition(b.x, 0.9, b.z);
      boltMesh.setMatrixAt(n, _m); boltCore.setMatrixAt(n, _m); n++;
    }
    boltMesh.count = boltCore.count = n;
    boltMesh.instanceMatrix.needsUpdate = boltCore.instanceMatrix.needsUpdate = true;
  }

  function clearWeaponFx() {
    bolts.length = scythes.length = flasks.length = pools.length = timers.length = 0;
    candles.forEach(c => { c.g.visible = false; });
    arcs.forEach(a => { a.m.visible = false; });
    beams.forEach(b => { b.active = false; b.warn.visible = b.col.visible = false; });
    zaps.forEach(z => { z.m.visible = false; });
    shocks.forEach(s => { s.m.visible = false; });
    [...scytheMeshes, ...flaskMeshes, ...poolMeshes].forEach(m => { m.visible = false; });
    auraMesh.visible = false; boltMesh.count = boltCore.count = 0;
  }

  // =====================================================================
  // Run state
  // =====================================================================
  const ULT_MAX = 120, DASH_CD = 2.4, STREAK_WINDOW = 2.2;
  const STREAK_TIERS = [[0, 1, '#ffd35a'], [25, 1.5, '#ffd35a'], [60, 2, '#ffb36b'], [120, 3, '#ff8a2a'], [250, 4, '#ff5a8a'], [500, 5, '#c9b8ff']];
  let state = 'menu';
  let hp = 100, xp = 0, level = 1, xpNext = 5, pendingLevels = 0;
  let kills = 0, score = 0, streak = 0, streakT = 0, bestStreak = 0, ult = 0;
  let dashCd = 0, dashT = 0, invuln = 0, freezeT = 0, frenzyT = 0, frenzyMix = 0, freezeMix = 0;
  let shake = 0, hitStop = 0, deathT = 0, rerolls = 2, aliveCount = 0, lanternT = 0;
  let hudDirty = true;
  const stats = { damage: 0, gold: 0 };
  const face = { x: 0, z: 1 };
  const vel = new THREE.Vector3();
  const bosses = [];
  const D = {}; // director clocks

  const xpFor = L => L < 20 ? 5 + (L - 1) * 8 : L < 40 ? 160 + (L - 20) * 12 : 400 + (L - 40) * 16;
  const minute = () => gameTime / 60;
  const streakTier = () => { let t = STREAK_TIERS[0]; for (const s of STREAK_TIERS) if (streak >= s[0]) t = s; return t; };
  const scoreMult = () => streakTier()[1] * (frenzyT > 0 ? 2 : 1);
  const addShake = v => { if (settings.shake) shake = Math.min(1, Math.max(shake, v)); };
  function addScore(v) { score += Math.round(v); }

  function flashScreen(cls = '') {
    const f = $('flash'); f.className = 'flash ' + cls + ' on';
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
  }
  function banner(title, sub = '', kind = '') {
    const b = $('banner');
    $('bannerTitle').textContent = title; $('bannerSub').textContent = sub;
    b.className = 'banner ' + kind;
    void b.offsetWidth; b.classList.add('show');
  }
  function heal(v, show = true) {
    const h = Math.min(v, P.maxHp - hp);
    hp += h;
    if (show && h > 0) fx2d.add(player.position.x, 2.4, player.position.z, `+${Math.round(h)}`, 'heal');
  }

  // =====================================================================
  // Spawning
  // =====================================================================
  function spawnPoint(minR = view.spawnR, maxR = view.spawnR + 4) {
    // biased toward where the ghost is heading so new foes meet you
    const moving = vel.lengthSq() > 1;
    const a = moving && Math.random() < 0.55 ? Math.atan2(vel.z, vel.x) + rand(-1.1, 1.1) : Math.random() * TAU;
    const r = rand(minR, maxR);
    return { x: player.position.x + Math.cos(a) * r, z: player.position.z + Math.sin(a) * r };
  }
  const hpScale = () => { const m = minute(); return 1 + m * 0.32 + Math.max(0, m - 8) * 0.4; };
  const dmgScale = () => 1 + minute() * 0.06;
  function spawn(id, x, z, o = {}) {
    const e = makeEnemy(id, x, z, o);
    if (!e.k.prop && !e.boss) { e.hp = e.maxHp = Math.round(e.k.hp * hpScale()); e.dmg = e.k.dmg * dmgScale(); }
    return e;
  }
  function makeElite(e) {
    e.elite = true; e.scale *= 1.6; e.r *= 1.6; e.hp = e.maxHp = Math.round(e.maxHp * 12); e.dmg *= 1.5; e.xp *= 8; e.pts *= 12;
    e.speed *= 1.1;
    return e;
  }

  const TABLE = [
    { id: 'pumpkin', from: 0, w: m => Math.max(3, 10 - m * 0.9) },
    { id: 'bat', from: 0.6, w: () => 6 },
    { id: 'wraith', from: 2, w: m => 3 + m * 0.3 },
    { id: 'spider', from: 3, w: () => 5 },
    { id: 'eye', from: 4, w: () => 1.6 },
    { id: 'brute', from: 5.5, w: m => 0.8 + m * 0.08 },
  ];
  function rollKind() {
    const m = minute(), opts = TABLE.filter(t => m >= t.from);
    let sum = 0; for (const o of opts) sum += o.w(m);
    let r = Math.random() * sum;
    for (const o of opts) { r -= o.w(m); if (r <= 0) return o.id; }
    return 'pumpkin';
  }
  function spawnWave(n) {
    const id = rollKind(), p = spawnPoint();
    for (let i = 0; i < n; i++) spawn(id, p.x + rand(-1.6, 1.6), p.z + rand(-1.6, 1.6));
  }
  function batSwarm() {
    const a = Math.random() * TAU, n = Math.min(70, 30 + Math.floor(minute() * 4)), R = view.spawnR + 2;
    const cx = player.position.x - Math.cos(a) * R, cz = player.position.z - Math.sin(a) * R;
    const px = -Math.sin(a), pz = Math.cos(a), sp = 9.5;
    for (let i = 0; i < n; i++) {
      const off = (i / (n - 1) - 0.5) * 26 + rand(-0.6, 0.6), back = rand(0, 3);
      const e = spawn('bat', cx + px * off - Math.cos(a) * back, cz + pz * off - Math.sin(a) * back, { ai: 'line', life: (R * 2 + 6) / sp });
      e.vx = Math.cos(a) * sp; e.vz = Math.sin(a) * sp; e.rot = Math.atan2(e.vx, e.vz);
    }
    banner('Bat swarm!', 'Dodge the flock or carve through it.', 'warn'); audio.alarm();
  }
  function encircle() {
    const m = minute(), id = m > 7 ? 'wraith' : 'pumpkin', n = Math.min(64, 30 + Math.floor(m * 4)), R = Math.min(13, view.r * 0.85);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      spawn(id, player.position.x + Math.cos(a) * R, player.position.z + Math.sin(a) * R, { spawn: 0.8 + (i % 4) * 0.05 });
    }
    banner('Surrounded!', 'Break the ring before it closes.', 'warn'); audio.alarm();
  }
  let bossCount = 0;
  function spawnBoss(kind) {
    bossCount++;
    const p = spawnPoint(view.spawnR - 4, view.spawnR - 2);
    const e = spawn(kind, p.x, p.z, { spawn: 1.2 });
    const hpv = Math.round(e.k.hp * (1 + (bossCount - 1) * 0.9) * (1 + minute() * 0.12));
    e.hp = e.maxHp = hpv; e.dmg = e.k.dmg * dmgScale(); e.timer = 2.5; e.mode = kind === 'king' ? 'walk' : 'hover'; e.cycle = -1; e.cool = 0;
    if (kind === 'king') {
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), glowMat(0xff3a2a, 0));
      lane.position.y = 0.05; lane.renderOrder = 3; scene.add(lane); e.lane = lane;
    }
    bosses.push(e);
    audio.roar(); addShake(0.5);
    banner(e.k.name, kind === 'king' ? 'Sidestep his charge, dodge the seeds.' : 'Weave through her bullet storm.', 'red');
    $('bossName').textContent = e.k.name;
    $('boss').style.setProperty('--bc', kind === 'king' ? '#ff8a2a' : '#c9b8ff');
    return e;
  }
  function spawnElite() {
    const id = rollKind(), p = spawnPoint();
    makeElite(spawn(id, p.x, p.z));
    fx2d.add(player.position.x, 3, player.position.z, 'An elite approaches…', 'info');
  }

  function resetDirector() {
    Object.assign(D, { acc: 0, elite: 45, swarm: 80, ring: 130, boss: 180, frenzy: 270, minute: 60 });
    bossCount = 0;
  }
  function direct(dt) {
    const m = minute(), frenzy = frenzyT > 0;
    const rate = (1.4 + m * 1.15) * (frenzy ? 2.4 : 1);
    const cap = Math.min(480, 26 + m * 34) * (frenzy ? 1.25 : 1);
    D.acc += rate * dt;
    while (D.acc >= 1) {
      D.acc -= 1;
      if (aliveCount >= cap) { D.acc = 0; break; }
      if (Math.random() < 0.22) { spawnWave(randi(3, 5 + Math.floor(m / 2))); D.acc -= 2; } else spawnWave(1);
    }
    if (gameTime >= D.elite) { D.elite += 50; spawnElite(); }
    if (gameTime >= D.swarm) { D.swarm += 150; batSwarm(); }
    if (gameTime >= D.ring) { D.ring += 150; encircle(); }
    if (gameTime >= D.boss) { D.boss += 180; spawnBoss(bossCount % 2 === 0 ? 'king' : 'queen'); }
    if (gameTime >= D.frenzy) {
      D.frenzy += 300; frenzyT = 40;
      banner('Witching hour', 'Twice the foes. Twice the score.', 'red'); audio.alarm(); audio.shriek();
    }
    if (gameTime >= D.minute) {
      const mm = Math.round(D.minute / 60); D.minute += 60;
      const bonus = 100 * mm; addScore(bonus);
      fx2d.add(player.position.x, 3.2, player.position.z, `${mm}:00 survived +${fmtNum(bonus)}`, 'bigGold');
    }
    // breakable lanterns keep popping up nearby
    lanternT -= dt;
    if (lanternT <= 0) {
      lanternT = 2.5;
      let n = 0; for (const e of enemies) if (e.k.prop) n++;
      if (n < 7) { const p = spawnPoint(view.spawnR - 6, view.spawnR + 8); spawn('lantern', p.x, p.z, { rot: Math.random() * TAU, spawn: 0 }); }
    }
  }

  // =====================================================================
  // Enemy behaviour
  // =====================================================================
  function steer(e, tx, tz, dt, k = 5) { const f = Math.min(1, dt * k); e.vx += (tx - e.vx) * f; e.vz += (tz - e.vz) * f; }
  const AI = {
    static(e) { e.vx = e.vz = 0; },
    chase(e, dt, dx, dz, d, sp) { steer(e, dx / d * sp, dz / d * sp, dt); },
    bat(e, dt, dx, dz, d, sp) {
      const w = Math.sin(e.t * 4 + e.phase) * 0.75;
      steer(e, (dx / d - dz / d * w) * sp, (dz / d + dx / d * w) * sp, dt, 4);
      e.y = 1.1 + Math.sin(e.t * 6 + e.phase) * 0.15;
    },
    wraith(e, dt, dx, dz, d, sp) {
      const w = Math.sin(e.t * 1.7 + e.phase) * 0.55;
      steer(e, (dx / d - dz / d * w) * sp, (dz / d + dx / d * w) * sp, dt, 3);
      e.y = 0.2 + Math.sin(e.t * 2.4 + e.phase) * 0.12;
    },
    spider(e, dt, dx, dz, d, sp) {
      e.timer -= dt;
      if (e.mode === 'run') {
        const a = Math.atan2(dz, dx) + e.ang;
        steer(e, Math.cos(a) * sp * 1.5, Math.sin(a) * sp * 1.5, dt, 10);
        if (e.timer <= 0) { e.mode = 'wait'; e.timer = rand(0.2, 0.45); }
      } else {
        steer(e, 0, 0, dt, 10);
        if (e.timer <= 0) { e.mode = 'run'; e.timer = rand(0.35, 0.6); e.ang = rand(-0.7, 0.7); }
      }
    },
    eye(e, dt, dx, dz, d, sp) {
      if (e.dirX === 0) e.dirX = Math.random() < 0.5 ? -1 : 1;
      if (d > 8.5) steer(e, dx / d * sp, dz / d * sp, dt, 3);
      else if (d < 5.5) steer(e, -dx / d * sp, -dz / d * sp, dt, 3);
      else steer(e, -dz / d * sp * 0.6 * e.dirX, dx / d * sp * 0.6 * e.dirX, dt, 3);
      e.y = 1.3 + Math.sin(e.t * 2 + e.phase) * 0.2;
      e.timer -= dt;
      if (e.timer <= 0 && d < view.r) {
        e.timer = rand(2.6, 3.6);
        fireOrb(e.x, e.z, Math.atan2(dz, dx), 6.5, 6 * dmgScale(), 1.3);
        e.flash = 0.06; audio.enemyShot();
      }
    },
    line() { /* swarm bats keep their heading */ },
    wander(e, dt) {
      if (e.wx === undefined || (e.x - e.wx) ** 2 + (e.z - e.wz) ** 2 < 1) { const a = Math.random() * TAU, r = rand(3, 13); e.wx = Math.cos(a) * r; e.wz = Math.sin(a) * r; }
      const dx = e.wx - e.x, dz = e.wz - e.z, d = Math.hypot(dx, dz) || 1, sp = e.speed * 0.5;
      steer(e, dx / d * sp, dz / d * sp, dt, 2);
      if (e.k.fly) e.y = e.k.fly + Math.sin(e.t * 3 + e.phase) * 0.15;
    },
    king(e, dt, dx, dz, d, sp) {
      e.timer -= dt;
      if (e.mode === 'walk') {
        steer(e, dx / d * sp, dz / d * sp, dt, 3);
        if (e.timer <= 0 && d < 15) { e.mode = 'windup'; e.timer = 0.85; e.dirX = dx / d; e.dirZ = dz / d; audio.roar(); }
      } else if (e.mode === 'windup') {
        steer(e, 0, 0, dt, 12);
        e.rot = Math.atan2(e.dirX, e.dirZ);
        e.lane.position.set(e.x, 0.05, e.z); e.lane.rotation.y = e.rot; e.lane.scale.set(2.8, 1, 14);
        e.lane.material.opacity = 0.2 + (1 - e.timer / 0.85) * 0.35 + Math.sin(gameTime * 30) * 0.08;
        if (e.timer <= 0) { e.mode = 'charge'; e.timer = 0.9; }
      } else if (e.mode === 'charge') {
        e.vx = e.dirX * 15.5; e.vz = e.dirZ * 15.5;
        e.lane.material.opacity = Math.max(0, e.lane.material.opacity - dt * 2);
        if (Math.random() < 0.7) particles.emit(e.x, 0.2, e.z, { count: 3, color: 0x6b5a3a, speed: 2.5, lift: 2, gravity: 8, life: 0.5, size: 0.35, vary: 0.4 });
        if (e.timer <= 0) {
          e.mode = 'walk'; e.timer = rand(2.2, 3.2); e.lane.material.opacity = 0;
          const n = 14 + bossCount * 2;
          for (let i = 0; i < n; i++) fireOrb(e.x, e.z, i / n * TAU + e.phase, 5.5, 10 * dmgScale(), 0.7);
          addShake(0.35); audio.thud();
        }
      }
    },
    queen(e, dt, dx, dz, d, sp) {
      e.timer -= dt; e.cool -= dt;
      e.y = 0.5 + Math.sin(e.t * 2) * 0.25;
      const hover = k => {
        if (d > 8) steer(e, dx / d * sp * k, dz / d * sp * k, dt, 2);
        else if (d < 5.5) steer(e, -dx / d * sp * k, -dz / d * sp * k, dt, 2);
        else steer(e, -dz / d * sp * 0.5 * k, dx / d * sp * 0.5 * k, dt, 2);
      };
      if (e.mode === 'hover') {
        hover(1);
        if (e.timer <= 0) {
          e.cycle = (e.cycle + 1) % 3;
          e.mode = ['spiral', 'ring', 'summon'][e.cycle];
          e.timer = e.mode === 'spiral' ? 3.2 : e.mode === 'ring' ? 1.5 : 0.6; e.cool = 0; e.ang = Math.random() * TAU; e.waves = 0;
          audio.shriek();
        }
      } else if (e.mode === 'spiral') {
        hover(0.3);
        if (e.cool <= 0) {
          e.cool = 0.1;
          for (let k = 0; k < 3; k++) fireOrb(e.x, e.z, e.ang + k * TAU / 3, 5.2, 9 * dmgScale(), 1);
          e.ang += 0.31; audio.enemyShot();
        }
        if (e.timer <= 0) { e.mode = 'hover'; e.timer = 2.2; }
      } else if (e.mode === 'ring') {
        hover(0.5);
        if (e.cool <= 0 && e.waves < 3) {
          e.cool = 0.45; e.waves++;
          const n = 22; for (let i = 0; i < n; i++) fireOrb(e.x, e.z, i / n * TAU + e.waves * 0.14, 6, 9 * dmgScale(), 1);
          e.flash = 0.08;
        }
        if (e.timer <= 0) { e.mode = 'hover'; e.timer = 2.2; }
      } else if (e.mode === 'summon') {
        steer(e, 0, 0, dt, 6);
        if (e.timer <= 0) {
          const n = 6 + bossCount * 2;
          for (let i = 0; i < n; i++) { const a = i / n * TAU; spawn('wraith', player.position.x + Math.cos(a) * 10, player.position.z + Math.sin(a) * 10, { spawn: 0.8 }); }
          fx2d.add(e.x, 4, e.z, 'Rise, my wraiths!', 'info');
          e.mode = 'hover'; e.timer = 2.4;
        }
      }
    },
  };

  function removeEnemy(e) {
    if (e.lane) { scene.remove(e.lane); e.lane.geometry.dispose(); e.lane.material.dispose(); e.lane = null; }
    const bi = bosses.indexOf(e); if (bi >= 0) bosses.splice(bi, 1);
  }
  function relocate(e) {
    const p = spawnPoint();
    e.x = p.x; e.z = p.z; e.vx = e.vz = e.kx = e.kz = 0;
  }
  function updateEnemies(dt, playing) {
    const px = player.position.x, pz = player.position.z, frozen = playing && freezeT > 0;
    const spMul = (1 + Math.min(0.4, minute() * 0.03)) * (frenzyT > 0 ? 1.15 : 1);
    let w = 0; aliveCount = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dying) {
        e.dying += dt;
        if (e.dying < 0.28) enemies[w++] = e; else removeEnemy(e);
        continue;
      }
      e.t += dt; e.flash = Math.max(0, e.flash - dt); e.slow = Math.max(0, e.slow - dt);
      if (e.spawn > 0) e.spawn -= dt;
      if (playing) e.life -= dt;
      if (e.life <= 0) { removeEnemy(e); continue; }
      const dx = px - e.x, dz = pz - e.z, d = Math.hypot(dx, dz) || 1;
      if (playing && d > view.despawnR) {
        if (e.k.prop) { removeEnemy(e); continue; }
        if (!e.boss && e.ai !== 'line') relocate(e);
      }
      if (!frozen && e.spawn <= 0.15) AI[e.ai](e, dt, dx, dz, d, e.speed * spMul * (e.slow > 0 ? 0.5 : 1));
      const mv = frozen ? 0 : 1;
      e.x += (e.vx * mv + e.kx) * dt; e.z += (e.vz * mv + e.kz) * dt;
      const kd = Math.exp(-9 * dt); e.kx *= kd; e.kz *= kd;
      if (!frozen && !e.k.prop && e.vx * e.vx + e.vz * e.vz > 0.05 && !(e.ai === 'king' && e.mode === 'windup')) {
        e.rot += angDiff(Math.atan2(e.vx, e.vz), e.rot) * Math.min(1, dt * 10);
      }
      if (!e.k.prop) aliveCount++;
      enemies[w++] = e;
    }
    enemies.length = w;
  }
  // soft separation so the horde reads as a crowd, not a single blob
  function separate() {
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      if (a.dying || a.k.prop || a.ai === 'line') continue;
      const list = gridQuery(a.x, a.z, a.r);
      for (let j = 0; j < list.length; j++) {
        const b = list[j];
        if (b === a || b.uid < a.uid || b.ai === 'line' || (!!a.k.fly !== !!b.k.fly)) continue;
        const dx = b.x - a.x, dz = b.z - a.z, dd = dx * dx + dz * dz, min = a.r + b.r;
        if (dd >= min * min || dd < 1e-6) continue;
        const d = Math.sqrt(dd), push = (min - d) / d * 0.5;
        const wa = b.boss || b.k.prop ? 1 : a.boss || a.k.prop ? 0 : 0.5, wb = 1 - wa;
        a.x -= dx * push * wa; a.z -= dz * push * wa;
        b.x += dx * push * wb; b.z += dz * push * wb;
      }
    }
  }

  // =====================================================================
  // Kills, drops, pickups
  // =====================================================================
  function burst(e, big) {
    const y = (e.y || 0) + 0.5 * e.scale, c = e.k.color;
    particles.emit(e.x, y, e.z, { count: big ? 120 : e.elite ? 50 : 12, color: c, speed: big ? 9 : 4.5, lift: 2, gravity: 8, life: big ? 1.2 : 0.6, size: big ? 0.45 : 0.3, drag: 1.5 });
    if (big || e.elite) particles.emit(e.x, y, e.z, { count: big ? 60 : 24, color: 0xffffff, speed: big ? 6 : 3, life: 0.6, size: 0.35 });
  }
  function kill(e, fam) {
    e.dying = 0.0001; e.flash = 0;
    if (e.k.prop) {
      burst(e); audio.shatter();
      const luck = P.luck, r = Math.random() * 100;
      const table = [['coin', 40], ['candy', hp < P.maxHp * 0.5 ? 30 : 14], ['bag', 7 * luck], ['vacuum', 6 * luck], ['clock', 5 * luck], ['bell', 4 * luck]];
      let sum = 0; for (const t of table) sum += t[1];
      let k = r / 100 * sum, kind = 'coin';
      for (const t of table) { k -= t[1]; if (k <= 0) { kind = t[0]; break; } }
      dropItem(kind, e.x, e.z);
      return;
    }
    kills++; streak++; streakT = STREAK_WINDOW; bestStreak = Math.max(bestStreak, streak);
    addScore(e.pts * scoreMult());
    const was = ult;
    ult = Math.min(ULT_MAX, ult + (e.boss ? 60 : e.elite ? 10 : 1));
    if (was < ULT_MAX && ult >= ULT_MAX) { audio.ready(); fx2d.add(player.position.x, 3, player.position.z, coarse ? 'BOO! ready' : 'BOO! ready [Space]', 'info'); }
    for (const t of STREAK_TIERS) if (streak === t[0] && t[0] > 0) { fx2d.add(player.position.x, 3.4, player.position.z, `${t[0]} CHAIN! x${t[1]}`, 'bigGold'); audio.power(); }
    burst(e, e.boss);
    audio.kill();
    if (e.boss) { bossDown(e); return; }
    dropGem(e.x, e.z, e.xp);
    if (e.elite) dropItem('chest', e.x, e.z).tier = 'elite';
    else if (Math.random() < 0.0035 * P.luck) dropItem(hp < P.maxHp * 0.6 ? 'candy' : 'coin', e.x, e.z);
  }
  function bossDown(e) {
    hitStop = 0.3; addShake(1); flashScreen('white'); audio.bossDie();
    shockwave(e.x, e.z, 12, e.k.color, 1);
    banner(e.id === 'king' ? 'King busted!' : 'Queen banished!', `+${fmtNum(e.pts * scoreMult())}`, 'gold');
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, r = rand(1, 4); dropGem(e.x + Math.cos(a) * r, e.z + Math.sin(a) * r, 6 + bossCount * 2); }
    dropItem('chest', e.x, e.z).tier = 'boss';
  }

  function updateGems(dt) {
    const px = player.position.x, pz = player.position.z, mr2 = P.magnet * P.magnet;
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      g.t += dt; if (g.pop > 0) g.pop -= dt;
      const dx = px - g.x, dz = pz - g.z, dd = dx * dx + dz * dz;
      if (!g.pull && dd < mr2) { g.pull = true; g.sp = -3; }
      if (g.pull) {
        g.sp = Math.min(32, g.sp + 40 * dt);
        const d = Math.sqrt(dd) || 1, step = Math.min(d, Math.max(0, g.sp) * dt) + (g.sp < 0 ? g.sp * dt : 0);
        g.x += dx / d * step; g.z += dz / d * step;
        if (dd < 0.36) {
          collectGem(g); gems[i] = gems[gems.length - 1]; gems.pop();
          continue;
        }
      } else if (dd > 70 * 70) { gems[i] = gems[gems.length - 1]; gems.pop(); }
    }
  }
  let gemChain = 0, gemChainT = 0;
  function collectGem(g) {
    xp += g.v * P.growth;
    while (xp >= xpNext) { xp -= xpNext; level++; xpNext = xpFor(level); pendingLevels++; }
    addScore(g.v);
    gemChainT = 0.4; audio.gem(gemChain++);
    if (g.tier >= 2) particles.emit(g.x, 0.6, g.z, { count: 10, color: GEM_TIERS[g.tier].color.getHex(), speed: 2, life: 0.4, size: 0.25 });
  }

  function updateItems(dt) {
    const px = player.position.x, pz = player.position.z;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.t += dt; it.life -= dt;
      it.spin.rotation.y += dt * 2.2;
      it.g.position.set(it.x, 0.8 + Math.sin(it.t * 2.5) * 0.12, it.z);
      it.g.visible = it.life > 4 || Math.floor(it.t * 8) % 2 === 0;
      if (it.life <= 0) { removeItem(it); continue; }
      const dx = px - it.x, dz = pz - it.z, dd = dx * dx + dz * dz;
      if (dd > 90 * 90) { removeItem(it); continue; }
      if (dd < (it.kind === 'chest' ? 1.6 : 1.2)) { removeItem(it); collectItem(it); if (state !== 'play') break; }
    }
  }
  function collectItem(it) {
    const x = it.x, z = it.z;
    particles.emit(x, 1, z, { count: 30, color: ITEMS[it.kind].color, speed: 4, life: 0.6, size: 0.3 });
    switch (it.kind) {
      case 'candy': heal(30); audio.heal(); break;
      case 'coin': case 'bag': {
        const v = it.kind === 'bag' ? 250 : 50; stats.gold += v; addScore(v * scoreMult());
        fx2d.add(x, 2, z, `+${fmtNum(v * scoreMult())}`, 'gold'); audio.coin(); break;
      }
      case 'vacuum':
        for (const g of gems) { g.pull = true; g.sp = 2; }
        fx2d.add(x, 2.4, z, 'Soul Vacuum!', 'info'); audio.power(); break;
      case 'clock':
        freezeT = 7; fx2d.add(x, 2.4, z, 'Time stands still!', 'info'); audio.freeze(); break;
      case 'bell': doomBell(); break;
      case 'chest': openChest(it.tier || 'elite'); break;
    }
  }
  function doomBell() {
    audio.nuke(); flashScreen('white'); addShake(0.8); hitStop = 0.12;
    shockwave(player.position.x, player.position.z, view.r * 1.3, 0xffd35a, 1);
    for (const e of gridQuery(player.position.x, player.position.z, view.r * 1.1).slice()) {
      if (e.k.prop) continue;
      const d = Math.hypot(e.x - player.position.x, e.z - player.position.z);
      later(d / view.r * 0.45, () => { if (!e.dying) { if (e.boss) hit(e, e.maxHp * 0.05, -1); else { e.hp = 1; hit(e, 9999, -1); } } });
    }
    banner('Doom bell!', '', 'gold');
  }

  // =====================================================================
  // Player
  // =====================================================================
  const keys = {};
  const touch = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  function readInput() {
    let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    if (touch.id !== null) {
      const dx = touch.x - touch.ox, dy = touch.y - touch.oy, d = Math.hypot(dx, dy);
      if (d > 8) { ix = dx / Math.max(d, 45); iz = dy / Math.max(d, 45); }
    }
    const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
    return [ix, iz];
  }
  function updatePlayer(dt) {
    const [ix, iz] = readInput();
    const spd = P.speed;
    if (dashT > 0) {
      dashT -= dt;
      particles.emit(player.position.x, 0.9, player.position.z, { count: 4, color: 0x9fdcff, speed: 0.6, life: 0.45, size: 0.5, spread: 0.3 });
      if (dashT <= 0) vel.setLength(Math.min(vel.length(), spd));
    } else {
      const accel = spd * 7;
      vel.x += ix * accel * dt; vel.z += iz * accel * dt;
      vel.multiplyScalar(Math.pow(0.004, dt));
      if (vel.length() > spd) vel.setLength(spd);
    }
    player.position.x += vel.x * dt; player.position.z += vel.z * dt;
    if (Math.hypot(ix, iz) > 0.2) { const l = Math.hypot(ix, iz); face.x = ix / l; face.z = iz / l; }
    const target = Math.atan2(face.x, face.z);
    player.rotation.y += angDiff(target, player.rotation.y) * Math.min(1, dt * 10);
  }
  function hurtPlayer(dmg, sx, sz) {
    if (invuln > 0 || dashT > 0 || state !== 'play') return;
    dmg = Math.max(1, Math.round(dmg - P.armor));
    hp -= dmg; invuln = 0.7;
    if (streak >= 10) fx2d.add(player.position.x, 3, player.position.z, 'Chain broken', 'hurt');
    streak = 0;
    addShake(0.4); hitStop = Math.max(hitStop, 0.05);
    audio.hurt(); flashScreen();
    particles.emit(player.position.x, 1, player.position.z, { count: 20, color: 0x8fd8ff, speed: 4, life: 0.5, size: 0.3 });
    fx2d.add(player.position.x, 2.2, player.position.z, `-${dmg}`, 'hurt');
    if (sx !== undefined) { const dx = player.position.x - sx, dz = player.position.z - sz, d = Math.hypot(dx, dz) || 1; vel.x += dx / d * 6; vel.z += dz / d * 6; }
    if (hp <= 0) { hp = 0; gameOver(); }
  }
  function contactDamage() {
    if (invuln > 0 || dashT > 0) return;
    const px = player.position.x, pz = player.position.z;
    for (const e of gridQuery(px, pz, 0.42)) {
      if (e.k.prop || e.spawn > 0.15 || !e.dmg) continue;
      if (e.k.fly && e.y > 1.9) continue;
      hurtPlayer(e.dmg, e.x, e.z);
      if (!e.boss) { const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz) || 1; e.kx += dx / d * 6; e.kz += dz / d * 6; }
      break;
    }
  }
  function updateOrbs(dt) {
    const px = player.position.x, pz = player.position.z;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      if (freezeT <= 0) { o.x += o.vx * dt; o.z += o.vz * dt; o.life -= dt; }
      const dx = o.x - px, dz = o.z - pz;
      if (dx * dx + dz * dz < 0.36 && invuln <= 0 && dashT <= 0) { hurtPlayer(o.dmg, o.x, o.z); o.life = 0; }
      if (o.life <= 0 || dx * dx + dz * dz > 40 * 40) { orbs[i] = orbs[orbs.length - 1]; orbs.pop(); }
    }
  }
  function dash() {
    if (state !== 'play' || dashCd > 0) return;
    const [ix, iz] = readInput();
    let dx = ix, dz = iz;
    if (Math.hypot(dx, dz) < 0.2) { dx = face.x; dz = face.z; }
    const l = Math.hypot(dx, dz) || 1;
    dashT = 0.22; dashCd = DASH_CD;
    vel.set(dx / l * 22, 0, dz / l * 22);
    audio.dash();
  }
  function boo() {
    if (state !== 'play' || ult < ULT_MAX) return;
    ult = 0; invuln = Math.max(invuln, 1.2);
    const px = player.position.x, pz = player.position.z;
    audio.boo(); flashScreen('white'); addShake(0.7); hitStop = 0.15;
    shockwave(px, pz, view.r * 1.2, 0xc9b8ff, 0.9);
    later(0.12, () => shockwave(px, pz, view.r * 0.8, 0xffffff, 0.7));
    particles.emit(px, 0.8, pz, { count: 260, color: 0xc9b8ff, speed: view.r * 2.2, flat: true, life: 0.8, size: 0.45, drag: 2 });
    for (const e of gridQuery(px, pz, view.r * 1.15).slice()) {
      const d = Math.hypot(e.x - px, e.z - pz);
      later(d / view.r * 0.4, () => {
        if (e.dying) return;
        if (e.boss) hit(e, Math.max(150 * P.might, e.maxHp * 0.08), -1);
        else { e.hp = Math.min(e.hp, 1); hit(e, 9999, -1); }
      });
    }
    for (const o of orbs) o.life = 0;
    banner('BOO!', '', '');
  }

  // =====================================================================
  // Level up + chests
  // =====================================================================
  function ownWeapon(id) { return owned.weapons.find(w => w.id === id); }
  function ownPassive(id) { return owned.passives.find(p => p.id === id); }
  function evolutionsReady() {
    const out = [];
    for (const w of owned.weapons) {
      const d = WEAPONS[w.id];
      if (!d.evolved && w.lvl >= d.max && plv(d.partner) > 0) out.push({ type: 'evo', id: d.evo, from: w.id });
    }
    return out;
  }
  function upgradeOptions(includeNew) {
    const pool = [];
    for (const w of owned.weapons) { const d = WEAPONS[w.id]; if (w.lvl < d.max) pool.push({ type: 'weapon', id: w.id, lvl: w.lvl + 1, weight: 1.4 }); }
    for (const p of owned.passives) if (p.lvl < PASSIVES[p.id].max) pool.push({ type: 'passive', id: p.id, lvl: p.lvl + 1, weight: 1 });
    if (includeNew) {
      if (owned.weapons.length < MAX_SLOTS) for (const id of BASE_WEAPONS) if (!famWeapon(WEAPONS[id].fam)) pool.push({ type: 'weapon', id, lvl: 1, weight: 1.1 });
      if (owned.passives.length < MAX_SLOTS) for (const id in PASSIVES) if (!plv(id)) pool.push({ type: 'passive', id, lvl: 1, weight: 0.8 });
    }
    return pool;
  }
  function weightedPick(pool, n) {
    const out = [], p = pool.slice();
    while (out.length < n && p.length) {
      let sum = 0; for (const o of p) sum += o.weight;
      let r = Math.random() * sum, i = 0;
      for (; i < p.length - 1; i++) { r -= p[i].weight; if (r <= 0) break; }
      out.push(p.splice(i, 1)[0]);
    }
    return out;
  }
  function buildChoices() {
    const n = 3 + (Math.random() < (P.luck - 1) * 1.6 ? 1 : 0);
    const evos = evolutionsReady();
    const out = evos.slice(0, 1).concat(weightedPick(upgradeOptions(true), n - Math.min(1, evos.length)));
    if (!out.length) return [{ type: 'candy' }, { type: 'gold' }];
    return out;
  }
  function applyChoice(c) {
    if (c.type === 'evo') {
      const w = ownWeapon(c.from);
      w.id = c.id; w.lvl = 1; w.t = 0; w.active = 0;
      audio.evolve(); flashScreen('white'); addShake(0.5);
      shockwave(player.position.x, player.position.z, 9, 0xffd35a, 1);
      particles.emit(player.position.x, 1, player.position.z, { count: 120, color: 0xffd35a, speed: 7, lift: 3, life: 1.1, size: 0.4 });
      banner('Evolution!', WEAPONS[c.id].name, 'gold');
    } else if (c.type === 'weapon') {
      const w = ownWeapon(c.id);
      if (w) w.lvl++; else owned.weapons.push({ id: c.id, lvl: 1, t: 0.2, dmg: 0, active: 0, ang: 0, since: gameTime });
    } else if (c.type === 'passive') {
      const p = ownPassive(c.id);
      if (p) p.lvl++; else owned.passives.push({ id: c.id, lvl: 1 });
      if (c.id === 'maxhp') hp += 20;
    } else if (c.type === 'candy') heal(30);
    else if (c.type === 'gold') { addScore(500); stats.gold += 500; }
    computeStats();
    hp = Math.min(hp, P.maxHp);
    hudDirty = true;
    flashSlot(c);
  }
  function choiceInfo(c) {
    if (c.type === 'evo') { const d = WEAPONS[c.id]; return { icon: c.id, name: d.name, color: d.color, tag: 'Evolution', desc: d.blurb, evo: true }; }
    if (c.type === 'weapon') {
      const d = WEAPONS[c.id];
      const desc = c.lvl === 1 ? `${d.blurb} <em>Evolves with ${PASSIVES[d.partner].name}.</em>` : describeUp(d, c.lvl) + (c.lvl === d.max ? ` <em>Max! Pair with ${PASSIVES[d.partner].name} to evolve.</em>` : '');
      return { icon: c.id, name: d.name, color: d.color, tag: c.lvl === 1 ? 'New weapon' : `Level ${c.lvl}`, isNew: c.lvl === 1, desc };
    }
    if (c.type === 'passive') {
      const d = PASSIVES[c.id];
      const pairs = BASE_WEAPONS.filter(id => WEAPONS[id].partner === c.id).map(id => WEAPONS[id].name);
      return { icon: c.id, name: d.name, color: d.color, tag: c.lvl === 1 ? 'New passive' : `Level ${c.lvl}`, isNew: c.lvl === 1, desc: d.desc + (c.lvl === 1 && pairs.length ? ` <em>Evolves ${pairs[0]}.</em>` : '') };
    }
    if (c.type === 'candy') return { icon: 'heal', name: 'Soul Candy', color: '#ff5a8a', tag: 'Treat', desc: 'Restore 30 HP.' };
    return { icon: 'gold', name: 'Gold Pile', color: '#ffd35a', tag: 'Treasure', desc: '+500 score.' };
  }
  function cardEl(c, i, key) {
    const info = choiceInfo(c);
    const el = document.createElement(key ? 'button' : 'div');
    if (key) el.type = 'button';
    el.className = 'up' + (info.evo ? ' evo' : '');
    el.style.setProperty('--uc', info.evo ? '#ffd35a' : info.color);
    el.innerHTML = `<div class="ic" style="color:${info.color}">${ICON(info.icon)}</div>
      <div class="top"><strong></strong><span class="tag${info.isNew ? ' new' : ''}">${info.tag}</span></div>
      <div class="desc">${info.desc}</div>${key ? `<kbd class="desktop-only">${i + 1}</kbd>` : ''}`;
    el.querySelector('strong').textContent = info.name;
    return el;
  }

  let choices = [];
  function openLevelUp() {
    pendingLevels--;
    state = 'levelup';
    const px = player.position.x, pz = player.position.z;
    audio.levelUp();
    shockwave(px, pz, 6, 0xffd35a, 0.7);
    particles.emit(px, 0.5, pz, { count: 60, color: 0xffd35a, speed: 2, lift: 7, life: 1, size: 0.35, drag: 1 });
    for (const e of gridQuery(px, pz, 5)) { if (e.boss || e.k.prop) continue; const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz) || 1; e.kx += dx / d * 12; e.kz += dz / d * 12; }
    $('xpbar').classList.remove('pulse'); void $('xpbar').offsetWidth; $('xpbar').classList.add('pulse');
    $('lvlTitle').textContent = `Level ${level - pendingLevels}!`;
    choices = buildChoices();
    renderChoices();
    setOverlay('levelScreen');
  }
  function renderChoices() {
    const box = $('cards'); box.innerHTML = '';
    choices.forEach((c, i) => {
      const el = cardEl(c, i, true);
      el.addEventListener('click', () => choose(i));
      box.appendChild(el);
    });
    $('rerollN').textContent = rerolls; $('rerollBtn').disabled = rerolls <= 0;
    setTimeout(() => { const f = box.querySelector('button'); if (f && !coarse) f.focus({ preventScroll: true }); }, 60);
  }
  function choose(i) {
    if (state !== 'levelup' || !choices[i]) return;
    audio.pickCard();
    applyChoice(choices[i]);
    afterLevelUp();
  }
  function afterLevelUp() {
    if (pendingLevels > 0) { openLevelUp(); return; }
    state = 'play'; setOverlay(null); clock.getDelta();
  }
  function reroll() {
    if (state !== 'levelup' || rerolls <= 0) return;
    rerolls--; audio.reroll(); choices = buildChoices(); renderChoices();
  }
  function skipLevel() {
    if (state !== 'levelup') return;
    addScore(100); audio.click(); afterLevelUp();
  }

  let chestState = null;
  function openChest(tier) {
    state = 'chest';
    const luck = P.luck;
    const count = tier === 'boss' ? (Math.random() < 0.3 * luck ? 5 : 3) : (Math.random() < 0.18 * luck ? 3 : 1);
    chestState = { count, opened: false };
    $('chestTitle').textContent = tier === 'boss' ? 'Royal treasure!' : 'Treasure!';
    $('chestArt').innerHTML = ICON('chest'); $('chestArt').className = 'chest-art'; $('chestArt').hidden = false;
    $('loot').innerHTML = ''; $('chestBtn').textContent = 'Open';
    audio.chest();
    setOverlay('chestScreen');
    setTimeout(() => $('chestBtn').focus({ preventScroll: true }), 60);
  }
  function chestAction() {
    if (state !== 'chest' || !chestState) return;
    if (chestState.opened) { chestState = null; state = 'play'; setOverlay(null); clock.getDelta(); return; }
    chestState.opened = true;
    $('chestArt').className = 'chest-art open';
    audio.evolve();
    const loot = $('loot');
    for (let i = 0; i < chestState.count; i++) {
      const evos = evolutionsReady();
      let c = evos[0];
      if (!c) { const pool = upgradeOptions(false); c = pool.length ? weightedPick(pool, 1)[0] : { type: 'gold' }; }
      applyChoice(c);
      const el = cardEl(c, i, false); el.style.animationDelay = `${0.25 + i * 0.3}s`;
      loot.appendChild(el);
    }
    setTimeout(() => { $('chestArt').hidden = true; }, 500);
    $('chestBtn').textContent = 'Collect';
  }

  function flashSlot(c) {
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-slot="${c.type === 'evo' ? c.id : c.id}"]`);
      if (el) { el.classList.remove('flashy'); void el.offsetWidth; el.classList.add('flashy'); }
    });
  }

  // =====================================================================
  // Run lifecycle
  // =====================================================================
  function clearWorld() {
    while (enemies.length) removeEnemy(enemies.pop());
    bosses.length = 0; gems.length = 0; orbs.length = 0;
    while (items.length) removeItem(items[0]);
    clearWeaponFx(); particles.clear(); fx2d.clear();
  }
  function startRun() {
    audio.init(); audio.click(); audio.setMusic(true); audio.music(0.25);
    clearWorld();
    owned.weapons.length = 0; owned.passives.length = 0;
    owned.weapons.push({ id: 'wisp', lvl: 1, t: 0.5, dmg: 0, active: 0, ang: 0, since: 0 });
    computeStats();
    hp = P.maxHp; xp = 0; level = 1; xpNext = xpFor(1); pendingLevels = 0;
    kills = 0; score = 0; streak = 0; streakT = 0; bestStreak = 0; ult = 0;
    dashCd = dashT = invuln = freezeT = frenzyT = 0; shake = hitStop = 0; rerolls = 2; lanternT = 1; gameTime = 0;
    stats.damage = 0; stats.gold = 0;
    player.position.set(0, 0, 0); player.rotation.set(0, 0, 0); model.scale.setScalar(1); vel.set(0, 0, 0); face.x = 0; face.z = 1;
    player.visible = true; deathT = 0;
    resetDirector();
    for (let i = 0; i < 10; i++) { const p = spawnPoint(view.r - 6, view.r - 1); spawn('pumpkin', p.x, p.z); }
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; spawn('lantern', Math.cos(a) * 9, Math.sin(a) * 9, { spawn: 0 }); }
    state = 'play'; hudDirty = true; setOverlay(null);
    banner('Survive the night', coarse ? 'Weapons fire on their own. Just float.' : 'Weapons fire on their own. WASD to float, Shift to dash.');
  }
  function gameOver() {
    state = 'dying'; deathT = 0;
    audio.die(); audio.setMusic(false); audio.music(0.08);
    addShake(0.9); hitStop = 0.3;
    particles.emit(player.position.x, 1, player.position.z, { count: 120, color: 0xbfe0ff, speed: 7, life: 1.4, size: 0.4, lift: 1.5, drag: 1.5 });
  }

  // ---------- leaderboard ----------
  const LB_KEY = 'ghost-haunt-board';
  function loadBoard() { try { const v = JSON.parse(store.get(LB_KEY, '[]')); return Array.isArray(v) ? v.filter(e => e && typeof e.s === 'number') : []; } catch (e) { return []; } }
  function saveBoard(b) { store.set(LB_KEY, JSON.stringify(b.slice(0, 10))); }
  let board = loadBoard();
  let myEntry = null;
  function renderBoard(el) {
    el.innerHTML = '';
    if (!board.length) { el.innerHTML = '<li class="none">No haunts yet. Be the first.</li>'; return; }
    board.slice(0, 10).forEach((r, i) => {
      const li = document.createElement('li');
      if (r === myEntry) li.className = 'me';
      li.innerHTML = `<span class="n">${i + 1}</span><span></span><span class="m">${fmtTime(r.t)} · Lv ${r.l}</span><span class="s">${fmtNum(r.s)}</span>`;
      li.children[1].textContent = r.n;
      el.appendChild(li);
    });
  }
  function showGameOver() {
    state = 'over'; audio.setMusic(false);
    const prevBest = board.length ? board[0].s : 0;
    myEntry = { n: store.get('ghost-haunt-name', 'YOU'), s: score, t: Math.floor(gameTime), l: level, k: kills, d: Date.now() };
    board.push(myEntry); board.sort((a, b) => b.s - a.s); board = board.slice(0, 10);
    const ranked = board.includes(myEntry);
    if (!ranked) myEntry = null;
    saveBoard(board);
    $('oScore').textContent = fmtNum(score);
    $('oTime').textContent = fmtTime(gameTime); $('oLevel').textContent = level; $('oKills').textContent = fmtNum(kills); $('oChain').textContent = fmtNum(bestStreak);
    $('newBest').hidden = !(score > prevBest && score > 0);
    $('initialsForm').hidden = !ranked;
    if (ranked) $('initials').value = myEntry.n;
    // damage table
    const rows = owned.weapons.slice().sort((a, b) => b.dmg - a.dmg), top = Math.max(1, rows[0] ? rows[0].dmg : 1);
    $('dmgTable').innerHTML = rows.map(w => {
      const d = WEAPONS[w.id], dps = w.dmg / Math.max(1, gameTime - w.since);
      return `<tr style="--sc:${d.color}"><td><div class="slot${d.evolved ? ' evo' : ''}">${ICON(w.id)}</div></td><td>${d.name}<br><span style="color:var(--muted);font-size:12px">${d.evolved ? 'Evolved' : 'Lv ' + w.lvl} · ${fmtNum(dps)} dps</span></td><td class="barcell"><i style="width:${(w.dmg / top * 100).toFixed(1)}%"></i></td><td class="num">${fmtNum(w.dmg)}</td></tr>`;
    }).join('');
    renderBoard($('overLb'));
    setOverlay('overScreen');
    setTimeout(() => (ranked ? $('initials') : $('againBtn')).focus({ preventScroll: true }), 80);
  }
  $('initialsForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const v = ($('initials').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'YOU';
    if (myEntry) { myEntry.n = v; saveBoard(board); renderBoard($('overLb')); }
    store.set('ghost-haunt-name', v); audio.pickCard();
    $('initialsForm').hidden = true; $('againBtn').focus({ preventScroll: true });
  });
  $('initials').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); });

  // ---------- menu demo: a few foes wander the graveyard behind the title ----------
  function startMenu() {
    state = 'menu'; clearWorld(); audio.setMusic(false);
    gameTime = 0; computeStats();
    player.position.set(0, 0, 0); player.visible = true; model.scale.setScalar(1); vel.set(0, 0, 0);
    const kinds = ['pumpkin', 'pumpkin', 'pumpkin', 'bat', 'bat', 'wraith', 'spider', 'eye', 'brute'];
    for (let i = 0; i < 36; i++) { const a = Math.random() * TAU, r = rand(3, 14); spawn(pick(kinds), Math.cos(a) * r, Math.sin(a) * r, { ai: 'wander', spawn: 0 }); }
    renderBoard($('menuLb'));
    setOverlay('menu');
  }

  // =====================================================================
  // Overlays + HUD
  // =====================================================================
  const OVERLAYS = ['menu', 'levelScreen', 'chestScreen', 'pauseScreen', 'overScreen'];
  function setOverlay(which) {
    OVERLAYS.forEach(id => { $(id).hidden = id !== which; });
    const inRun = which !== 'menu';
    $('hud').hidden = !inRun; $('xpbar').hidden = !inRun;
    $('abilities').hidden = which !== null; $('touchCtl').hidden = which !== null;
    if (which !== null) { for (const k in keys) keys[k] = false; touch.id = null; $('stick').classList.remove('on'); }
  }
  function pause() {
    if (state !== 'play') return;
    state = 'paused'; audio.music(0.08);
    renderBuild($('pauseBuild'), true);
    const pct = v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
    const rows = [['Max HP', P.maxHp], ['Might', pct(P.might - 1)], ['Cooldown', pct(P.cd - 1)], ['Area', pct(P.area - 1)], ['Duration', pct(P.duration - 1)], ['Amount', `+${P.amount}`],
      ['Speed', pct(P.speed / 6.2 - 1)], ['Magnet', pct(P.magnet / 2.9 - 1)], ['Luck', pct(P.luck - 1)], ['Armor', P.armor], ['Regen', `${P.regen.toFixed(1)}/s`], ['Growth', pct(P.growth - 1)]];
    $('pauseStats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span>${v}</div>`).join('');
    setOverlay('pauseScreen');
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'play'; setOverlay(null); audio.music(0.25); clock.getDelta();
  }
  function renderBuild(el, big) {
    const slot = (id, lvl, max, color, evo, small) => `<div class="slot${small ? ' small' : ''}${evo ? ' evo' : ''}" data-slot="${id}" style="--sc:${color}" title="${(WEAPONS[id] || PASSIVES[id]).name}">${ICON(id)}${max > 1 ? `<div class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>`;
    const w = owned.weapons.map(x => { const d = WEAPONS[x.id]; return slot(x.id, x.lvl, d.max, d.color, d.evolved, false); });
    const p = owned.passives.map(x => { const d = PASSIVES[x.id]; return slot(x.id, x.lvl, d.max, d.color, false, !big); });
    while (w.length < MAX_SLOTS) w.push('<div class="slot empty"></div>');
    while (p.length < MAX_SLOTS) p.push(`<div class="slot empty${big ? '' : ' small'}"></div>`);
    if (big) el.innerHTML = `<div class="build-row">${w.join('')}</div><div class="build-row">${p.join('')}</div>`;
    else return [w.join(''), p.join('')];
  }

  const hud = {
    xpFill: $('xpFill'), lv: $('lv'), time: $('time'), kills: $('kills'), score: $('score'), streak: $('streak'), streakN: $('streakN'), streakFill: $('streakFill'), mult: $('mult'),
    abDash: $('abDash'), abUlt: $('abUlt'), dashCd: $('abDash').querySelector('.cd'), ultCd: $('abUlt').querySelector('.cd'), dashBtn: $('dashBtn'), ultBtn: $('ultBtn'),
    boss: $('boss'), bossFill: $('bossFill'), vignette: $('vignette'), freeze: $('freezeTint'), frenzy: $('frenzyTint'), clock: $('clock'),
  };
  const cache = new Map();
  const setText = (el, v) => { if (cache.get(el) !== v) { cache.set(el, v); el.textContent = v; } };
  const setScaleX = (el, k) => { const v = `scaleX(${clamp(k, 0, 1).toFixed(3)})`; if (cache.get(el) !== v) { cache.set(el, v); el.style.transform = v; } };
  function updateHud() {
    if ($('hud').hidden) return;
    if (hudDirty) {
      hudDirty = false;
      const [w, p] = renderBuild(null, false);
      $('wSlots').innerHTML = w; $('pSlots').innerHTML = p;
    }
    setScaleX(hud.xpFill, xp / xpNext);
    setText(hud.lv, `LV ${level}`);
    setText(hud.time, fmtTime(gameTime));
    setText(hud.kills, fmtNum(kills));
    setText(hud.score, fmtNum(score));
    const tier = streakTier(), m = scoreMult();
    hud.streak.classList.toggle('on', streak >= 5);
    if (streak >= 5) {
      setText(hud.streakN, `${fmtNum(streak)} chain`);
      setScaleX(hud.streakFill, streakT / STREAK_WINDOW);
      setText(hud.mult, `x${m}`);
      hud.streak.style.setProperty('--sc', frenzyT > 0 ? '#ff4a5e' : tier[2]);
    }
    const dk = dashCd / DASH_CD, uk = ult / ULT_MAX;
    setScaleX(hud.dashCd, 1 - dk);
    setScaleX(hud.ultCd, uk);
    hud.abDash.classList.toggle('ready', dk <= 0);
    hud.abUlt.classList.toggle('ready', uk >= 1);
    hud.dashBtn.style.setProperty('--cd', dk.toFixed(3));
    hud.ultBtn.style.setProperty('--cd', (1 - uk).toFixed(3));
    const boss = bosses.find(b => !b.dying);
    hud.boss.hidden = !boss || state === 'over';
    if (boss) setScaleX(hud.bossFill, boss.hp / boss.maxHp);
    const low = hp / P.maxHp <= 0.3 && state === 'play';
    hud.vignette.style.opacity = low ? String(0.6 + Math.sin(realT * 6) * 0.4) : '0';
    hud.freeze.classList.toggle('on', freezeT > 0);
    hud.frenzy.classList.toggle('on', frenzyT > 0);
    hud.clock.classList.toggle('frenzy', frenzyT > 0);
  }

  // things drawn on the 2D overlay: the ghost's HP bar, elite HP bars, arrows to bosses and chests
  function drawOverlayExtras(g, W, H, project) {
    if (state !== 'play' && state !== 'levelup' && state !== 'chest' && state !== 'paused') return;
    const [sx, sy] = project(player.position.x, -0.1, player.position.z);
    const bw = 46, k = clamp(hp / P.maxHp, 0, 1);
    g.fillStyle = 'rgba(10,6,20,0.8)'; g.fillRect(sx - bw / 2 - 1, sy + 8, bw + 2, 7);
    g.fillStyle = k <= 0.3 ? '#ff5a6e' : '#7dff9a'; g.fillRect(sx - bw / 2, sy + 9, bw * k, 5);
    for (const e of enemies) {
      if (!e.elite || e.dying || e.hp >= e.maxHp) continue;
      const [ex, ey, ez] = project(e.x, (e.y || 0) + 1.6 * e.scale, e.z);
      if (ez > 1 || ex < 0 || ex > W || ey < 0 || ey > H) continue;
      g.fillStyle = 'rgba(10,6,20,0.8)'; g.fillRect(ex - 25, ey - 4, 50, 6);
      g.fillStyle = '#ffd35a'; g.fillRect(ex - 24, ey - 3, 48 * (e.hp / e.maxHp), 4);
    }
    const targets = [];
    for (const it of items) if (it.kind === 'chest') targets.push([it.x, it.z, '#ffd35a']);
    for (const b of bosses) if (!b.dying) targets.push([b.x, b.z, b.id === 'king' ? '#ff8a2a' : '#c9b8ff']);
    const cx = W / 2, cy = H / 2, pad = 34;
    for (const [x, z, col] of targets) {
      const [tx, ty, tz] = project(x, 0.8, z);
      if (tz < 1 && tx > pad && tx < W - pad && ty > pad + 70 && ty < H - pad) continue;
      let dx = tx - cx, dy = ty - cy; if (tz > 1) { dx = -dx; dy = -dy; }
      const a = Math.atan2(dy, dx), s = Math.min((W / 2 - pad) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - pad - 30) / Math.abs(Math.sin(a) || 1e-6));
      const ax = cx + Math.cos(a) * s, ay = cy + Math.sin(a) * s;
      g.save(); g.translate(ax, ay); g.rotate(a);
      g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 12;
      const pulse = 1 + Math.sin(realT * 8) * 0.12;
      g.scale(pulse, pulse);
      g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -10); g.lineTo(-3, 0); g.lineTo(-8, 10); g.closePath(); g.fill();
      g.restore();
    }
  }

  // =====================================================================
  // Settings toggles
  // =====================================================================
  function renderToggles() {
    ['menuToggles', 'pauseToggles'].forEach(cid => {
      const box = $(cid); box.innerHTML = '';
      for (const k in SETTING_LABELS) {
        const lab = document.createElement('label'); lab.className = 'toggle';
        lab.innerHTML = `<span>${SETTING_LABELS[k]}</span><input type="checkbox" role="switch">`;
        const inp = lab.querySelector('input'); inp.checked = settings[k];
        inp.addEventListener('change', () => {
          settings[k] = inp.checked; store.set('ghost-haunt-' + k, inp.checked ? '1' : '0');
          if (k === 'bloom' && inp.checked) buildComposer();
          if (k === 'bloom') resize();
          renderToggles();
        });
        box.appendChild(lab);
      }
    });
  }
  renderToggles();

  // =====================================================================
  // Input
  // =====================================================================
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;
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
    } else if (state === 'levelup') {
      const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (i >= 0) choose(i);
      else if (e.code === 'KeyR') reroll();
    } else if (state === 'chest') {
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); chestAction(); }
    } else if ((state === 'menu' || state === 'over') && e.code === 'Enter' && (document.activeElement === document.body || !document.activeElement)) {
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
  $('ultBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); boo(); });
  $('dashBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); dash(); });
  $('startBtn').addEventListener('click', startRun);
  $('againBtn').addEventListener('click', startRun);
  $('menuBtn').addEventListener('click', () => { audio.click(); startMenu(); });
  $('pauseBtn').addEventListener('click', e => { e.currentTarget.blur(); if (state === 'paused') resume(); else pause(); });
  $('resumeBtn').addEventListener('click', resume);
  $('quitBtn').addEventListener('click', () => { state = 'over'; hp = 0; showGameOver(); });
  $('muteBtn').addEventListener('click', e => { audio.init(); toggleMute(); e.currentTarget.blur(); });
  $('rerollBtn').addEventListener('click', reroll);
  $('skipBtn').addEventListener('click', skipLevel);
  $('chestBtn').addEventListener('click', chestAction);
  $('killIcon').innerHTML = ICON('skull');
  $('trophyIcon').innerHTML = ICON('trophy'); $('trophyIcon2').innerHTML = ICON('trophy');
  $('rerollIcon').innerHTML = ICON('reroll'); $('skipIcon').innerHTML = ICON('skip');
  function toggleMute() {
    const m = audio.toggleMute();
    $('muteWaves').toggleAttribute('hidden', m); $('muteX').toggleAttribute('hidden', !m);
  }
  if (audio.muted) { $('muteWaves').setAttribute('hidden', ''); $('muteX').removeAttribute('hidden'); }

  // =====================================================================
  // Frame
  // =====================================================================
  const clock = new THREE.Clock();
  const camWant = new THREE.Vector3(), camLook = new THREE.Vector3();
  let realT = 0;

  function updatePlay(dt) {
    gameTime += dt;
    for (let i = timers.length - 1; i >= 0; i--) { const tm = timers[i]; tm.t -= dt; if (tm.t <= 0) { timers.splice(i, 1); tm.fn(); } }
    dashCd = Math.max(0, dashCd - dt); invuln = Math.max(0, invuln - dt);
    freezeT = Math.max(0, freezeT - dt);
    if (frenzyT > 0) { frenzyT -= dt; if (frenzyT <= 0) banner('Dawn… for now', 'The witching hour passes.'); }
    if (streakT > 0) { streakT -= dt; if (streakT <= 0) streak = 0; }
    gemChainT -= dt; if (gemChainT <= 0) gemChain = 0;
    if (P.regen > 0) hp = Math.min(P.maxHp, hp + P.regen * dt);

    updatePlayer(dt);
    direct(dt);
    updateEnemies(dt, true);
    gridBuild(player.position.x, player.position.z);
    separate();
    contactDamage();
    if (state !== 'play') return; // died this frame
    updateWeapons(dt);
    updateOrbs(dt);
    updateGems(dt);
    updateItems(dt);
    audio.setIntensity(Math.min(1, aliveCount / 160), frenzyT > 0);
    if (pendingLevels > 0 && state === 'play') openLevelUp();
  }

  function drawInstances() {
    for (const id in herds) herds[id].n = 0;
    let sn = 0;
    const frozen = freezeT > 0 && state !== 'menu';
    for (const e of enemies) {
      const h = herds[e.id];
      if (h.n >= h.cap) continue;
      const i = h.n++;
      let s = e.scale, y = e.y || 0, sqY = 1, sqXZ = 1, tiltZ = 0;
      if (e.spawn > 0) { const k = clamp(1 - e.spawn / 0.3, 0.05, 1); s *= k; if (!e.k.fly) y -= (1 - k) * 0.6; }
      if (e.dying) { const k = e.dying / 0.28; s *= (1 + k * 0.6) * (1 - k); y += k * 1.4; }
      if (!e.k.fly && !e.k.prop && !frozen) {
        const hop = Math.abs(Math.sin(e.t * (e.boss ? 5 : e.id === 'spider' ? 16 : 9) + e.phase));
        y += hop * (e.id === 'spider' ? 0.05 : 0.16) * e.scale; sqY = 0.92 + hop * 0.12; sqXZ = 1.04 - hop * 0.06;
      }
      if (e.id === 'wraith' || e.id === 'queen') tiltZ = Math.sin(e.t * 3 + e.phase) * 0.12;
      _q.setFromEuler(_e.set(e.id === 'king' && e.mode === 'charge' ? 0.25 : 0, e.rot, tiltZ));
      _s.set(s * sqXZ, s * sqY, s * sqXZ);
      _m.compose(_p.set(e.x, y, e.z), _q, _s);
      h.mesh.setMatrixAt(i, _m);
      if (frozen && !e.k.prop) _c.setRGB(0.55, 0.85, 1.6);
      else if (e.elite) _c.setRGB(1.4, 1.1, 0.45);
      else _c.setRGB(1, 1, 1);
      h.mesh.setColorAt(i, _c);
      h.flash.array[i] = e.flash > 0 ? 0.85 : 0;
      h.phase.array[i] = e.phase;
      if (sn < 1400 && !e.dying) {
        const sc = e.r * (e.k.fly ? 1.2 : 1.7) * (e.spawn > 0 ? 0.5 : 1);
        _m.makeScale(sc, 1, sc).setPosition(e.x, 0.03, e.z);
        shadows.setMatrixAt(sn++, _m);
      }
    }
    for (const id in herds) {
      const h = herds[id];
      h.mesh.count = h.n;
      if (h.n) { h.mesh.instanceMatrix.needsUpdate = true; h.mesh.instanceColor.needsUpdate = true; h.flash.needsUpdate = true; h.phase.needsUpdate = true; }
    }
    shadows.count = sn; shadows.instanceMatrix.needsUpdate = true;

    // gems
    let gn = 0;
    for (const g of gems) {
      if (gn >= GEM_CAP) break;
      const tier = GEM_TIERS[g.tier], pop = g.pop > 0 ? 1 - g.pop / 0.25 : 1;
      _q.setFromEuler(_e.set(0, g.t * 3, 0));
      _s.setScalar(tier.s * pop);
      _m.compose(_p.set(g.x, 0.45 + Math.sin(g.t * 4) * 0.08, g.z), _q, _s);
      gemMesh.setMatrixAt(gn, _m); gemMesh.setColorAt(gn, tier.color); gn++;
    }
    gemMesh.count = gn; gemMesh.instanceMatrix.needsUpdate = true; if (gemMesh.instanceColor) gemMesh.instanceColor.needsUpdate = true;

    // orbs
    let on = 0;
    for (const o of orbs) {
      const p = 1 + Math.sin(realT * 20 + on) * 0.15;
      _m.makeScale(p, p, p).setPosition(o.x, o.y, o.z);
      orbMesh.setMatrixAt(on, _m); orbCore.setMatrixAt(on, _m); on++;
    }
    orbMesh.count = orbCore.count = on; orbMesh.instanceMatrix.needsUpdate = orbCore.instanceMatrix.needsUpdate = true;
  }

  function updateCosmetics(dt) {
    const bob = Math.sin(realT * 2.2) * 0.12;
    if (state !== 'dying' && state !== 'over') {
      player.position.y = 0.45 + bob;
      player.rotation.z = Math.sin(realT * 1.7) * 0.05 - vel.x * 0.015;
      player.rotation.x = vel.z * 0.015;
      const dashStretch = dashT > 0 ? 0.25 : 0;
      model.scale.set(1 - dashStretch * 0.4, 1 - dashStretch * 0.2, 1 + dashStretch);
      player.visible = invuln <= 0 || dashT > 0 || Math.floor(realT * 14) % 2 === 0 || state !== 'play';
      ghostMat.emissive.setHex(dashT > 0 ? 0x9a7aff : ult >= ULT_MAX && state === 'play' ? 0x8a6aff : 0x5d7bd8);
      ghostMat.emissiveIntensity = ult >= ULT_MAX && state === 'play' ? 0.55 + Math.sin(realT * 6) * 0.2 : 0.4;
    }
    playerBlob.position.set(player.position.x, 0.025, player.position.z);
    playerBlob.scale.setScalar(1 - bob * 0.8);
    playerBlob.visible = player.visible;
  }

  function updateCamera(dt) {
    if (state === 'menu') {
      camera.position.set(Math.sin(realT * 0.1) * 15, 9, Math.cos(realT * 0.1) * 15);
      camera.lookAt(0, 1, 0);
    } else {
      const zoom = 1 + (bosses.length ? 0.08 : 0) + frenzyMix * 0.05;
      camWant.copy(player.position).addScaledVector(CAM_OFFSET, zoom);
      camWant.x += vel.x * 0.2; camWant.z += vel.z * 0.2; camWant.y = CAM_OFFSET.y * zoom;
      camera.position.lerp(camWant, Math.min(1, dt * 5));
      camLook.set(player.position.x + vel.x * 0.2, 0.8, player.position.z + vel.z * 0.2);
      camera.lookAt(camLook);
    }
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 2);
      const s = shake * shake * 0.7;
      camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s;
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    let dt = Math.min(clock.getDelta(), 0.05);
    const frozenUi = state === 'levelup' || state === 'chest' || state === 'paused';
    if (frozenUi) dt = 0;
    if (hitStop > 0) { hitStop -= dt; dt *= 0.1; }
    realT += dt;
    shaderTime.value = realT;
    audio.tick();

    if (state === 'play') updatePlay(dt);
    else if (state === 'menu') { updateEnemies(dt, false); }
    else if (state === 'dying') {
      deathT += dt; updateEnemies(dt, false);
      model.scale.set(1 + deathT * 0.6, Math.max(0.01, 1 - deathT * 1.1), 1 + deathT * 0.6);
      player.rotation.y += dt * 10;
      if (deathT > 0.95) player.visible = false;
      if (deathT > 1.6) showGameOver();
    } else if (state === 'over') { updateEnemies(dt, false); }

    frenzyMix += ((frenzyT > 0 ? 1 : 0) - frenzyMix) * Math.min(1, dt * 1.5);
    freezeMix += ((freezeT > 0 ? 1 : 0) - freezeMix) * Math.min(1, dt * 3);
    updateSky(frenzyMix, freezeMix);
    if (bloomPass) bloomPass.strength = 0.8 + frenzyMix * 0.3;

    updateCosmetics(dt);
    drawInstances();
    updateCamera(dt);
    updateWorld(realT, player.position.x, player.position.z);
    particles.update(dt);
    fx2d.draw(dt, drawOverlayExtras);
    updateHud();
    renderFrame();
  }

  startMenu();
  frame();

  // tiny hook for automated smoke tests
  window.__ghostHaunt = {
    get state() { return state; }, get score() { return score; }, get hp() { return hp; }, get level() { return level; },
    get time() { return gameTime; }, get kills() { return kills; }, get enemies() { return enemies.length; }, get gems() { return gems.length; },
    get weapons() { return owned.weapons.map(w => `${w.id}:${w.lvl}`); }, get passives() { return owned.passives.map(p => `${p.id}:${p.lvl}`); },
    get choices() { return choices.map(c => `${c.type}:${c.id || ''}`); },
    get dmg() { return owned.weapons.map(w => `${w.id}:${Math.round(w.dmg)}`); },
    clear() { owned.weapons.length = 0; computeStats(); hudDirty = true; },
    start: startRun, choose, reroll, chest: chestAction,
    xp(n) { xp += n; while (xp >= xpNext) { xp -= xpNext; level++; xpNext = xpFor(level); pendingLevels++; } },
    give(id, lvl = 1) {
      if (WEAPONS[id]) { const w = ownWeapon(id) || famWeapon(WEAPONS[id].fam); if (w) w.lvl = lvl; else owned.weapons.push({ id, lvl, t: 0.2, dmg: 0, active: 0, ang: 0, since: gameTime }); }
      else if (PASSIVES[id]) { const p = ownPassive(id); if (p) p.lvl = lvl; else owned.passives.push({ id, lvl }); }
      computeStats(); hudDirty = true;
    },
    setTime(s) { gameTime = s; }, boss(k) { spawnBoss(k || 'king'); }, item(k) { dropItem(k, player.position.x + 0.6, player.position.z); },
    god(on = true) { invuln = on ? 1e9 : 0; }, die() { hp = 1; invuln = 0; dashT = 0; hurtPlayer(999); }, ult() { ult = ULT_MAX; },
  };
})();
