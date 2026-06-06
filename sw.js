// Service Worker para RoadSign Evaluator

const CACHE_NAME = 'roadsign-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/css/dark-mode.css',
    '/css/components.css',
    '/js/app.js',
    '/js/camera.js',
    '/js/db.js',
    '/js/modes.js'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                self.skipWaiting();
            })
    );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                self.clients.claim();
            })
    );
});

// Estrategia de caché: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignorar solicitudes no-GET
    if (request.method !== 'GET') {
        return;
    }
    
    // Ignorar solicitudes a dominios externos
    if (url.origin !== location.origin) {
        return;
    }
    
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Si la respuesta es válida, guardar en caché
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(request, responseToCache);
                        });
                }
                return response;
            })
            .catch(() => {
                // Si la red falla, intentar desde caché
                return caches.match(request)
                    .then((response) => {
                        return response || createOfflineResponse();
                    });
            })
    );
});

// Respuesta offline
function createOfflineResponse() {
    return new Response(
        '<html><body><h1>Offline</h1><p>No hay conexión a internet.</p></body></html>',
        {
            headers: { 'Content-Type': 'text/html' }
        }
    );
}

// Manejo de mensajes desde el cliente
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
        case 'GET_VERSION':
            event.ports[0].postMessage({
                version: CACHE_NAME
            });
            break;
        default:
            break;
    }
});

// Notificaciones push (futuro)
self.addEventListener('push', (event) => {
    if (event.data) {
        const options = event.data.json();
        event.waitUntil(
            self.registration.showNotification('RoadSign', options)
        );
    }
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

console.log('[Service Worker] Loaded');
