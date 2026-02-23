const CACHE_NAME = 'shift-tracker-v16';

const ASSETS = [
  'index.html',
  'manifest.json',
  'icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Добавляем ресурсы по одному, чтобы один сбой не отменил всё
      return Promise.allSettled(ASSETS.map(asset => cache.add(asset)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Не перехватываем запросы к API и внешним скриптам
  const url = event.request.url;
  if (
    url.includes('google') || 
    url.includes('googleapis') || 
    url.includes('tailwindcss') ||
    url.includes('esm.sh')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      
      return fetch(event.request).catch(() => {
        // Fallback для навигации в оффлайне
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});
