'use strict';
const CACHE_NAME = 'roadsign-v1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/components.css',
  '/css/detection.css',
  '/css/evaluation.css',
  '/css/responsive.css',
  '/js/config.js',
  '/js/utils/logger.js',
  '/js/utils/geo.js',
  '/js/utils/image.js',
  '/js/utils/export.js',
  '/js/db.js',
  '/js/evaluation/parameters.js',
  '/js/evaluation/learning.js',
  '/js/evaluation/evaluationEngine.js',
  '/js/detection/objectDetector.js',
  '/js/detection/signDetector.js',
  '/js/detection/markingDetector.js',
  '/js/detection/detector.js',
  '/js/camera.js',
  '/js/ui/screens.js',
  '/js/ui/detection-ui.js',
  '/js/ui/evaluation-ui.js',
  '/js/ui/export-ui.js',
  '/js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // TF.js y fuentes: network-first con fallback a caché
  const isExternal = !e.request.url.startsWith(self.location.origin);
  if (isExternal) {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Assets locales: cache-first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});
