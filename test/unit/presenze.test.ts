/** Check delle serie di presenze: `bun test/unit/presenze.test.ts`. */
import assert from "node:assert/strict";
import type { Evento } from "@/lib/eventi";
import {
  conRisposta,
  contaPresenzeGiocatore,
  destinatariSollecito,
  serieConferme,
  serieConsecutiva,
  totaliEventiGiocatore,
  type MappaPresenze,
  type MappaTempiRisposta,
} from "@/lib/presenze";

const ev = (id: string, tipo: Evento["tipo"], data: string, convocati: string[] = []): Evento => ({
  id,
  tipo,
  titolo: id,
  luogo: "",
  data,
  ora: "20:00",
  note: "",
  convocati,
  campionato: false,
  casa: true,
  pagelleChiuse: false,
});

const OGGI = "2026-09-04";

// Passati in ordine sparso: a1 sì, a2 no, a3 sì, a4 sì. La serie riparte dopo il buco.
const eventi: Evento[] = [
  ev("a3", "allenamento", "2026-08-20"),
  ev("a1", "allenamento", "2026-08-06"),
  ev("p1", "partita", "2026-08-10"),
  ev("a2", "allenamento", "2026-08-13"),
  ev("a4", "allenamento", "2026-08-27"),
  ev("a5", "allenamento", "2026-09-10"), // futuro: non conta ancora
];

const presenze: MappaPresenze = {
  a1: { g1: "presente" },
  a2: { g1: "assente" },
  a3: { g1: "ritardo" },
  a4: { g1: "presente" },
  p1: { g1: "presente" },
  a5: { g1: "presente" },
};

assert.equal(serieConsecutiva("g1", eventi, presenze, "allenamento", OGGI), 2, "riparte dal buco");
assert.equal(serieConsecutiva("g1", eventi, presenze, "partita", OGGI), 1);
assert.equal(
  serieConsecutiva("g1", eventi, presenze, undefined, OGGI),
  2,
  "senza tipo conta partite e allenamenti insieme, sempre in ordine di data",
);

// Nessuna risposta vale come buco.
assert.equal(serieConsecutiva("g2", eventi, presenze, "allenamento", OGGI), 0);

// Chi non è convocato non spezza la serie di nessun altro.
const conConvocati = [...eventi, ev("a6", "allenamento", "2026-08-30", ["g9"])];
assert.equal(serieConsecutiva("g1", conConvocati, presenze, "allenamento", OGGI), 2);

// --- conteggio presenze: numeratore e denominatore delle statistiche ----------
// a1 presente, a2 assente, a3 ritardo, a4 presente, p1 presente: 4 su 5 passati.
assert.equal(contaPresenzeGiocatore("g1", eventi, presenze, OGGI), 4, "il ritardo conta presente");
assert.equal(totaliEventiGiocatore("g1", eventi, OGGI), 5, "gli eventi futuri non contano");
assert.equal(contaPresenzeGiocatore("g2", eventi, presenze, OGGI), 0, "chi non risponde è a zero");
assert.equal(totaliEventiGiocatore("g2", eventi, OGGI), 5, "il denominatore è uguale per tutti");

// Solo partite e allenamenti: compleanni e altri eventi restano fuori.
const conAltri: Evento[] = [
  ...eventi,
  ev("x1", "evento", "2026-08-15"),
  ev("c1", "compleanno", "2026-08-16"),
];
assert.equal(totaliEventiGiocatore("g1", conAltri, OGGI), 5, "solo partite e allenamenti");

// Un evento con convocati espliciti conta solo per i convocati.
const conRistretti: Evento[] = [...eventi, ev("a7", "allenamento", "2026-08-29", ["g9"])];
assert.equal(totaliEventiGiocatore("g9", conRistretti, OGGI), 6, "il convocato ce l'ha in più");
assert.equal(totaliEventiGiocatore("g1", conRistretti, OGGI), 5, "chi non è convocato no");

// --- destinatari del sollecito: chi non ha risposto, più i "forse" ------------
const squadra = [
  { id: "g1", attivo: true },
  { id: "g2", attivo: true },
  { id: "g3", attivo: true },
  { id: "g4", attivo: true },
  { id: "g5", attivo: false }, // uscito dalla squadra: non lo si disturba più
];

const risposte = [
  { giocatore_id: "g1", stato: "presente" },
  { giocatore_id: "g2", stato: "forse" },
  { giocatore_id: "g4", stato: "assente" },
  { giocatore_id: "g5", stato: "forse" },
];

assert.deepEqual(
  destinatariSollecito(squadra, risposte),
  ["g2", "g3"],
  "il forse va sollecitato come chi non ha risposto; presente e assente no",
);
assert.deepEqual(
  destinatariSollecito(squadra, []),
  ["g1", "g2", "g3", "g4"],
  "senza nessuna risposta si avvisano tutti gli attivi",
);
assert.deepEqual(
  destinatariSollecito(squadra, [
    { giocatore_id: "g1", stato: "presente" },
    { giocatore_id: "g2", stato: "ritardo" },
    { giocatore_id: "g3", stato: "infortunato" },
    { giocatore_id: "g4", stato: "assente" },
  ]),
  [],
  "quando hanno risposto tutti non parte nessuna push",
);
assert.deepEqual(destinatariSollecito([], risposte), [], "rosa vuota, nessun destinatario");

// --- serie conferme: risposta entro 24h dalla convocazione --------------------
const convocati = (id: string, data: string, creatoIl?: string): Evento => ({
  ...ev(id, "allenamento", data),
  ...(creatoIl === undefined ? {} : { creatoIl }),
});

const conConvocazione: Evento[] = [
  convocati("c1", "2026-08-06", "2026-08-01T10:00:00Z"),
  convocati("c2", "2026-08-13", "2026-08-08T10:00:00Z"),
  convocati("c3", "2026-08-20", "2026-08-15T10:00:00Z"),
  convocati("c4", "2026-08-27"), // evento generato dal client: nessuna convocazione tracciata
  convocati("c5", "2026-09-10", "2026-09-05T10:00:00Z"), // futuro
];

const tempi: MappaTempiRisposta = {
  c1: { g1: "2026-08-01T11:00:00Z" }, // un'ora dopo
  c2: { g1: "2026-08-10T10:00:00Z" }, // due giorni dopo: buco
  c3: { g1: "2026-08-16T09:59:00Z" }, // appena dentro le 24h
  c5: { g1: "2026-09-05T10:30:00Z" },
};

assert.equal(serieConferme("g1", conConvocazione, tempi, OGGI), 1, "il ritardo su c2 azzera");
assert.equal(
  serieConferme("g1", conConvocazione.slice(0, 1), tempi, OGGI),
  1,
  "una risposta rapida vale 1",
);
assert.equal(
  serieConferme("g1", [conConvocazione[0]!, conConvocazione[3]!, conConvocazione[2]!], tempi, OGGI),
  2,
  "un evento senza istante di convocazione viene saltato, non spezza la serie",
);
assert.equal(serieConferme("g2", conConvocazione, tempi, OGGI), 0, "chi non risponde è a zero");

// --- cache locale dopo una risposta: il cronometro non riparte ----------------
// Stessa regola del database: `risposto_il` è la PRIMA risposta e un trigger la congela.
// Qui la cache deve imitarla, altrimenti la serie "Conferme 24h" mente fino al refresh.
const PRIMA = "2026-08-01T10:00:00Z";
const POI = "2026-08-08T10:00:00Z";

const dopoPrimaRisposta = conRisposta(
  undefined,
  { eventoId: "e1", giocatoreId: "g1", stato: "presente" },
  PRIMA,
);
assert.deepEqual(dopoPrimaRisposta, {
  presenze: { e1: { g1: "presente" } },
  tempi: { e1: { g1: PRIMA } },
});

const dopoRipensamento = conRisposta(
  dopoPrimaRisposta,
  { eventoId: "e1", giocatoreId: "g1", stato: "assente" },
  POI,
);
assert.equal(dopoRipensamento.presenze["e1"]?.["g1"], "assente", "vale l'ultima risposta");
assert.equal(
  dopoRipensamento.tempi["e1"]?.["g1"],
  PRIMA,
  "l'istante resta quello della prima risposta: il ripensamento non fa ripartire il cronometro",
);

const dopoRitiro = conRisposta(
  dopoRipensamento,
  { eventoId: "e1", giocatoreId: "g1", stato: null },
  POI,
);
assert.deepEqual(dopoRitiro.presenze["e1"], {}, "ritirare la risposta la toglie");
assert.deepEqual(
  dopoRitiro.tempi["e1"],
  {},
  "e toglie anche l'istante: chi risponde di nuovo riparte da capo",
);
assert.equal(
  conRisposta(dopoRitiro, { eventoId: "e1", giocatoreId: "g1", stato: "presente" }, POI).tempi[
    "e1"
  ]?.["g1"],
  POI,
  "dopo un ritiro il cronometro riparte davvero",
);

// Gli altri giocatori e gli altri eventi non vengono toccati.
const conAltri2 = conRisposta(
  conRisposta(undefined, { eventoId: "e1", giocatoreId: "g1", stato: "presente" }, PRIMA),
  { eventoId: "e2", giocatoreId: "g2", stato: "forse" },
  POI,
);
assert.equal(conAltri2.presenze["e1"]?.["g1"], "presente", "l'altro evento resta in cache");
assert.equal(conAltri2.tempi["e2"]?.["g2"], POI);

console.log("presenze: ok");
