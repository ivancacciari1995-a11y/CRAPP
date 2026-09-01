/** Check delle serie consecutive: `bun test/unit/serie.test.ts`. */
import assert from "node:assert/strict";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import { aggiornaSerie, serieDefs, serieGiocatore, serieMigliore, statoSerie } from "@/lib/serie";

function g(valori: Partial<Giocatore> = {}): Giocatore {
  return { ...giocatori[0]!, serieAllenamenti: 0, seriePartite: 0, serieConferme: 0, ...valori };
}

const allenamenti = serieDefs.find((d) => d.tipo === "allenamenti")!;

// --- aggiornaSerie: si azzera solo la serie non onorata -----------------------
assert.equal(aggiornaSerie(4, true), 5);
assert.equal(aggiornaSerie(4, false), 0, "un buco azzera la serie");
assert.equal(aggiornaSerie(0, true), 1, "si riparte da uno");

// --- statoSerie: traguardi 3 / 6 / 10 / 15 -----------------------------------
const partenza = statoSerie(allenamenti, g());
assert.deepEqual(
  [partenza.valore, partenza.prossimo, partenza.manca, partenza.progresso],
  [0, 3, 3, 0],
);
assert.equal(partenza.messaggio, "Serie allenamenti azzerata: riparti dal prossimo.");

const aDue = statoSerie(allenamenti, g({ serieAllenamenti: 2 }));
assert.deepEqual([aDue.prossimo, aDue.manca, aDue.progresso], [3, 1, 67]);
assert.equal(aDue.messaggio, "Manca solo una volta al prossimo traguardo!");

const sulTraguardo = statoSerie(allenamenti, g({ serieAllenamenti: 3 }));
assert.equal(sulTraguardo.prossimo, 6, "raggiunto un traguardo si punta al successivo");
assert.equal(sulTraguardo.progresso, 50);

const veterano = statoSerie(allenamenti, g({ serieAllenamenti: 7 }));
assert.equal(veterano.messaggio, "Che continuità: ancora 3 e sali di livello.");

const fuoriScala = statoSerie(allenamenti, g({ serieAllenamenti: 20 }));
assert.deepEqual([fuoriScala.prossimo, fuoriScala.manca, fuoriScala.progresso], [null, 0, 100]);
assert.equal(fuoriScala.messaggio, "Serie leggendaria: sei fuori scala!");

// --- serieGiocatore / serieMigliore ------------------------------------------
const tutte = serieGiocatore(g({ serieAllenamenti: 4, seriePartite: 1, serieConferme: 9 }));
assert.equal(tutte.length, serieDefs.length, "tre serie indipendenti");
assert.deepEqual(
  tutte.map((s) => s.valore),
  [4, 1, 9],
  "ogni serie legge il proprio contatore",
);

const migliore = serieMigliore(g({ serieAllenamenti: 4, seriePartite: 1, serieConferme: 9 }));
assert.equal(migliore.def.tipo, "conferme", "in home si mostra la serie più lunga");
assert.ok(serieMigliore(g()), "anche a zero c'è sempre una serie da mostrare");

// --- invarianti sulle definizioni --------------------------------------------
for (const def of serieDefs) {
  const ordinati = [...def.traguardi].sort((a, b) => a - b);
  assert.deepEqual(def.traguardi, ordinati, `${def.tipo}: traguardi crescenti`);
  assert.ok(def.traguardi.length > 0 && def.label && def.descrizione);
}

console.log("serie: ok");
