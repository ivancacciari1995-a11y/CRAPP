/** Check del sondaggio cacche: `bun test/unit/cacche.test.ts`. */
import assert from "node:assert/strict";
import {
  mediaPartita,
  mediaStagione,
  recordStagione,
  statisticheCacche,
  type RigaCacche,
} from "@/lib/cacche";

const r = (evento_id: string, giocatore_id: string, quantita: number): RigaCacche => ({
  evento_id,
  giocatore_id,
  quantita,
});

const righe: RigaCacche[] = [
  r("e1", "g1", 3),
  r("e2", "g1", 4),
  r("e1", "g2", 1),
  r("e2", "g2", 2),
];

// --- statisticheCacche -------------------------------------------------------
const stat = statisticheCacche(righe);
assert.deepEqual(stat["g1"], { totale: 7, giornate: 2, media: 3.5, record: 4, giornateTop: 2 });
assert.deepEqual(stat["g2"], { totale: 3, giornate: 2, media: 1.5, record: 2, giornateTop: 0 });
assert.deepEqual(statisticheCacche([]), {});

// giornateTop è la soglia del badge segreto: 3 conta, 2 no.
assert.equal(statisticheCacche([r("e1", "g9", 3)])["g9"]?.giornateTop, 1);
assert.equal(statisticheCacche([r("e1", "g9", 2)])["g9"]?.giornateTop, 0);

// Uno zero dichiarato è una giornata censita, non un dato mancante.
const conZero = statisticheCacche([r("e1", "g7", 0)])["g7"]!;
assert.deepEqual([conZero.giornate, conZero.media, conZero.record], [1, 0, 0]);

// --- medie -------------------------------------------------------------------
assert.equal(mediaPartita(righe, "e1"), 2, "(3+1)/2");
assert.equal(mediaPartita(righe, "e2"), 3, "(4+2)/2");
assert.equal(mediaPartita(righe, "inesistente"), 0, "nessun dato: zero, non NaN");
assert.equal(mediaStagione(righe), 2.5);
assert.equal(mediaStagione([]), 0);
assert.equal(mediaStagione([r("e1", "g1", 1), r("e1", "g2", 2), r("e1", "g3", 2)]), 1.7);

// --- recordStagione ----------------------------------------------------------
assert.deepEqual(recordStagione(righe), r("e2", "g1", 4));
assert.equal(recordStagione([]), null);
assert.deepEqual(
  recordStagione([r("e1", "g1", 4), r("e2", "g2", 4)]),
  r("e1", "g1", 4),
  "a parità vince chi l'ha fatto per primo",
);

console.log("cacche: ok");
