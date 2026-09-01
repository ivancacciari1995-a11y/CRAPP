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

// --- giocatoriConScout: presenze e MVP, nessuna statistica offensiva ---------
const base = giocatori.find((g) => g.id === "g1")!;
const conScout = giocatoriConScout([match("m1", 3, 0, azioni)], { m1: base.nome });
const dopo = conScout.find((g) => g.id === "g1")!;
assert.equal(dopo.presenze, base.presenze + 1, "chi ha azioni risulta presente");
assert.equal(dopo.mvp, base.mvp + 1, "l'MVP eletto viene sommato");
assert.equal(dopo.totaliEventi, base.totaliEventi + 1);

const assente = conScout.find((g) => g.id === "g3")!;
const baseAssente = giocatori.find((g) => g.id === "g3")!;
assert.equal(assente.presenze, baseAssente.presenze, "chi non ha azioni non guadagna presenze");
assert.equal(assente.totaliEventi, baseAssente.totaliEventi + 1, "l'evento conta per tutti");

assert.deepEqual(giocatoriConScout([]), giocatori, "senza partite la rosa resta invariata");

// --- metadati azioni ---------------------------------------------------------
for (const [tipo, meta] of Object.entries(azioniMeta)) {
  assert.ok(meta.label && meta.short, `${tipo}: etichette presenti`);
}

console.log("scout-store: ok");
