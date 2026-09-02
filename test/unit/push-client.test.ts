/**
 * Check delle notifiche push lato client: `bun test/unit/push-client.test.ts`.
 * Fuori dal browser (nessun `navigator.serviceWorker`) tutte le funzioni devono
 * riconoscere l'assenza di supporto senza tentare rete o API del DOM.
 */
import assert from "node:assert/strict";
import {
  attivaNotifiche,
  disattivaNotifiche,
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

// --- disattivaNotifiche: no-op silenzioso, nessun errore ----------------------
await assert.doesNotReject(() => disattivaNotifiche());

console.log("push-client: ok");
