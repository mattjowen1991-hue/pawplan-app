/* ═══════════════════════════════════════════════════
   PAWPLAN · sw.js
   Service Worker — offline caching & PWA support
════════════════════════════════════════════════════ */

const CACHE_NAME = 'pawplan-v1';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/pawplan-app/',
  '/pawplan-app/index.html',
  '/pawplan-app/css/styles.css',
  '/pawplan-app/js/schedule.js',
  '/pawplan-app/js/db.js',
  '/pawplan-app/js/ui.js',
  '/pawplan-app/js/app.js',
  '/pawplan-app/manifest.json',
];

// ── Install: cache static assets ─────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for static, network-first for Supabase ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network-first for Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If offline, return a helpful JSON error
          return new Response(
            JSON.stringify({ error: 'offline', message: 'No internet connection' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Cache-first for Google Fonts
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Cache-first for everything else (app shell)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
