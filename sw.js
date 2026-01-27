const CACHE_NAME = 'himagro-hub-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json',
    './Logo/Himagro.png',
    './Logo/Unsil.png',
    './Logo/Kabinet.png',
    './Logo/BluSpeed.png',
    './Logo/Berdampak.png'
];

// Install Event - Cache Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching app shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event - Cleanup Old Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Serve from Cache, then Network
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests specifically for Google Apps Script to avoid CORS issues in strict mode
    // But usually we just let them pass through. 
    // We mainly want to cache local assets.

    if (event.request.url.startsWith('chrome-extension')) return;

    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return cached response if found
            if (response) {
                return response;
            }

            // Otherwise fetch from network
            return fetch(event.request).catch(() => {
                // Fallback or offline page logic can go here
                // For now, if offline and not in cache, it typically fails
            });
        })
    );
});
