/** Check di infortuni e ritardi: `bun test/unit/infortuni.test.ts`. */
import assert from "node:assert/strict";
import { conInfortuni, contaInfortuni, contaRitardi } from "@/lib/infortuni";
import { giocatori } from "@/lib/crapp-data";
import type { MappaPresenze } from "@/lib/presenze";

const presenze: MappaPresenze = {
  e1: { g1: "infortunato", g2: "presente", g3: "ritardo" },
  e2: { g1: "infortunato", g2: "ritardo", g3: "assente" },
  e3: { g1: "presente", g2: "forse" },
};

// --- conteggi ----------------------------------------------------------------
assert.deepEqual(contaInfortuni(presenze), { g1: 2 }, "ogni evento vale una volta sola");
assert.deepEqual(contaRitardi(presenze), { g3: 1, g2: 1 });
assert.deepEqual(contaInfortuni({}), {});
assert.deepEqual(contaRitardi({ e1: {} }), {}, "evento senza risposte: nessun conteggio");

// --- conInfortuni: arricchisce il giocatore senza perdere gli altri campi ----
const base = giocatori.find((g) => g.id === "g1")!;
const arricchito = conInfortuni(base, contaInfortuni(presenze), contaRitardi(presenze));
assert.equal(arricchito.infortuni, 2);
assert.equal(arricchito.ritardi, 0, "g1 non ha ritardi");
assert.equal(arricchito.nome, base.nome, "il resto del giocatore resta intatto");
assert.equal(base.infortuni, 0, "l'originale non viene mutato");

const senzaDati = conInfortuni(base, {});
assert.deepEqual([senzaDati.infortuni, senzaDati.ritardi], [0, 0], "assenza di dati = zero");

const g3 = giocatori.find((g) => g.id === "g3")!;
assert.equal(conInfortuni(g3, contaInfortuni(presenze), contaRitardi(presenze)).ritardi, 1);

console.log("infortuni: ok");
