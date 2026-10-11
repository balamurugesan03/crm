/* NexusCRM service worker. Works at the domain root or under a sub-path (e.g. /crm/).
 * - Hashed build assets (<scope>assets/*): cache-first (immutable).
 * - Page navigations: network-first, falling back to the cached app shell when offline.
 * - API calls (<scope>api/*) and cross-origin requests are never cached: CRM data must stay live and private.
 */
const VERSION = 'nexus-v2';
const SCOPE = new URL(self.registration.scope).pathname; // '/' or '/crm/'
const SHELL = ['', 'manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png'].map((p) => SCOPE + p);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith(`${SCOPE}api`)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(SCOPE, copy));
          return res;
        })
        .catch(() => caches.match(SCOPE)),
    );
    return;
  }

  if (url.pathname.startsWith(`${SCOPE}assets/`)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
