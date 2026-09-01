/** Check dello scout: `bun test/unit/scout-store.test.ts`. */
import assert from "node:assert/strict";
import { giocatori } from "@/lib/crapp-data";
import {
  azioniMeta,
  giocatoriConScout,
  totaliPerGiocatore,
  totaliSquadra,
  type Azione,
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
