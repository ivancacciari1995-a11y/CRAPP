/** Check della conversione eventi: `bun test/unit/eventi.test.ts`. */
import assert from "node:assert/strict";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import {
  categoriaEvento,
  compleanniEventi,
  convocatiEvento,
  daCategoria,
  daRiga,
  eConvocato,
  eventoVisibile,
  rosaConvocata,
  eventoVuoto,
  type RigaEvento,
} from "@/lib/eventi";

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

// --- compleanniEventi: l'anagrafica diventa calendario -----------------------
const rosa: Giocatore[] = [
  { ...giocatori[0]!, id: "g1", nome: "Bruno", nascita: "1990-12-31" },
  { ...giocatori[0]!, id: "g2", nome: "Anna", nascita: "2001-03-08" },
  { ...giocatori[0]!, id: "g3", nome: "Senza data", nascita: "" },
];

const compleanni = compleanniEventi(rosa, 2026);
assert.deepEqual(
  compleanni.map((e) => [e.id, e.data, e.luogo]),
  [
    ["c-g2", "2026-03-08", "Compie 25 anni"],
    ["c-g1", "2026-12-31", "Compie 36 anni"],
  ],
  "chi non ha data di nascita resta fuori, gli altri sono in ordine di data",
);
assert.equal(compleanni[0]!.titolo, "Compleanno di Anna");
assert.equal(compleanni[0]!.tipo, "compleanno");
assert.deepEqual(compleanni[0]!.convocati, [], "un compleanno non convoca nessuno");
assert.deepEqual(compleanniEventi([], 2026), []);

// --- convocatiEvento: elenco vuoto = tutta la rosa ---------------------------
const evento = daRiga({ ...riga, convocati: ["g2"] });
assert.deepEqual(
  convocatiEvento(evento, rosa).map((g) => g.id),
  ["g2"],
  "con i convocati indicati si filtra",
);
assert.deepEqual(
  convocatiEvento(daRiga({ ...riga, convocati: null }), rosa),
  rosa,
  "vuoto = tutti",
);
assert.deepEqual(convocatiEvento(null, rosa), rosa, "senza evento restano tutti");
assert.deepEqual(
  convocatiEvento(daRiga({ ...riga, convocati: ["ignoto"] }), rosa),
  [],
  "un convocato che non è in rosa non inventa giocatori",
);

// --- eventoVuoto: la bozza parte allenamento, oggi, senza convocati ----------
const bozza = eventoVuoto();
assert.equal(bozza.tipo, "allenamento");
assert.equal(bozza.campionato, false);
assert.equal(bozza.pagelleChiuse, false);
assert.deepEqual(bozza.convocati, []);
assert.match(bozza.data, /^\d{4}-\d{2}-\d{2}$/, "la data è di oggi in formato ISO");
assert.match(bozza.id, /^e[a-z0-9]+$/, "id generato dal client");
assert.notEqual(bozza.id, "", "ogni bozza ha un id");

console.log("eventi: ok");

// --- eventoVisibile: i non convocati non vedono l'evento, chi gestisce sì -----
assert.equal(eventoVisibile({ convocati: ["g1"] }, "g1", false), true, "il convocato lo vede");
assert.equal(eventoVisibile({ convocati: ["g1"] }, "g2", false), false, "il non convocato no");
assert.equal(eventoVisibile({ convocati: ["g1"] }, null, false), false, "senza slot no");
assert.equal(eventoVisibile({ convocati: ["g1"] }, "g2", true), true, "admin/allenatore sempre");
assert.equal(eventoVisibile({ convocati: [] }, "g2", false), true, "vuoto = tutta la rosa");

// --- eConvocato: elenco vuoto = tutti ----------------------------------------
assert.equal(eConvocato({ convocati: ["g1"] }, "g1"), true, "convocato");
assert.equal(eConvocato({ convocati: ["g1"] }, "g2"), false, "non convocato");
assert.equal(eConvocato({ convocati: [] }, "g2"), true, "vuoto = tutti");

// --- Copertura per numero di convocati: 1, 2, 3, tutti, nessuno, id sconosciuti -
const squadra = ["g1", "g2", "g3", "g4"].map((id) => ({ id }));
const ids = (l: Array<{ id: string }>) => l.map((g) => g.id);
const casi: Array<{ nome: string; convocati: string[]; attesi: string[] }> = [
  { nome: "nessuno indicato = tutta la rosa", convocati: [], attesi: ["g1", "g2", "g3", "g4"] },
  { nome: "solo 1", convocati: ["g2"], attesi: ["g2"] },
  { nome: "2", convocati: ["g1", "g4"], attesi: ["g1", "g4"] },
  { nome: "3", convocati: ["g3", "g1", "g2"], attesi: ["g1", "g2", "g3"] },
  { nome: "tutti indicati", convocati: ["g1", "g2", "g3", "g4"], attesi: ["g1", "g2", "g3", "g4"] },
  { nome: "id sconosciuto ignorato", convocati: ["g2", "zz"], attesi: ["g2"] },
  { nome: "solo ids sconosciuti: nessuno", convocati: ["zz"], attesi: [] },
];
for (const { nome, convocati, attesi } of casi) {
  assert.deepEqual(ids(rosaConvocata(squadra, convocati)), attesi, `rosaConvocata: ${nome}`);
  const conv = { convocati };
  for (const { id } of squadra) {
    const dentro = attesi.includes(id) || convocati.length === 0;
    assert.equal(
      eConvocato(conv, id),
      convocati.length === 0 || convocati.includes(id),
      `eConvocato ${id}: ${nome}`,
    );
    assert.equal(eventoVisibile(conv, id, false), dentro, `visibile a ${id}: ${nome}`);
    assert.equal(
      eventoVisibile(conv, id, true),
      true,
      `admin/allenatore vede sempre (${id}): ${nome}`,
    );
  }
  assert.equal(eventoVisibile(conv, null, false), convocati.length === 0, `senza slot: ${nome}`);
  assert.equal(eventoVisibile(conv, null, true), true, `admin senza slot: ${nome}`);
}
assert.equal(rosaConvocata([], ["g1"]).length, 0, "rosa vuota resta vuota");
