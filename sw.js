/* ════════════════════════════════════════════════════════════════════
   Finance AI OS — Service Worker v9.1.0
   Strategy: stale-while-revalidate for shell, network-first for AI APIs
   ════════════════════════════════════════════════════════════════════ */
const VERSION = '9.1.0';
const CACHE_NAME = 'finance-ai-v' + VERSION;
const SHELL = ['./','./index.html','./manifest.json','./icon-96.png','./icon-192.png','./icon-512.png','./icon-aladdin.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c =>
      c.addAll(SHELL.map(u => new Request(u, {cache:'reload'}))).catch(() =>
        c.addAll(['./','./index.html'])
      )
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
  if (e.data && e.data.type === 'GET_VERSION') {
    e.ports[0] && e.ports[0].postMessage({ version: VERSION });
  }
});

/* Network-first for AI APIs, stale-while-revalidate for shell */
self.addEventListener('fetch', e => {
  const url = e.request.url;

  /* Always network for AI APIs and external auth */
  if (/groq\.com|googleapis\.com|generativelanguage|openai\.com|accounts\.google|supabase/i.test(url)) {
    e.respondWith(
      fetch(e.request).catch(() => {
        if (e.request.method === 'GET') return caches.match('./index.html');
        return new Response('{"error":"offline"}', {status:503, headers:{'Content-Type':'application/json'}});
      })
    );
    return;
  }

  /* Navigate → serve shell */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(cached => cached || fetch(e.request)).catch(() => fetch('./index.html'))
    );
    return;
  }

  /* Shell files → cache-first with background update */
  if (e.request.method === 'GET' && (url.includes(self.location.origin) || url.startsWith('.'))) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        const networkPromise = fetch(e.request).then(resp => {
          if (resp && resp.ok && resp.type !== 'opaque') cache.put(e.request, resp.clone()).catch(() => {});
          return resp;
        }).catch(() => null);
        return cached || networkPromise;
      })
    );
    return;
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (const c of clients) {
      if ('focus' in c) { c.postMessage({type:'NOTIF_CLICK', tag:e.notification.tag}); return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Finance AI OS', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-96.png',
      tag: data.tag || 'finance-ai',
      renotify: true,
      vibrate: [120, 60, 120]
    })
  );
});
