/* ============================================================
 * YouTube Ultra – Service Worker
 * Hält die App-Shell offline bereit (PWA-Kriterium).
 * Strategie: network-first für eigene Dateien (schnelle Updates),
 * externe Quellen (Bilder/APIs) nie cachen → immer aktuell.
 * ============================================================ */
var CACHE = 'yt-ultra-v1';
var SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/styles.css',
  './js/config.js', './js/types.js', './js/format.js', './js/db.js',
  './js/settings.js', './js/api.js', './js/recommend.js', './js/store.js',
  './js/ui.js', './js/glow.js', './js/player.js', './js/router.js',
  './js/app.js', './js/install.js',
  './js/pages/home.js', './js/pages/search.js', './js/pages/watch.js',
  './js/pages/shorts.js', './js/pages/subs.js', './js/pages/history.js',
  './js/pages/lists.js', './js/pages/playlists.js', './js/pages/channel.js',
  './js/pages/settings.js', './js/pages/mine.js'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // Nur eigene Dateien; externe (Thumbnails/APIs) immer aus dem Netz
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
