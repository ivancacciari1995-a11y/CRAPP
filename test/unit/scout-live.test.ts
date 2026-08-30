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

// --- dataOggi ----------------------------------------------------------------
assert.match(dataOggi(), /^\d{4}-\d{2}-\d{2}$/);
assert.equal(dataOggi(), new Date().toLocaleDateString("sv-SE"), "data locale, non UTC");

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
