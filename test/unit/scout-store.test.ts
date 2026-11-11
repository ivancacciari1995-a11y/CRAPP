/** Check dello scout: `bun test/unit/scout-store.test.ts`. */
import assert from "node:assert/strict";
import { giocatori } from "@/lib/crapp-data";
import {
  azioniMeta,
  contaPiuSenzaRicezione,
  haPunteggio,
  parzialiFinali,
  sintesiValutazioni,
  contaValutazioni,
  fondamentali,
  giocatoriConScout,
  totaliPerGiocatore,
  totaliSquadra,
  totaliSquadraValutazioni,
  totaliTecnici,
  type Azione,
  type Valutazione,
  type ScoutMatch,
} from "@/lib/scout-store";

const a = (tipo: Azione["tipo"], giocatoreId?: string, set = 1): Azione => ({
  id: `${tipo}-${giocatoreId ?? "team"}-${set}-${Math.random()}`,
  tipo,
  ...(giocatoreId ? { giocatoreId } : {}),
  set,
  ts: 0,
});

const match = (
  id: string,
  setNostri: number,
  setLoro: number,
  azioni: Azione[] = [],
): ScoutMatch => ({
  id,
  data: "2026-09-01",
  avversario: "Avversari",
  casa: true,
  setNostri,
  setLoro,
  parziali: [],
  azioni,
  valutazioni: [],
});

// --- totaliPerGiocatore: ace e muri valgono anche come punto ------------------
const azioni = [
  a("attacco", "g1"),
  a("ace", "g1"),
  a("muro", "g1"),
  a("errore", "g1"),
  a("attacco", "g2"),
  a("punto_avv"),
  a("errore_avv"),
];
const totali = totaliPerGiocatore(azioni);
assert.deepEqual(totali.get("g1"), { punti: 3, ace: 1, muri: 1, errori: 1 });
assert.deepEqual(totali.get("g2"), { punti: 1, ace: 0, muri: 0, errori: 0 });
assert.equal(totali.size, 2, "le azioni senza giocatore non creano righe");
assert.equal(totaliPerGiocatore([]).size, 0);

// --- totaliSquadra -----------------------------------------------------------
assert.deepEqual(totaliSquadra([match("m1", 3, 0, azioni), match("m2", 3, 1, azioni)]), {
  punti: 8,
  ace: 2,
  muri: 2,
  errori: 2,
});
assert.deepEqual(totaliSquadra([]), { punti: 0, ace: 0, muri: 0, errori: 0 });

// --- totaliSquadraValutazioni: solo i + dello scout, fallback sulle azioni ------
const vl = (fondamentale: Valutazione["fondamentale"], segno: "+" | "-", giocatoreId = "g1") =>
  ({
    id: Math.random().toString(),
    giocatoreId,
    fondamentale,
    segno,
    set: 1,
    ts: 0,
  }) as Valutazione;
const conVal = {
  ...match("v1", 3, 0),
  valutazioni: [
    vl("battuta", "+"),
    vl("battuta", "+", "g2"),
    vl("battuta", "-"),
    vl("muro", "+"),
    vl("muro", "-"),
    vl("attacco", "+"),
    vl("attacco", "+", "g2"),
    vl("attacco", "-"),
    vl("ricezione", "+"),
    vl("ricezione", "+"),
  ],
};
assert.deepEqual(totaliSquadraValutazioni([conVal]), { punti: 5, ace: 2, muri: 1 });
assert.deepEqual(
  totaliSquadraValutazioni([conVal, conVal]),
  { punti: 10, ace: 4, muri: 2 },
  "somma su più partite",
);
assert.deepEqual(
  totaliSquadraValutazioni([match("a1", 3, 0, azioni)]),
  { punti: 4, ace: 1, muri: 1 },
  "senza valutazioni: contano le azioni del metodo precedente",
);
assert.deepEqual(
  totaliSquadraValutazioni([{ ...conVal, azioni }]),
  { punti: 5, ace: 2, muri: 1 },
  "con entrambe valgono solo le valutazioni",
);
assert.deepEqual(totaliSquadraValutazioni([]), { punti: 0, ace: 0, muri: 0 });

// --- totaliTecnici: per giocatore, con attacchi -------------------------------
assert.deepEqual(totaliTecnici([conVal], "g1"), { punti: 3, ace: 1, attacchi: 1, muri: 1 });
assert.deepEqual(totaliTecnici([conVal], "g2"), { punti: 2, ace: 1, attacchi: 1, muri: 0 });
assert.deepEqual(totaliTecnici([conVal], "assente"), { punti: 0, ace: 0, attacchi: 0, muri: 0 });
assert.deepEqual(totaliTecnici([conVal, conVal]), { punti: 10, ace: 4, attacchi: 4, muri: 2 });
assert.deepEqual(
  totaliTecnici([match("a1", 3, 0, azioni)], "g1"),
  { punti: 3, ace: 1, attacchi: 1, muri: 1 },
  "metodo precedente: ace, muro e attacco dalle azioni",
);

// --- giocatoriConScout: solo MVP da scout, presenze separate -----------------
const base = giocatori.find((g) => g.id === "g1")!;
const conScout = giocatoriConScout([match("m1", 3, 0, azioni)], { m1: base.nome });
const dopo = conScout.find((g) => g.id === "g1")!;
assert.equal(dopo.presenze, 0, "le azioni scout non alimentano le presenze personali");
assert.equal(dopo.mvp, 1, "l'MVP eletto viene contato");
assert.equal(dopo.totaliEventi, 0, "totaliEventi arriva dagli eventi CrAPP, non dallo scout");

const assente = conScout.find((g) => g.id === "g3")!;
assert.equal(assente.presenze, 0, "senza risposte presenze resta a zero");
assert.equal(assente.mvp, 0);
assert.equal(assente.totaliEventi, 0);

const senzaPartite = giocatoriConScout([]);
assert.ok(
  senzaPartite.every((g) => g.presenze === 0 && g.mvp === 0 && g.totaliEventi === 0),
  "senza partite scout le statistiche restano a zero",
);

// --- metadati azioni ---------------------------------------------------------
for (const [tipo, meta] of Object.entries(azioniMeta)) {
  assert.ok(meta.label && meta.short, `${tipo}: etichette presenti`);
}

console.log("scout-store: ok");

// --- valutazioni − / +: per giocatore, fondamentale e set; fuori dal punteggio -------
const v = (
  giocatoreId: string,
  fondamentale: Valutazione["fondamentale"],
  segno: Valutazione["segno"],
  set = 1,
): Valutazione => ({
  id: `${giocatoreId}-${fondamentale}-${segno}-${set}-${Math.random()}`,
  giocatoreId,
  fondamentale,
  segno,
  set,
  ts: 0,
});

assert.deepEqual(
  fondamentali.map((f) => f.id),
  ["battuta", "ricezione", "attacco", "muro"],
);
const val = [
  v("g1", "battuta", "+"),
  v("g1", "battuta", "+"),
  v("g1", "battuta", "-"),
  v("g1", "ricezione", "-", 2),
  v("g1", "muro", "+", 2),
  v("g2", "attacco", "+"),
];
assert.deepEqual(contaValutazioni(val, "g1", 1), {
  battuta: { piu: 2, meno: 1 },
  ricezione: { piu: 0, meno: 0 },
  attacco: { piu: 0, meno: 0 },
  muro: { piu: 0, meno: 0 },
});
assert.deepEqual(
  contaValutazioni(val, "g1", 2).ricezione,
  { piu: 0, meno: 1 },
  "il set 2 è separato",
);
assert.deepEqual(
  contaValutazioni(val, "g1").battuta,
  { piu: 2, meno: 1 },
  "senza set: tutta la partita",
);
assert.deepEqual(contaValutazioni(val, "g1").ricezione, { piu: 0, meno: 1 });
assert.deepEqual(
  contaValutazioni(val, "g3", 1).battuta,
  { piu: 0, meno: 0 },
  "giocatore senza valutazioni",
);
assert.equal(totaliPerGiocatore([]).size, 0, "le valutazioni non sono azioni: nessun punto");

// --- + del riquadro giocatore: tutti i fondamentali tranne la ricezione, nel set -------
const piuVal = [
  v("g1", "battuta", "+"),
  v("g1", "attacco", "+"),
  v("g1", "muro", "+"),
  v("g1", "ricezione", "+"),
  v("g1", "attacco", "-"),
  v("g1", "battuta", "+", 2),
  v("g2", "attacco", "+"),
];
assert.equal(
  contaPiuSenzaRicezione(piuVal, "g1", 1),
  3,
  "niente ricezione, niente −, solo il set 1",
);
assert.equal(contaPiuSenzaRicezione(piuVal, "g1", 2), 1);
assert.equal(contaPiuSenzaRicezione(piuVal, "g3", 1), 0);

// --- parziali finali: il set in corso conta solo se ha dati ------------------------
assert.deepEqual(
  parzialiFinali([[25, 20]], [0, 0], true),
  [
    [25, 20],
    [0, 0],
  ],
  "set con sole valutazioni",
);
assert.deepEqual(
  parzialiFinali([[25, 20]], [0, 0], false),
  [[25, 20]],
  "set vuoto: non si archivia",
);
assert.deepEqual(parzialiFinali([], [0, 0], false), [], "nessun set da salvare");

// --- haPunteggio: le partite di sole valutazioni non sono un risultato -------------
assert.equal(
  haPunteggio({
    parziali: [
      [0, 0],
      [0, 0],
    ],
  }),
  false,
);
assert.equal(haPunteggio({ parziali: [] }), false);
assert.equal(
  haPunteggio({
    parziali: [
      [0, 0],
      [25, 18],
    ],
  }),
  true,
);

// --- sintesi per la lettura nell'app: squadra e giocatori, partita o singolo set -----
const tutta = sintesiValutazioni(val);
assert.deepEqual(tutta.squadra.battuta, { piu: 2, meno: 1 });
assert.deepEqual(tutta.squadra.attacco, { piu: 1, meno: 0 });
assert.deepEqual(tutta.squadra.ricezione, { piu: 0, meno: 1 });
assert.deepEqual(tutta.perGiocatore.map((r) => r.giocatoreId).sort(), ["g1", "g2"]);
const set2 = sintesiValutazioni(val, 2);
assert.deepEqual(
  set2.perGiocatore.map((r) => r.giocatoreId),
  ["g1"],
);
assert.deepEqual(set2.squadra.muro, { piu: 1, meno: 0 });
assert.deepEqual(set2.squadra.battuta, { piu: 0, meno: 0 });
assert.equal(sintesiValutazioni([]).perGiocatore.length, 0);
console.log("scout-store sintesi: ok");
