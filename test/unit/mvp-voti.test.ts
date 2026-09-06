/** Check dei voti MVP: `bun test/unit/mvp-voti.test.ts`. */
import assert from "node:assert/strict";
import {
  conteggioPartita,
  mioVoto,
  mvpVintiPerGiocatore,
  vincitoriMvp,
  votoMvpAperto,
  type VotoMvp,
} from "@/lib/mvp-voti";

const v = (
  match_id: string,
  votante_id: string,
  votato_id: string,
  votato_nome: string,
): VotoMvp => ({
  match_id,
  votante_id,
  votato_id,
  votato_nome,
});

// --- conteggioPartita --------------------------------------------------------
const partita = [
  v("m1", "g1", "g2", "Bruno"),
  v("m1", "g3", "g2", "Bruno"),
  v("m1", "g4", "g5", "Anna"),
  v("m2", "g1", "g5", "Anna"),
];

assert.deepEqual(conteggioPartita(partita, "m1"), [
  { id: "g2", nome: "Bruno", voti: 2 },
  { id: "g5", nome: "Anna", voti: 1 },
]);
assert.deepEqual(conteggioPartita(partita, "inesistente"), []);

// A parità di voti l'ordine è alfabetico, così la UI è stabile.
const pari = [v("m3", "g1", "g9", "Zeno"), v("m3", "g2", "g8", "Anna")];
assert.deepEqual(
  conteggioPartita(pari, "m3").map((c) => c.nome),
  ["Anna", "Zeno"],
);

// --- vincitoriMvp: la parità non assegna nessun MVP --------------------------
assert.deepEqual(vincitoriMvp(partita), { m1: "Bruno", m2: "Anna" });
assert.deepEqual(vincitoriMvp(pari), {}, "due voti pari: MVP non assegnato");
assert.deepEqual(vincitoriMvp([]), {});
assert.deepEqual(
  vincitoriMvp([v("m4", "g1", "g2", "Solo")]),
  { m4: "Solo" },
  "un solo votante basta se non c'è concorrenza",
);

// --- mioVoto -----------------------------------------------------------------
assert.equal(mioVoto(partita, "m1", "g1")?.votato_nome, "Bruno");
assert.equal(mioVoto(partita, "m1", "g9"), null, "chi non ha votato non ha voto");
assert.equal(mioVoto(partita, "m9", "g1"), null);

// --- mvpVintiPerGiocatore: una vittoria per partita, la parità non conta -----
assert.deepEqual(
  mvpVintiPerGiocatore(partita),
  { g2: 1, g5: 1 },
  "m1 la vince g2, m2 g5: un titolo a testa",
);
assert.deepEqual(
  mvpVintiPerGiocatore([...partita, ...pari]),
  { g2: 1, g5: 1 },
  "la parità non assegna",
);
assert.deepEqual(
  mvpVintiPerGiocatore([...partita, v("m5", "g1", "g2", "Bruno")]),
  { g2: 2, g5: 1 },
  "i titoli si sommano su partite diverse",
);
assert.deepEqual(mvpVintiPerGiocatore([]), {});

// --- votoMvpAperto: due ore dopo il fischio d'inizio -------------------------
const alle = (o: number, m = 0) => new Date(2026, 8, 5, o, m);
assert.equal(votoMvpAperto("2026-09-05", "20:30", alle(22, 29)), false, "un minuto prima");
assert.equal(votoMvpAperto("2026-09-05", "20:30", alle(22, 30)), true, "due ore in punto");
assert.equal(votoMvpAperto("2026-09-05", "20:30", alle(23)), true);
assert.equal(votoMvpAperto("2026-09-06", "10:00", alle(23)), false, "partita di domani");
assert.equal(votoMvpAperto("2026-09-04", "20:30", alle(0, 1)), true, "partita passata: aperto");
assert.equal(votoMvpAperto("2026-09-05", "", alle(1, 59)), false, "senza ora vale mezzanotte");
assert.equal(votoMvpAperto("2026-09-05", "", alle(2)), true);

console.log("mvp-voti: ok");
