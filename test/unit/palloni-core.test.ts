/** Check dei turni palloni: `bun src/lib/palloni-core.test.ts`. */
import assert from "node:assert/strict";
import { giocatori } from "@/lib/crapp-data";
import type { Evento } from "@/lib/eventi";
import {
  completaTurni,
  conteggioTurni,
  eventiDelGiorno,
  eventiPalloni,
  eventoPrecedente,
  eventoSuccessivo,
  oggiISO,
} from "@/lib/palloni-core";

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

// --- completaTurni: assegna i mancanti, rispetta quelli già decisi -----------
const turni = completaTurni({ e2: "g5" }, eventi);
assert.equal(turni["e2"], "g5", "il turno già assegnato non viene toccato");
assert.equal(Object.keys(turni).length, 3, "tutti gli eventi hanno un incaricato");
assert.ok(
  giocatori.some((g) => g.id === turni["e1"]),
  "assegna a un giocatore reale",
);
assert.notEqual(turni["e1"], turni["e3"], "non tocca due volte di fila alla stessa persona");

const molti = Array.from({ length: giocatori.length + 2 }, (_, i) =>
  evento(`x${i}`, `2026-10-${String(i + 1).padStart(2, "0")}`),
);
const rotazione = conteggioTurni(completaTurni({}, molti));
const carichi = Object.values(rotazione);
assert.equal(
  Math.max(...carichi) - Math.min(...carichi),
  1,
  "su un giro completo il carico resta bilanciato",
);
assert.equal(
  Object.keys(rotazione).length,
  giocatori.length,
  "nessuno viene saltato prima che tutti abbiano fatto un turno",
);

// Un turno salvato per un giocatore non più in rosa non deve rompere il conteggio.
const conFantasma = completaTurni({ e1: "gXX" }, eventi);
assert.equal(conFantasma["e1"], "gXX", "il turno storico resta com'è");
assert.equal(Object.keys(conFantasma).length, 3);

// --- conteggioTurni ----------------------------------------------------------
assert.deepEqual(conteggioTurni({ a: "g1", b: "g1", c: "g2" }), { g1: 2, g2: 1 });
assert.deepEqual(conteggioTurni({}), {});

// --- oggiISO -----------------------------------------------------------------
assert.match(oggiISO(), /^\d{4}-\d{2}-\d{2}$/);
assert.equal(oggiISO(), new Date().toLocaleDateString("sv-SE"), "data locale, non UTC");

console.log("palloni-core: ok");
