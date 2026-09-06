/**
 * Check delle notifiche push lato client: `bun test/unit/push-client.test.ts`.
 * Fuori dal browser (nessun `navigator.serviceWorker`) tutte le funzioni devono
 * riconoscere l'assenza di supporto senza tentare rete o API del DOM.
 */
import assert from "node:assert/strict";
import {
  attivaNotifiche,
  disattivaNotifiche,
  mantieniWorkerPushAggiornato,
  notificaDiProva,
  pushSupportato,
  statoNotifiche,
} from "@/lib/push-client";

// --- pushSupportato: falso in ambiente server (nessun window) -----------------
assert.equal(typeof window, "undefined", "il test gira senza DOM");
assert.equal(pushSupportato(), false);

// --- statoNotifiche: nessun supporto -> nessuna sottoscrizione ----------------
assert.equal(await statoNotifiche(), false);

// --- attivaNotifiche: rifiuta subito, senza chiedere permessi o rete ----------
await assert.rejects(() => attivaNotifiche("g1"), /Notifiche non supportate su questo dispositivo/);

// --- notificaDiProva: rifiuta subito, senza toccare la rete -------------------
await assert.rejects(() => notificaDiProva(), /Notifiche non supportate su questo dispositivo/);

// --- disattivaNotifiche: no-op silenzioso, nessun errore ----------------------
await assert.doesNotReject(() => disattivaNotifiche());

// Il mantenimento del worker è innocuo anche durante SSR.
assert.doesNotThrow(mantieniWorkerPushAggiornato());

const originali = new Map(
  ["window", "navigator", "document"].map((nome) => [
    nome,
    Object.getOwnPropertyDescriptor(globalThis, nome),
  ]),
);
const documento = Object.assign(new EventTarget(), { visibilityState: "visible" });
let letture = 0;
let aggiornamenti = 0;
let presente = true;
let errore = false;
let sblocca: (() => void) | undefined;
let attesa: Promise<void> | undefined;
let interrompi = () => {};
const ciclo = () => new Promise((resolve) => setTimeout(resolve, 0));
const visibilita = async (stato: string) => {
  documento.visibilityState = stato;
  documento.dispatchEvent(new Event("visibilitychange"));
  await ciclo();
};

try {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { PushManager: {}, Notification: {} },
  });
  Object.defineProperty(globalThis, "document", { configurable: true, value: documento });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      serviceWorker: {
        async getRegistration(url: string) {
          assert.equal(url, "/push-sw.js");
          letture++;
          return presente
            ? {
                async update() {
                  aggiornamenti++;
                  if (errore) throw new Error("offline");
                  await attesa;
                },
              }
            : undefined;
        },
        // Un aggiornamento non deve cancellare o sostituire la registrazione.
        register() {
          assert.fail("non deve registrare un nuovo worker");
        },
      },
    },
  });

  interrompi = mantieniWorkerPushAggiornato();
  await ciclo();
  assert.equal(aggiornamenti, 1, "aggiorna il worker esistente all'avvio");

  await visibilita("hidden");
  assert.equal(letture, 1, "nessun lavoro quando l'app viene chiusa");
  await visibilita("visible");
  assert.equal(aggiornamenti, 2, "controlla gli aggiornamenti al ritorno nella webapp");

  errore = true;
  await visibilita("visible");
  assert.equal(aggiornamenti, 3, "un errore offline non blocca l'app");
  errore = false;
  await visibilita("visible");
  assert.equal(aggiornamenti, 4, "riprova dopo l'errore");

  attesa = new Promise<void>((resolve) => (sblocca = resolve));
  await visibilita("visible");
  await visibilita("visible");
  assert.equal(aggiornamenti, 5, "accorpa gli aggiornamenti sovrapposti");
  sblocca!();
  await ciclo();
  attesa = undefined;

  presente = false;
  await visibilita("visible");
  assert.equal(aggiornamenti, 5, "nessuna nuova iscrizione senza registrazione");

  interrompi();
  const prima = letture;
  await visibilita("visible");
  assert.equal(letture, prima, "rimuove il listener allo smontaggio");

  documento.visibilityState = "hidden";
  presente = true;
  interrompi = mantieniWorkerPushAggiornato();
  await ciclo();
  assert.equal(letture, prima, "non aggiorna se parte già in background");
  await visibilita("visible");
  assert.equal(aggiornamenti, 6);
} finally {
  interrompi();
  for (const [nome, originale] of originali) {
    if (originale) Object.defineProperty(globalThis, nome, originale);
    else Reflect.deleteProperty(globalThis, nome);
  }
}

console.log("push-client: ok");
