/** Check della conversione eventi: `bun test/unit/eventi.test.ts`. */
import assert from "node:assert/strict";
import { categoriaEvento, daCategoria, daRiga, type RigaEvento } from "@/lib/eventi";

const riga: RigaEvento = {
  id: "e1",
  tipo: "partita",
  titolo: "CRAP - Avversari",
  luogo: "PalaCRAP",
  data: "2026-09-01",
  ora: "21:00",
  note: "portare la seconda maglia",
  convocati: ["g1", "g2"],
  campionato: true,
  casa: true,
  pagelle_chiuse: false,
  creato_il: "2026-08-20T09:00:00Z",
};

// --- daRiga: i NULL del database diventano valori sicuri ---------------------
assert.deepEqual(daRiga(riga), {
  id: "e1",
  tipo: "partita",
  titolo: "CRAP - Avversari",
  luogo: "PalaCRAP",
  data: "2026-09-01",
  ora: "21:00",
  note: "portare la seconda maglia",
  convocati: ["g1", "g2"],
  campionato: true,
  casa: true,
  pagelleChiuse: false,
  creatoIl: "2026-08-20T09:00:00Z",
});

const vuota = daRiga({
  ...riga,
  note: null,
  convocati: null,
  casa: null,
  campionato: false,
  pagelle_chiuse: false,
});
assert.equal(vuota.note, "", "note NULL → stringa vuota");
assert.deepEqual(vuota.convocati, [], "convocati NULL → tutta la rosa (array vuoto)");
assert.equal(vuota.casa, true, "casa NULL → si gioca in casa");
assert.equal(vuota.pagelleChiuse, false);

// --- categoriaEvento: l'amichevole è una partita fuori campionato ------------
assert.equal(categoriaEvento({ tipo: "partita", campionato: true }), "partita");
assert.equal(categoriaEvento({ tipo: "partita", campionato: false }), "amichevole");
assert.equal(categoriaEvento({ tipo: "allenamento", campionato: false }), "allenamento");
assert.equal(categoriaEvento({ tipo: "evento", campionato: false }), "evento");
assert.equal(categoriaEvento({ tipo: "compleanno", campionato: false }), "evento");

// --- daCategoria: inverso di categoriaEvento ---------------------------------
assert.deepEqual(daCategoria("partita"), { tipo: "partita", campionato: true });
assert.deepEqual(daCategoria("amichevole"), { tipo: "partita", campionato: false });
assert.deepEqual(daCategoria("allenamento"), { tipo: "allenamento", campionato: false });
assert.deepEqual(daCategoria("evento"), { tipo: "evento", campionato: false });

for (const c of ["partita", "amichevole", "allenamento", "evento"] as const) {
  assert.equal(categoriaEvento(daCategoria(c)), c, `andata e ritorno stabile per ${c}`);
}

console.log("eventi: ok");
