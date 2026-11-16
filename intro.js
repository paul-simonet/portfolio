/* ============================================================
   Entrée du portfolio : une forêt → un champignon → son mycélium → la page.
   Le défilement pilote la caméra. Tout est procédural : textures dessinées
   en canvas, géométries générées, Three.js chargé à la demande depuis un CDN.
   Sans WebGL, sans réseau ou avec « réduire les animations », l'entrée
   s'efface et la page s'affiche directement.
   ============================================================ */
(() => {
'use strict';
const intro = document.getElementById('intro'), track = document.getElementById('intro-track');
if (!intro || !track) return;
const body = document.body, root = document.documentElement;
const replayBtn = document.getElementById('replay'), heroEl = document.querySelector('.hero');
const glCanvas = document.getElementById('intro-gl');
const loadEl = intro.querySelector('.i-load b');
const progEl = intro.querySelector('.i-prog i'), hintEl = intro.querySelector('.i-hint');
const caps = [...intro.querySelectorAll('.i-cap')].map(el => ({ el, a: +el.dataset.from, b: +el.dataset.to, k: -1 }));
const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const end = () => track.offsetHeight;
const DONE = 'ps-intro-done';
const session = { get(){ try { return sessionStorage.getItem(DONE); } catch(_){ return null; } }, set(){ try { sessionStorage.setItem(DONE, '1'); } catch(_){} } };

// « réduire les animations » : pas d'entrée du tout
if (matchMedia('(prefers-reduced-motion: reduce)').matches){ intro.remove(); track.remove(); return; }

let live = false, looping = false, supported = true, world = null, building = null;
let pDisp = 0, snapNext = true, lastP = -1, last = performance.now();

/* Fin de l'entrée : on replie la piste de défilement, la page reste en place
   et on ne peut plus remonter dans la forêt (seul le bouton « Intro » y ramène). */
function finish(atEnd){
  if (!live) return;
  // fin par le défilement : la page se pose tout en haut, puis apparaît pendant que le défilement est bloqué
  const y = atEnd ? 0 : Math.max(0, scrollY - end());
  live = false;
  track.hidden = true; intro.hidden = true;
  body.classList.remove('in-intro', 'intro-live');
  try { history.scrollRestoration = 'auto'; } catch(_){}
  scrollTo({ top: y, behavior: 'instant' });
  if (atEnd) reveal(); else if (heroEl) heroEl.style.removeProperty('--intro-reveal');
  session.set();
  if (replayBtn) replayBtn.hidden = !supported;
}
/* Apparition du haut de la page (--intro-reveal de 0 à 1) ; molette, tactile et clavier bloqués
   jusqu'à la fin, pour que l'élan d'un défilement trop fort ne parte pas dans la page */
const REVEAL_MS = 800;
function reveal(){
  // reprend là où le fondu de fin l'a laissé (overlay) au lieu de repartir de zéro
  const r0 = heroEl ? +heroEl.style.getPropertyValue('--intro-reveal') || 0 : 0, dur = Math.max(1, REVEAL_MS * (1 - r0));
  const t0 = performance.now();
  const stop = e => { if (e.cancelable) e.preventDefault(); };
  const keys = e => { if ([' ', 'PageDown', 'ArrowDown', 'End'].includes(e.key)) e.preventDefault(); };
  const release = () => { removeEventListener('wheel', stop); removeEventListener('touchmove', stop); removeEventListener('keydown', keys); };
  addEventListener('wheel', stop, { passive: false }); addEventListener('touchmove', stop, { passive: false }); addEventListener('keydown', keys);
  const step = now => {
    if (live){ release(); return; }   // entrée relancée entre-temps
    const t = clamp((now - t0) / dur);
    if (heroEl) heroEl.style.setProperty('--intro-reveal', lerp(r0, 1, sstep(0, 1, t)).toFixed(3));
    if (t < 1) requestAnimationFrame(step);
    else { release(); if (heroEl) heroEl.style.removeProperty('--intro-reveal'); }
  };
  requestAnimationFrame(step);
}
/* Pendant l'entrée, on ne dépasse pas la fin de la piste. La molette est arrêtée net à la fin (pas de saut) ;
   le rappel sur « scroll » ne sert que pour le tactile et la barre de défilement. */
addEventListener('wheel', e => { if (live && e.deltaY > 0 && scrollY + e.deltaY >= end()){ e.preventDefault(); if (scrollY < end()) scrollTo({ top: end(), behavior: 'instant' }); } }, { passive: false });
addEventListener('scroll', () => { if (live && scrollY > end()) scrollTo({ top: end(), behavior: 'instant' }); }, { passive: true });
/* (Re)lance l'entrée depuis le début */
function start(){
  if (live || !supported) return;
  live = true;
  track.hidden = false; intro.hidden = false;
  intro.style.opacity = 1; intro.style.visibility = 'visible'; intro.classList.remove('passed');
  body.classList.add('in-intro', 'intro-live');
  try { history.scrollRestoration = 'manual'; } catch(_){}
  scrollTo({ top: 0, behavior: 'instant' });
  pDisp = 0; snapNext = true; lastP = -1;
  ensureWorld();
  if (!looping){ looping = true; last = performance.now(); requestAnimationFrame(loop); }
}

function ensureWorld(){
  if (world || building) return;
  building = (async () => {
    try {
      loadEl.textContent = '4 %';
      const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js');
      world = await build(THREE, v => { loadEl.textContent = Math.round(v * 100) + ' %'; });
      snapNext = true; lastP = -1;
      intro.classList.remove('loading'); intro.classList.add('ready');
    } catch (err){
      console.warn('[intro] désactivée :', err);
      supported = false; finish(); if (replayBtn) replayBtn.hidden = true;
    }
  })();
}

intro.querySelector('.i-skip').addEventListener('click', () => finish());
if (replayBtn) replayBtn.addEventListener('click', start);
const langBtns = intro.querySelectorAll('[data-lang]');
langBtns.forEach(b => b.addEventListener('click', () => { if (typeof window.applyLang === 'function') window.applyLang(b.dataset.lang); }));
const syncLang = () => langBtns.forEach(b => b.setAttribute('aria-pressed', String((root.lang || 'fr') === b.dataset.lang)));
new MutationObserver(syncLang).observe(root, { attributes: true, attributeFilter: ['lang'] }); syncLang();

/* ---------- textes et fondu final (écrits seulement quand la valeur change) ---------- */
function overlay(p){
  for (const c of caps){
    const k = Math.round(Math.min(c.a <= 0 ? 1 : sstep(c.a, c.a + .03, p), 1 - sstep(c.b - .03, c.b, p)) * 1000) / 1000;
    if (k === c.k) continue;
    c.k = k;
    c.el.style.opacity = k;
    c.el.style.transform = `translate3d(0,${((1 - k) * 22).toFixed(1)}px,0)`;
    c.el.style.visibility = k > .002 ? 'visible' : 'hidden';
  }
  hintEl.style.opacity = (1 - sstep(.004, .03, p)).toFixed(3);
  progEl.style.transform = `scaleY(${p.toFixed(4)})`;
  const fade = 1 - sstep(.95, .995, p);
  intro.style.opacity = fade.toFixed(3);
  intro.style.visibility = fade <= .001 ? 'hidden' : 'visible';
  intro.classList.toggle('passed', p > .95);
  body.classList.toggle('in-intro', p < .95);
  body.classList.toggle('intro-live', p < .95);   // la culture de la page ne démarre qu'au moment où l'entrée s'efface
  // sur .hero, pas sur <html> : rien d'autre à recalculer
  // le haut de la page commence à apparaître pendant que l'entrée s'efface, reveal() termine
  if (heroEl) heroEl.style.setProperty('--intro-reveal', (sstep(.965, 1, p) * .6).toFixed(3));
  intro.style.setProperty('--scrim', (1 - sstep(.9, .95, p)).toFixed(3));   // voile sombre sous les textes, retiré quand l'image prend les couleurs de la page
  intro.style.setProperty('--cap-ink', sstep(.895, .93, p).toFixed(3));     // …et le dernier texte prend la couleur d'encre de la page
}

function loop(now){
  if (!live){ looping = false; return; }
  requestAnimationFrame(loop);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  const target = clamp(scrollY / Math.max(1, end()));
  // pas de lissage tant que la scène charge : on se cale sur la position réelle
  if (snapNext){ pDisp = target; if (world) snapNext = false; }
  else pDisp += (target - pDisp) * (1 - Math.exp(-dt * 3.2));
  if (Math.abs(target - pDisp) < 1e-4) pDisp = target;
  // .999 : sur iPhone le défilement peut s'arrêter une fraction de pixel avant la fin
  if (target >= .999 && pDisp > .99){ finish(true); return; }
  if (pDisp !== lastP){ overlay(pDisp); lastP = pDisp; }
  if (world) world.frame(pDisp, now / 1000, dt);
}

// arrivée par un lien direct (#projets, #p-…) ou entrée déjà vue dans cette session : on va droit à la page
live = true;
if (location.hash.length > 1 || session.get()){ finish(); if (replayBtn) replayBtn.hidden = false; }
else { live = false; start(); }

/* Couleurs de la page (fond, hyphes) : la fin de l'entrée s'y fond */
const probe = document.createElement('canvas').getContext('2d');
function toRGB(str, fb){
  probe.fillStyle = fb; probe.fillStyle = str || fb;
  const h = probe.fillStyle;
  if (h[0] === '#'){ const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const m = h.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [236, 239, 232];
}
function pageColors(){
  const cs = getComputedStyle(root);
  return {
    bg: toRGB(cs.getPropertyValue('--bg').trim(), '#ECEFE8'),
    hy: (cs.getPropertyValue('--hypha').trim() || '38,48,66').split(',').map(Number),
    a: parseFloat(cs.getPropertyValue('--hypha-a')) || .3
  };
}

/* ============================================================
   Monde 3D
   ============================================================ */
async function build(THREE, progress){
  const V3 = THREE.Vector3, Col = THREE.Color;
  const breathe = () => new Promise(r => setTimeout(r, 0));
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: !mobile, powerPreference: 'high-performance' });
  // définition : on vise la netteté de l'écran, et on ne descend qu'autant que la machine l'exige (voir adapt())
  const maxDpr = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.75), minDpr = Math.min(maxDpr, .6);
  let dpr = maxDpr;
  renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const a2c = !mobile;   // bords du feuillage lissés par l'antialiasing (alpha to coverage)

  /* ---------- hasard et bruit déterministes ---------- */
  let seed = 20260930;
  const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rand = (a, b) => a + (b - a) * rnd();
  const hash = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  function noise(x, y, z = 0){
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), c = (i, j, k) => hash(xi + i, yi + j, zi + k);
    return lerp(lerp(lerp(c(0,0,0), c(1,0,0), u), lerp(c(0,1,0), c(1,1,0), u), v), lerp(lerp(c(0,0,1), c(1,0,1), u), lerp(c(0,1,1), c(1,1,1), u), v), w);
  }
  const fbm = (x, y, z = 0, o = 4) => { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++){ s += a * noise(x * f, y * f, z * f + i * 7.1); n += a; f *= 2.03; a *= .5; } return s / n; };

  /* ---------- brouillard : distance + brume au sol + diffusion vers le soleil ---------- */
  const SC = THREE.ShaderChunk;
  SC.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogPos;\n#endif';
  SC.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogPos = mvPosition.xyz;\n#endif';
  SC.fog_pars_fragment = `#ifdef USE_FOG
    uniform vec3 fogColor; uniform float fogDensity; varying float vFogDepth; varying vec3 vFogPos;
    uniform vec3 uSunDir; uniform vec3 uSunCol; uniform mat3 uViewInv; uniform vec3 uCamPos; uniform vec3 uMist; uniform vec3 uMistCol;
  #endif`;
  SC.fog_fragment = `#ifdef USE_FOG
    vec3 fDir = uViewInv * vFogPos; float fD = length(fDir); fDir /= max(fD, 1e-5);
    float fY = uCamPos.y + fDir.y * fD;
    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * fD * fD);
    float fMist = clamp((1.0 - exp(-fD * uMist.x)) * exp(-max(fY, 0.0) / max(uMist.y, 1e-3)) * uMist.z, 0.0, 1.0);
    float fS = max(dot(fDir, uSunDir), 0.0);
    vec3 fGlow = uSunCol * (pow(fS, 8.0) * .28 + pow(fS, 40.0) * .6);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uMistCol + fGlow * .6, fMist);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor + fGlow, fogFactor);
  #endif`;
  const FOGU = {
    uSunDir: { value: new V3() }, uSunCol: { value: new Col() }, uViewInv: { value: new THREE.Matrix3() },
    uCamPos: { value: new V3() }, uMist: { value: new V3() }, uMistCol: { value: new Col() }
  };
  function hook(m, x = {}){
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, FOGU, x.uniforms || {});
      if (x.vPre) sh.vertexShader = x.vPre + '\n' + sh.vertexShader;
      if (x.v) sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + x.v);
      if (x.fPre) sh.fragmentShader = x.fPre + '\n' + sh.fragmentShader;
      if (x.f) sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + x.f);
      if (x.fe) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + x.fe);
    };
    m.customProgramCacheKey = () => x.key || 'fog';
    return m;
  }
  // feuilles translucides : face au soleil, la lumière les traverse
  const LEAF = key => ({ key, fe: 'vec3 lvD = normalize(uViewInv * vFogPos); totalEmissiveRadiance += diffuseColor.rgb * uSunCol * pow(max(dot(lvD, uSunDir), 0.), 3.) * 2.6;' });
  const std = (o, x) => hook(new THREE.MeshStandardMaterial(o), x);
  const phys = (o, x) => hook(new THREE.MeshPhysicalMaterial(o), x);

  /* ---------- textures dessinées ---------- */
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, rx = 1, ry = 1, color = true, flip = true) => {
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.anisotropy = aniso; t.flipY = flip; if (color) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  function normalMap(c, k = 3){
    const w = c.width, h = c.height, s = c.getContext('2d').getImageData(0, 0, w, h).data, Hh = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) Hh[i] = (s[i * 4] * .3 + s[i * 4 + 1] * .59 + s[i * 4 + 2] * .11) / 255;
    const [n, nx] = canvas(w, h), img = nx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      const l = Hh[y * w + (x - 1 + w) % w], r = Hh[y * w + (x + 1) % w], u = Hh[((y - 1 + h) % h) * w + x], b = Hh[((y + 1) % h) * w + x];
      const dx = (l - r) * k, dy = (b - u) * k, il = 1 / Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
      d[i] = (dx * il * .5 + .5) * 255; d[i + 1] = (dy * il * .5 + .5) * 255; d[i + 2] = (il * .5 + .5) * 255; d[i + 3] = 255;
    }
    nx.putImageData(img, 0, 0); return n;
  }
  function grain(x, w, h, amt){
    const img = x.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4){ const n = (rnd() - .5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    x.putImageData(img, 0, 0);
  }
  function leafPath(x, l, w, ox = 0, oy = 0){
    x.beginPath(); x.moveTo(-l / 2 + ox, oy);
    x.bezierCurveTo(-l * .2 + ox, -w * 1.1 + oy, l * .3 + ox, -w * .7 + oy, l / 2 + ox, oy);
    x.bezierCurveTo(l * .3 + ox, w * .7 + oy, -l * .2 + ox, w * 1.1 + oy, -l / 2 + ox, oy);
  }
  // copie aux bords pour que la texture se répète sans couture
  function tiled(W, H, X, Y, m, fn){
    for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]){
      const px = X + ox, py = Y + oy;
      if (px < -m || px > W + m || py < -m || py > H + m) continue;
      fn(px, py);
    }
  }

  function barkCanvas(){
    const W = 512, H = 1024, [c, x] = canvas(W, H);
    x.fillStyle = '#4c463f'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++){ const bx = rand(0, W), bw = rand(8, 70); x.fillStyle = `hsla(${rand(22, 48)},${rand(4, 16)}%,${rand(20, 44)}%,.28)`; for (const o of [-W, 0, W]) x.fillRect(bx + o, 0, bw, H); }
    const stroke = (pts, lw, col) => {
      x.strokeStyle = col; x.lineWidth = lw; x.lineCap = x.lineJoin = 'round';
      for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]){ x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0] + ox, p[1] + oy) : x.moveTo(p[0] + ox, p[1] + oy)); x.stroke(); }
    };
    const crack = (len, amp) => { const pts = []; let xx = rand(0, W); const y0 = rand(0, H); for (let y = 0; y <= len; y += 6){ xx += rand(-amp, amp); pts.push([xx, y0 + y]); } return pts; };
    for (let i = 0; i < 120; i++){ const p = crack(rand(120, 520), 2.2); stroke(p, rand(6, 14), `rgba(160,150,135,${rand(.1, .24)})`); }
    for (let i = 0; i < 190; i++){ const p = crack(rand(80, 480), 2.6); stroke(p, rand(2, 6), `rgba(16,12,9,${rand(.45, .85)})`); stroke(p.map(q => [q[0] + 2.2, q[1]]), 1.2, 'rgba(190,180,165,.16)'); }
    for (let i = 0; i < 170; i++){ const px = rand(0, W), py = rand(0, H), l = rand(8, 26); stroke([[px, py], [px + l * .5, py + rand(-4, 4)], [px + l, py + rand(-3, 3)]], rand(1.5, 3), 'rgba(18,14,10,.5)'); }
    for (let i = 0; i < 80; i++){
      const px = rand(0, W), py = rand(0, H), r = rand(4, 24), grey = rnd() < .6;
      for (let k = 0; k < 34; k++){
        const a = rand(0, 6.28), d = r * Math.sqrt(rnd());
        x.fillStyle = grey ? `rgba(${rand(125, 160) | 0},${rand(140, 165) | 0},${rand(110, 130) | 0},${rand(.15, .4)})` : `rgba(90,112,48,${rand(.2, .45)})`;
        x.beginPath(); x.arc(px + Math.cos(a) * d, py + Math.sin(a) * d, rand(1, 3.5), 0, 7); x.fill();
      }
    }
    grain(x, W, H, 22);
    return c;
  }

  function groundCanvas(S){
    const [c, x] = canvas(S, S), k = S / 1024;
    x.fillStyle = '#33271c'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 500; i++){ const X = rand(0, S), Y = rand(0, S), r = rand(10, 70) * k; x.fillStyle = `rgba(${rand(20, 75) | 0},${rand(14, 52) | 0},${rand(8, 30) | 0},.3)`; tiled(S, S, X, Y, r, (a, b) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }); }
    for (let i = 0; i < 9000; i++){ x.fillStyle = `rgba(${rand(10, 90) | 0},${rand(8, 70) | 0},${rand(5, 45) | 0},.6)`; x.fillRect(rand(0, S), rand(0, S), rand(1, 2.5) * k, rand(1, 2.5) * k); }
    // brindilles
    for (let i = 0; i < 110; i++){
      const X = rand(0, S), Y = rand(0, S), a = rand(0, 6.28), l = rand(30, 140) * k, w = rand(1.4, 4) * k;
      tiled(S, S, X, Y, l, (px, py) => {
        x.strokeStyle = 'rgba(12,8,5,.5)'; x.lineWidth = w + 1.5 * k; x.beginPath(); x.moveTo(px + k, py + 2 * k); x.lineTo(px + Math.cos(a) * l + k, py + Math.sin(a) * l + 2 * k); x.stroke();
        x.strokeStyle = `rgb(${rand(70, 110) | 0},${rand(52, 78) | 0},${rand(34, 50) | 0})`; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
      });
    }
    // feuilles mortes : vieilles et sombres dessous, récentes et dorées dessus
    const pal = [[104, 70, 40], [133, 92, 50], [160, 114, 62], [88, 62, 38], [120, 100, 58], [145, 108, 64], [74, 55, 36], [172, 134, 82], [112, 78, 44], [150, 92, 45]];
    const N = 3400;
    for (let i = 0; i < N; i++){
      const old = i < N * .55, X = rand(0, S), Y = rand(0, S), l = rand(13, 36) * k, w = l * rand(.26, .42), a = rand(0, 6.28);
      const c0 = pal[Math.floor(rnd() * pal.length)], j = old ? rand(.45, .75) : rand(.8, 1.15);
      const col = `rgb(${c0[0] * j | 0},${c0[1] * j | 0},${c0[2] * j | 0})`, dark = `rgb(${c0[0] * j * .72 | 0},${c0[1] * j * .7 | 0},${c0[2] * j * .66 | 0})`;
      tiled(S, S, X, Y, l, (px, py) => {
        x.save(); x.translate(px, py); x.rotate(a);
        x.fillStyle = 'rgba(8,5,2,.42)'; leafPath(x, l, w, 1.6 * k, 2.4 * k); x.fill();
        const g = x.createLinearGradient(0, -w, 0, w); g.addColorStop(0, col); g.addColorStop(1, dark);
        x.fillStyle = g; leafPath(x, l, w); x.fill();
        x.strokeStyle = 'rgba(40,24,10,.42)'; x.lineWidth = .9 * k; x.beginPath(); x.moveTo(-l / 2, 0); x.lineTo(l / 2 + 3 * k, 0); x.stroke();
        x.lineWidth = .5 * k; for (let v = -.3; v <= .31; v += .15){ x.beginPath(); x.moveTo(l * v, 0); x.lineTo(l * v + l * .12, -w * .55); x.moveTo(l * v, 0); x.lineTo(l * v + l * .12, w * .55); x.stroke(); }
        x.restore();
      });
    }
    // touffes de mousse
    for (let i = 0; i < 34; i++){
      const X = rand(0, S), Y = rand(0, S), r = rand(18, 70) * k;
      for (let q = 0; q < 240; q++){
        const a = rand(0, 6.28), d = r * Math.sqrt(rnd());
        x.fillStyle = `hsl(${rand(72, 98) | 0},${rand(35, 60) | 0}%,${rand(16, 34) | 0}%)`;
        tiled(S, S, X + Math.cos(a) * d, Y + Math.sin(a) * d, 4, (px, py) => { x.beginPath(); x.arc(px, py, rand(.8, 2.2) * k, 0, 7); x.fill(); });
      }
    }
    grain(x, S, S, 16);
    return c;
  }

  function fernCanvas(){
    const W = 256, H = 512, [c, x] = canvas(W, H), cx = W / 2, N = 30;
    x.lineCap = 'round';
    for (let i = 0; i < N; i++){
      const t = i / N, y = H - 10 - t * (H - 24);
      const len = 116 * Math.pow(1 - t, .6) * Math.min(1, .45 + t * 4), ang = lerp(.18, .5, t);
      for (const s of [-1, 1]){
        const dx = Math.cos(ang) * s, dy = -Math.sin(ang), n = Math.max(3, Math.floor(len / 6.5));
        for (let m = 0; m < n; m++){
          const u = (m + .5) / n, px = cx + dx * len * u, py = y + dy * len * u + u * u * len * .14;
          const sz = Math.max(1.6, (1 - u * .75) * len * .11 + 1.5);
          x.fillStyle = `hsl(${rand(80, 98) | 0},${rand(38, 54) | 0}%,${(rand(22, 34) + (1 - t) * 5 - u * 4) | 0}%)`;
          for (const side of [-1, 1]){
            x.save(); x.translate(px - dy * side * sz * .8, py + dx * side * sz * .8); x.rotate(Math.atan2(dy, dx) + side * .85 * s);
            x.beginPath(); x.ellipse(sz * .3, 0, sz, sz * .46, 0, 0, 7); x.fill(); x.restore();
          }
        }
        x.strokeStyle = 'rgba(66,86,34,.9)'; x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(cx, y); for (let u = .1; u <= 1.001; u += .1) x.lineTo(cx + dx * len * u, y + dy * len * u + u * u * len * .14); x.stroke();
      }
    }
    x.strokeStyle = '#4b5a24'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(cx, H); x.lineTo(cx, 10); x.stroke();
    return c;
  }

  // rameau feuillu (hêtre) : brindilles, feuilles alternes, lumière variable d'une feuille à l'autre
  // touffe d'herbe : brins effilés, serrés au pied et libres en haut, pour garder une silhouette de touffe
  // même dans les petites mip-maps (sinon, de loin, la carte devient un pavé gris)
  function grassCanvas(){
    const W = 256, H = 256, [c, x] = canvas(W, H);
    for (let i = 0; i < 80; i++){
      const bx = W / 2 + (rnd() + rnd() + rnd() - 1.5) * 70, h = rand(.35, 1) * H * .94, lean = rand(-55, 55), w = rand(3, 6.5);
      const tx = bx + lean, ty = H - h, mx = bx + lean * .3, my = H - h * .55, hue = rand(68, 96) | 0, sat = rand(30, 50) | 0;
      const g = x.createLinearGradient(0, H, 0, ty);
      g.addColorStop(0, `hsl(${hue},${sat}%,12%)`); g.addColorStop(1, `hsl(${hue - 6},${sat + 10}%,${rand(36, 50) | 0}%)`);
      x.fillStyle = g; x.beginPath(); x.moveTo(bx - w / 2, H);
      x.quadraticCurveTo(mx - w * .3, my, tx, ty); x.quadraticCurveTo(mx + w * .3, my, bx + w / 2, H); x.fill();
    }
    return c;
  }
  function foliageCanvas(){
    const S = 512, [c, x] = canvas(S, S), cx = S / 2, cy = S / 2;
    x.lineCap = 'round';
    const leaf = (px, py, a, l) => {
      const w = l * rand(.3, .38), L = rand(28, 50), sat = rand(38, 62) | 0, hue = rand(78, 102) | 0;
      x.save(); x.translate(px, py); x.rotate(a);
      const g = x.createLinearGradient(0, -w, 0, w);
      g.addColorStop(0, `hsl(${hue},${sat}%,${L}%)`); g.addColorStop(1, `hsl(${hue + 6},${sat}%,${L * .62}%)`);
      x.fillStyle = g; leafPath(x, l, w, l / 2); x.fill();
      x.strokeStyle = `hsla(${hue},40%,${Math.min(80, L + 18)}%,.55)`; x.lineWidth = .8;
      x.beginPath(); x.moveTo(0, 0); x.lineTo(l * .95, 0); x.stroke();
      x.restore();
    };
    const twigs = [];
    for (let i = 0; i < 11; i++){
      const a0 = i / 11 * 6.28 + rand(-.25, .25), len = rand(130, 215), pts = [[cx + rand(-30, 30), cy + rand(-30, 30)]];
      let a = a0;
      for (let s = 1; s <= 8; s++){ a += rand(-.18, .18); const p = pts[s - 1]; pts.push([p[0] + Math.cos(a) * len / 8, p[1] + Math.sin(a) * len / 8]); }
      twigs.push(pts);
      x.strokeStyle = 'rgba(58,44,30,.95)';
      pts.forEach((p, s) => { if (!s) return; x.lineWidth = lerp(3.2, .8, s / 8); x.beginPath(); x.moveTo(pts[s - 1][0], pts[s - 1][1]); x.lineTo(p[0], p[1]); x.stroke(); });
    }
    for (const pts of twigs) for (let s = 1; s <= 8; s++){
      const p = pts[s], q = pts[s - 1], a = Math.atan2(p[1] - q[1], p[0] - q[0]), side = s % 2 ? 1 : -1;
      leaf(p[0], p[1], a + side * rand(.55, 1.05), rand(30, 46) * (1 - s / 16));
      if (s === 8) leaf(p[0], p[1], a + rand(-.2, .2), rand(32, 42));
    }
    for (let i = 0; i < 70; i++){ const a = rand(0, 6.28), d = rand(0, 120); leaf(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rand(0, 6.28), rand(26, 40)); }
    return c;
  }

  function leafCanvas(){
    const [c, x] = canvas(128, 256);
    x.translate(64, 128); x.rotate(-Math.PI / 2);
    const l = 232, w = 50;
    const g = x.createLinearGradient(-l / 2, 0, l / 2, 0); g.addColorStop(0, '#d8bd8c'); g.addColorStop(1, '#e6d2a8');
    x.fillStyle = g; leafPath(x, l, w); x.fill();
    for (let i = 0; i < 26; i++){ x.fillStyle = `rgba(90,55,25,${rand(.08, .25)})`; x.beginPath(); x.arc(rand(-l * .4, l * .4), rand(-w * .6, w * .6), rand(2, 9), 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(95,60,30,.55)'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(-l / 2 - 18, 0); x.lineTo(l / 2 - 6, 0); x.stroke();
    x.lineWidth = 1.2;
    for (let v = -.36; v <= .36; v += .09){ x.beginPath(); x.moveTo(l * v, 0); x.quadraticCurveTo(l * v + 16, -w * .4, l * v + 30, -w * .8); x.moveTo(l * v, 0); x.quadraticCurveTo(l * v + 16, w * .4, l * v + 30, w * .8); x.stroke(); }
    x.globalCompositeOperation = 'source-atop'; x.strokeStyle = 'rgba(80,45,20,.5)'; x.lineWidth = 7; leafPath(x, l, w); x.stroke();
    return c;
  }

  function capCanvas(){ // x : tour du chapeau · y : du bord (haut) vers le centre (bas)
    const W = 512, H = 256, [c, x] = canvas(W, H);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#caa877'); g.addColorStop(.1, '#a97f4d'); g.addColorStop(.45, '#7b5231'); g.addColorStop(.85, '#553520'); g.addColorStop(1, '#42281a');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++){ const X = rand(0, W), Y = rand(0, H), r = rand(6, 30); x.fillStyle = `rgba(${rnd() < .5 ? '60,35,18' : '190,150,105'},.07)`; for (const o of [-W, 0, W]){ x.beginPath(); x.ellipse(X + o, Y, r * .5, r, 0, 0, 7); x.fill(); } }
    for (let i = 0; i < 1500; i++){ const X = rand(0, W), y0 = rand(-20, H), len = rand(20, 120); x.strokeStyle = rnd() < .55 ? `rgba(45,25,12,${rand(.08, .26)})` : `rgba(225,195,155,${rand(.05, .14)})`; x.lineWidth = rand(.5, 1.6); x.beginPath(); x.moveTo(X, y0); x.lineTo(X + rand(-2, 2), y0 + len); x.stroke(); }
    for (let i = 0; i < 90; i++){ const X = rand(0, W), Y = rand(H * .55, H); x.fillStyle = `rgba(48,27,13,${rand(.12, .28)})`; x.beginPath(); x.ellipse(X, Y, rand(1.5, 4), rand(1, 2.6), 0, 0, 7); x.fill(); }
    grain(x, W, H, 10);
    return c;
  }
  function stemCanvas(){ // y : de la base (haut) au sommet (bas)
    const [c, x] = canvas(256, 512);
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#7d6849'); g.addColorStop(.1, '#c4b394'); g.addColorStop(.35, '#e0d3bb'); g.addColorStop(1, '#ebe2d0');
    x.fillStyle = g; x.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 1100; i++){ const X = rand(0, 256), y0 = rand(-40, 512), len = rand(30, 160); x.strokeStyle = rnd() < .5 ? `rgba(120,95,60,${rand(.05, .16)})` : `rgba(255,250,240,${rand(.06, .18)})`; x.lineWidth = rand(.6, 1.8); x.beginPath(); x.moveTo(X, y0); x.lineTo(X + rand(-3, 3), y0 + len); x.stroke(); }
    for (let i = 0; i < 90; i++){ x.fillStyle = `rgba(70,50,30,${rand(.2, .5)})`; x.beginPath(); x.arc(rand(0, 256), rand(0, 70), rand(1, 4), 0, 7); x.fill(); }
    grain(x, 256, 512, 8);
    return c;
  }
  function mossCanvas(){
    const S = 512, [c, x] = canvas(S, S);
    x.fillStyle = '#2f421b'; x.fillRect(0, 0, S, S); x.lineCap = 'round';
    for (let i = 0; i < 17000; i++){
      const X = rand(0, S), Y = rand(0, S), a = rand(0, 6.28), l = rand(2, 6);
      x.strokeStyle = `hsl(${rand(70, 100) | 0},${rand(40, 65) | 0}%,${rand(16, 44) | 0}%)`; x.lineWidth = rand(.8, 1.6);
      x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); x.stroke();
    }
    for (let i = 0; i < 1500; i++){ x.fillStyle = `hsla(${rand(66, 84) | 0},70%,${rand(45, 62) | 0}%,.8)`; x.beginPath(); x.arc(rand(0, S), rand(0, S), rand(.6, 1.3), 0, 7); x.fill(); }
    return c;
  }

  progress(.1); await breathe();
  const barkC = barkCanvas(); progress(.18); await breathe();
  const groundC = groundCanvas(mobile ? 1024 : 2048); progress(.34); await breathe();
  const barkT = tex(barkC), barkN = tex(normalMap(barkC, 5), 1, 1, false);
  const groundT = tex(groundC), groundN = tex(normalMap(groundC, 4), 1, 1, false);
  progress(.46); await breathe();
  const fernT = tex(fernCanvas()), foliageT = tex(foliageCanvas()), leafT = tex(leafCanvas()), grassT = tex(grassCanvas());
  const capC = capCanvas(), capT = tex(capC, 1, 1, true, false), capN = tex(normalMap(capC, 2), 1, 1, false, false);
  const stemT = tex(stemCanvas(), 1, 1, true, false);
  const mossC = mossCanvas(), mossT = tex(mossC, 3, 2), mossN = tex(normalMap(mossC, 3), 3, 2, false);
  progress(.56); await breathe();

  /* ============================================================
     Scène 1 : la forêt
     ============================================================ */
  const forest = new THREE.Scene();
  const FOG = new Col('#8b9787'), MIST = new Col('#b7bcaa');
  forest.fog = new THREE.FogExp2(FOG, .028); forest.background = FOG;
  const SUN = new V3(-.36, .47, -1).normalize();                 // vers le soleil : devant, bas, à gauche → contre-jour
  const SUN_SCAT = new Col(1, .74, .45).multiplyScalar(1.05);
  const cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .05, 400);

  const hemi = new THREE.HemisphereLight('#c2cfcb', '#3e3324', 1.25); forest.add(hemi);
  const sun = new THREE.DirectionalLight('#ffdcaa', 3.6);
  // le soleil ne bouge pas : une seule carte d'ombres, calculée une fois pour toute la forêt
  const SM = Math.min(mobile ? 2048 : 4096, renderer.capabilities.maxTextureSize);
  sun.castShadow = true; sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -.0003; sun.shadow.normalBias = .012;
  forest.add(sun, sun.target);

  // ciel : dégradé + halo du soleil, raccord avec le brouillard
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new Col('#a7b6b3') }, uHor: { value: FOG }, uSunDir: FOGU.uSunDir, uSunCol: FOGU.uSunCol },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uTop, uHor, uSunDir, uSunCol; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); vec3 c = mix(uHor, uTop, pow(clamp(d.y, 0., 1.), .7));
        float s = max(dot(d, uSunDir), 0.); c += uSunCol * (pow(s, 6.) * .45 + pow(s, 40.) * .9 + pow(s, 900.) * 5.);
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.frustumCulled = false; sky.renderOrder = -1; forest.add(sky);

  /* ---------- sol ---------- */
  const M = new V3(.4, 0, -60);   // pied du champignon principal
  const groundH = (x, z) => {
    const h = (fbm(x * .045, z * .045, 1.7, 4) - .5) * 2.2 + (noise(x * .35, z * .35, 5.1) - .5) * .12;
    return h * sstep(1.2, 6, Math.hypot(x - M.x, z - M.z));
  };
  {
    const seg = mobile ? 150 : 250, g = new THREE.PlaneGeometry(170, 175, seg, seg);
    g.rotateX(-Math.PI / 2); g.translate(0, 0, -35);
    const P = g.attributes.position, UV = g.attributes.uv, col = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++){
      const x = P.getX(i), z = P.getZ(i);
      P.setY(i, groundH(x, z)); UV.setXY(i, x / 3.4, -z / 3.4);
      const moss = sstep(.52, .72, fbm(x * .07 + 3, z * .07, 2, 3)), d = .78 + .4 * fbm(x * .22, z * .22, 9, 2);
      col[i * 3] = d * lerp(1, .62, moss); col[i * 3 + 1] = d * lerp(1, .9, moss); col[i * 3 + 2] = d * lerp(1, .42, moss);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const ground = new THREE.Mesh(g, std({ map: groundT, normalMap: groundN, normalScale: new THREE.Vector2(1.3, 1.3), roughness: .95, vertexColors: true }));
    ground.receiveShadow = true; forest.add(ground);
  }

  /* ---------- trajet caméra (défilement → position) ---------- */
  const G = (x, h, z) => new V3(x, groundH(x, z) + h, z);
  const Mv = (dx, dy, dz) => new V3(M.x + dx, M.y + dy, M.z + dz);
  // on arrive sur le champignon par le haut : on monte au-dessus du chapeau, on le survole, puis on plonge par le sommet
  const KEYS = [
    [0,    G(0, 1.7, 13),        G(.3, 2.5, 0)],
    [.058, G(.4, 1.7, 4),        G(0, 2.4, -10)],
    [.136, G(-.6, 1.65, -8),     G(.4, 1.7, -22)],
    [.22,  G(.8, 1.5, -21),      G(-.2, 1.2, -34)],
    [.296, G(-.3, 1.2, -33),     Mv(0, .6, 0)],
    [.432, Mv(.35, .75, 6),      Mv(0, .15, 0)],
    [.49,  Mv(.16, .44, 1.5),    Mv(0, .15, 0)],      // on approche en restant au-dessus du chapeau
    [.535, Mv(.07, .37, .5),     Mv(.01, .18, 0)],
    [.568, Mv(.025, .33, .14),   Mv(.01, .2, 0)],     // survol : le chapeau vu d'en haut
    [.597, Mv(.012, .265, .03),  Mv(.01, .1, 0)],     // plongée par le sommet
    [.625, Mv(.01, .205, .006),  Mv(.01, -.1, 0)]
  ];
  const posC = new THREE.CatmullRomCurve3(KEYS.map(k => k[1]), false, 'centripetal');
  const lookC = new THREE.CatmullRomCurve3(KEYS.map(k => k[2]), false, 'centripetal');
  function keyU(p, K = KEYS){
    const n = K.length;
    if (p <= 0) return 0;
    if (p >= K[n - 1][0]) return 1;
    let i = 0; while (p > K[i + 1][0]) i++;
    return (i + (p - K[i][0]) / (K[i + 1][0] - K[i][0])) / (n - 1);
  }
  const pathPts = posC.getPoints(500);
  // distance au chemin : points triés par z, on ne regarde que ceux assez proches en z (appelée ~100 000 fois au chargement)
  const pathZ = pathPts.map(q => [q.z, q.x]).sort((a, b) => a[0] - b[0]);
  const distPath = (x, z) => {
    let lo = 0, hi = pathZ.length - 1, d = Infinity;
    while (lo < hi){ const m = (lo + hi) >> 1; if (pathZ[m][0] < z) lo = m + 1; else hi = m; }
    for (let i = lo; i < pathZ.length; i++){ const dz = pathZ[i][0] - z; if (dz * dz >= d) break; const e = (pathZ[i][1] - x) ** 2 + dz * dz; if (e < d) d = e; }
    for (let i = lo - 1; i >= 0; i--){ const dz = z - pathZ[i][0]; if (dz * dz >= d) break; const e = (pathZ[i][1] - x) ** 2 + dz * dz; if (e < d) d = e; }
    return Math.sqrt(d);
  };

  /* ---------- colonnes de lumière (et trouées correspondantes dans la canopée) ---------- */
  const shafts = [[M.x - .1, M.z + .25, .45]];
  for (const z of [-3, -11, -17, -26, -35, -44, -52]) shafts.push([rand(-4.5, 4.5), z + rand(-2, 2), rand(.7, 1.5)]);
  for (let i = 0; i < 9; i++) shafts.push([rand(-18, 18), rand(-75, 5), rand(.8, 2)]);
  const shaftLine = shafts.map(s => ({ g: new V3(s[0], groundH(s[0], s[1]), s[1]), r: s[2] }));
  const distShaft = q => { let d = 1e9; const v = new V3(); for (const s of shaftLine){ v.copy(q).sub(s.g); const a = v.dot(SUN); v.addScaledVector(SUN, -a); d = Math.min(d, v.length() - s.r); } return d; };

  /* ---------- arbres ---------- */
  function trunkGeo(r0, h, s, log = false){
    const g = new THREE.CylinderGeometry(1, 1, 1, 22, log ? 30 : 46, true);
    const P = g.attributes.position, UV = g.attributes.uv, n = P.count, col = new Float32Array(n * 3), moss = new Float32Array(n);
    const roots = 4 + s % 3, ph = s * 1.7, lx = Math.sin(s * 3.1) * .6, lz = Math.cos(s * 2.3) * .6, md = s * 2.1;
    const ku = Math.max(2, Math.round(2 * Math.PI * r0 / .5));
    for (let i = 0; i < n; i++){
      const t = P.getY(i) + .5, a = Math.atan2(P.getX(i), P.getZ(i)), ca = Math.cos(a), sa = Math.sin(a);
      const hh = log ? t * h : Math.pow(t, 1.7) * h - .45, hc = Math.max(hh, 0);
      const rp = Math.pow(.5 + .5 * Math.cos(roots * a + ph), 3);
      const flare = log ? 1 : 1 + Math.exp(-hc / .5) * (.25 + 1.25 * rp) + Math.exp(-hc / 3) * .1;
      const bump = 1 + (noise(ca * 1.4 + s * 7, sa * 1.4, hh * .7) - .5) * .18;
      const r = r0 * (log ? 1 - .2 * t : 1 - .5 * hc / h) * flare * bump;
      const bend = log ? 0 : Math.pow(hc / h, 2) * 2.4;
      P.setXYZ(i, sa * r + lx * bend, hh, ca * r + lz * bend);
      UV.setXY(i, UV.getX(i) * ku, hh / 1.25);
      const v = .8 + .35 * noise(ca * 1.5 + s, sa * 1.5 + hh * .25, 3);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v;
      moss[i] = log ? 0 : clamp(1.15 - hc / 1.7 + (noise(ca * 2.2, sa * 2.2 + hh * 1.3, s) - .5) * 1.1) * (.45 + .55 * (.5 + .5 * Math.cos(a - md)));
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aMoss', new THREE.BufferAttribute(moss, 1));
    g.computeVertexNormals();
    g.userData = { lx, lz, h, r0 };
    return g;
  }
  const MOSS = {
    key: 'bark', uniforms: { uMossCol: { value: new Col('#5a7a28') } },
    vPre: 'attribute float aMoss; varying float vMoss;', v: 'vMoss = aMoss;',
    fPre: 'uniform vec3 uMossCol; varying float vMoss;',
    f: 'diffuseColor.rgb = mix(diffuseColor.rgb, uMossCol * (.4 + 3.2 * diffuseColor.g), smoothstep(.2, .75, vMoss));'
  };
  const barkMat = std({ map: barkT, normalMap: barkN, normalScale: new THREE.Vector2(1.8, 1.8), roughness: .93, vertexColors: true }, MOSS);
  const logMat = std({ map: barkT, normalMap: barkN, normalScale: new THREE.Vector2(1.8, 1.8), roughness: .95, vertexColors: true, side: THREE.DoubleSide }, { ...MOSS, key: 'bark2' });

  const trees = [{ x: M.x + 1.25, z: M.z - 1.15, r: .62, hero: true }];
  for (let n = 0; n < 9000 && trees.length < (mobile ? 150 : 230); n++){
    const x = rand(-48, 48), z = rand(-118, 30), r = rand(.22, .52);
    if (distPath(x, z) < 1.8 + r * 2.2) continue;
    if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < (2.3 + (t.r + r) * 3) ** 2)) continue;
    trees.push({ x, z, r, v: trees.length % 3, rot: rand(0, 6.28), sy: rand(.9, 1.1) });
  }
  progress(.62); await breathe();

  /* ---------- houppiers : branches + rameaux feuillus ---------- */
  const branchMat = std({ map: barkT, normalMap: barkN, roughness: .9, color: '#c2b8ac' }, { key: 'branch' });
  const crownMat = std({ map: foliageT, alphaTest: .45, alphaToCoverage: a2c, side: THREE.DoubleSide, roughness: .7, emissive: '#4a6a18', emissiveMap: foliageT, emissiveIntensity: .3 }, LEAF('crown'));
  const crownDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: foliageT, alphaTest: .45 });
  const up = new V3(0, 1, 0), tq = new THREE.Quaternion(), te = new THREE.Euler();
  function cyl(a, b, r1, r2){
    const d = new V3().subVectors(b, a), L = d.length();
    const g = new THREE.CylinderGeometry(r2, r1, L, 5, 1, true);
    g.translate(0, L / 2, 0); g.applyQuaternion(tq.setFromUnitVectors(up, d.normalize())); g.translate(a.x, a.y, a.z);
    return g;
  }
  function crown(o){
    const bark = [], leaves = [];
    const axis = hh => { const k = Math.pow(clamp(hh / o.h), 2) * 2.4; return new V3(o.lx * k, hh, o.lz * k); };
    const card = (p, s, c) => {
      const g = new THREE.PlaneGeometry(1, 1);
      te.set(rand(-1.2, 1.2) - Math.PI / 2 * rnd(), rand(0, 6.28), rand(-1, 1)); g.scale(s, s, s); g.applyQuaternion(tq.setFromEuler(te)); g.translate(p.x, p.y, p.z);
      // normales « sphériques » depuis le cœur de la grappe : volume doux plutôt que plans visibles
      const P = g.attributes.position, N = g.attributes.normal, v = new V3();
      for (let i = 0; i < P.count; i++){ v.set(P.getX(i) - c.x, P.getY(i) - c.y + s * .5, P.getZ(i) - c.z).normalize(); N.setXYZ(i, v.x, v.y, v.z); }
      leaves.push(g);
    };
    // grappe de feuilles accrochée au bout d'un rameau
    const cluster = (tip, n, s) => { for (let k = 0; k < n; k++) card(tip.clone().add(new V3(rand(-1, 1), rand(-.5, .7), rand(-1, 1)).multiplyScalar(s * .32)), rand(s * .75, s * 1.1), tip); };
    const twig = (from, dir, len, r, n, s) => {
      const d = dir.clone().add(new V3(rand(-.45, .45), rand(.05, .55), rand(-.45, .45))).normalize();
      const mid = from.clone().addScaledVector(d, len * .55); mid.y -= len * .06;
      const tip = mid.clone().addScaledVector(d.clone().add(new V3(0, .25, 0)).normalize(), len * .45);
      bark.push(cyl(from, mid, r, r * .6), cyl(mid, tip, r * .6, r * .25));
      cluster(tip, n, s); card(mid, rand(s * .6, s * .85), mid);
    };
    if (o.trunk) for (let k = 0; k < 6; k++) bark.push(cyl(axis(o.h * k / 6 - (k ? 0 : .2)), axis(o.h * (k + 1) / 6), o.r0 * (1 - .6 * k / 6), o.r0 * (1 - .6 * (k + 1) / 6)));
    for (let i = 0; i < o.nb; i++){
      const f = i / Math.max(1, o.nb - 1), hb = lerp(o.start, o.h * .9, Math.pow(f, .85)) + rand(-.3, .3);
      const base = axis(hb), az = i * 2.39996 + rand(-.4, .4), L = lerp(o.len0, o.len1, f) * rand(.8, 1.2), pitch = lerp(.35, .85, f) + rand(-.15, .15);
      const dir = new V3(Math.cos(az) * Math.cos(pitch), Math.sin(pitch), Math.sin(az) * Math.cos(pitch));
      const rt = Math.max(.02, o.r0 * (1 - .5 * hb / o.h) * .55);
      const p1 = base.clone().addScaledVector(dir, L * .55); p1.y -= L * .05;
      const d2 = dir.clone(); d2.y += .45; d2.x += rand(-.3, .3); d2.z += rand(-.3, .3); d2.normalize();
      const p2 = p1.clone().addScaledVector(d2, L * .45);
      bark.push(cyl(base, p1, rt, rt * .55), cyl(p1, p2, rt * .55, rt * .18));
      for (let k = 0; k < o.twigs; k++){
        const t = rand(.15, 1), from = t < .5 ? base.clone().lerp(p1, .4 + t) : p1.clone().lerp(p2, t);
        twig(from, t < .5 ? dir : d2, L * rand(.25, .42), rt * .3, o.cards, o.leafS);
      }
      cluster(p2, o.cards + 1, o.leafS);
    }
    const top = axis(o.h * .97);
    for (let k = 0; k < 5; k++) twig(axis(o.h * rand(.86, .95)), new V3(rand(-1, 1), 1.2, rand(-1, 1)).normalize(), o.len1 * rand(.5, .8), o.r0 * .12, o.cards, o.leafS);
    cluster(top, o.cards + 2, o.leafS);
    return { bark: mergeGeos(bark), leaves: mergeGeos(leaves) };
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new V3(), yAxis4 = new V3(0, 1, 0), leafTint = new Col();
  // un arbre = tronc + branches + feuillage, partagés par instances (3 variantes)
  function plant(list, parts, withTrunk){
    for (const [geo, mat, depth] of parts){
      if (!geo) continue;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((t, i) => {
        q4.setFromAxisAngle(yAxis4, t.rot); s4.set(t.s, t.sy, t.s);
        im.setMatrixAt(i, m4.compose(new V3(t.x, groundH(t.x, t.z), t.z), q4, s4));
        if (mat === crownMat) im.setColorAt(i, leafTint.setHSL(rand(.2, .27), rand(.35, .55), rand(.45, .62)));
      });
      im.castShadow = true; im.receiveShadow = mat !== crownMat;
      if (depth) im.customDepthMaterial = depth;
      im.computeBoundingSphere(); forest.add(im);
    }
  }
  const BIG = { start: 5.5, nb: mobile ? 8 : 11, len0: 5.2, len1: 2.2, cards: mobile ? 3 : 4, twigs: mobile ? 3 : 4, leafS: 1.45 };
  {
    const heroG = trunkGeo(.6, 30, 7), hc = crown({ ...heroG.userData, ...BIG, r0: .6, nb: 13 });
    const hero = { x: trees[0].x, z: trees[0].z, rot: 2.2, s: 1, sy: 1 };
    plant([hero], [[heroG, barkMat], [hc.bark, branchMat], [hc.leaves, crownMat, crownDepth]]);
    [trunkGeo(.34, 26, 1), trunkGeo(.34, 29, 2), trunkGeo(.34, 24, 3)].forEach((g, v) => {
      const c = crown({ ...g.userData, ...BIG });
      const list = trees.filter(t => !t.hero && t.v === v).map(t => ({ ...t, s: t.r / .34 }));
      plant(list, [[g, barkMat], [c.bark, branchMat], [c.leaves, crownMat, crownDepth]]);
    });
  }
  progress(.68); await breathe();
  // jeunes arbres du sous-bois : du feuillage à hauteur d'yeux
  {
    const saps = [];
    for (let n = 0; n < 6000 && saps.length < (mobile ? 60 : 140); n++){
      const x = rand(-30, 30), z = rand(-95, 24);
      if (distPath(x, z) < 2.6 || Math.hypot(x - M.x, z - M.z) < 2.5) continue;
      if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < (t.r * 3 + .8) ** 2)) continue;
      if (saps.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 1.6)) continue;
      saps.push({ x, z, v: saps.length % 2, rot: rand(0, 6.28), s: rand(.75, 1.25), sy: rand(.8, 1.2) });
    }
    [0, 1].forEach(v => {
      const c = crown({ h: v ? 4.6 : 3.4, r0: .05, lx: rand(-.3, .3), lz: rand(-.3, .3), trunk: true, start: 1.1, nb: 7, len0: 1.5, len1: .6, cards: 3, twigs: 2, leafS: .8 });
      plant(saps.filter(t => t.v === v), [[c.bark, branchMat], [c.leaves, crownMat, crownDepth]]);
    });
  }
  // troncs couchés
  {
    let made = 0;
    for (let n = 0; n < 400 && made < 5; n++){
      const x = rand(-9, 9), z = rand(-56, 6), a = rand(0, 6.28), L = rand(4, 8), r0 = rand(.2, .34);
      const x2 = x - Math.cos(a) * L, z2 = z + Math.sin(a) * L;
      if (distPath(x, z) < 2 || distPath(x2, z2) < 2 || distPath((x + x2) / 2, (z + z2) / 2) < 2) continue;
      if (trees.some(t => Math.hypot(t.x - (x + x2) / 2, t.z - (z + z2) / 2) < L * .5 + t.r * 2)) continue;
      const g = trunkGeo(r0, L, 11 + made, true); g.rotateZ(Math.PI / 2); g.computeVertexNormals();
      const P = g.attributes.position, N = g.attributes.normal, mo = g.attributes.aMoss;
      for (let i = 0; i < P.count; i++) mo.setX(i, clamp(N.getY(i) * 1.2 + .15 + (noise(P.getX(i) * 1.5, P.getZ(i) * 3, made) - .5) * .9));
      const log = new THREE.Mesh(g, logMat);
      log.position.set(x, lerp(groundH(x, z), groundH(x2, z2), .5) + r0 * .7, z); log.rotation.y = a;
      log.castShadow = log.receiveShadow = true; forest.add(log); made++;
    }
  }

  /* ---------- canopée haute, hors champ : tachète la lumière au sol ---------- */
  let hiCanopy;
  {
    const hiMat = std({ map: foliageT, alphaTest: .5, side: THREE.DoubleSide });
    hiMat.colorWrite = false; hiMat.depthWrite = false;
    const cards = [];
    for (const t of trees) for (let k = 0; k < 3; k++){
      const p = new V3(t.x + rand(-4, 4), rand(24, 34), t.z + rand(-4, 4));
      if (distShaft(p) < 2.4) continue;
      cards.push([p, rand(3, 5.5), rand(-.5, .5), rand(0, 6.28)]);
    }
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), hiMat, cards.length), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new V3();
    cards.forEach((c, i) => { e.set(-Math.PI / 2 + c[2], c[3], rand(-.4, .4), 'YXZ'); q.setFromEuler(e); s.setScalar(c[1]); im.setMatrixAt(i, m4.compose(c[0], q, s)); });
    im.castShadow = true; im.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: foliageT, alphaTest: .5 });
    im.computeBoundingSphere(); forest.add(im); hiCanopy = im;
  }

  /* ---------- fougères ---------- */
  // fusion en tableaux pré-alloués (plutôt que des push élément par élément)
  function mergeGeos(geos){
    const g = new THREE.BufferGeometry(), names = Object.keys(geos[0].attributes);
    let vc = 0, ic = 0; for (const q of geos){ vc += q.attributes.position.count; ic += q.index.count; }
    for (const n of names){
      const size = geos[0].attributes[n].itemSize, arr = new Float32Array(vc * size); let o = 0;
      for (const q of geos){ arr.set(q.attributes[n].array, o); o += q.attributes[n].array.length; }
      g.setAttribute(n, new THREE.BufferAttribute(arr, size));
    }
    const idx = vc < 65536 ? new Uint16Array(ic) : new Uint32Array(ic); let o = 0, base = 0;
    for (const q of geos){ const ix = q.index.array; for (let i = 0; i < ix.length; i++) idx[o++] = ix[i] + base; base += q.attributes.position.count; }
    g.setIndex(new THREE.BufferAttribute(idx, 1)); return g;
  }
  function frond(L, W, pitch, droop, yaw, roll){
    const g = new THREE.PlaneGeometry(1, 1, 2, 10), P = g.attributes.position;
    for (let i = 0; i < P.count; i++){
      const u = P.getX(i), s = (P.getY(i) + .5) * L;
      P.setXYZ(i, u * W, Math.sin(pitch) * s - droop * s * s - Math.abs(u) * W * .22, Math.cos(pitch) * s);
    }
    g.rotateZ(roll); g.rotateY(yaw); return g;
  }
  {
    const parts = [];
    for (let k = 0; k < 11; k++){
      const L = rand(.7, 1.1), pitch = rand(.85, 1.15);
      parts.push(frond(L, rand(.28, .36), pitch, Math.sin(pitch) / L * rand(.7, .88), k / 11 * 6.28 + rand(-.25, .25), rand(-.2, .2)));
    }
    const g = mergeGeos(parts); g.computeVertexNormals();
    const fernMat = std({ map: fernT, alphaTest: .5, alphaToCoverage: a2c, side: THREE.DoubleSide, roughness: .7, color: '#cfe0a8', emissive: '#4d6a1c', emissiveMap: fernT, emissiveIntensity: .7 }, LEAF('fern'));
    const list = [];
    for (let n = 0; n < 30000 && list.length < (mobile ? 420 : 950); n++){
      const x = rand(-32, 32), z = rand(-98, 24);
      if (fbm(x * .07, z * .07, 11, 3) < .47) continue;
      const dp = distPath(x, z); if (dp < .6 || Math.hypot(x - M.x, z - M.z) < 1.1) continue;
      if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < (t.r * 2.4) ** 2)) continue;
      list.push([x, z, rand(.9, 1.7) * (dp < 1.5 ? .75 : 1)]);
    }
    const im = new THREE.InstancedMesh(g, fernMat, list.length), m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new V3();
    list.forEach((f, i) => { e.set(rand(-.12, .12), rand(0, 6.28), rand(-.12, .12)); q.setFromEuler(e); s.setScalar(f[2]); im.setMatrixAt(i, m4.compose(new V3(f[0], groundH(f[0], f[1]) - .02, f[1]), q, s)); });
    im.castShadow = im.receiveShadow = true; im.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: fernT, alphaTest: .5 });
    im.computeBoundingSphere(); forest.add(im);
  }
  // touffes d'herbe : trois plans croisés, surtout au bord du chemin et dans les trouées de lumière
  {
    const parts = [0, 1, 2].map(k => { const g = new THREE.PlaneGeometry(.5, .4); g.translate(0, .19, 0); g.rotateY(k * Math.PI / 3); return g; });
    const g = mergeGeos(parts), P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) N.setXYZ(i, P.getX(i) * .6, 1, P.getZ(i) * .6);   // éclairage doux, comme une masse d'herbe
    g.attributes.normal.needsUpdate = true;
    const grassMat = std({ map: grassT, alphaTest: .4, alphaToCoverage: a2c, side: THREE.DoubleSide, roughness: .8, emissive: '#34501a', emissiveMap: grassT, emissiveIntensity: .28 }, { key: 'grass' });
    const list = [];
    for (let n = 0; n < 40000 && list.length < (mobile ? 700 : 1600); n++){
      const x = rand(-22, 22), z = rand(-80, 22), dp = distPath(x, z);
      if (dp < .45 || Math.hypot(x - M.x, z - M.z) < .7) continue;
      if (fbm(x * .11 + 4, z * .11, 6, 3) < .46 - (dp < 3 ? .08 : 0)) continue;
      list.push([x, z]);
    }
    const im = new THREE.InstancedMesh(g, grassMat, list.length), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new V3(), tint = new Col();
    list.forEach((l, i) => {
      e.set(0, rand(0, 6.28), 0); q.setFromEuler(e); const k = rand(.6, 1.5); s.set(k, k * rand(.7, 1.4), k);
      im.setMatrixAt(i, m4.compose(new V3(l[0], groundH(l[0], l[1]) - .01, l[1]), q, s)); im.setColorAt(i, tint.setHSL(rand(.17, .24), rand(.3, .45), rand(.4, .55)));
    });
    im.receiveShadow = true; im.computeBoundingSphere(); forest.add(im);
  }
  progress(.74); await breathe();

  /* ---------- feuilles au sol (en relief) et feuilles qui tombent ---------- */
  const leafG = new THREE.PlaneGeometry(.55, 1, 4, 6);
  {
    const P = leafG.attributes.position;
    for (let i = 0; i < P.count; i++){ const x = P.getX(i), y = P.getY(i); P.setZ(i, (x / .275) ** 2 * .07 + y * y * .1); }
    leafG.rotateX(-Math.PI / 2); leafG.computeVertexNormals();
  }
  const leafMat = std({ map: leafT, alphaTest: .5, alphaToCoverage: a2c, side: THREE.DoubleSide, roughness: .85 });
  const leafColor = () => new Col().setHSL(rand(.045, .11), rand(.45, .75), rand(.26, .5));
  {
    const list = [];
    for (let n = 0; n < 20000 && list.length < (mobile ? 1400 : 3000); n++){
      let x, z;
      if (rnd() < .5){ const a = rand(0, 6.28), d = Math.pow(rnd(), .7) * 2; x = M.x + Math.cos(a) * d; z = M.z + Math.sin(a) * d; }
      else { const q = pathPts[Math.floor(rnd() * 380)]; x = q.x + rand(-2.6, 2.6); z = q.z + rand(-2.6, 2.6); }
      if (Math.hypot(x - M.x, z - M.z) < .045) continue;
      list.push([x, z]);
    }
    const im = new THREE.InstancedMesh(leafG, leafMat, list.length), m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new V3();
    list.forEach((l, i) => {
      e.set(rand(-.15, .15), rand(0, 6.28), rand(-.15, .15)); q.setFromEuler(e); s.setScalar(rand(.06, .12));
      im.setMatrixAt(i, m4.compose(new V3(l[0], groundH(l[0], l[1]) + .004, l[1]), q, s)); im.setColorAt(i, leafColor());
    });
    im.receiveShadow = true; im.computeBoundingSphere(); forest.add(im);
  }
  const FALL = mobile ? 18 : 36, falling = new THREE.InstancedMesh(leafG, leafMat, FALL), fallState = [];
  for (let i = 0; i < FALL; i++){ fallState.push({ p: new V3(), ph: rand(0, 6.28), sp: rand(.35, .7), spin: rand(1, 3), live: false }); falling.setColorAt(i, leafColor()); }
  falling.frustumCulled = false; forest.add(falling);

  /* ---------- champignons ---------- */
  const stemMat = phys({ map: stemT, roughness: .72, sheen: .6, sheenColor: new Col('#fff6e6'), sheenRoughness: .5, color: '#fff' }, { key: 'stem' });
  const capMat = phys({ map: capT, normalMap: capN, normalScale: new THREE.Vector2(.8, .8), roughness: .42, clearcoat: .35, clearcoatRoughness: .4, side: THREE.DoubleSide }, { key: 'cap' });
  const underMat = std({ color: '#5a4431', roughness: .9, side: THREE.DoubleSide });
  const gillMat = std({ color: '#eadbbf', roughness: .75, side: THREE.DoubleSide, vertexColors: true, emissive: '#3a2e1c', emissiveIntensity: .15 });
  function mushroom(o){
    const { h, r, R, ch, bend = 0, sd = 1 } = o, grp = new THREE.Group();
    const sp = [];
    for (let i = 0; i <= 16; i++){ const t = i / 16; sp.push(new THREE.Vector2(r * (1 + .5 * Math.exp(-t * 8) - .15 * t) * (1 + .025 * Math.sin(t * 17 + sd)), -.012 + t * (h + .014))); }
    const bx = y => bend * h * Math.pow(clamp(y / h), 2);
    const stem = new THREE.LatheGeometry(sp, 30);
    { const P = stem.attributes.position; for (let i = 0; i < P.count; i++) P.setX(i, P.getX(i) + bx(P.getY(i))); stem.computeVertexNormals(); }
    const under = rr => h - .36 * ch * Math.pow(clamp((rr - r) / (R - r)), 1.3), rimY = under(R);
    const top = [new THREE.Vector2(R * .97, rimY - .06 * ch)];
    for (let i = 0; i <= 20; i++){ const t = 1 - i / 20; top.push(new THREE.Vector2(Math.max(R * t, 1e-5), rimY + (h + ch - rimY) * (1 - Math.pow(t, 2.3)) + .05 * ch * Math.sin(Math.PI * t))); }
    const und = [];
    for (let i = 0; i <= 10; i++){ const rr = lerp(r * .9, R * .97, i / 10); und.push(new THREE.Vector2(rr, i === 10 ? rimY - .06 * ch : under(rr) + .0015)); }
    const capTop = new THREE.LatheGeometry(top, 48), capUnder = new THREE.LatheGeometry(und, 48);
    // lamelles : grandes, moyennes et petites en alternance
    const nG = Math.round(64 + R * 900), pos = [], nor = [], uv = [], gcol = [], idx = [], S = 8;
    for (let k = 0; k < nG; k++){
      const a = (k + (hash(k, sd, 1) - .5) * .3) / nG * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const r0 = k % 4 === 0 ? r * 1.02 : k % 2 === 0 ? lerp(r, R, .38) : lerp(r, R, .66), r1 = R * .95, base = pos.length / 3;
      for (let s = 0; s <= S; s++){
        const u = s / S, rr = lerp(r0, r1, u), yt = under(rr) + .002;
        const dep = Math.max(.0005, .15 * R * Math.pow(Math.sin(Math.PI * (.12 + .88 * u)), .6) * sstep(0, .3, 1 - u));
        pos.push(ca * rr, yt, sa * rr, ca * rr, yt - dep, sa * rr); nor.push(-sa, 0, ca, -sa, 0, ca); uv.push(u, 1, u, 0);
        gcol.push(.35, .33, .3, 1, 1, 1);
        if (s){ const q = base + (s - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      }
    }
    const gills = new THREE.BufferGeometry();
    gills.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gills.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); gills.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gills.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3)); gills.setIndex(idx);
    [capTop, capUnder, gills].forEach(g => g.translate(0, -h, 0));
    const capGrp = new THREE.Group(); capGrp.position.set(bx(h), h, 0); capGrp.rotation.z = -bend * .7;
    capGrp.add(new THREE.Mesh(capTop, capMat), new THREE.Mesh(capUnder, underMat), new THREE.Mesh(gills, gillMat));
    grp.add(new THREE.Mesh(stem, stemMat), capGrp);
    grp.traverse(m => { if (m.isMesh){ m.castShadow = m.receiveShadow = true; } });
    return grp;
  }
  const shrooms = [
    [0, 0, 0,        { h: .16, r: .014, R: .085, ch: .045, bend: .06, sd: 1 }],
    [-.11, -.07, 1.9, { h: .11, r: .011, R: .06, ch: .035, bend: -.08, sd: 2 }],
    [.09, -.1, 4.1,  { h: .07, r: .009, R: .036, ch: .03, bend: .05, sd: 3 }],
    [-.05, -.17, .7, { h: .045, r: .007, R: .022, ch: .022, sd: 4 }],
    [.17, -.04, 5.3, { h: .125, r: .012, R: .07, ch: .04, bend: .1, sd: 5 }],
    [.95, -.55, 2.6, { h: .09, r: .01, R: .05, ch: .032, bend: -.05, sd: 6 }],
    [1.02, -.42, .2, { h: .06, r: .008, R: .032, ch: .026, sd: 7 }]
  ];
  for (const [dx, dz, ry, o] of shrooms){ const m = mushroom(o); m.position.set(M.x + dx, M.y - .004, M.z + dz); m.rotation.y = ry; forest.add(m); }
  // tache de soleil sur le groupe (dans l'axe de la colonne de lumière qui y descend) : vu d'en haut, le chapeau accroche la lumière
  {
    const spot = new THREE.SpotLight('#ffd9a0', 2.6, 0, .03, .7, 0);
    spot.position.copy(M).addScaledVector(SUN, 34); spot.target.position.set(M.x - .02, .1, M.z - .03);
    forest.add(spot, spot.target);
  }
  // coussin de mousse d'où sort le groupe
  {
    const g = new THREE.SphereGeometry(1, 72, 24, 0, Math.PI * 2, 0, Math.PI / 2), P = g.attributes.position;
    for (let i = 0; i < P.count; i++){
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(z, x);
      const k = (.55 + .6 * fbm(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6, 1, 3)) * (.85 + .3 * fbm(x * 4, z * 4, y * 3 + 2, 3));
      P.setXYZ(i, x * k, y * k * (1 + .8 * (noise(x * 6, z * 6, 4) - .5)), z * k);
    }
    g.computeVertexNormals();
    const mound = new THREE.Mesh(g, std({ map: mossT, normalMap: mossN, normalScale: new THREE.Vector2(1.5, 1.5), roughness: 1 }));
    mound.scale.set(.34, .05, .26); mound.position.set(M.x - .02, -.014, M.z - .16); mound.receiveShadow = true; forest.add(mound);
  }

  /* ---------- faisceaux de lumière ---------- */
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCol: { value: new Col('#ffe2b4') }, uI: { value: .34 } },
    vertexShader: 'varying vec3 vN; varying vec3 vW; varying float vT; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vT = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; uniform vec3 uCol; uniform float uI; varying vec3 vN; varying vec3 vW; varying float vT;
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float f = pow(abs(dot(normalize(vN), v)), 4.0);
        float along = smoothstep(0.0, 0.14, vT) * (1.0 - smoothstep(0.4, 0.95, vT));
        float fl = 0.72 + 0.28 * sin(uTime * 0.35 + vW.x * 0.8 + vW.z * 0.5) * sin(uTime * 0.23 + vT * 9.0);
        float near = smoothstep(0.3, 4.0, distance(cameraPosition, vW));
        gl_FragColor = vec4(uCol * uI * f * along * fl * near, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  });
  for (const s of shaftLine){
    const L = 48, g = new THREE.CylinderGeometry(s.r * 1.25, s.r, L, 20, 1, true);
    const m = new THREE.Mesh(g, shaftMat);
    m.position.copy(s.g).addScaledVector(SUN, L / 2); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), SUN);
    forest.add(m);
  }

  /* ---------- poussières dans la lumière, spores sous le chapeau ---------- */
  function motes(n, place, o){
    const p = new Float32Array(n * 3), sd = new Float32Array(n);
    for (let i = 0; i < n; i++){ const v = place(); p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z; sd[i] = rnd(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 800 }, uSize: { value: o.size }, uAmp: { value: o.amp }, uFall: { value: o.fall || 0 }, uCol: { value: new Col(o.col) }, uSunDir: FOGU.uSunDir, uNear: { value: o.near } },
      vertexShader: `attribute float aSeed; uniform float uTime, uScale, uSize, uAmp, uFall, uNear; uniform vec3 uSunDir; varying float vA;
        void main(){
          vec3 p = position;
          p += uAmp * vec3(sin(uTime * .21 + aSeed * 40.), sin(uTime * .13 + aSeed * 90.) * .7, cos(uTime * .17 + aSeed * 60.));
          p.y -= uFall > 0. ? mod(uTime * uFall + aSeed * .2, .2) : 0.;
          vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          gl_PointSize = max(1.2, uScale * uSize * (.6 + aSeed * .8) / d);
          float f = pow(max(dot(normalize(p - cameraPosition), uSunDir), 0.), 4.);
          vA = (.18 + 1.7 * f) * smoothstep(uNear, uNear * 3., d) * (1. - smoothstep(14., 26., d)) * (.5 + .5 * sin(uTime * (.5 + aSeed) + aSeed * 30.));
        }`,
      fragmentShader: `uniform vec3 uCol; varying float vA;
        void main(){ float a = smoothstep(.5, .1, length(gl_PointCoord - .5)); gl_FragColor = vec4(uCol * vA, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; return pts;
  }
  const dust = motes(mobile ? 1400 : 3200, () => { const q = pathPts[Math.floor(rnd() * 440)]; return new V3(q.x + rand(-7, 7), groundH(q.x, q.z) + rand(.2, 7), q.z + rand(-7, 7)); }, { size: .012, amp: .3, col: '#fff0d2', near: .25 });
  const spores = motes(500, () => new V3(M.x + rand(-.12, .12), rand(.0, .2), M.z + rand(-.14, .1)), { size: .0009, amp: .01, fall: .012, col: '#fff6e4', near: .004 });
  forest.add(dust, spores);
  progress(.84); await breathe();

  /* ============================================================
     Scène 2 : le chapeau → le pied → le réseau sous terre, relié aux racines des arbres
     (y > 3 : chair du chapeau · 4 > y > -4 : pied · y < -4 : sol)
     ============================================================ */
  const micro = new THREE.Scene();
  const FLESH = new Col('#b99f80'), CREAM = new Col('#c6b494'), SOIL = new Col('#1e1610'), PAGE_BG = new Col(), PAGE_HY = new Col(), FIB = new Col('#f1e6d1');
  micro.fog = new THREE.FogExp2(FLESH.clone(), .085); micro.background = micro.fog.color;
  const mCam = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, .02, 80);
  const SKY_M = new Col('#fff4e2'), GROUND_M = new Col('#3a2a1a'), WHITE = new Col(1, 1, 1);
  const mHemi = new THREE.HemisphereLight(SKY_M, GROUND_M, 1.1), mDir = new THREE.DirectionalLight('#fff1dc', 1.7);
  mDir.position.set(.3, 1, .2); micro.add(mHemi, mDir);
  // aFib = (abscisse le long de la fibre, graine, poids des impulsions, rayon) : des impulsions dorées parcourent le réseau
  // sans tone mapping : le brouillard et le fond (couleur unie) restent identiques, jusqu'à la couleur exacte de la page
  const FIBU = { uTime: { value: 0 }, uPulse: { value: 0 }, uFlat: { value: 0 }, uThin: { value: 0 }, uPulseCol: { value: new Col('#ff9a2e') } };
  const fiberMat = std({ color: '#f1e6d1', roughness: .5, emissive: '#ffe6bf', emissiveIntensity: 0, toneMapped: false }, {
    key: 'fiber', uniforms: FIBU,
    // uThin amincit les fibres vers leur axe à la fin, jusqu'à la finesse des traits de la page
    vPre: 'attribute vec4 aFib; varying vec3 vFib; uniform float uThin;', v: 'vFib = aFib.xyz; transformed -= objectNormal * aFib.w * uThin;',
    fPre: 'uniform float uTime; uniform float uPulse; uniform float uFlat; uniform vec3 uPulseCol; varying vec3 vFib;',
    f: 'diffuseColor.rgb *= 1. + (vFib.y - .5) * .4 * (1. - uFlat);',
    fe: 'float fPh = fract(vFib.x * 1.6 - uTime * .2 + vFib.y * 7.); totalEmissiveRadiance += uPulseCol * (uPulse * vFib.z * 1.6 * smoothstep(.86, .985, fPh) * (1. - smoothstep(.985, 1., fPh)));'
  });
  const rootMat = std({ color: '#4d3727', roughness: .95, emissive: '#2e1f14', emissiveIntensity: .6, transparent: true, toneMapped: false }, { key: 'root' });
  let rootMesh;
  {
    const fibs = [], roots = [];
    const tube = (pts, rad, w = 0) => {
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, rad, 5, false);
      const uv = g.attributes.uv, a = new Float32Array(uv.count * 4), s = rnd();
      for (let i = 0; i < uv.count; i++){ a[i * 4] = uv.getX(i); a[i * 4 + 1] = s; a[i * 4 + 2] = w; a[i * 4 + 3] = rad; }
      g.setAttribute('aFib', new THREE.BufferAttribute(a, 4)); return g;
    };
    const clear = p => { const r = Math.hypot(p.x, p.z); if (r < .55){ const k = .55 / Math.max(r, 1e-3); p.x *= k; p.z *= k; } return p; };
    // chapeau : feutrage de fibres couchées dans tous les sens
    for (let i = 0; i < (mobile ? 110 : 200); i++){
      let p = new V3(rand(-6, 6), rand(3.2, 9.8), rand(-6, 6)), a = rand(0, 6.28); const pts = [clear(p.clone())];
      for (let s = 0; s < 22; s++){ a += rand(-.45, .45); p = p.clone().add(new V3(Math.cos(a) * .55, rand(-.12, .12), Math.sin(a) * .55)); pts.push(clear(p.clone())); }
      fibs.push(tube(pts, rand(.012, .035)));
    }
    // pied : fibres verticales, un peu torsadées, qui s'écartent en entrant dans le sol
    for (let i = 0; i < (mobile ? 120 : 220); i++){
      const a0 = rand(0, 6.28), r0 = .75 + Math.sqrt(rnd()) * 2.6, tw = rand(-.08, .08), rad = rand(.01, .03), pts = [];
      for (let y = 4; y >= -20; y -= .5){
        const dd = Math.max(0, -4 - y), spread = 1 + dd * .38 + dd * dd * .02;
        const a = a0 + tw * y + (noise(i, y * .15) - .5) * .5, rr = r0 * spread + (noise(i * 3.1, y * .2, 1) - .5) * .3 * spread;
        pts.push(new V3(Math.cos(a) * rr, y, Math.sin(a) * rr));
      }
      fibs.push(tube(pts, rad, .35));
      if (rnd() < .55){
        const k = Math.floor(rand(22, 40)), st = pts[k], b = [st.clone()];
        let p = st.clone(), aa = Math.atan2(st.z, st.x) + rand(-.7, .7);
        for (let s = 0; s < 14; s++){ aa += rand(-.25, .25); p = p.clone().add(new V3(Math.cos(aa) * .5, -rand(.05, .3), Math.sin(aa) * .5)); b.push(p); }
        fibs.push(tube(b, rad * .6, .6));
      }
    }
    // racines de six arbres autour : pivot qui s'amincit + racines latérales
    const anchors = [];
    for (let t = 0; t < 6; t++){
      const a = t / 6 * 6.28 + rand(-.3, .3), r = rand(7.5, 11), main = [];
      let x = Math.cos(a) * r, z = Math.sin(a) * r;
      for (let y = -2; y >= -24; y -= 2){ main.push(new V3(x, y, z)); x += rand(-.6, .6); z += rand(-.6, .6); }
      roots.push(tube(main.slice(0, 5), rand(.3, .38)), tube(main.slice(4, 8), rand(.19, .24)), tube(main.slice(7), rand(.1, .13)));
      for (let k = 0; k < 4; k++){
        const st = main[1 + Math.floor(rnd() * 6)], pts = [st.clone()];
        let p = st.clone(), aa = Math.atan2(-st.z, -st.x) + rand(-1.4, 1.4);   // plutôt vers le champignon
        for (let s = 0; s < 6; s++){ aa += rand(-.4, .4); p = p.clone().add(new V3(Math.cos(aa), rand(-.7, .1), Math.sin(aa))); pts.push(p); anchors.push(p); }
        roots.push(tube(pts, rand(.06, .1)));
      }
      anchors.push(...main.slice(1, 9));
    }
    // les hyphes qui partent du pied et vont s'enrouler autour des racines : c'est le réseau qui relie les arbres
    for (let i = 0; i < (mobile ? 60 : 110); i++){
      const a = rand(0, 6.28), r = rand(1.5, 4.5), from = new V3(Math.cos(a) * r, rand(-14, -7), Math.sin(a) * r);
      const to = anchors[Math.floor(rnd() * anchors.length)], pts = [];
      for (let s = 0; s <= 6; s++){ const p = from.clone().lerp(to, s / 6); if (s && s < 6) p.add(new V3(rand(-.9, .9), rand(-.6, .6), rand(-.9, .9))); pts.push(p); }
      fibs.push(tube(pts, rand(.01, .02), 1));
    }
    // et d'une racine à l'autre, maillé (anastomoses)
    for (let i = 0; i < (mobile ? 70 : 130); i++){
      const p1 = anchors[Math.floor(rnd() * anchors.length)], p2 = anchors[Math.floor(rnd() * anchors.length)];
      if (p1.distanceTo(p2) < 2.5) continue;
      const mid = p1.clone().lerp(p2, .5).add(new V3(rand(-1.5, 1.5), rand(-.8, .4), rand(-1.5, 1.5)));
      fibs.push(tube([p1, p1.clone().lerp(mid, .5).add(new V3(rand(-.5, .5), 0, rand(-.5, .5))), mid, mid.clone().lerp(p2, .5).add(new V3(rand(-.5, .5), 0, rand(-.5, .5))), p2], rand(.008, .018), .8));
    }
    micro.add(new THREE.Mesh(mergeGeos(fibs), fiberMat));
    rootMesh = new THREE.Mesh(mergeGeos(roots), rootMat); micro.add(rootMesh);
  }
  const grains = motes(mobile ? 800 : 1800, () => { const a = rand(0, 6.28), r = rand(.6, 7); return new V3(Math.cos(a) * r, rand(-19, 10), Math.sin(a) * r); }, { size: .02, amp: .15, col: '#fff3dc', near: .1 });
  grains.material.uniforms.uSunDir = { value: new V3(0, -1, 0) };
  micro.add(grains);
  progress(.93); await breathe();

  /* ============================================================
     Rendu
     ============================================================ */
  const _p = new V3(), _l = new V3(), _f = new V3(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3();
  function setFog(c, sunCol, mist){
    c.updateMatrixWorld();
    FOGU.uViewInv.value.setFromMatrix4(c.matrixWorld); FOGU.uCamPos.value.setFromMatrixPosition(c.matrixWorld);
    FOGU.uSunDir.value.copy(SUN); FOGU.uSunCol.value.copy(sunCol); FOGU.uMist.value.copy(mist); FOGU.uMistCol.value.copy(MIST);
  }
  const NO_SUN = new Col(0, 0, 0), FOREST_MIST = new V3(.07, 1, .37), NO_MIST = new V3(0, 1, 0);
  const pxScale = c => glCanvas.height / (2 * Math.tan(THREE.MathUtils.degToRad(c.fov) / 2));

  function updateFalling(time, dt){
    cam.getWorldDirection(_f);
    for (let i = 0; i < FALL; i++){
      const s = fallState[i];
      if (!s.live || s.p.y < groundH(s.p.x, s.p.z) || s.p.distanceTo(cam.position) > 16){
        const d = rand(1.5, 11);
        s.p.set(cam.position.x + _f.x * d + rand(-4, 4), cam.position.y + rand(1, 5), cam.position.z + _f.z * d + rand(-4, 4)); s.live = true;
      }
      s.p.y -= s.sp * dt; s.p.x += Math.sin(time * 1.3 + s.ph) * .35 * dt; s.p.z += Math.cos(time * .9 + s.ph) * .2 * dt;
      e.set(Math.sin(time * s.spin + s.ph) * 1.1, time * .6 * s.spin + s.ph, Math.cos(time * s.spin * .8 + s.ph) * .9); q.setFromEuler(e); sc.setScalar(.085);
      falling.setMatrixAt(i, m4.compose(s.p, q, sc));
    }
    falling.instanceMatrix.needsUpdate = true;
  }

  // fenêtre du fondu : le chapeau → l'intérieur du chapeau ; MEND : fin du voyage dans le mycélium
  const T0 = .592, T1 = .625, MEND = .95;

  /* Ombres statiques : le soleil ne bouge pas, la carte d'ombres couvre toute la zone vue
     et n'est calculée qu'une fois (au lieu d'à chaque image). */
  {
    const C = new V3(0, 0, -34);
    sun.target.position.copy(C); sun.position.copy(C).addScaledVector(SUN, 120);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
    const sc0 = sun.shadow.camera; sc0.position.copy(sun.position); sc0.lookAt(C); sc0.updateMatrixWorld();
    const inv = sc0.matrixWorldInverse, v = new V3(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const x of [-26, 26]) for (const z of [-100, 24]) for (const y of [-2, 3]){
      v.set(x, y, z).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
    }
    sc0.left = x0; sc0.right = x1; sc0.bottom = y0; sc0.top = y1; sc0.near = .5; sc0.far = -z0 + 5; sc0.updateProjectionMatrix();
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  }

  function renderForest(p, time, dt, target = null){
    const u = keyU(p);
    posC.getPoint(u, _p); lookC.getPoint(u, _l);
    const hg = Math.max(.01, _p.y - groundH(_p.x, _p.z));
    const amp = Math.min(1, hg / 1.6) * .035 + .0012;
    _p.x += (noise(time * .35, 3.1) - .5) * amp * 2; _p.y += (noise(time * .3, 8.7) - .5) * amp * 1.4;
    cam.position.copy(_p); cam.lookAt(_l); cam.rotateZ((noise(time * .25, 5.5) - .5) * .02 * Math.min(1, hg));
    cam.fov = lerp(55, 46, sstep(.432, .53, p)) + sstep(.575, T1, p) * 16;
    cam.near = clamp(hg * .04, .0015, .05); cam.aspect = glCanvas.width / glCanvas.height;
    cam.updateProjectionMatrix();

    shaftMat.uniforms.uTime.value = time;
    dust.material.uniforms.uTime.value = spores.material.uniforms.uTime.value = time;
    dust.material.uniforms.uScale.value = spores.material.uniforms.uScale.value = pxScale(cam);
    falling.visible = p < .48; if (falling.visible) updateFalling(time, dt);
    sky.position.copy(cam.position);
    setFog(cam, SUN_SCAT, FOREST_MIST);
    renderer.setRenderTarget(target); renderer.render(forest, cam);
  }

  /* Dans le champignon, quatre temps (qn de 0 à 1) :
     chair du chapeau, regard qui se relève → descente du pied, fibres en faisceaux → sortie dans le sol,
     les hyphes filent vers les racines, parcourues d'impulsions → vue d'en haut du réseau, aux couleurs de la page. */
  const MK = [   // [qn, hauteur, tangage, champ]
    [0,   10.4, -1.48, 76],
    [.1,   8.5, -1.05, 72],
    [.24,  5.2, -.5,   66],
    [.38,   .8, -.28,  70],
    [.52, -3.8, -.34,  72],
    [.66, -6.8, -.66,  68],
    [.82, -8.3, -1.1,  63],
    [1,   -8.8, -1.42, 60]
  ];
  const mC = new THREE.CatmullRomCurve3(MK.map(k => new V3(k[1], k[2], k[3])), false, 'catmullrom', .5);
  const _d = new V3(), _m = new V3(), toLin = rgb => new Col().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
  let pageCol = null;
  function renderMicro(p, time, target = null){
    const qn = clamp((p - T0) / (MEND - T0));
    mC.getPoint(keyU(qn, MK), _m);
    const pitch = _m.y + Math.sin(time * .4) * .02, yaw = Math.PI + qn * 1.6 + Math.sin(time * .15) * .04;
    mCam.position.set(Math.sin(time * .3) * .04, _m.x, Math.cos(time * .25) * .04);
    _d.set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
    mCam.lookAt(_d.add(mCam.position));
    mCam.fov = _m.z; mCam.aspect = glCanvas.width / glCanvas.height; mCam.updateProjectionMatrix();

    const stem = sstep(.2, .36, qn), dark = sstep(.44, .6, qn), page = sstep(.8, 1, qn);
    if (page > 0 && !pageCol){
      // à la fin, les fibres prennent la couleur des hyphes du fond de la page, à la même discrétion
      const c = pageColors(); pageCol = { bg: toLin(c.bg), hy: toLin(c.hy) };
      PAGE_BG.copy(pageCol.bg); PAGE_HY.copy(pageCol.bg).lerp(pageCol.hy, clamp(c.a * 1.5, .3, .6));
    }
    if (page === 0) pageCol = null;
    micro.fog.color.copy(FLESH).lerp(CREAM, stem).lerp(SOIL, dark).lerp(PAGE_BG, page);
    micro.fog.density = lerp(lerp(lerp(.2, .08, stem), .05, dark), .075, page);
    // éclairage aplati à la fin (ciel = sol = blanc, intensité π) : une fibre y rend exactement sa couleur, comme un trait de la page
    mHemi.color.copy(SKY_M).lerp(WHITE, page); mHemi.groundColor.copy(GROUND_M).lerp(WHITE, page);
    mHemi.intensity = lerp(lerp(1.1, .16, dark), Math.PI, page); mDir.intensity = lerp(lerp(1.7, .2, dark), 0, page);
    fiberMat.emissiveIntensity = lerp(lerp(.2, .42, sstep(.34, .6, qn)), 0, page);
    fiberMat.color.copy(FIB).multiplyScalar(lerp(1, .7, dark)).lerp(PAGE_HY, page);
    FIBU.uTime.value = time; FIBU.uPulse.value = sstep(.46, .62, qn) * (1 - page); FIBU.uFlat.value = page; FIBU.uThin.value = .72 * page;
    rootMat.opacity = 1 - page; rootMat.emissiveIntensity = .6 * (1 - page); rootMesh.visible = page < .99;
    grains.material.uniforms.uTime.value = time; grains.material.uniforms.uScale.value = pxScale(mCam);
    grains.visible = page < .9;
    setFog(mCam, NO_SUN, NO_MIST);
    renderer.setRenderTarget(target); renderer.render(micro, mCam);
  }

  /* ---------- fondu enchaîné : on traverse la peau du chapeau (voile doux, pas de rayons) ---------- */
  const rtOpts = { type: THREE.HalfFloatType, samples: 0 };
  let rtA = null, rtB = null;
  const comp = new THREE.ShaderMaterial({
    uniforms: { tA: { value: null }, tB: { value: null }, uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform sampler2D tA, tB; uniform float uT; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 d = vUv - .5;
        float n = vn(vUv * 3.) * .6 + vn(vUv * 9.) * .4;
        float m = smoothstep(0., 1., clamp(uT * 1.7 - .35 + (n - .5) * .5, 0., 1.));
        vec3 ca = (texture2D(tA, .5 + d * (1. - uT * .12)).rgb + texture2D(tA, .5 + d * (1. - uT * .06)).rgb) * .5;
        vec3 cb = texture2D(tB, .5 + d * (1. + (1. - uT) * .1)).rgb;
        vec3 veil = vec3(.95, .86, .72) * sin(3.14159 * uT) * .35;
        gl_FragColor = vec4(mix(ca, cb, m) + veil, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false
  });
  const compScene = new THREE.Scene(), compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const compQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp); compQuad.frustumCulled = false; compScene.add(compQuad);
  const bufSize = new THREE.Vector2();
  function ensureRT(){
    renderer.getDrawingBufferSize(bufSize);
    if (!rtA){ rtA = new THREE.WebGLRenderTarget(bufSize.x, bufSize.y, rtOpts); rtB = new THREE.WebGLRenderTarget(bufSize.x, bufSize.y, rtOpts); }
    else if (rtA.width !== bufSize.x || rtA.height !== bufSize.y){ rtA.setSize(bufSize.x, bufSize.y); rtB.setSize(bufSize.x, bufSize.y); }
  }
  function renderBlend(p, time, dt){
    ensureRT();
    renderForest(p, time, dt, rtA); renderMicro(p, time, rtB);
    comp.uniforms.tA.value = rtA.texture; comp.uniforms.tB.value = rtB.texture; comp.uniforms.uT.value = sstep(T0, T1, p);
    renderer.setRenderTarget(null); renderer.render(compScene, compCam);
  }

  /* Résolution adaptative, dans les deux sens : on baisse si l'image saccade, on remonte quand elle est fluide.
     Un palier qui a fait saccader n'est plus retenté (ceil), pour ne pas osciller. */
  let ft = 16.7, frames = 0, calm = 0, lastChange = 0, ceil = maxDpr;
  function resize(){ renderer.setSize(innerWidth, innerHeight, false); }
  addEventListener('resize', resize);
  function setDpr(v, now){ dpr = v; renderer.setPixelRatio(dpr); resize(); lastChange = now; calm = 0; ft = 16.7; }
  function adapt(dt, now){
    if (++frames < 30 || dt >= .1) return;   // premières images (compilation) et retours d'onglet : pas représentatifs
    ft = lerp(ft, dt * 1000, .06);
    if (now - lastChange < 1.2) return;
    // le coût suit le nombre de pixels (dpr²) : on vise ~15 ms d'un coup plutôt que par petits pas
    if (ft > 22 && dpr > minDpr){ ceil = Math.min(ceil, dpr * .97); setDpr(Math.max(minDpr, dpr * clamp(Math.sqrt(15 / ft), .6, .9)), now); }
    else if (ft < 18.5){ if (++calm > 150 && dpr < ceil) setDpr(Math.min(ceil, dpr * 1.12), now); }
    else calm = 0;
  }

  progress(.97); await breathe();
  // premier rendu de chaque étape : compile les shaders maintenant plutôt qu'en plein défilement
  renderForest(0, 0, 0); hiCanopy.visible = false;   // la carte d'ombres est faite : la canopée haute ne sert plus
  renderBlend((T0 + T1) / 2, 0, 0); renderMicro(.8, 0); renderMicro(.94, 0);
  progress(1);

  return {
    frame(p, time, dt){
      if (p >= .996) return;
      adapt(dt, time);
      if (p <= T0) renderForest(p, time, dt);
      else if (p >= T1) renderMicro(p, time);
      else renderBlend(p, time, dt);
    }
  };
}
})();
