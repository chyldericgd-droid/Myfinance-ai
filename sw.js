// Finance AI Service Worker v4.8
const CACHE = 'finance-ai-v4.8';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Never cache APIs
  if (/groq\.com|googleapis\.com|google\.com\/o\/oauth2/i.test(url.href)) {
    return; // pass-through
  }
  // Fonts & shell: cache-first
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.host) || SHELL.some(p => url.pathname.endsWith(p.replace('./','')))) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
        return resp;
      }).catch(() => caches.match('./index.html')))
    );
    return;
  }
  // Navigation: network-first
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }
});

// Background sync hook (placeholder — app posts message when online)
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-finance') {
    // App handles via online listener
  }
});
