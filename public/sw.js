// Service Worker for Claude Code UI PWA
const CACHE_NAME = 'claude-ui-v1';
const DYNAMIC_CACHE = 'claude-ui-dynamic-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event with Network First strategy for API calls and Cache First for assets
self.addEventListener('fetch', event => {
  // Skip Vite development server resources
  if (event.request.url.includes('@vite/client') || 
      event.request.url.includes('/@react-refresh') ||
      event.request.url.includes('?t=') ||
      event.request.url.includes('src/main.jsx') ||
      event.request.url.includes('node_modules')) {
    return; // Let the browser handle these requests normally
  }

  // Network First for API calls
  if (event.request.url.includes('/api/') || event.request.url.includes('/socket.io/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          return response;
        })
        .catch(error => {
          console.log('API fetch failed:', error);
          // Could return cached data here if appropriate
          throw error;
        })
    );
    return;
  }

  // Cache First with Network Fallback for other resources
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request).then(fetchResponse => {
          // Don't cache non-successful responses
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }

          // Clone the response
          const responseToCache = fetchResponse.clone();

          // Cache successful responses
          caches.open(DYNAMIC_CACHE)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return fetchResponse;
        });
      })
      .catch(error => {
        console.log('Fetch failed; returning offline page instead.', error);
        // Return offline page for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
        throw error;
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});