/** Check di infortuni e ritardi: `bun test/unit/infortuni.test.ts`. */
import assert from "node:assert/strict";
import { conInfortuni, contaInfortuni, contaRitardi } from "@/lib/infortuni";
import { giocatori } from "@/lib/crapp-data";
import type { Evento } from "@/lib/eventi";
import type { MappaPresenze } from "@/lib/presenze";

const ev = (id: string, data: string): Evento => ({
  id,
  tipo: "allenamento",
  titolo: id,
  luogo: "",
  data,
  ora: "20:00",
  note: "",
  convocati: [],
  campionato: false,
  casa: true,
  pagelleChiuse: false,
});

const OGGI = "2026-09-04";

const eventi: Evento[] = [ev("e1", "2026-08-20"), ev("e2", "2026-08-27"), ev("e3", "2026-09-03")];

const presenze: MappaPresenze = {
  e1: { g1: "infortunato", g2: "presente", g3: "ritardo" },
  e2: { g1: "infortunato", g2: "ritardo", g3: "assente" },
  e3: { g1: "presente", g2: "forse" },
};

// --- conteggi ----------------------------------------------------------------
assert.deepEqual(
  contaInfortuni(presenze, eventi, OGGI),
  { g1: 2 },
  "ogni evento passato vale una volta sola",
);
assert.deepEqual(contaRitardi(presenze, eventi, OGGI), { g3: 1, g2: 1 });
assert.deepEqual(contaInfortuni({}, eventi, OGGI), {});
assert.deepEqual(
  contaRitardi({ e1: {} }, eventi, OGGI),
  {},
  "evento senza risposte: nessun conteggio",
);

// --- eventi futuri: non contano finché non sono passati -----------------------
const eventiConFuturo: Evento[] = [...eventi, ev("f1", "2026-09-10")];
const presenzeConFuturo: MappaPresenze = {
  ...presenze,
  f1: { g1: "infortunato", g3: "ritardo" },
};
assert.deepEqual(
  contaInfortuni(presenzeConFuturo, eventiConFuturo, OGGI),
  { g1: 2 },
  "l'infortunio su un evento futuro non conta ancora",
);
assert.deepEqual(
  contaRitardi(presenzeConFuturo, eventiConFuturo, OGGI),
  { g3: 1, g2: 1 },
  "il ritardo su un evento futuro non conta ancora",
);
// Con l'avanzare della data, l'evento prima futuro entra nel conteggio.
assert.deepEqual(
  contaInfortuni(presenzeConFuturo, eventiConFuturo, "2026-09-11"),
  { g1: 3 },
  "una volta passata la data dell'evento, l'infortunio viene conteggiato",
);
assert.deepEqual(
  contaRitardi(presenzeConFuturo, eventiConFuturo, "2026-09-11"),
  { g3: 2, g2: 1 },
  "una volta passata la data dell'evento, il ritardo viene conteggiato",
);
// Evento non più presente in `eventi` (es. cancellato): escluso per prudenza.
assert.deepEqual(
  contaInfortuni({ ...presenze, sconosciuto: { g1: "infortunato" } }, eventi, OGGI),
  { g1: 2 },
  "un evento senza data nota non viene contato",
);

// --- conInfortuni: arricchisce il giocatore senza perdere gli altri campi ----
const base = giocatori.find((g) => g.id === "g1")!;
const arricchito = conInfortuni(
  base,
  contaInfortuni(presenze, eventi, OGGI),
  contaRitardi(presenze, eventi, OGGI),
);
assert.equal(arricchito.infortuni, 2);
assert.equal(arricchito.ritardi, 0, "g1 non ha ritardi");
assert.equal(arricchito.nome, base.nome, "il resto del giocatore resta intatto");
assert.equal(base.infortuni, 0, "l'originale non viene mutato");

const senzaDati = conInfortuni(base, {});
assert.deepEqual([senzaDati.infortuni, senzaDati.ritardi], [0, 0], "assenza di dati = zero");

const g3 = giocatori.find((g) => g.id === "g3")!;
assert.equal(
  conInfortuni(g3, contaInfortuni(presenze, eventi, OGGI), contaRitardi(presenze, eventi, OGGI))
    .ritardi,
  1,
);

console.log("infortuni: ok");
