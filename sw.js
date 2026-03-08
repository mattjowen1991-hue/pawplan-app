/* ═══════════════════════════════════════════════════
   PAWPLAN · sw.js
   Service Worker — network-first, HTML never cached
════════════════════════════════════════════════════ */

const CACHE_NAME = 'pawplan-v38';
const CDN_CACHE  = 'pawplan-cdn';   // separate, never wiped

// ── Install: skip waiting so new SW activates immediately ─
self.addEventListener('install', event => {
  self.skipWaiting();
});

// ── Activate: clear old APP caches only, keep CDN cache ───
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      ))
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
  if (url.hostname === self.location.hostname &&
      (url.pathname.endsWith('.html') || url.pathname.endsWith('/'))) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Own JS / CSS / assets — network-first, cache as offline fallback
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

  // 4. Google Fonts & CDN — cache-first in separate persistent cache
  event.respondWith(
    caches.open(CDN_CACHE).then(cache =>
      cache.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        });
      })
    )
  );
});
