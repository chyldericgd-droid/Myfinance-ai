// Finance AI Service Worker v4.19.0 — Stale-While-Revalidate + Offline + APK background
const CACHE = 'finance-ai-v4.19.0';
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
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

// Stale-While-Revalidate
async function swr(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then(resp => {
    if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
      cache.put(req, resp.clone()).catch(() => {});
    }
    return resp;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never cache APIs
  if (/groq\.com|googleapis\.com|google\.com\/o\/oauth2|accounts\.google\.com|supabase/i.test(url.href)) {
    e.respondWith(
      fetch(e.request).catch(() => {
        if (e.request.method === 'GET') return caches.match('./index.html');
        return new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Navigations: network-first, fallback shell
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put('./index.html', clone)).catch(() => {});
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Shell + fonts: Stale-While-Revalidate
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.host) || url.origin === self.location.origin) {
    e.respondWith(swr(e.request));
    return;
  }
});

// Notification click — focus app or open
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) {
        c.postMessage({ type: 'NOTIF_CLICK', tag: e.notification.tag });
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});

// Push notifications (APK/PWA)
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : { title: 'Finance AI OS', body: '' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'Finance AI OS', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-96.png',
      tag: data.tag || 'finance-ai',
      renotify: true,
      vibrate: [150, 80, 150]
    })
  );
});
