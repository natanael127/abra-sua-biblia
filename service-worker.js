const CACHE_NAME = 'abra-sua-biblia-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/assets/js/page.js',
  '/assets/js/bibleUtils.js',
  '/assets/js/xmlBibles.js',
  '/assets/js/bibleManager.js',
  '/assets/icons/favicon.ico',
  '/assets/icons/icon.png',
  '/assets/data/bibles/index.json',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (like Google Analytics)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Check if valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clone the response
            const responseToCache = networkResponse.clone();

            // Cache the fetched resource (especially Bible JSON files)
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Cache Bible data files dynamically
                if (event.request.url.includes('/assets/data/bibles/') ||
                    event.request.url.includes('.ebf1.json')) {
                  cache.put(event.request, responseToCache);
                }
              });

            return networkResponse;
          })
          .catch(() => {
            // Network failed, return offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            return new Response('Offline', { status: 503, statusText: 'Offline' });
          });
      })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle cache update for Bible files
  if (event.data && event.data.type === 'CACHE_BIBLE') {
    const bibleUrl = event.data.url;
    caches.open(CACHE_NAME)
      .then((cache) => {
        fetch(bibleUrl)
          .then((response) => {
            if (response.ok) {
              cache.put(bibleUrl, response);
            }
          });
      });
  }
});
