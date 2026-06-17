/// <reference lib="webworker" />
// Service Worker custom (vite-plugin-pwa em injectManifest, ADR-0004).
// Mantém o precache do app-shell e adiciona os handlers de Web Push (Fase 2).
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Atualização imediata (registerType: 'autoUpdate').
void self.skipWaiting();
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Precache do app-shell (lista injetada no build) + fallback de navegação (SPA).
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
}

self.addEventListener("push", (event) => {
  let data: PushPayload = {};
  try {
    if (event.data) data = event.data.json() as PushPayload;
  } catch {
    // payload ausente/ inválido: usa textos padrão.
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Habit Tracker", {
      body: data.body ?? "Hora de cuidar dos seus hábitos. 💪",
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
