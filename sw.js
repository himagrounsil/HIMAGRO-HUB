const CACHE_NAME = 'himagro-hub-v3';
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

// Fetch Event - Network First Strategy
self.addEventListener('fetch', (event) => {
    if (event.request.url.startsWith('chrome-extension')) return;

    // Strategy: Network First
    // Sangat penting untuk aplikasi yang sering update agar user tidak terjebak di versi lama
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Simpan copy ke cache jika berhasil
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Jika network gagal (offline), ambil dari cache
                return caches.match(event.request);
            })
    );
});
