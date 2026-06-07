'use strict';
const CACHE = 'roadsign-v1.4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/components.css',
  './css/detection.css',
  './css/evaluation.css',
  './css/responsive.css',
  './js/config.js',
  './js/utils/logger.js',
  './js/utils/geo.js',
  './js/utils/image.js',
  './js/utils/export.js',
  './js/db.js',
  './js/evaluation/parameters.js',
  './js/evaluation/learning.js',
  './js/evaluation/evaluationEngine.js',
  './js/detection/objectDetector.js',
  './js/detection/signDetector.js',
  './js/detection/markingDetector.js',
  './js/detection/classMapper.js',
  './js/detection/yoloDetector.js',
  './js/detection/signTracker.js',
  './js/detection/detector.js',
  './js/camera.js',
  './js/ui/screens.js',
  './js/ui/detection-ui.js',
  './js/ui/evaluation-ui.js',
  './js/ui/export-ui.js',
  './js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => {
        // Intentar cachear cada asset individualmente para no fallar todo si uno da 404
        return Promise.allSettled(ASSETS.map(url => c.add(url)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Solo interceptar GET del mismo origen
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // No interceptar recursos externos (CDN de ONNX Runtime, etc.)
  if (url.origin !== self.location.origin) return;

  // No cachear el modelo ONNX ni los .wasm (grandes; el navegador los gestiona)
  if (url.pathname.endsWith('.onnx') || url.pathname.endsWith('.wasm')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached); // fallback a caché si offline
    })
  );
});
