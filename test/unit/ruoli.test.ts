/** Check dei permessi di amministrazione: `bun test/unit/ruoli.test.ts`. */
import assert from "node:assert/strict";
import { risolviAdmin } from "@/lib/ruoli";
import { adminNomi, giocatori } from "@/lib/crapp-data";

const referente = giocatori.find((g) => adminNomi.includes(g.nome))!;
const chiunque = giocatori.find((g) => !adminNomi.includes(g.nome))!;

// Con una sessione attiva decide il database, e basta: la lista di nomi non conta più.
assert.equal(risolviAdmin(true, chiunque.id), true, "il ruolo nel database concede");
assert.equal(
  risolviAdmin(false, referente.id),
  false,
  "il ruolo nel database nega anche a chi è nella lista dei nomi",
);
assert.equal(risolviAdmin(true, null), true);

// Senza sessione (null) resta il ponte temporaneo sulla lista di nomi.
assert.equal(risolviAdmin(null, referente.id), true);
assert.equal(risolviAdmin(null, chiunque.id), false);
assert.equal(risolviAdmin(null, null), false, "nessuna identità, nessun permesso");
assert.equal(risolviAdmin(null, "gXX"), false, "un id sconosciuto non concede nulla");

console.log("ruoli: ok");
