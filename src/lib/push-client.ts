function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function chiaviDa(sub: PushSubscription) {
  const json = sub.toJSON();
  return { p256dh: json.keys?.["p256dh"] ?? "", auth: json.keys?.["auth"] ?? "" };
}

export function pushSupportato() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function statoNotifiche(): Promise<boolean> {
  if (!pushSupportato()) return false;
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  const sub = await reg?.pushManager.getSubscription();
  return Boolean(sub);
}

export async function attivaNotifiche(giocatoreId: string): Promise<void> {
  if (!pushSupportato()) throw new Error("Notifiche non supportate su questo dispositivo");

  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") throw new Error("Permesso notifiche negato");

  const config = await fetch("/api/public/push-config").then((r) => r.json());
  if (!config?.publicKey) throw new Error("Notifiche non configurate");

  const reg = await navigator.serviceWorker.register("/push-sw.js");
  await navigator.serviceWorker.ready;

  const esistente = await reg.pushManager.getSubscription();
  const sub =
    esistente ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(config.publicKey) as BufferSource,
    }));

  const res = await fetch("/api/public/push-subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint, giocatoreId, ...chiaviDa(sub) }),
  });
  if (!res.ok) throw new Error("Salvataggio iscrizione non riuscito");
}

export async function disattivaNotifiche(): Promise<void> {
  if (!pushSupportato()) return;
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/public/push-subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  }
  await reg?.unregister();
}
