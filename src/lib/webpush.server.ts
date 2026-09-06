/** Invio di notifiche web push con payload cifrato (RFC 8291), firmate con VAPID, compatibile con il runtime edge. */

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

function concat(...parti: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parti.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const parte of parti) {
    out.set(parte, offset);
    offset += parte.length;
  }
  return out;
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

/** Un dispositivo iscritto: endpoint del servizio push e chiavi con cui cifrare per lui. */
export type IscrizionePush = { endpoint: string; p256dh: string; auth: string };

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, byte: number) {
  const chiave = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    chiave,
    byte * 8,
  );
  return new Uint8Array(bits);
}

function etichetta(testo: string): Uint8Array {
  return concat(new TextEncoder().encode(testo), new Uint8Array([0]));
}

/**
 * Cifra il testo della notifica nel corpo della push, in formato `aes128gcm`.
 *
 * Esportata solo per i test: il payload viaggia dentro la push proprio perché il service
 * worker non abbia bisogno della rete per sapere cosa mostrare — a dispositivo dormiente
 * il browser lo sveglia per pochi secondi e una fetch di troppo lo fa morire prima di
 * `showNotification`, cioè niente notifica ad app chiusa.
 */
export async function cifraPayload(
  iscrizione: IscrizionePush,
  testoInChiaro: string,
): Promise<Uint8Array> {
  const uaPublic = base64UrlDecode(iscrizione.p256dh);
  const authSecret = base64UrlDecode(iscrizione.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const effimera = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", effimera.publicKey));
  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const condiviso = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, effimera.privateKey, 256),
  );

  const ikm = await hkdf(
    authSecret,
    condiviso,
    concat(etichetta("WebPush: info"), uaPublic, asPublic),
    32,
  );
  const cek = await hkdf(salt, ikm, etichetta("Content-Encoding: aes128gcm"), 16);
  const nonce = await hkdf(salt, ikm, etichetta("Content-Encoding: nonce"), 12);

  // Il delimitatore 0x02 chiude l'ultimo (e unico) record: il testo sta sotto i 4 KB.
  const chiaro = concat(new TextEncoder().encode(testoInChiaro), new Uint8Array([2]));
  const aes = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, [
    "encrypt",
  ]);
  const cifrato = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      aes,
      chiaro as BufferSource,
    ),
  );

  // Intestazione RFC 8188: salt(16) | record size(4) | lunghezza chiave(1) | chiave(65).
  const dimensioneRecord = new Uint8Array(4);
  new DataView(dimensioneRecord.buffer).setUint32(0, 4096);
  return concat(salt, dimensioneRecord, new Uint8Array([asPublic.length]), asPublic, cifrato);
}

/**
 * Invia la notifica: titolo e testo viaggiano cifrati dentro la push.
 *
 * Torna anche il corpo della risposta, non solo lo stato: un servizio push che rifiuta
 * spiega il perché lì dentro, e buttarlo via lasciava i guasti indistinguibili fra loro.
 */
export async function inviaPush(
  iscrizione: IscrizionePush,
  titolo: string,
  testo: string,
): Promise<{ stato: number; corpo: string }> {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:crapp@crapvolley.it";
  if (!publicKey || !privateKey) throw new Error("Chiavi VAPID non configurate");

  const audience = new URL(iscrizione.endpoint).origin;
  const jwt = await creaVapidJwt(audience, subject, publicKey, privateKey);
  const corpo = await cifraPayload(iscrizione, JSON.stringify({ title: titolo, body: testo }));

  const res = await fetch(iscrizione.endpoint, {
    method: "POST",
    headers: {
      TTL: "86400",
      // Senza `Urgency` il servizio push usa "normal", e un telefono in risparmio
      // energetico (doze) accumula i messaggi normali fino al risveglio: la notifica
      // arriva solo quando il dispositivo è già attivo, cioè quando l'app è aperta.
      // "high" chiede la consegna immediata anche a schermo spento (RFC 8030 §5.3).
      Urgency: "high",
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
    },
    body: corpo as BodyInit,
  });

  const risposta = (await res.text().catch(() => "")).slice(0, 500);
  if (!res.ok) console.error("inviaPush", res.status, risposta);
  return { stato: res.status, corpo: risposta };
}
