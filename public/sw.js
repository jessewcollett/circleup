// Service Worker with network-first strategy
const CACHE_NAME = 'circleup-cache-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache GET requests with http/https scheme
        const url = new URL(event.request.url);
        if (
          response &&
          response.status === 200 &&
          event.request.method === 'GET' &&
          (url.protocol === 'http:' || url.protocol === 'https:')
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // If the network request fails, try to return the cached version
        return caches.match(event.request);
      })
  );
});