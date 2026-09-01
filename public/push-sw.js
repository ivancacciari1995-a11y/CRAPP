// Service worker dedicato alle notifiche push del turno palloni.
// Non memorizza nella cache pagine o asset dell'app.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function testoNotifica() {
  try {
    const sub = await self.registration.pushManager.getSubscription();
    if (!sub) return null;
    const res = await fetch("/api/public/push-messaggio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const dati = await testoNotifica();
      await self.registration.showNotification(dati?.title ?? "CrAPP · Turno palloni", {
        body: dati?.body ?? "Controlla il turno palloni di oggi.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "turno-palloni",
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const aperto = clientList.find((c) => "focus" in c);
      if (aperto) return aperto.focus();
      return self.clients.openWindow("/");
    }),
  );
});
