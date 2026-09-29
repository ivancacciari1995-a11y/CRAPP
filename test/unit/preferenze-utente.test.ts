/** Preferenze dell'account (M22): `bun test/unit/preferenze-utente.test.ts`. */
import assert from "node:assert/strict";
import { emailAttive } from "@/lib/preferenze-utente";
import { prova, riepilogo } from "../helpers/prova";

await prova("senza riga le email sono attive (default DD-036)", () => {
  assert.equal(emailAttive(null), true);
  assert.equal(emailAttive(undefined), true);
});

await prova("con la riga vale il valore scelto dal giocatore", () => {
  assert.equal(emailAttive({ email_notifiche: true }), true);
  assert.equal(emailAttive({ email_notifiche: false }), false);
});

riepilogo("preferenze-utente");
