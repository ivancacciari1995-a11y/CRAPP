/** Check della classifica della rosa: `bun test/unit/rosa.test.ts`. */
import assert from "node:assert/strict";
import { classificaRank, dettaglioClassifica } from "@/lib/rosa";

// --- classificaRank: dense rank, a parità di valore stessa posizione -----------

assert.deepEqual(
  classificaRank([4, 4, 3]),
  [1, 1, 2],
  "due giocatori a pari merito condividono la posizione, il numero successivo non salta",
);

assert.deepEqual(
  classificaRank([5, 4, 3, 2]),
  [1, 2, 3, 4],
  "nessun pareggio: posizione progressiva normale",
);

assert.deepEqual(
  classificaRank([3, 3, 3, 1]),
  [1, 1, 1, 2],
  "tre giocatori a pari merito in testa condividono tutti la posizione #1",
);

assert.deepEqual(classificaRank([]), [], "rosa vuota: nessuna posizione");

assert.deepEqual(classificaRank([0, 0]), [1, 1], "parità anche a valore zero");

// --- dettaglioClassifica: il sottotitolo segue il criterio selezionato -------

const g = { streak: 12, votiPagella: 18, totaliEventi: 22, cacche: 3, seriePalloni: 4 };

assert.equal(
  dettaglioClassifica(g, "presenze"),
  "12 presenze consecutive",
  "presenze: mostra la serie di presenze consecutive",
);
assert.equal(
  dettaglioClassifica(g, "palloni"),
  "4 volte consecutive",
  "palloni: mostra le volte consecutive in cui ha portato i palloni, non le presenze",
);
assert.equal(
  dettaglioClassifica(g, "mediaVoto"),
  "18 voti pagella",
  "media voto: mostra quanti voti compongono la media",
);
assert.equal(
  dettaglioClassifica(g, "mvp"),
  "22 partite giocate",
  "mvp: mostra le partite giocate, non le presenze consecutive",
);
assert.equal(
  dettaglioClassifica(g, "cacchePartita"),
  "3 giornate top",
  "cacche: mostra le giornate da primo classificato",
);

console.log("rosa: ok");
