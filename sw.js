// Finance AI Service Worker v4.11 — Stale-While-Revalidate
const CACHE = 'finance-ai-v4.11';
const SHELL = ['./', './index.html', './manifest.json', './icon-96.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) self.skipWaiting();
});

// Stale-While-Revalidate helper
async function swr(req){
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then(resp => {
    if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
      cache.put(req, resp.clone()).catch(()=>{});
    }
    return resp;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never cache APIs (always network)
  if (/groq\.com|googleapis\.com|google\.com\/o\/oauth2|accounts\.google\.com/i.test(url.href)) {
    return;
  }

  // Navigations: network-first, fallback to cached shell (offline-safe)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put('./index.html', clone)).catch(()=>{});
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Fonts, shell, same-origin assets: Stale-While-Revalidate (instant open)
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.host) || url.origin === self.location.origin) {
    e.respondWith(swr(e.request));
    return;
  }
});

// Notification click → focus app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { c.postMessage({type:'NOTIF_CLICK'}); return c.focus(); } }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});
