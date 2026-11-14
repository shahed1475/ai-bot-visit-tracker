/* Service worker: makes the dashboard shell installable and available offline.
 * Rules that must hold (tests/test_pwa_assets.js):
 *  - /api/* is never intercepted or cached: it is private, cookie-protected data.
 *  - Only same-origin GET requests are handled.
 *  - Network first, so a new deploy shows up immediately; the cache is the offline fallback.
 * Bump VERSION to drop old caches. */
const VERSION = 'v2';
const CACHE = `abt-shell-${VERSION}`;
const SHELL = [
  '/', '/app/', '/site.css', '/app/app.css', '/app/app.js', '/app/charts.js', '/app/demo-data.js', '/manifest.webmanifest',
  '/favicon.svg', '/brand/mark.svg', '/icons/icon-192.png', '/icons/icon-512.png',
  '/fonts/geist-latin-wght-normal.woff2', '/fonts/geist-mono-latin-wght-normal.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('abt-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      const cache = await caches.open(CACHE);
      await cache.put(req, res.clone());
    }
    return res;
  } catch {
    const hit = (await caches.match(req)) || (req.mode === 'navigate' ? (await caches.match(new URL(req.url).pathname.startsWith('/app/') ? '/app/' : '/')) || (await caches.match('/')) : undefined);
    return hit || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
  }
}
