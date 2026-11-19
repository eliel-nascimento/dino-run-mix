const CACHE = 'dino-mix-run-v3';
const FILES = ['./', 'index.html', 'game.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'img/bg-city-far.svg', 'img/bg-city-near.svg', 'img/bg-desert-far.svg', 'img/bg-desert-near.svg', 'img/bg-forest-far.svg', 'img/bg-forest-near.svg', 'img/bg-snow-far.svg', 'img/bg-snow-near.svg', 'img/bg-space-far.svg', 'img/bg-space-near.svg', 'img/cloud.svg', 'img/coin.svg', 'img/dino-dead.svg', 'img/dino-duck1.svg', 'img/dino-duck2.svg', 'img/dino-jump.svg', 'img/dino-run1.svg', 'img/dino-run2.svg', 'img/fly-bird1.svg', 'img/fly-bird2.svg', 'img/fly-drone1.svg', 'img/fly-drone2.svg', 'img/fly-ibird1.svg', 'img/fly-ibird2.svg', 'img/fly-ufo1.svg', 'img/fly-ufo2.svg', 'img/moon.svg', 'img/obs-alien.svg', 'img/obs-asteroid.svg', 'img/obs-bush.svg', 'img/obs-cactus.svg', 'img/obs-cactus2.svg', 'img/obs-cone.svg', 'img/obs-crate.svg', 'img/obs-crystal.svg', 'img/obs-hydrant.svg', 'img/obs-ice.svg', 'img/obs-log.svg', 'img/obs-mushroom.svg', 'img/obs-pine.svg', 'img/obs-rock.svg', 'img/obs-snowman.svg', 'img/planet.svg', 'img/star.svg', 'img/sun.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
    return r;
  }).catch(() => caches.match('index.html'))));
});
