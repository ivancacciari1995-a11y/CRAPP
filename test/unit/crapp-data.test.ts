/** Check dei dati di base della rosa: `bun test/unit/crapp-data.test.ts`. */
import assert from "node:assert/strict";
import { formatData, giocatori, statoMeta } from "@/lib/crapp-data";

// --- rosa --------------------------------------------------------------------
assert.ok(giocatori.length > 0, "la rosa non è vuota");
assert.deepEqual(
  giocatori.map((g) => g.id),
  giocatori.map((_, i) => `g${i + 1}`),
  "gli id sono progressivi g1..gN: le tabelle del database vi si appoggiano",
);
assert.equal(
  new Set(giocatori.map((g) => g.numero)).size,
  giocatori.length,
  "numeri di maglia unici",
);
for (const g of giocatori) {
  assert.ok(g.nome.trim().length > 0 && g.ruolo.trim().length > 0, `${g.id}: nome e ruolo`);
  assert.match(g.nascita, /^\d{4}-\d{2}-\d{2}$/, `${g.id}: data di nascita valida`);
  assert.ok(g.numero > 0, `${g.id}: numero di maglia positivo`);
  assert.equal(g.iniziali.length, 2, `${g.id}: due iniziali`);
  assert.equal(g.iniziali, g.iniziali.toUpperCase(), `${g.id}: iniziali maiuscole`);
  assert.equal(g.mediaVoto, 0, `${g.id}: media voto iniziale a zero`);
  assert.equal(g.presenze, 0, `${g.id}: presenze iniziali a zero`);
  assert.equal(g.totaliEventi, 0, `${g.id}: totaliEventi iniziale a zero`);
  assert.equal(g.mvp, 0, `${g.id}: mvp iniziale a zero`);
  assert.equal(g.streak, 0, `${g.id}: streak iniziale a zero`);
}

// --- formatData --------------------------------------------------------------
assert.equal(formatData("2026-09-01"), "mar 01 settembre");
assert.equal(formatData("2026-01-31"), "sab 31 gennaio");
assert.ok(
  !formatData("2026-03-29").includes("28"),
  "cambio ora legale: la data non slitta al giorno prima",
);

// --- stati presenza ----------------------------------------------------------
assert.deepEqual(Object.keys(statoMeta), [
  "presente",
  "assente",
  "forse",
  "ritardo",
  "infortunato",
]);
for (const [stato, meta] of Object.entries(statoMeta)) {
  assert.ok(meta.label && meta.emoji && meta.className, `${stato}: metadati completi`);
}

console.log("crapp-data: ok");
