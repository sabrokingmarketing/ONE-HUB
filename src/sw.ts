/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

// App shell only. Business data is NEVER cached by the service worker — it is
// always fetched live from Convex, so no confidential records persist offline.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// Public lead forms (/f/*) always come from the network: they carry their own embeddable
// frame headers, which the cached app shell (served with X-Frame-Options: DENY) would replace.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//, /^\/f\//] }));
registerRoute(({ request }) => request.destination === "font", new CacheFirst({ cacheName: "fonts" }));

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

// Web Push (Phase 6): payloads are small {title, body, link} objects sent by the backend.
self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; link?: string } = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "ONE HUB", {
      body: data.body,
      icon: "/pwa-192.png",
      badge: "/badge-72.png",
      data: { link: data.link ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data as { link?: string })?.link ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => "focus" in c);
      if (existing) { void (existing as WindowClient).navigate(link); return (existing as WindowClient).focus(); }
      return self.clients.openWindow(link);
    }),
  );
});
