/** Check dei badge e dei gradi: `bun src/lib/badges.test.ts`. */
import assert from "node:assert/strict";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import {
  badgeDefs,
  badgeGiocatore,
  badgeSegreti,
  badgeSegretiSbloccati,
  collezioneBadge,
  descrizioneSoglie,
  gradiOrdine,
  gradoRaggiunto,
  mancanoPer,
  microcopyBadge,
  prossimoTraguardo,
  segretiNascosti,
  statoBadge,
  tuttiBadge,
} from "@/lib/badges";

/** Giocatore azzerato: ogni test dichiara solo i valori che gli servono. */
function g(valori: Partial<Giocatore> = {}): Giocatore {
  return {
    ...giocatori[0]!,
    presenze: 0,
    mvp: 0,
    mediaVoto: 0,
    palloni: 0,
    cacche: 0,
    cacchePartita: 0,
    infortuni: 0,
    ritardi: 0,
    streak: 0,
    serieAllenamenti: 0,
    seriePartite: 0,
    serieConferme: 0,
    ...valori,
  };
}

const mvpDef = badgeDefs.find((b) => b.id === "mvp")!;

// --- gradoRaggiunto: soglie 1 / 3 / 5 ----------------------------------------
assert.equal(gradoRaggiunto(mvpDef, 0), null, "sotto la prima soglia nessun grado");
assert.equal(gradoRaggiunto(mvpDef, 1), "bronzo", "la soglia è inclusiva");
assert.equal(gradoRaggiunto(mvpDef, 2), "bronzo");
assert.equal(gradoRaggiunto(mvpDef, 3), "argento");
assert.equal(gradoRaggiunto(mvpDef, 99), "oro", "oltre l'oro resta oro");
assert.deepEqual(gradiOrdine, ["bronzo", "argento", "oro"]);

// --- statoBadge: progresso verso la soglia successiva ------------------------
const aMeta = statoBadge(mvpDef, g({ mvp: 2 }));
assert.deepEqual(
  [aMeta.grado, aMeta.prossimo, aMeta.prossimaSoglia, aMeta.progresso],
  ["bronzo", "argento", 3, 67],
);
const alMassimo = statoBadge(mvpDef, g({ mvp: 5 }));
assert.deepEqual(
  [alMassimo.grado, alMassimo.prossimo, alMassimo.prossimaSoglia],
  ["oro", null, null],
);
assert.equal(alMassimo.progresso, 100, "raggiunto l'oro il progresso è pieno");

// La media voto usa soglie decimali: non deve arrotondare per eccesso.
const pagella = badgeDefs.find((b) => b.id === "pagella")!;
assert.equal(gradoRaggiunto(pagella, 6.4), null);
assert.equal(gradoRaggiunto(pagella, 6.5), "bronzo");

// --- badgeGiocatore ----------------------------------------------------------
assert.equal(badgeGiocatore(g()).length, badgeDefs.length, "i badge normali sono sempre tutti");
assert.ok(
  badgeGiocatore(g()).every((b) => b.grado === null),
  "un giocatore a zero non ha gradi",
);

// --- badge segreti: invisibili finché non si sbloccano ------------------------
const nessunSegreto = g({ mvp: 2, mediaVoto: 7.9 });
assert.equal(badgeSegretiSbloccati(nessunSegreto).length, 0, "serve media 8, non 7.9");
assert.equal(segretiNascosti(nessunSegreto), badgeSegreti.length);

const tiebreak = badgeSegretiSbloccati(g({ mvp: 2, mediaVoto: 8 }));
assert.deepEqual(
  tiebreak.map((b) => b.def.id),
  ["s-tiebreak"],
  "sblocca solo il segreto il cui requisito è soddisfatto",
);

assert.deepEqual(
  badgeSegretiSbloccati(g({ infortuni: 3 })).map((b) => b.def.id),
  ["s-infermeria"],
);
assert.equal(badgeSegretiSbloccati(g({ infortuni: 2 })).length, 0, "2 infortuni non bastano");
assert.deepEqual(
  badgeSegretiSbloccati(g({ ritardi: 5 })).map((b) => b.def.id),
  ["s-ritardi"],
);
assert.deepEqual(
  badgeSegretiSbloccati(g({ cacche: 3 })).map((b) => b.def.id),
  ["s-cacche"],
);
assert.deepEqual(
  badgeSegretiSbloccati(g({ serieConferme: 10, presenze: 15 })).map((b) => b.def.id),
  ["s-mai-forfait"],
);
assert.equal(
  badgeSegretiSbloccati(g({ serieConferme: 10, presenze: 14 })).length,
  0,
  "servono entrambe le condizioni",
);

// --- collezioneBadge ---------------------------------------------------------
const vuota = collezioneBadge(g());
assert.equal(vuota.ottenuti, 0);
assert.equal(vuota.totali, tuttiBadge.length);
assert.equal(vuota.sbloccati.length, 0);
assert.equal(vuota.inProgresso.length, badgeDefs.length);
assert.equal(vuota.nascosti, badgeSegreti.length);

const piena = collezioneBadge(g({ mvp: 5, mediaVoto: 8, presenze: 30, infortuni: 3 }));
assert.equal(
  piena.ottenuti,
  piena.sbloccati.length + piena.segreti.length,
  "gli ottenuti sommano normali e segreti",
);
assert.equal(piena.nascosti, badgeSegreti.length - piena.segreti.length);
assert.ok(piena.ottenuti > 0 && piena.ottenuti < piena.totali);

// --- prossimoTraguardo: il badge in proporzione più vicino -------------------
const vicino = prossimoTraguardo(g({ mvp: 2, presenze: 1 }));
assert.equal(vicino?.def.id, "mvp", "67% batte 20%");
assert.equal(
  prossimoTraguardo(
    g({
      mvp: 5,
      mediaVoto: 10,
      palloni: 10,
      presenze: 30,
      serieAllenamenti: 10,
      serieConferme: 15,
    }),
  ),
  null,
  "tutto al massimo: nessun traguardo residuo",
);

// --- microcopy ---------------------------------------------------------------
assert.equal(mancanoPer(statoBadge(mvpDef, g({ mvp: 2 }))), "Ti mancano 1 MVP per il argento");
assert.equal(mancanoPer(alMassimo), "Livello massimo raggiunto");
assert.equal(microcopyBadge(alMassimo), "Hai fatto tutto: badge d'oro in bacheca.");
assert.equal(microcopyBadge(aMeta), "Sei in piena corsa, continua così.");
assert.equal(microcopyBadge(statoBadge(mvpDef, g())), "Ogni partita conta: si parte da qui.");
assert.equal(descrizioneSoglie(mvpDef), "1/3/5 MVP");

// --- invarianti sulle definizioni --------------------------------------------
for (const def of tuttiBadge) {
  assert.ok(def.soglie.bronzo <= def.soglie.argento, `${def.id}: soglie crescenti`);
  assert.ok(def.soglie.argento <= def.soglie.oro, `${def.id}: soglie crescenti`);
  assert.ok(def.nome && def.descrizione && def.unita, `${def.id}: testi presenti`);
}
assert.equal(
  new Set(tuttiBadge.map((b) => b.id)).size,
  tuttiBadge.length,
  "gli id dei badge sono unici",
);

console.log("badges: ok");
