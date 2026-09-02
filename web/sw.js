// Cambiar VERSION en cada despliegue que modifique archivos de la app.
const VERSION = '20260902-3';
const CACHE = 'atria-' + VERSION;
const APP_ROOT = new URL('./', self.location.href);
const DEFAULT_LAUNCH_URL = new URL('es/?source=pwa', APP_ROOT).toString();
const ICON_192_URL = new URL('assets/Icon/icon192x192.png', APP_ROOT).toString();
const ICON_512_URL = new URL('assets/Icon/icon512x512.png', APP_ROOT).toString();
const EN_INDEX_URL = new URL('en/index.html', APP_ROOT).toString();
const ES_INDEX_URL = new URL('es/index.html', APP_ROOT).toString();
const ROOT_INDEX_URL = new URL('index.html', APP_ROOT).toString();
const APP_SHELL = [
  new URL('./', APP_ROOT).toString(),
  ROOT_INDEX_URL,
  new URL('manifest.json?v=' + VERSION, APP_ROOT).toString(),
  new URL('sw.js', APP_ROOT).toString(),
  new URL('assets/vendor/html2canvas.min.js', APP_ROOT).toString(),
  new URL('assets/vendor/qrcode.min.js', APP_ROOT).toString(),
  new URL('assets/vendor/fonts/google-fonts.css', APP_ROOT).toString(),
  new URL('assets/vendor/fonts/aFTT7PB1QTsUX8KYth-orYataA.ttf', APP_ROOT).toString(),
  new URL('assets/vendor/fonts/aFTR7PB1QTsUX8KYvrGyIYQ.ttf', APP_ROOT).toString(),
  new URL('assets/vendor/fonts/aFTU7PB1QTsUX8KYhh0.ttf', APP_ROOT).toString(),
  new URL('assets/vendor/fonts/aFTR7PB1QTsUX8KYvumzIYQ.ttf', APP_ROOT).toString(),
  new URL('assets/vendor/fonts/8vIS7w4qzmVxsWxjBZRjr0FKM_04uT6k.ttf', APP_ROOT).toString(),
  new URL('assets/vendor/fonts/8vIS7w4qzmVxsWxjBZRjr0FKM_0KuT6k.ttf', APP_ROOT).toString(),
  new URL('assets/vendor/fonts/8vIS7w4qzmVxsWxjBZRjr0FKM_3mvj6k.ttf', APP_ROOT).toString(),
  new URL('assets/vendor/fonts/8vIS7w4qzmVxsWxjBZRjr0FKM_3fvj6k.ttf', APP_ROOT).toString(),
  new URL('assets/vendor/fonts/8vIS7w4qzmVxsWxjBZRjr0FKM_24vj6k.ttf', APP_ROOT).toString(),
  ICON_192_URL,
  ICON_512_URL,
  new URL('en/', APP_ROOT).toString(),
  EN_INDEX_URL,
  new URL('en/style.css?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/online-services.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/online-views.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/online-chat.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/app.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/p4-p5-import.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/internal-organization.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/p5-snapshots.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/finance-store.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/finance-service.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/finance-recurring.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/core.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/reminders-core.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/reminders-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/notes-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/notes-content.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/notes-detail.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/notes-editor.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/safe-markdown.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/diary-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/diary-editor.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/diary-detail.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/rules-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/search-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/onboarding-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/rules-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/rules-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/search-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/search-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/onboarding-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/onboarding-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/routines-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/routines-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/projects-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/projects-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/crisis-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/crisis-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/library-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/library-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/notifications-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/notifications-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/agenda-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/agenda-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/fronting-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/fronting-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/config-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/config-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/modules/tracker-view.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/online/presence.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/online/realtime.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('core/online/sync.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('en/manifest.json?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/', APP_ROOT).toString(),
  ES_INDEX_URL,
  new URL('es/style.css?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/online-services.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/online-views.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/online-chat.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/app.js?v=' + VERSION, APP_ROOT).toString(),
  new URL('es/manifest.json?v=' + VERSION, APP_ROOT).toString(),
];

function isCacheableResponse(response) {
  return !!response && response.ok;
}

function navigationFallbackFor(url) {
  const enPath = new URL('en/', APP_ROOT).pathname;
  const esPath = new URL('es/', APP_ROOT).pathname;
  if (url.pathname.startsWith(enPath)) return EN_INDEX_URL;
  if (url.pathname.startsWith(esPath)) return ES_INDEX_URL;
  return ROOT_INDEX_URL;
}

function shellUrlForNotification(data) {
  const launchUrl = new URL(DEFAULT_LAUNCH_URL);
  if (!data?.nav && !data?.tab) return launchUrl.toString();
  const params = new URLSearchParams();
  if (data?.nav) params.set('notifNav', data.nav);
  if (data?.tab) params.set('notifTab', data.tab);
  params.set('source', 'pwa');
  launchUrl.search = params.toString();
  return launchUrl.toString();
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    ).then(() => clients.claim())
  );
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      await caches.match(request) ||
      await caches.match(navigationFallbackFor(new URL(request.url)))
    );
  }
}

async function handleStatic(request) {
  const cache = await caches.open(CACHE);
  const cached = await caches.match(request);

  // Stale-while-revalidate: respond from cache immediately, update in background
  const networkPromise = fetch(request).then(response => {
    if (isCacheableResponse(response)) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  if (cached) {
    // Return cached instantly; network update runs in background
    return cached;
  }

  // Nothing cached yet; wait for network.
  return (await networkPromise) || Response.error();
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  event.respondWith(handleStatic(event.request));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, icon, data } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        body: body || '',
        tag: tag || 'atria-notif',
        icon: icon || ICON_192_URL,
        renotify: true,
        data: data || {},
      })
    );
  }
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = payload.title || 'Atria';
  const kind = payload.kind || 'message';
  const fallback = kind === 'reminder'
    ? {
      body: 'Tienes un recordatorio / You have a reminder',
      tag: 'atria-reminder',
      data: { nav: 'recordatorios' },
    }
    : kind === 'friend_request'
    ? {
      body: 'Nueva solicitud de amistad / New friend request',
      tag: 'atria-online-friend-request',
      data: { nav: 'online-amigos' },
    }
    : {
      body: 'Nuevo mensaje online / New online message',
      tag: 'atria-online-message',
      data: { nav: 'innerchat', tab: 'online' },
    };
  const body = payload.body || fallback.body;
  const data = payload.data || fallback.data;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: payload.tag || fallback.tag,
      icon: payload.icon || ICON_192_URL,
      renotify: true,
      data,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const nav = notifData.nav || null;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url) {
          if (nav) client.postMessage({ type: 'NOTIF_NAV', nav, tab: notifData.tab || null });
          client.focus();
          return;
        }
      }
      if (clients.openWindow) clients.openWindow(shellUrlForNotification(notifData));
    })
  );
});
