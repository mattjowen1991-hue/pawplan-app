/* ═══════════════════════════════════════════════════
   PAWPLAN · sw.js
   Service Worker — network-first, HTML never cached
════════════════════════════════════════════════════ */

const CACHE_NAME = 'pawplan-v8';

// ── Install: skip waiting so new SW activates immediately ─
self.addEventListener('install', event => {
  self.skipWaiting();
});

// ── Activate: clear ALL old caches, claim clients ─────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ─────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Supabase API — always network only, never cache
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // 2. HTML — network only, NEVER cache
  //    Ensures index.html is always fresh so CSS/JS updates show immediately
  if (url.hostname === self.location.hostname &&
      (url.pathname.endsWith('.html') || url.pathname.endsWith('/'))) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. JS / CSS / assets — network-first, cache only as offline fallback
  if (url.hostname === self.location.hostname) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 4. Google Fonts & CDN — cache-first (these never change)
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
