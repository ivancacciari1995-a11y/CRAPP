/** Check della card di dettaglio degli obiettivi: `bun test/unit/obiettivi-dettaglio.test.ts`. */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SchedaObiettivo } from "@/components/crapp/ObiettivoDrawer";
import { Drawer } from "@/components/ui/drawer";
import { giocatori } from "@/lib/crapp-data";
import { contestoVuoto, obiettiviSquadra, type ObiettivoSquadra } from "@/lib/obiettivi";

const OGGI = new Date("2026-08-15T10:00:00Z");
const tutti = obiettiviSquadra(giocatori, contestoVuoto, OGGI);

/** Rende la scheda dentro un Drawer aperto, come fa l'app (titolo e descrizione ne hanno bisogno). */
const scheda = (o: ObiettivoSquadra) =>
  renderToStaticMarkup(
    createElement(Drawer, { open: true }, createElement(SchedaObiettivo, { o })),
  );

// --- ogni obiettivo ha tutti i testi, nessun campo vuoto ----------------------------
const ids = tutti.map((o) => o.id).sort();
assert.deepEqual(
  ids,
  ["o1", "o11", "o12", "o13", "o2", "o3", "o4", "o5", "o6", "o7"],
  "gli obiettivi sono quelli attesi: se ne aggiungi uno, scrivi il suo dettaglio",
);

for (const o of tutti) {
  const d = o.dettaglio;
  for (const [nome, testo] of Object.entries({
    comeSiCalcola: d.comeSiCalcola,
    periodo: d.periodo,
    fonte: d.fonte,
    esempio: d.esempio,
  })) {
    assert.ok(testo.trim().length > 20, `${o.id}: «${nome}» troppo corto o vuoto`);
  }
  for (const voce of [...d.conta, ...d.nonConta, ...(d.perse ?? [])]) {
    assert.ok(voce.trim().length > 10, `${o.id}: voce di elenco vuota o troppo corta`);
  }
  assert.equal(new Set(d.conta).size, d.conta.length, `${o.id}: voci «conta» duplicate`);
  assert.equal(new Set(d.nonConta).size, d.nonConta.length, `${o.id}: voci «non conta» duplicate`);
}

// --- «presenza persa» solo sulle due percentuali di presenze ------------------------
for (const o of tutti) {
  const haPerse = Boolean(o.dettaglio.perse && o.dettaglio.perse.length > 0);
  assert.equal(haPerse, o.id === "o1" || o.id === "o7", `${o.id}: presenza persa solo su o1 e o7`);
}

// --- le due presenze spiegano gli stessi punti chiave -------------------------------
for (const id of ["o1", "o7"]) {
  const d = tutti.find((o) => o.id === id)!.dettaglio;
  const tutto = [d.comeSiCalcola, ...d.conta, ...(d.perse ?? []), ...d.nonConta].join(" ");
  for (const parola of ["convocat", "presente", "in ritardo", "assente", "cene"]) {
    assert.ok(tutto.toLowerCase().includes(parola), `${id}: la spiegazione non cita «${parola}»`);
  }
  assert.ok(
    d.nonConta.some((v) => /non è convocato/i.test(v)),
    `${id}: dice che il non convocato non pesa`,
  );
}
const mese = tutti.find((o) => o.id === "o1")!.dettaglio;
const totale = tutti.find((o) => o.id === "o7")!.dettaglio;
assert.ok(/mese/i.test(mese.periodo) && /azzera/i.test(mese.periodo), "o1: si azzera ogni mese");
assert.ok(/stagione/i.test(totale.periodo) && /mai/i.test(totale.periodo), "o7: non si azzera mai");

// --- la card renderizzata mostra tutte le sezioni ------------------------------------
const o1 = tutti.find((o) => o.id === "o1")!;
const html1 = scheda(o1);
for (const titolo of [
  "Stato attuale",
  "Come si calcola",
  "Cosa conta",
  "Presenza persa",
  "Non entra nel calcolo",
  "Quando vale",
  "Da dove arrivano i dati",
  "Un esempio",
]) {
  assert.ok(html1.includes(titolo), `la card di o1 non mostra «${titolo}»`);
}
assert.ok(html1.includes(o1.titolo.replace(/&/g, "&amp;")), "titolo");
assert.ok(html1.includes(o1.dettaglio.comeSiCalcola), "testo «come si calcola»");
assert.ok(html1.includes(o1.impatto), "frase di impatto");
assert.ok(html1.includes("entro il"), "o1 ha una scadenza mensile");
assert.ok(
  !html1.includes("Cosa non conta"),
  "con «presenza persa» la sezione si chiama diversamente",
);

// Un obiettivo senza «presenza persa» ha «Cosa non conta» e nessuna sezione in più.
const o12 = tutti.find((o) => o.id === "o12")!;
const html12 = scheda(o12);
assert.ok(html12.includes("Cosa non conta"), "o12: «Cosa non conta»");
assert.ok(!html12.includes("Presenza persa"), "o12: nessuna «presenza persa»");
assert.ok(!html12.includes("Non entra nel calcolo"), "o12: nessun «non entra nel calcolo»");
assert.ok(!html12.includes("entro il"), "o12 non ha scadenza");

// --- stato: in corso / completato, e i numeri mostrati --------------------------------
const finto = (valore: number): ObiettivoSquadra => ({ ...o12, valore, target: 10 });
assert.ok(scheda(finto(4)).includes("In corso"), "sotto il target: in corso");
assert.ok(scheda(finto(4)).includes("40%"), "percentuale mostrata");
assert.ok(scheda(finto(10)).includes("Completato"), "al target: completato");
assert.ok(!scheda(finto(10)).includes("In corso"), "al target non è più in corso");

console.log("obiettivi-dettaglio: ok");
