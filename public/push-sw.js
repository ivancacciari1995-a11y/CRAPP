// Service worker dedicato alle notifiche push di CrAPP.
// Non memorizza nella cache pagine o asset dell'app.

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  // Il testo arriva cifrato dentro la push: nessuna rete, nessuna attesa. A dispositivo
  // dormiente il browser sveglia il worker per pochi secondi e una fetch di troppo lo fa
  // terminare prima di `showNotification` — la notifica non appare affatto, mentre ad app
  // aperta, con la rete calda, sembra funzionare tutto.
  let dati = null;
  try {
    dati = event.data?.json() ?? null;
  } catch {
    dati = null;
  }
  event.waitUntil(
    self.registration.showNotification(dati?.title ?? "CrAPP", {
      body: dati?.body ?? "Apri l'app per i dettagli.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Il tag fa sostituire la notifica precedente invece di accumularne una pila;
      // `renotify` fa sì che la sostituzione avvisi di nuovo, altrimenti la seconda
      // notifica comparirebbe in silenzio e sembrerebbe non essere mai arrivata.
      tag: "crapp-notifica",
      renotify: true,
    }),
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
