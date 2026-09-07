/** Check della sessione Scout Live: `bun test/unit/scout-live.test.ts`. */
import assert from "node:assert/strict";
import type { Evento } from "@/lib/eventi";
import {
  SCADENZA_MINUTI,
  dataOggi,
  partitaDiOggi,
  sessioneScaduta,
  type SessioneScout,
} from "@/lib/scout-live";

const evento = (id: string, data: string, tipo: Evento["tipo"]): Evento => ({
  id,
  tipo,
  titolo: id,
  luogo: "",
  data,
  ora: "21:00",
  note: "",
  convocati: [],
  campionato: true,
  casa: true,
  pagelleChiuse: false,
});

// --- dataOggi ------------------------------------------------------------------
assert.match(dataOggi(), /^\d{4}-\d{2}-\d{2}$/);
// CET (gennaio, UTC+1): dopo le 23:00 UTC del 15, a Roma è già il 16. L'ISO in UTC
// direbbe ancora 15: se `dataOggi()` tornasse a farlo, questo test lo scoprirebbe.
assert.equal(
  dataOggi(new Date("2026-01-15T23:30:00Z")),
  "2026-01-16",
  "CET: mezzanotte italiana precede quella UTC di un'ora",
);
// CEST (luglio, UTC+2): lo scarto raddoppia, la mezzanotte italiana anticipa quella UTC
// di due ore. Se il calcolo usasse un offset fisso invece del fuso Europe/Rome, questo
// secondo caso lo tradirebbe anche se il primo passasse per caso.
assert.equal(
  dataOggi(new Date("2026-07-15T22:30:00Z")),
  "2026-07-16",
  "CEST: il cambio ora legale porta lo scarto a due ore, non resta fisso a uno",
);

// --- partitaDiOggi -----------------------------------------------------------
const eventi = [
  evento("a1", "2026-09-01", "allenamento"),
  evento("p1", "2026-09-01", "partita"),
  evento("p2", "2026-09-02", "partita"),
];
assert.equal(partitaDiOggi(eventi, "2026-09-01")?.id, "p1", "l'allenamento non si scoutizza");
assert.equal(partitaDiOggi(eventi, "2026-09-03"), null, "nessuna partita oggi");
assert.equal(partitaDiOggi([], "2026-09-01"), null);

// --- sessioneScaduta: libera il tavolo dopo SCADENZA_MINUTI ------------------
const sessione = (minutiFa: number): SessioneScout => ({
  evento_id: "p1",
  giocatore_id: "g1",
  giocatore_nome: "Tizio",
  aggiornato_il: new Date(Date.now() - minutiFa * 60_000).toISOString(),
});

assert.equal(sessioneScaduta(null), true, "nessuna sessione = tavolo libero");
assert.equal(sessioneScaduta(sessione(0)), false, "appena aggiornata");
assert.equal(sessioneScaduta(sessione(SCADENZA_MINUTI - 1)), false, "dentro la finestra");
assert.equal(sessioneScaduta(sessione(SCADENZA_MINUTI + 1)), true, "oltre la finestra");
assert.equal(
  sessioneScaduta({ ...sessione(0), aggiornato_il: "data-non-valida" }),
  true,
  "timestamp illeggibile: meglio liberare la sessione che bloccarla",
);

console.log("scout-live: ok");
