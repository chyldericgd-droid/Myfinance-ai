// Finance AI Service Worker v4.12 — Stale-While-Revalidate + Offline Support
const CACHE = 'finance-ai-v4.12';
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
  
  // v4.12: Support local IA offline via postMessage
  if (e.data && e.data.type === 'ANALYZE_OFFLINE') {
    const analysis = performOfflineAnalysis(e.data.payload);
    e.ports[0].postMessage({ type: 'OFFLINE_ANALYSIS', data: analysis });
  }
});

// === v4.12 Offline IA Analysis (local, no API) ===
function performOfflineAnalysis(data) {
  const { transactions, kpis, language } = data;
  
  if (!transactions || transactions.length === 0) {
    return { text: "📝 No transactions yet. Enter your first one with the + button.", src: 'LOCAL' };
  }
  
  // Simple behavioral analysis without API
  const expense = transactions.filter(t => t.type === 'expense').length;
  const income = transactions.filter(t => t.type === 'income').length;
  const avgTx = expense > 0 ? transactions.filter(t => t.type === 'expense').length / 7 : 0;
  
  let insight = '';
  if (language === 'fr') {
    if (avgTx > 3) insight = `💸 Rythme moyen: ${Math.round(avgTx)}/j. Attention à l'accumulation.`;
    else if (avgTx > 1) insight = `✅ Rythme stable et mesurable.`;
    else insight = `🎯 Peu de transactions. Continue d'enregistrer pour une analyse précise.`;
  } else if (language === 'es') {
    if (avgTx > 3) insight = `💸 Ritmo promedio: ${Math.round(avgTx)}/día. Cuidado con la acumulación.`;
    else if (avgTx > 1) insight = `✅ Ritmo estable y medible.`;
    else insight = `🎯 Pocas transacciones. Continúa registrando para análisis preciso.`;
  } else if (language === 'pt') {
    if (avgTx > 3) insight = `💸 Ritmo médio: ${Math.round(avgTx)}/dia. Cuidado com acumulação.`;
    else if (avgTx > 1) insight = `✅ Ritmo estável e mensurável.`;
    else insight = `🎯 Poucas transações. Continue registrando para análise precisa.`;
  } else {
    if (avgTx > 3) insight = `💸 Average pace: ${Math.round(avgTx)}/day. Watch for drift.`;
    else if (avgTx > 1) insight = `✅ Steady and measurable pace.`;
    else insight = `🎯 Few transactions yet. Keep logging for accurate analysis.`;
  }
  
  return { text: insight, src: 'LOCAL' };
}

// Stale-While-Revalidate helper
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

  // Never cache APIs (always network, with offline fallback)
  if (/groq\.com|googleapis\.com|google\.com\/o\/oauth2|accounts\.google\.com|supabase/i.test(url.href)) {
    e.respondWith(
      fetch(e.request).catch(() => {
        // v4.12: Return offline response for APIs
        if (e.request.method === 'GET') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Navigations: network-first, fallback to cached shell (offline-safe)
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

  // Fonts, shell, same-origin assets: Stale-While-Revalidate (instant open)
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.host) || url.origin === self.location.origin) {
    e.respondWith(swr(e.request));
    return;
  }
});

// === v4.12 Notification support ===
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

// v4.12: Background sync for notifications (if available)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (e) => {
    if (e.tag === 'check-alerts') {
      e.waitUntil(notifyAlerts());
    }
  });
}

async function notifyAlerts() {
  // This would be called periodically to check for alerts even when app is closed
  console.log('[SW v4.12] Periodic sync check for alerts');
  // Implementation depends on IndexedDB access from SW
}
