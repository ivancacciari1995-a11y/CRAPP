/**
 * Check dell'invio push server-side: `bun test/unit/webpush-server.test.ts`.
 * `inviaPush` firma un JWT VAPID con Web Crypto e fa una POST all'endpoint del
 * browser: qui generiamo una vera coppia di chiavi P-256 e sostituiamo `fetch`
 * per intercettare la richiesta, così il test non tocca mai la rete.
 */
import assert from "node:assert/strict";
import { ORE_VALIDITA_PROMEMORIA, inviaPush, promemoriaAncoraValido } from "@/lib/webpush.server";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

try {
  // --- senza chiavi configurate: rifiuta subito, senza tentare la firma -------
  delete process.env["VAPID_PUBLIC_KEY"];
  delete process.env["VAPID_PRIVATE_KEY"];
  await assert.rejects(() => inviaPush("https://push.example/ep"), /Chiavi VAPID non configurate/);

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
    const stato = await inviaPush("https://push.example/abc123");
    assert.equal(stato, 201, "restituisce lo status della risposta");
    assert.ok(richiesta, "ha chiamato fetch");
    assert.equal(richiesta!.url, "https://push.example/abc123");
    assert.equal(richiesta!.init.method, "POST");

    const headers = new Headers(richiesta!.init.headers);
    assert.equal(headers.get("TTL"), "86400");
    assert.equal(headers.get("Content-Length"), "0");

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
  } finally {
    globalThis.fetch = fetchOriginale;
  }
} finally {
  ripristinaEnv();
}

// --- scadenza dei promemoria in coda ------------------------------------------
// La coda si svuota solo quando il dispositivo legge: se la push non arriva mai, la
// riga resta. Senza scadenza dirotterebbe la notifica successiva, giorni dopo.
const ADESSO = new Date("2026-09-06T12:00:00Z");
const oreFa = (n: number) => new Date(ADESSO.getTime() - n * 60 * 60 * 1000).toISOString();

assert.equal(promemoriaAncoraValido(oreFa(1), ADESSO), true, "un'ora fa è attuale");
assert.equal(
  promemoriaAncoraValido(oreFa(ORE_VALIDITA_PROMEMORIA - 0.1), ADESSO),
  true,
  "poco prima della scadenza vale ancora",
);
assert.equal(
  promemoriaAncoraValido(oreFa(ORE_VALIDITA_PROMEMORIA + 0.1), ADESSO),
  false,
  "oltre la scadenza non è più un promemoria",
);
assert.equal(promemoriaAncoraValido(oreFa(72), ADESSO), false, "un sollecito di tre giorni fa no");
assert.equal(promemoriaAncoraValido("non-una-data", ADESSO), false, "una data illeggibile scade");

console.log("webpush-server: ok");
