/**
 * Check della deduplica per la sezione Notifiche in admin:
 * `bun test/unit/notifiche-attive.test.ts`.
 */
import assert from "node:assert/strict";
import { idsConNotificheAttive } from "@/lib/notifiche-attive.server";

assert.deepEqual(idsConNotificheAttive([]), [], "nessuna riga -> nessun id");

assert.deepEqual(idsConNotificheAttive([{ giocatore_id: "g1" }]), ["g1"], "una riga -> un id");

assert.deepEqual(
  idsConNotificheAttive([{ giocatore_id: "g1" }, { giocatore_id: "g1" }, { giocatore_id: "g2" }]),
  ["g1", "g2"],
  "più dispositivi dello stesso giocatore contano una volta sola",
);

assert.deepEqual(
  idsConNotificheAttive([{ giocatore_id: "g2" }, { giocatore_id: "g1" }]),
  ["g2", "g1"],
  "ordine di prima comparsa, non alfabetico",
);

console.log("notifiche-attive: ok");
