(() => {
'use strict';

// ============================================================ CONFIG
const W = 900, H = 320, GY = 262;           // mundo lógico e linha do chão
const S = 76;                                // tamanho do dino na tela
const GRAV = 2400, JUMP_V = 790, CUT = 0.45; // física
const BASE_SPEED = 320, MAX_SPEED = 780;
const BIOME_LEN = 900;                       // pontos por bioma

const BIOMES = {
  desert: { name: 'Deserto', emoji: '🌵', sky: ['#6fcbff', '#ffe9b0'], ground: '#e6b868', edge: '#c98f4f', mark: '#d4a053',
            ground1: ['cactus', 'cactus2', 'rock'], fly: 'bird', decor: ['sun', 'cloud'], g: 1 },
  forest: { name: 'Floresta', emoji: '🌲', sky: ['#8fd9ff', '#e2f8ff'], ground: '#58b05f', edge: '#2f7d3a', mark: '#3f9a4c',
            ground1: ['log', 'bush', 'mushroom', 'rock'], fly: 'bird', decor: ['sun', 'cloud'], g: 1 },
  city:   { name: 'Cidade', emoji: '🏙️', sky: ['#35457f', '#ff9f7a'], ground: '#4b5068', edge: '#2b3047', mark: '#ffd34d',
            ground1: ['cone', 'crate', 'hydrant'], fly: 'drone', decor: ['moon', 'star'], g: 1 },
  snow:   { name: 'Neve', emoji: '❄️', sky: ['#a6d6ff', '#f0f9ff'], ground: '#f4f9ff', edge: '#a9c6e6', mark: '#cfe2f5',
            ground1: ['snowman', 'ice', 'pine'], fly: 'ibird', decor: ['cloud'], g: 1, flakes: true },
  space:  { name: 'Espaço', emoji: '🪐', sky: ['#04010e', '#2b1763'], ground: '#3b2a67', edge: '#7b5cff', mark: '#5a44a0',
            ground1: ['crystal', 'alien', 'asteroid'], fly: 'ufo', decor: ['planet', 'star'], g: 0.78 },
};
const BIOME_KEYS = Object.keys(BIOMES);

// altura de desenho (px) dos obstáculos
const OBS_H = { cactus: 72, cactus2: 54, rock: 42, log: 40, bush: 46, mushroom: 46, cone: 48, crate: 46, hydrant: 54,
                snowman: 68, ice: 48, pine: 76, crystal: 68, alien: 50, asteroid: 44 };
const FLY_H = { bird: 48, ibird: 48, drone: 44, ufo: 46 };

const IMG_NAMES = [
  'dino-run1', 'dino-run2', 'dino-jump', 'dino-duck1', 'dino-duck2', 'dino-dead', 'coin',
  'obs-cactus', 'obs-cactus2', 'obs-rock', 'obs-log', 'obs-bush', 'obs-mushroom', 'obs-cone', 'obs-crate', 'obs-hydrant',
  'obs-snowman', 'obs-ice', 'obs-pine', 'obs-crystal', 'obs-alien', 'obs-asteroid',
  'fly-bird1', 'fly-bird2', 'fly-ibird1', 'fly-ibird2', 'fly-drone1', 'fly-drone2', 'fly-ufo1', 'fly-ufo2',
  'sun', 'moon', 'planet', 'cloud', 'star',
  ...BIOME_KEYS.flatMap(b => ['bg-' + b + '-far', 'bg-' + b + '-near']),
];

// ============================================================ UTIL
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const lerp = (a, b, t) => a + (b - a) * t;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

const IM = {};
function loadImages() {
  return Promise.all(IMG_NAMES.map(n => new Promise(res => {
    const im = new Image();
    im.onload = () => res();
    im.onerror = () => res();
    im.src = 'img/' + n + '.svg';
    IM[n] = im;
  })));
}

// ============================================================ ÁUDIO
let actx = null, soundOn = store.get('dmr-sound', '1') === '1';
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(f1, f2, dur, type = 'square', vol = 0.06, delay = 0) {
  if (!soundOn) return;
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  jump: () => tone(380, 780, 0.16),
  coin: () => { tone(880, 1180, 0.08, 'triangle', 0.08); tone(1320, 1580, 0.1, 'triangle', 0.08, 0.07); },
  hit: () => { tone(220, 40, 0.4, 'sawtooth', 0.1); tone(120, 30, 0.45, 'square', 0.07, 0.05); },
  world: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f * 1.01, 0.14, 'triangle', 0.07, i * 0.09)),
  land: () => tone(140, 70, 0.07, 'sine', 0.05),
};

// ============================================================ CANVAS
const wrap = $('wrap'), cv = $('c'), ctx = cv.getContext('2d');
let scale = 1;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = wrap.clientWidth || W;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(w * dpr * H / W);
  scale = cv.width / W;
}
new ResizeObserver(resize).observe(wrap);
window.addEventListener('resize', resize);

// ============================================================ ESTADO
let state = 'loading';       // loading | menu | play | paused | dead
let best = parseInt(store.get('dmr-best', '0'), 10) || 0;
let G;                       // estado da partida

function newGame() {
  const first = pick(BIOME_KEYS);
  G = {
    t: 0, dist: 0, score: 0, coins: 0, speed: BASE_SPEED,
    biome: first, prev: first, blend: 1, worldsDone: 0, worldAt: BIOME_LEN, banner: 2.4, bannerName: first,
    dino: { y: GY, vy: 0, ground: true, duck: false, frame: 0, ft: 0, coyote: 0, buf: 0, held: false, cut: false },
    obs: [], coins_: [], parts: [], nextSpawn: 650, shake: 0,
    scroll: 0,
    clouds: Array.from({ length: 4 }, (_, i) => ({ x: i * 240 + rnd(0, 80), y: rnd(20, 100), s: rnd(0.5, 1), v: rnd(6, 16) })),
    stars: Array.from({ length: 50 }, () => ({ x: rnd(0, W), y: rnd(0, GY - 40), s: rnd(0.4, 1), p: rnd(0, 6) })),
    flakes: Array.from({ length: 55 }, () => ({ x: rnd(0, W), y: rnd(0, H), s: rnd(1, 3), v: rnd(30, 70), p: rnd(0, 6) })),
  };
}

// ============================================================ ENTRADAS
function pressJump() {
  if (state !== 'play') return;
  const d = G.dino;
  d.held = true;
  d.buf = 0.12;
}
function releaseJump() {
  if (state !== 'play') return;
  const d = G.dino;
  d.held = false;
  if (!d.ground && d.vy < 0 && !d.cut) { d.vy *= CUT; d.cut = true; }
}
function setDuck(v) { if (state === 'play') G.dino.duck = v; }

addEventListener('keydown', e => {
  const k = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') {
    if (state === 'menu' || state === 'dead') start(); else pressJump();
  } else if (k === 'ArrowDown' || k === 'KeyS') setDuck(true);
  else if (k === 'KeyP' || k === 'Escape') togglePause();
  else if (k === 'Enter') { if (state === 'menu' || state === 'dead') start(); else if (state === 'paused') togglePause(); }
});
addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') releaseJump();
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') setDuck(false);
});

wrap.addEventListener('pointerdown', e => {
  if (e.target.closest('button')) return;
  if (state === 'play') { pressJump(); }
});
addEventListener('pointerup', releaseJump);
addEventListener('pointercancel', releaseJump);

const duckBtn = $('duck');
['pointerdown'].forEach(ev => duckBtn.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); setDuck(true); }));
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => duckBtn.addEventListener(ev, () => setDuck(false)));

// deslizar para baixo = agachar
let swipeY = null;
wrap.addEventListener('touchstart', e => { swipeY = e.touches[0].clientY; }, { passive: true });
wrap.addEventListener('touchmove', e => {
  if (swipeY !== null && e.touches[0].clientY - swipeY > 28) setDuck(true);
}, { passive: true });
wrap.addEventListener('touchend', () => { swipeY = null; setDuck(false); }, { passive: true });
wrap.addEventListener('contextmenu', e => e.preventDefault());

// ============================================================ UI
const panels = ['loading', 'menu', 'paused', 'over'].map(id => $(id));
function showPanel(id) { panels.forEach(p => p.classList.toggle('on', p.id === id)); }
function hud(on) {
  $('topbtns').classList.toggle('on', on);
  const touch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
  duckBtn.classList.toggle('on', on && touch);
}

function start() {
  audio();
  newGame();
  state = 'play';
  showPanel(null);
  hud(true);
  last = performance.now();
}
function toMenu() {
  state = 'menu';
  newGame();
  showPanel('menu');
  hud(false);
  $('bestMenu').textContent = best ? '🏆 Recorde: ' + best : '';
}
function togglePause() {
  if (state === 'play') { state = 'paused'; showPanel('paused'); }
  else if (state === 'paused') { state = 'play'; showPanel(null); last = performance.now(); }
}
function die() {
  state = 'dead';
  const d = G.dino;
  G.shake = 0.35;
  sfx.hit();
  const sc = Math.floor(G.score);
  const rec = sc > best;
  if (rec) { best = sc; store.set('dmr-best', String(best)); }
  setTimeout(() => {
    if (state !== 'dead') return;
    $('oScore').textContent = sc;
    $('oBest').textContent = best;
    $('oCoins').textContent = G.coins;
    $('oWorld').textContent = BIOMES[G.biome].emoji + ' ' + BIOMES[G.biome].name;
    $('newrec').hidden = !rec;
    showPanel('over');
    hud(false);
  }, 650);
}

$('btnPlay').onclick = start;
$('btnAgain').onclick = start;
$('btnHome').onclick = toMenu;
$('btnPause').onclick = togglePause;
$('btnResume').onclick = togglePause;
function soundLabel() { $('btnSound').textContent = soundOn ? '🔊 Som: ligado' : '🔇 Som: desligado'; }
$('btnSound').onclick = () => { soundOn = !soundOn; store.set('dmr-sound', soundOn ? '1' : '0'); soundLabel(); if (soundOn) sfx.coin(); };
soundLabel();
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });

// ---- instalar (PWA)
let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('btnInstall').hidden = false; });
$('btnInstall').onclick = async () => {
  if (!deferred) return;
  deferred.prompt();
  try { await deferred.userChoice; } catch (e) {}
  deferred = null; $('btnInstall').hidden = true;
};
addEventListener('appinstalled', () => { $('btnInstall').hidden = true; });
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) $('iosHint').style.display = 'block';
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ============================================================ SPAWN
function spawnGround(x) {
  const b = BIOMES[G.biome];
  const kind = pick(b.ground1);
  const im = IM['obs-' + kind];
  const h = OBS_H[kind];
  const w = h * (im.naturalWidth || 60) / (im.naturalHeight || 60);
  const group = (kind === 'cactus2' || kind === 'cone' || kind === 'mushroom' || kind === 'crystal') && Math.random() < 0.4 ? 2 : 1;
  let cx = x, total = 0;
  for (let i = 0; i < group; i++) {
    G.obs.push({ kind: 'g', img: im, x: cx, y: GY + 3 - h, w, h, inX: 0.2, inT: 0.12 });
    cx += w * 0.92; total += w * 0.92;
  }
  // moedas em arco por cima
  if (Math.random() < 0.55) {
    const n = 5, span = Math.max(150, total + 120), x0 = x + total / 2 - span / 2;
    const peak = Math.min(120, 60 + h);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      G.coins_.push({ x: x0 + u * span, y: GY - 26 - Math.sin(u * Math.PI) * peak, p: rnd(0, 6), got: false });
    }
  }
  return total;
}
function spawnFlyer(x) {
  const b = BIOMES[G.biome];
  const kind = b.fly, h = FLY_H[kind];
  const im1 = IM['fly-' + kind + '1'];
  const w = h * (im1.naturalWidth || 80) / (im1.naturalHeight || 56);
  const r = Math.random();
  let cy, lvl;
  if (r < 0.5) { cy = GY - 55; lvl = 'duck'; }
  else if (r < 0.78) { cy = GY - 28; lvl = 'jump'; }
  else { cy = GY - 128; lvl = 'high'; }
  G.obs.push({ kind: 'f', fly: kind, lvl, x, y: cy - h / 2, w, h, inX: 0.2, inT: 0.22, rel: 70, t: rnd(0, 1) });
  if (lvl === 'duck') for (let i = 0; i < 3; i++) G.coins_.push({ x: x + 140 + i * 46, y: GY - 26, p: rnd(0, 6), got: false });
  return w;
}
function spawn() {
  const x = W + 40;
  const flyerOK = G.score > 220;
  let w;
  if (flyerOK && Math.random() < Math.min(0.32, 0.12 + G.score / 6000)) w = spawnFlyer(x);
  else w = spawnGround(x);
  // distância até o próximo obstáculo: depende da velocidade (tempo de salto ~0.65s)
  const sp = G.speed;
  G.nextSpawn = w + sp * rnd(0.72, 1.35) + 90 + (G.score < 150 ? 160 : 0);
}

// ============================================================ UPDATE
function worldCheck() {
  if (G.score >= G.worldAt) {
    G.worldAt += BIOME_LEN;
    G.worldsDone++;
    let nb; do { nb = pick(BIOME_KEYS); } while (nb === G.biome);
    G.prev = G.biome; G.biome = nb; G.blend = 0; G.banner = 2.6; G.bannerName = nb;
    sfx.world();
  }
}

function hitbox(d) {
  const k = S / 128, ft = d.y + 2, left = 60;
  if (d.duck && d.ground) return { x: left + 18 * k, y: ft - 62 * k, w: 98 * k, h: 60 * k };
  return { x: left + 38 * k, y: ft - 96 * k, w: 66 * k, h: 94 * k };
}

function update(dt) {
  G.t += dt;
  const d = G.dino;

  G.speed = Math.min(MAX_SPEED, BASE_SPEED + G.score * 0.15);
  G.dist += G.speed * dt;
  G.score = G.dist / 11;
  worldCheck();
  if (G.blend < 1) G.blend = Math.min(1, G.blend + dt / 1.6);
  if (G.banner > 0) G.banner -= dt;
  G.scroll += G.speed * dt;
  if (G.shake > 0) G.shake -= dt;

  // --- dino
  const g = GRAV * BIOMES[G.biome].g;
  d.buf = Math.max(0, d.buf - dt);
  if (d.ground) d.coyote = 0.08; else d.coyote = Math.max(0, d.coyote - dt);
  if (d.buf > 0 && d.coyote > 0) {
    d.vy = -JUMP_V; d.ground = false; d.cut = false; d.buf = 0; d.coyote = 0;
    sfx.jump();
    for (let i = 0; i < 6; i++) G.parts.push({ x: 60 + S * 0.45, y: GY, vx: rnd(-90, 20), vy: rnd(-60, -10), life: 0.4, c: '#fff8', r: rnd(2, 4) });
  }
  if (!d.ground) {
    d.vy += g * (d.duck ? 2.2 : 1) * dt;
    d.y += d.vy * dt;
    if (d.y >= GY) {
      d.y = GY; d.vy = 0; d.ground = true;
      sfx.land();
      for (let i = 0; i < 7; i++) G.parts.push({ x: 60 + S * 0.5, y: GY, vx: rnd(-120, 60), vy: rnd(-70, -10), life: 0.45, c: '#fff8', r: rnd(2, 4) });
      if (d.held && d.buf <= 0) { /* mantém pulo só com novo toque */ }
    }
  }
  d.ft += dt * (6 + G.speed / 70);
  if (d.ground && Math.random() < dt * 14) {
    G.parts.push({ x: 60 + S * 0.3, y: GY + 2, vx: rnd(-120, -40), vy: rnd(-30, -5), life: 0.35, c: '#fff6', r: rnd(1.5, 3) });
  }

  // --- spawn
  G.nextSpawn -= G.speed * dt;
  if (G.nextSpawn <= 0) spawn();

  // --- obstáculos
  const hb = hitbox(d);
  for (const o of G.obs) {
    o.x -= (G.speed + (o.rel || 0)) * dt;
    if (o.kind === 'f') o.t += dt;
    const ox = o.x + o.w * o.inX, oy = o.y + o.h * o.inT, ow = o.w * (1 - 2 * o.inX), oh = o.h * (1 - 1.4 * o.inT);
    if (state === 'play' && hb.x < ox + ow && hb.x + hb.w > ox && hb.y < oy + oh && hb.y + hb.h > oy) { die(); return; }
  }
  G.obs = G.obs.filter(o => o.x + o.w > -40);

  // --- moedas
  const cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
  for (const c of G.coins_) {
    c.x -= G.speed * dt;
    if (!c.got && Math.abs(c.x - cx) < hb.w / 2 + 14 && Math.abs(c.y - cy) < hb.h / 2 + 14) {
      c.got = true; G.coins++; G.dist += 11 * 8; sfx.coin();
      for (let i = 0; i < 6; i++) G.parts.push({ x: c.x, y: c.y, vx: rnd(-90, 90), vy: rnd(-110, 20), life: 0.45, c: '#ffd34d', r: rnd(2, 3.5) });
    }
  }
  G.coins_ = G.coins_.filter(c => !c.got && c.x > -30);

  // --- partículas / decoração
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt; }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const c of G.clouds) { c.x -= (c.v + G.speed * 0.04) * dt; if (c.x < -160) { c.x = W + rnd(20, 200); c.y = rnd(16, 100); } }
  for (const f of G.flakes) { f.y += f.v * dt; f.x -= (G.speed * 0.25) * dt + Math.sin(G.t + f.p) * 8 * dt; if (f.y > H) { f.y = -4; f.x = rnd(0, W); } if (f.x < -4) f.x = W; }
}

// ============================================================ DESENHO
function drawLayer(img, y, h, par, alpha) {
  if (!img.naturalWidth) return;
  const w = 800 * (h / img.naturalHeight);
  const off = -((G.scroll * par) % w);
  ctx.globalAlpha = alpha;
  for (let x = off; x < W; x += w) ctx.drawImage(img, x, y, w + 1, h);
  ctx.globalAlpha = 1;
}

function drawWorld(key, a) {
  if (a <= 0) return;
  const b = BIOMES[key];
  ctx.globalAlpha = a;
  // céu
  const gr = ctx.createLinearGradient(0, 0, 0, GY);
  gr.addColorStop(0, b.sky[0]); gr.addColorStop(1, b.sky[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  // estrelas (cidade / espaço)
  if (b.decor.includes('star')) {
    for (const s of G.stars) {
      const tw = 0.5 + 0.5 * Math.sin(G.t * 2 + s.p);
      ctx.globalAlpha = a * (key === 'space' ? 0.9 : 0.45) * (0.4 + 0.6 * tw);
      const sz = 6 + s.s * 6;
      ctx.drawImage(IM.star, s.x, s.y * (key === 'city' ? 0.55 : 1), sz, sz);
    }
    ctx.globalAlpha = a;
  }
  // astros
  if (b.decor.includes('sun')) { const im = IM.sun; ctx.drawImage(im, 700 - ((G.scroll * 0.01) % 40), 22, 110, 110); }
  if (b.decor.includes('moon')) ctx.drawImage(IM.moon, 730, 18, 90, 90);
  if (b.decor.includes('planet')) ctx.drawImage(IM.planet, 640 - ((G.scroll * 0.012) % 60), 24, 170, 128);
  // nuvens
  if (b.decor.includes('cloud')) for (const c of G.clouds) ctx.drawImage(IM.cloud, c.x, c.y, 140 * c.s, 60 * c.s);
  ctx.globalAlpha = 1;
  // parallax
  drawLayer(IM['bg-' + key + '-far'], GY - 246, 256, 0.12, a);
  drawLayer(IM['bg-' + key + '-near'], GY - 108, 118, 0.38, a);
  // chão
  ctx.globalAlpha = a;
  ctx.fillStyle = b.ground; ctx.fillRect(0, GY + 2, W, H - GY);
  ctx.fillStyle = b.edge; ctx.fillRect(0, GY + 2, W, 5);
  ctx.fillStyle = b.mark;
  const off = G.scroll % 90;
  for (let x = -off; x < W; x += 90) {
    if (key === 'city') { ctx.fillRect(x, GY + 30, 44, 5); }
    else if (key === 'space') { ctx.fillRect(x + 20, GY + 22, 30, 3); ctx.fillRect(x + 60, GY + 40, 14, 3); }
    else { ctx.fillRect(x + 10, GY + 20, 22, 3); ctx.fillRect(x + 50, GY + 38, 12, 3); ctx.fillRect(x + 70, GY + 14, 8, 3); }
  }
  if (b.flakes) {
    ctx.fillStyle = '#fff';
    for (const f of G.flakes) { ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, 6.3); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

function dinoImg(d) {
  if (state === 'dead') return IM['dino-dead'];
  if (!d.ground) return IM['dino-jump'];
  const f = ((d.ft | 0) % 2) + 1;
  return d.duck ? IM['dino-duck' + f] : IM['dino-run' + f];
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (G.shake > 0) ctx.translate(rnd(-5, 5), rnd(-4, 4));

  drawWorld(G.prev, 1);
  if (G.blend < 1 || G.prev !== G.biome) drawWorld(G.biome, G.blend);

  // moedas
  for (const c of G.coins_) {
    const bob = Math.sin(G.t * 5 + c.p) * 3;
    const sx = Math.abs(Math.cos(G.t * 3 + c.p)) * 0.6 + 0.4;
    ctx.save(); ctx.translate(c.x, c.y + bob); ctx.scale(sx, 1);
    ctx.drawImage(IM.coin, -13, -13, 26, 26);
    ctx.restore();
  }

  // obstáculos
  for (const o of G.obs) {
    if (o.kind === 'g') ctx.drawImage(o.img, o.x, o.y, o.w, o.h);
    else {
      const fr = (((o.t * 8) | 0) % 2) + 1;
      ctx.drawImage(IM['fly-' + o.fly + fr], o.x, o.y, o.w, o.h);
    }
  }

  // dino (sombra + sprite)
  const d = G.dino;
  const lift = GY - d.y;
  ctx.fillStyle = '#0003';
  ctx.beginPath(); ctx.ellipse(60 + S * 0.5, GY + 6, S * 0.34 * (1 - Math.min(0.5, lift / 300)), 5, 0, 0, 6.3); ctx.fill();
  const im = dinoImg(d);
  ctx.drawImage(im, 60, d.y + 2 - S * 121 / 128, S, S);

  // partículas
  for (const p of G.parts) { ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = p.c.length > 5 ? p.c.slice(0, 7) : p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill(); }
  ctx.globalAlpha = 1;

  // aviso de novo mundo
  if (G.banner > 0) {
    const t = G.banner, a = Math.min(1, t * 2, (2.6 - t) * 3);
    const b = BIOMES[G.bannerName];
    ctx.globalAlpha = Math.max(0, a);
    ctx.textAlign = 'center';
    ctx.font = '800 38px "Trebuchet MS",system-ui,sans-serif';
    ctx.lineWidth = 7; ctx.strokeStyle = '#0b1630cc'; ctx.strokeText(b.emoji + ' ' + b.name, W / 2, 96);
    ctx.fillStyle = '#fff'; ctx.fillText(b.emoji + ' ' + b.name, W / 2, 96);
    ctx.globalAlpha = 1;
  }

  // HUD
  ctx.textAlign = 'right';
  ctx.font = '800 22px "Courier New",monospace';
  const sc = String(Math.floor(G.score)).padStart(5, '0');
  const hi = String(best).padStart(5, '0');
  ctx.lineWidth = 5; ctx.strokeStyle = '#0b1630aa';
  const txt = 'HI ' + hi + '   ' + sc;
  ctx.strokeText(txt, W - 16, 32); ctx.fillStyle = '#fff'; ctx.fillText(txt, W - 16, 32);
  const ct = String(G.coins);
  ctx.strokeText(ct, W - 16, 60); ctx.fillStyle = '#ffd34d'; ctx.fillText(ct, W - 16, 60);
  ctx.drawImage(IM.coin, W - 16 - ctx.measureText(ct).width - 30, 42, 24, 24);

  ctx.restore();
}

// ============================================================ LOOP
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if (!G) return;
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (state === 'play') update(dt);
  else if (state === 'menu') { G.banner = 0; G.t += dt; G.scroll += 90 * dt; G.dino.ft += dt * 9; for (const c of G.clouds) { c.x -= 10 * dt; if (c.x < -160) c.x = W + 40; } }
  else if (state === 'dead') { G.t += dt; if (G.shake > 0) G.shake -= dt; }
  render();
}

// ============================================================ INÍCIO
resize();
newGame();
requestAnimationFrame(frame);
loadImages().then(() => { resize(); toMenu(); });

// atalho para testes
window.__dmr = { get G() { return G; }, get state() { return state; }, start, update, render };
})();
