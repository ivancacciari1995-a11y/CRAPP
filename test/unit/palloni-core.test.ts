/** Check dei turni palloni: `bun src/lib/palloni-core.test.ts`. */
import assert from "node:assert/strict";
import { giocatori } from "@/lib/crapp-data";
import type { Evento } from "@/lib/eventi";
import {
  completaTurni,
  conteggioTurni,
  avvisiPalloniEvento,
  destinatariPromemoriaPalloni,
  eventiDelGiorno,
  eventiPalloni,
  eventoPrecedente,
  eventoSuccessivo,
  oggiISO,
} from "@/lib/palloni-core";

const rosa = giocatori.map((g) => ({ id: g.id, nome: g.nome }));

const evento = (id: string, data: string, tipo: Evento["tipo"] = "allenamento"): Evento => ({
  id,
  tipo,
  titolo: `Evento ${id}`,
  luogo: "PalaCRAP",
  data,
  ora: "21:00",
  note: "",
  convocati: [],
  campionato: false,
  casa: true,
  pagelleChiuse: false,
});

const eventi: Evento[] = [
  evento("e3", "2026-09-10"),
  evento("e1", "2026-09-01"),
  evento("compleanno", "2026-09-05", "compleanno"),
  evento("e2", "2026-09-05", "partita"),
];

// --- eventiPalloni: ordina per data e scarta i compleanni ---------------------
const ordinati = eventiPalloni(eventi);
assert.deepEqual(
  ordinati.map((e) => e.id),
  ["e1", "e2", "e3"],
  "compleanni esclusi e ordine cronologico",
);
assert.equal(eventi[0]!.id, "e3", "l'array in ingresso non viene modificato");

// --- eventoPrecedente / eventoSuccessivo -------------------------------------
assert.equal(eventoPrecedente(eventi, "e2")?.id, "e1");
assert.equal(eventoPrecedente(eventi, "e1"), undefined, "il primo non ha precedente");
assert.equal(eventoSuccessivo(eventi, "e2")?.id, "e3");
assert.equal(eventoSuccessivo(eventi, "e3"), undefined, "l'ultimo non ha successivo");
assert.equal(eventoPrecedente(eventi, "inesistente"), undefined);

// --- eventiDelGiorno ---------------------------------------------------------
assert.deepEqual(
  eventiDelGiorno(eventi, "2026-09-05").map((e) => e.id),
  ["e2"],
  "il compleanno dello stesso giorno non richiede palloni",
);

// --- completaTurni: niente proposta sugli allenamenti; partite sì ------------
const turni = completaTurni({ e2: "g5" }, eventi, rosa);
assert.equal(turni["e2"], "g5", "il turno già assegnato non viene toccato");
assert.equal(turni["e1"], undefined, "allenamento senza salvataggio resta da assegnare");
assert.equal(turni["e3"], undefined, "allenamento futuro resta da assegnare");
assert.equal(Object.keys(turni).length, 1, "solo i turni salvati / partite proposte");

const conAllenamentoSalvato = completaTurni({ e1: "g3", e2: "g5" }, eventi, rosa);
assert.equal(conAllenamentoSalvato["e1"], "g3", "un allenamento salvato resta");
assert.equal(conAllenamentoSalvato["e2"], "g5");

const molti = Array.from({ length: giocatori.length + 2 }, (_, i) =>
  evento(`x${i}`, `2026-10-${String(i + 1).padStart(2, "0")}`, "partita"),
);
// Tutte "passate" rispetto a questa data, altrimenti conteggioTurni le scarterebbe.
const rotazione = conteggioTurni(completaTurni({}, molti, rosa), molti, "2026-11-01");
const carichi = Object.values(rotazione);
assert.equal(
  Math.max(...carichi) - Math.min(...carichi),
  1,
  "su un giro completo di partite il carico resta bilanciato",
);
assert.equal(
  Object.keys(rotazione).length,
  giocatori.length,
  "nessuno viene saltato prima che tutti abbiano fatto un turno",
);

const soloAllenamenti = Array.from({ length: 5 }, (_, i) =>
  evento(`a${i}`, `2026-11-${String(i + 1).padStart(2, "0")}`),
);
assert.deepEqual(
  completaTurni({}, soloAllenamenti, rosa),
  {},
  "solo allenamenti: nessuna proposta automatica",
);

// Un turno salvato per un giocatore non più in rosa non deve rompere il conteggio.
const conFantasma = completaTurni({ e1: "gXX" }, eventi, rosa);
assert.equal(conFantasma["e1"], "gXX", "il turno storico resta com'è");
assert.ok(conFantasma["e2"], "la partita riceve comunque una proposta");
assert.equal(conFantasma["e3"], undefined, "l'allenamento senza salvataggio resta vuoto");

// --- conteggioTurni: solo eventi già passati ----------------------------------
const eventiConteggio: Evento[] = [
  evento("c1", "2026-09-01", "partita"),
  evento("c2", "2026-09-05", "partita"),
  evento("c3", "2026-09-10", "allenamento"), // futuro rispetto a OGGI_CONTEGGIO
];
const OGGI_CONTEGGIO = "2026-09-08";
assert.deepEqual(
  conteggioTurni({ c1: "g1", c2: "g1", c3: "g2" }, eventiConteggio, OGGI_CONTEGGIO),
  { g1: 2 },
  "il turno di un evento futuro non è ancora contato, anche se già assegnato",
);
assert.deepEqual(
  conteggioTurni({}, eventiConteggio, OGGI_CONTEGGIO),
  {},
  "nessun turno assegnato: conteggio vuoto",
);

// --- oggiISO -------------------------------------------------------------------
assert.match(oggiISO(), /^\d{4}-\d{2}-\d{2}$/);
// Stesso controllo di dataOggi() in scout-live.test.ts: oggiISO() ne è un alias, il fuso
// deve restare Europe/Rome anche passando da qui.
assert.equal(
  oggiISO(new Date("2026-01-15T23:30:00Z")),
  "2026-01-16",
  "CET: mezzanotte italiana precede quella UTC di un'ora",
);
assert.equal(
  oggiISO(new Date("2026-07-15T22:30:00Z")),
  "2026-07-16",
  "CEST: il cambio ora legale porta lo scarto a due ore, non resta fisso a uno",
);

// --- destinatariPromemoriaPalloni --------------------------------------------
const eventiPush: Evento[] = [
  evento("p1", "2026-02-01"),
  evento("p2", "2026-02-02"),
  evento("p3", "2026-02-03"),
];
const turniPush = { p1: "g1", p2: "g2", p3: "g3" };

assert.deepEqual(
  destinatariPromemoriaPalloni(turniPush, eventiPush, "2026-02-02"),
  ["g2", "g1"],
  "chi porta oggi e chi li aveva portati alla volta prima",
);
assert.deepEqual(
  destinatariPromemoriaPalloni(turniPush, eventiPush, "2026-02-01"),
  ["g1"],
  "il primo evento non ha un precedente da avvisare",
);
assert.deepEqual(
  destinatariPromemoriaPalloni(turniPush, eventiPush, "2026-03-01"),
  [],
  "nessun evento in quella data: nessun destinatario",
);
assert.deepEqual(
  destinatariPromemoriaPalloni({ p1: "g1", p2: "g1" }, eventiPush, "2026-02-02"),
  ["g1"],
  "stessa persona oggi e alla volta prima: un solo avviso",
);

// --- avvisiPalloniEvento ------------------------------------------------------
// Il promemoria per un evento scelto dall'admin: due destinatari, con testi diversi.
const avvisi = avvisiPalloniEvento(turniPush, eventiPush, "p2");
assert.deepEqual(
  avvisi.map((a) => a.giocatoreId),
  ["g2", "g1"],
  "l'incaricato di questo evento, e chi ha i palloni dalla volta prima",
);
assert.match(avvisi[0]!.titolo, /prendere i palloni/);
assert.match(avvisi[1]!.titolo, /Porta i palloni/);
assert.ok(
  avvisi.every((a) => !/oggi/i.test(a.testo)),
  "il testo nomina l'evento, non 'oggi': può arrivare giorni prima",
);

assert.deepEqual(
  avvisiPalloniEvento(turniPush, eventiPush, "p1").map((a) => a.giocatoreId),
  ["g1"],
  "il primo evento non ha un precedente da avvisare",
);
assert.deepEqual(
  avvisiPalloniEvento({ p1: "g1", p2: "g1" }, eventiPush, "p2").map((a) => a.giocatoreId),
  ["g1"],
  "stessa persona nei due ruoli: un avviso solo, non due notifiche uguali",
);
assert.deepEqual(
  avvisiPalloniEvento(turniPush, eventiPush, "non-esiste"),
  [],
  "un evento inesistente non produce avvisi",
);
assert.deepEqual(
  avvisiPalloniEvento({}, eventiPush, "p2"),
  [],
  "senza turni assegnati non c'è nessuno da avvisare",
);

console.log("palloni-core: ok");
