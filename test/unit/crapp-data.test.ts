/** Check dei dati di base della rosa: `bun test/unit/crapp-data.test.ts`. */
import assert from "node:assert/strict";
import {
  adminNomi,
  classifica,
  formatData,
  giocatori,
  isAdmin,
  statoMeta,
  storicoMatch,
} from "@/lib/crapp-data";

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
  assert.ok(g.mediaVoto >= 0 && g.mediaVoto <= 10, `${g.id}: media voto nel range 1-10`);
  assert.ok(g.presenze <= g.totaliEventi, `${g.id}: presenze mai oltre gli eventi totali`);
}

// --- amministratori ----------------------------------------------------------
for (const nome of adminNomi) {
  const admin = giocatori.find((g) => g.nome === nome);
  assert.ok(admin, `l'amministratore ${nome} è in rosa`);
  assert.equal(isAdmin(admin.id), true);
}
const nonAdmin = giocatori.find((g) => !adminNomi.includes(g.nome))!;
assert.equal(isAdmin(nonAdmin.id), false);
assert.equal(isAdmin("g999"), false, "un id inesistente non è amministratore");
assert.equal(isAdmin(""), false);

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

// --- dati demo residui -------------------------------------------------------
assert.equal(new Set(storicoMatch.map((m) => m.id)).size, storicoMatch.length, "id partite unici");
for (const m of storicoMatch) {
  assert.equal(
    m.parziali.length,
    m.setNostri + m.setLoro,
    `${m.id}: un parziale per ogni set giocato`,
  );
  assert.ok(m.setNostri === 3 || m.setLoro === 3, `${m.id}: una partita finisce a 3 set vinti`);
}
assert.deepEqual(
  classifica.map((r) => r.pos),
  classifica.map((_, i) => i + 1),
  "la classifica di partenza è numerata in ordine",
);
for (const r of classifica) {
  assert.equal(r.vinte + r.perse, r.giocate, `${r.squadra}: vinte + perse = giocate`);
}

console.log("crapp-data: ok");
