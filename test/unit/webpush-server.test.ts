/**
 * Check dell'invio push server-side: `bun test/unit/webpush-server.test.ts`.
 * `inviaPush` firma un JWT VAPID con Web Crypto e fa una POST all'endpoint del
 * browser: qui generiamo una vera coppia di chiavi P-256 e sostituiamo `fetch`
 * per intercettare la richiesta, così il test non tocca mai la rete. Il corpo
 * cifrato viene decifrato con la chiave del "dispositivo": se la cifratura fosse
 * sbagliata il browser scarterebbe la push in silenzio e non arriverebbe niente.
 */
import assert from "node:assert/strict";
import { inviaPush } from "@/lib/webpush.server";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
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

function etichetta(testo: string): Uint8Array {
  return concat(new TextEncoder().encode(testo), new Uint8Array([0]));
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, byte: number) {
  const chiave = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
      chiave,
      byte * 8,
    ),
  );
}

async function chiaviVapidDiProva() {
  const coppia = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", coppia.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", coppia.privateKey);
  return { publicKey: base64UrlEncode(raw), privateKey: jwk.d! };
}

/** Il "dispositivo": chiavi che finirebbero in `push_subscriptions`, più la privata. */
async function dispositivoDiProva() {
  const coppia = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const pubblica = new Uint8Array(await crypto.subtle.exportKey("raw", coppia.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    iscrizione: {
      endpoint: "https://push.example/abc123",
      p256dh: base64UrlEncode(pubblica),
      auth: base64UrlEncode(auth),
    },
    pubblica,
    auth,
    privata: coppia.privateKey,
  };
}

/** Fa quello che fa il browser alla ricezione: apre il record aes128gcm (RFC 8188/8291). */
async function decifra(corpo: Uint8Array, device: Awaited<ReturnType<typeof dispositivoDiProva>>) {
  const salt = corpo.slice(0, 16);
  const lunghezzaChiave = corpo[20]!;
  const asPublic = corpo.slice(21, 21 + lunghezzaChiave);
  const cifrato = corpo.slice(21 + lunghezzaChiave);

  const asKey = await crypto.subtle.importKey(
    "raw",
    asPublic as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const condiviso = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, device.privata, 256),
  );
  const ikm = await hkdf(
    device.auth,
    condiviso,
    concat(etichetta("WebPush: info"), device.pubblica, asPublic),
    32,
  );
  const cek = await hkdf(salt, ikm, etichetta("Content-Encoding: aes128gcm"), 16);
  const nonce = await hkdf(salt, ikm, etichetta("Content-Encoding: nonce"), 12);
  const aes = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, [
    "decrypt",
  ]);
  const chiaro = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      aes,
      cifrato as BufferSource,
    ),
  );
  assert.equal(chiaro.at(-1), 2, "l'ultimo record finisce col delimitatore 0x02");
  return new TextDecoder().decode(chiaro.slice(0, -1));
}

const originali = {
  pub: process.env["VAPID_PUBLIC_KEY"],
  priv: process.env["VAPID_PRIVATE_KEY"],
  subj: process.env["VAPID_SUBJECT"],
};

function ripristinaEnv() {
  for (const [chiave, valore] of Object.entries({
    VAPID_PUBLIC_KEY: originali.pub,
    VAPID_PRIVATE_KEY: originali.priv,
    VAPID_SUBJECT: originali.subj,
  })) {
    if (valore === undefined) delete process.env[chiave];
    else process.env[chiave] = valore;
  }
}

const device = await dispositivoDiProva();

try {
  // --- senza chiavi configurate: rifiuta subito, senza tentare la firma -------
  delete process.env["VAPID_PUBLIC_KEY"];
  delete process.env["VAPID_PRIVATE_KEY"];
  await assert.rejects(
    () => inviaPush(device.iscrizione, "t", "b"),
    /Chiavi VAPID non configurate/,
  );

  // --- con le chiavi: firma il JWT e chiama fetch con l'header vapid ----------
  const { publicKey, privateKey } = await chiaviVapidDiProva();
  process.env["VAPID_PUBLIC_KEY"] = publicKey;
  process.env["VAPID_PRIVATE_KEY"] = privateKey;
  process.env["VAPID_SUBJECT"] = "mailto:test@example.com";

  const fetchOriginale = globalThis.fetch;
  let richiesta: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    richiesta = { url: String(url), init };
    return new Response(null, { status: 201 });
  }) as typeof fetch;

  try {
    const { stato, corpo: risposta } = await inviaPush(
      device.iscrizione,
      "Porta i palloni",
      "Stasera tocca a te.",
    );
    assert.equal(stato, 201, "restituisce lo status della risposta");
    assert.equal(typeof risposta, "string", "riporta anche il corpo, per capire i rifiuti");
    assert.ok(richiesta, "ha chiamato fetch");
    assert.equal(richiesta!.url, "https://push.example/abc123");
    assert.equal(richiesta!.init.method, "POST");

    const headers = new Headers(richiesta!.init.headers);
    assert.equal(headers.get("TTL"), "86400");
    assert.equal(headers.get("Content-Encoding"), "aes128gcm");
    assert.equal(
      headers.get("Urgency"),
      "high",
      "con l'urgenza normale un telefono in doze accumula i messaggi fino al risveglio: la notifica arriverebbe solo a dispositivo già attivo",
    );

    const auth = headers.get("Authorization")!;
    assert.ok(auth.startsWith("vapid t="), "usa lo schema vapid con il token JWT");
    assert.ok(auth.includes(`k=${publicKey}`), "include la chiave pubblica");

    const jwt = /t=([^,]+),/.exec(auth)![1]!;
    const [header, payload] = jwt.split(".");
    const decodifica = (parte: string) =>
      JSON.parse(Buffer.from(parte.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    assert.deepEqual(decodifica(header!), { typ: "JWT", alg: "ES256" });
    const claim = decodifica(payload!);
    assert.equal(claim.aud, "https://push.example", "l'audience è l'origine dell'endpoint");
    assert.equal(claim.sub, "mailto:test@example.com");
    assert.ok(claim.exp > Date.now() / 1000, "il token scade nel futuro");

    // --- il payload: il testo viaggia dentro la push, non lo si va a cercare --
    const corpo = new Uint8Array(richiesta!.init.body as ArrayBuffer);
    assert.equal(corpo[20], 65, "l'intestazione dichiara la chiave effimera da 65 byte");
    assert.deepEqual(
      JSON.parse(await decifra(corpo, device)),
      { title: "Porta i palloni", body: "Stasera tocca a te." },
      "il dispositivo legge titolo e testo senza nessuna chiamata di rete",
    );
  } finally {
    globalThis.fetch = fetchOriginale;
  }
} finally {
  ripristinaEnv();
}

console.log("webpush-server: ok");
