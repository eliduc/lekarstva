/*
 * Service worker: приложение открывается и без интернета.
 * Стратегия: сеть в приоритете (обновления доходят сразу), при недоступности — кэш.
 * Запросы к GitHub API (api.github.com, другой origin) идут мимо кэша.
 */
var CACHE = 'meds-shell-v10';
var SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'js/i18n.js',
  'js/data.js',
  'js/storage.js',
  'js/sync.js',
  'js/app.js',
  'manifest.json',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'img/esomeprazole.jpg',
  'img/fusid.jpg',
  'img/forxiga.jpg',
  'img/amiodacore.jpg',
  'img/eliquis.jpg',
  'img/lipitor.jpg',
  'img/avilac.jpg',
  'img/aerovent.jpg',
  'img/flixotide.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // GitHub/Anthropic API — мимо кэша
  e.respondWith(
    fetch(e.request).then(function (resp) {
      if (resp && resp.ok) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return resp;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('index.html');
      });
    })
  );
});
