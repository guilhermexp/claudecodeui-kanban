// Service Worker for Claude Code UI PWA
const CACHE_NAME = 'claude-ui-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
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

// Fetch event
self.addEventListener('fetch', event => {
  // Skip Vite development server resources
  if (event.request.url.includes('@vite/client') || 
      event.request.url.includes('/@react-refresh') ||
      event.request.url.includes('?t=') ||
      event.request.url.includes('src/main.jsx') ||
      event.request.url.includes('node_modules')) {
    return; // Let the browser handle these requests normally
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }
        // Otherwise fetch from network
        return fetch(event.request)
          .catch(error => {
            console.log('Fetch failed; returning offline page instead.', error);
            // Return a basic offline response for failed requests
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            // For other resources, just return a network error
            throw error;
          });
      }
    )
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});