const CACHE_NAME = 'doce-horas-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  'imagenes/12horas-192.png',
  'imagenes/12horas-512.png'
];

// Instalar y cachear recursos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

// Activar y limpiar cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: red primero, caché como fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return; // No cachear API
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});

// Recibir notificación push
self.addEventListener('push', e => {
  let data = { title: '12 HORAS', body: 'Nueva notificación', icon: '/12horas.jpg' };
  try { data = { ...data, ...JSON.parse(e.data.text()) }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon  || 'imagenes/12horas-512.jpg',

      vibrate: [200, 100, 200],
      data:    data.data  || {},
      actions: [{ action: 'open', title: 'Ver detalle' }]
    })
  );
});

// Clic en notificación push
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});