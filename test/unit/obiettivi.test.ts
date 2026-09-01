/** Check degli obiettivi di squadra: `bun test/unit/obiettivi.test.ts`. */
import assert from "node:assert/strict";
import { giocatori } from "@/lib/crapp-data";
import type { Evento } from "@/lib/eventi";
import type { VotoPagella } from "@/lib/pagelle";
import type { MappaPresenze } from "@/lib/presenze";
import {
  contestoVuoto,
  microcopyObiettivo,
  obiettiviOrdinati,
  obiettiviSquadra,
  progressoObiettivo,
  type ContestoObiettivi,
  type ObiettivoSquadra,
} from "@/lib/obiettivi";

const evento = (id: string, data: string, tipo: Evento["tipo"]): Evento => ({
  id,
  tipo,
  titolo: id,
  luogo: "",
  data,
  ora: "21:00",
  note: "",
  convocati: [],
  campionato: false,
  casa: true,
  pagelleChiuse: false,
});

const trova = (lista: ObiettivoSquadra[], id: string) => lista.find((o) => o.id === id)!;

// --- contesto vuoto: nessuna divisione per zero ------------------------------
const vuoti = obiettiviSquadra(giocatori, contestoVuoto);
assert.equal(trova(vuoti, "o1").valore, 0, "nessun evento nel mese: 0%, non NaN");
assert.equal(trova(vuoti, "o2").valore, 0);
assert.equal(trova(vuoti, "o12").valore, 0, "nessuna pagella: media 0");
assert.ok(
  vuoti.every((o) => Number.isFinite(o.valore)),
  "nessun valore NaN o infinito",
);

// --- presenze del mese (agosto 2026) e risposte ------------------------------
const tuttiPresenti: MappaPresenze = {
  a1: Object.fromEntries(giocatori.map((g) => [g.id, "presente" as const])),
};
const ctx: ContestoObiettivi = {
  eventi: [evento("a1", "2026-08-10", "allenamento")],
  presenze: tuttiPresenti,
  pagelle: [],
};
assert.equal(trova(obiettiviSquadra(giocatori, ctx), "o1").valore, 100, "rosa al completo = 100%");

const metaRosa: MappaPresenze = {
  a1: Object.fromEntries(
    giocatori.map((g, i) => [g.id, i % 2 === 0 ? ("presente" as const) : ("assente" as const)]),
  ),
};
const percentuale = trova(obiettiviSquadra(giocatori, { ...ctx, presenze: metaRosa }), "o1").valore;
assert.ok(percentuale > 40 && percentuale < 60, `metà rosa presente ≈ 50%, era ${percentuale}`);

// Il ritardo conta come presenza, il "forse" no.
const conRitardo: MappaPresenze = { a1: { g1: "ritardo", g2: "forse" } };
assert.equal(
  trova(obiettiviSquadra(giocatori, { ...ctx, presenze: conRitardo }), "o1").valore,
  Math.round((1 / giocatori.length) * 100),
  "solo il ritardo conta come presente",
);
assert.equal(
  trova(obiettiviSquadra(giocatori, { ...ctx, presenze: conRitardo }), "o2").valore,
  Math.round((2 / giocatori.length) * 100),
  "per le risposte anche il forse conta",
);

// Un evento fuori mese non sposta l'obiettivo mensile.
const fuoriMese: ContestoObiettivi = {
  eventi: [evento("s1", "2026-09-10", "allenamento")],
  presenze: { s1: { g1: "presente" } },
  pagelle: [],
};
assert.equal(trova(obiettiviSquadra(giocatori, fuoriMese), "o1").valore, 0);

// I compleanni non richiedono risposta.
const soloCompleanni: ContestoObiettivi = {
  eventi: [evento("c1", "2026-08-03", "compleanno")],
  presenze: {},
  pagelle: [],
};
assert.equal(trova(obiettiviSquadra(giocatori, soloCompleanni), "o2").valore, 0);

// --- somme sulla rosa --------------------------------------------------------
const sommaPresenze = giocatori.reduce((s, g) => s + g.presenze, 0);
assert.equal(trova(vuoti, "o7").valore, sommaPresenze);
assert.equal(
  trova(obiettiviSquadra([], contestoVuoto), "o7").valore,
  0,
  "rosa vuota: nessuna presenza",
);

const pagelle: VotoPagella[] = [
  { match_id: "m1", votante_id: "g1", votato_id: "g2", voto: 7 },
  { match_id: "m1", votante_id: "g2", votato_id: "g1", voto: 8 },
];
const conPagelle = obiettiviSquadra(giocatori, { ...contestoVuoto, pagelle });
assert.equal(trova(conPagelle, "o12").valore, 7.5);
assert.equal(trova(conPagelle, "o13").valore, 2, "conta i voti compilati");

// --- progressoObiettivo ------------------------------------------------------
const o = (valore: number, target: number): ObiettivoSquadra => ({
  id: "x",
  titolo: "t",
  descrizione: "d",
  valore,
  target,
  unita: "%",
  emoji: "🎯",
  impatto: "i",
});
assert.equal(progressoObiettivo(o(0, 10)), 0);
assert.equal(progressoObiettivo(o(5, 10)), 50);
assert.equal(progressoObiettivo(o(20, 10)), 100, "il progresso non supera il 100%");

// --- obiettiviOrdinati: i completati vanno in fondo --------------------------
const ordinati = obiettiviOrdinati(giocatori, contestoVuoto);
assert.equal(ordinati.length, vuoti.length, "nessun obiettivo perso nell'ordinamento");
const percentuali = ordinati.map(progressoObiettivo);
const completati = percentuali.filter((p) => p >= 100);
assert.deepEqual(
  percentuali.slice(percentuali.length - completati.length),
  completati,
  "i completati stanno tutti in coda",
);
const inCorso = percentuali.slice(0, percentuali.length - completati.length);
assert.deepEqual(
  inCorso,
  [...inCorso].sort((a, b) => b - a),
  "gli altri dal più avanzato",
);

// --- microcopy ---------------------------------------------------------------
assert.equal(microcopyObiettivo(o(10, 10)), "Obiettivo centrato: grande squadra!");
assert.equal(microcopyObiettivo(o(95, 100)), "Ci siamo quasi: mancano 5 %.");
assert.equal(microcopyObiettivo(o(60, 100)), "Oltre metà strada: ancora 40 %.");
assert.equal(microcopyObiettivo(o(10, 100)), "Si parte: 90 % al traguardo.");
assert.equal(microcopyObiettivo(o(0, 100)), "Tocca a noi far partire questo obiettivo.");

console.log("obiettivi: ok");
