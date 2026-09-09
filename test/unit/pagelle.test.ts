/** Check delle pagelle: `bun test/unit/pagelle.test.ts`. */
import assert from "node:assert/strict";
import {
  mediaSquadra,
  mediaVotoColpoDOcchio,
  mediePagelle,
  mieiVoti,
  pagellePartita,
  type VotoPagella,
} from "@/lib/pagelle";
import { VOTI_MINIMI_PAGELLA } from "@/lib/badges";

const voto = (
  match_id: string,
  votante_id: string,
  votato_id: string,
  voto: number,
): VotoPagella => ({
  match_id,
  votante_id,
  votato_id,
  voto,
});

const voti: VotoPagella[] = [
  voto("m1", "g1", "g2", 8),
  voto("m1", "g3", "g2", 7),
  voto("m1", "g2", "g1", 6),
  voto("m2", "g1", "g2", 6),
];

// --- mediePagelle ------------------------------------------------------------
const medie = mediePagelle(voti);
assert.deepEqual(medie["g2"], { media: 7, voti: 3 }, "media su tutte le partite");
assert.deepEqual(medie["g1"], { media: 6, voti: 1 });
assert.equal(medie["g99"], undefined, "chi non ha voti non compare");
assert.deepEqual(mediePagelle([]), {}, "nessun voto: nessuna media");

// Arrotondamento a un decimale, senza errori di virgola mobile.
assert.equal(
  mediePagelle([voto("m1", "g1", "gx", 7), voto("m1", "g2", "gx", 8)])["gx"]?.media,
  7.5,
);
assert.equal(
  mediePagelle([voto("m1", "g1", "gy", 7), voto("m1", "g2", "gy", 8), voto("m1", "g3", "gy", 8)])[
    "gy"
  ]?.media,
  7.7,
  "7.666… diventa 7.7",
);

// --- pagellePartita: isola la singola partita --------------------------------
assert.deepEqual(pagellePartita(voti, "m1")["g2"], { media: 7.5, voti: 2 });
assert.deepEqual(pagellePartita(voti, "m2")["g2"], { media: 6, voti: 1 });
assert.deepEqual(pagellePartita(voti, "inesistente"), {});

// --- mieiVoti: cosa ho già votato in questa partita --------------------------
assert.deepEqual(mieiVoti(voti, "m1", "g1"), { g2: 8 });
assert.deepEqual(mieiVoti(voti, "m1", "g2"), { g1: 6 });
assert.deepEqual(mieiVoti(voti, "m1", "g99"), {}, "chi non ha votato non ha voti");

// --- mediaSquadra ------------------------------------------------------------
assert.equal(mediaSquadra(voti), 6.8, "(8+7+6+6)/4 = 6.75 → 6.8");
assert.equal(mediaSquadra([]), 0, "nessun voto: media zero, non NaN");

// --- mediaVotoColpoDOcchio: soglia minima per la StatTile home (DD-028) ------
assert.equal(
  mediaVotoColpoDOcchio({ mediaVoto: 10, votiPagella: VOTI_MINIMI_PAGELLA - 1 }),
  "—",
  "sotto soglia: nascosta anche con media altissima",
);
assert.equal(
  mediaVotoColpoDOcchio({ mediaVoto: 7.5, votiPagella: VOTI_MINIMI_PAGELLA }),
  7.5,
  "esattamente in soglia: la media conta",
);
assert.equal(mediaVotoColpoDOcchio({ mediaVoto: 0, votiPagella: 0 }), "—", "nessun voto ricevuto");

console.log("pagelle: ok");
