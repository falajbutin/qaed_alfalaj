/* ═══════════════════════════════════════════════
   Service Worker — نظام قعد فلج بطين
   النسخة تتغير عند كل تحديث للتطبيق
═══════════════════════════════════════════════ */
const VERSION    = 'falaj-v1.1.0';
const CACHE_NAME = VERSION;

/* الملفات المطلوبة للعمل بدون إنترنت */
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
];

/* ── تثبيت: تحميل الملفات الأساسية ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] بعض الملفات لم تُخزَّن:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── تفعيل: حذف caches القديمة ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => {
      self.clients.claim();
      // إخطار التطبيق بالتفعيل
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: VERSION }))
      );
    })
  );
});

/* ── استقبال رسالة SKIP_WAITING ── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ── استراتيجية الجلب: Network First ثم Cache ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* تجاهل طلبات Firebase (تعمل online فقط) */
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('google') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('cdnjs')) {
    return; /* السماح للمتصفح بالتعامل معها مباشرة */
  }

  /* للملفات المحلية: Network First مع Cache كاحتياط */
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        /* تخزين نسخة حديثة في الكاش */
        if (response.ok && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        /* بدون إنترنت: أعطِ من الكاش */
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          /* لأي صفحة HTML غير موجودة في الكاش: أعطِ index.html */
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
