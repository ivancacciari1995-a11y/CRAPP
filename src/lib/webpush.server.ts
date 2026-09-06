/** Invio di notifiche web push (senza payload) firmate con VAPID, compatibile con il runtime edge. */

function base64UrlDecode(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

async function importaChiave(publicKey: string, privateKey: string) {
  const pub = base64UrlDecode(publicKey);
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: privateKey,
      x: base64UrlEncode(pub.slice(1, 33)),
      y: base64UrlEncode(pub.slice(33, 65)),
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function creaVapidJwt(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string,
) {
  const header = encodeJson({ typ: "JWT", alg: "ES256" });
  const payload = encodeJson({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  });
  const chiave = await importaChiave(publicKey, privateKey);
  const firma = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    chiave,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${base64UrlEncode(new Uint8Array(firma))}`;
}

/**
 * Per quante ore un messaggio in coda su `promemoria_push` resta un promemoria.
 *
 * La coda si svuota solo quando il dispositivo legge il messaggio, e se la push non arriva
 * mai (registrazione scaduta: i server push accettano con 2xx e poi buttano via) la riga
 * resta lì. Senza una scadenza, la notifica successiva — di qualunque tipo — mostrerebbe
 * un sollecito di giorni prima, per un evento ormai passato.
 */
export const ORE_VALIDITA_PROMEMORIA = 12;

/** Un promemoria accodato è ancora attuale? */
export function promemoriaAncoraValido(creatoIl: string, adesso: Date = new Date()): boolean {
  const creato = Date.parse(creatoIl);
  if (Number.isNaN(creato)) return false;
  return adesso.getTime() - creato < ORE_VALIDITA_PROMEMORIA * 60 * 60 * 1000;
}

/** Invia una notifica "vuota": il service worker recupera poi il testo aggiornato. */
export async function inviaPush(endpoint: string): Promise<number> {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:crapp@crapvolley.it";
  if (!publicKey || !privateKey) throw new Error("Chiavi VAPID non configurate");

  const audience = new URL(endpoint).origin;
  const jwt = await creaVapidJwt(audience, subject, publicKey, privateKey);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
      "Content-Length": "0",
    },
  });
  return res.status;
}
