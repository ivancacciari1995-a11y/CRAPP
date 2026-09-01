/** Check dello scout: `bun test/unit/scout-store.test.ts`. */
import assert from "node:assert/strict";
import { classifica, giocatori } from "@/lib/crapp-data";
import {
  azioniMeta,
  classificaConScout,
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
  mvp: "",
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

// --- classificaConScout: 3 punti netti, 2 al tie-break vinto, 1 al perso -----
assert.deepEqual(classificaConScout([]), classifica, "senza scout resta la classifica di partenza");

const noi = "CRAP Volley";
const rigaBase = classifica.find((r) => r.squadra === noi)!;
const puntiDopo = (m: ScoutMatch) =>
  classificaConScout([m]).find((r) => r.squadra === noi)!.punti - rigaBase.punti;

assert.equal(puntiDopo(match("v1", 3, 0)), 3, "3-0 vale 3 punti");
assert.equal(puntiDopo(match("v2", 3, 1)), 3, "3-1 vale 3 punti");
assert.equal(puntiDopo(match("v3", 3, 2)), 2, "3-2 vale 2 punti");
assert.equal(puntiDopo(match("p1", 2, 3)), 1, "2-3 vale 1 punto");
assert.equal(puntiDopo(match("p2", 0, 3)), 0, "0-3 non vale punti");

const aggiornata = classificaConScout([match("v1", 3, 1)]);
const nostra = aggiornata.find((r) => r.squadra === noi)!;
assert.equal(nostra.giocate, rigaBase.giocate + 1);
assert.equal(nostra.vinte, rigaBase.vinte + 1);
assert.equal(nostra.setFatti, rigaBase.setFatti + 3);
assert.equal(nostra.setSubiti, rigaBase.setSubiti + 1);
assert.deepEqual(
  aggiornata.map((r) => r.pos),
  aggiornata.map((_, i) => i + 1),
  "le posizioni vengono rinumerate dopo il riordino",
);
assert.deepEqual(
  aggiornata.map((r) => r.punti),
  [...aggiornata.map((r) => r.punti)].sort((x, y) => y - x),
  "ordinata per punti decrescenti",
);
assert.equal(
  aggiornata.filter((r) => r.squadra !== noi).length,
  classifica.length - 1,
  "le altre squadre restano invariate",
);

// --- metadati azioni ---------------------------------------------------------
for (const [tipo, meta] of Object.entries(azioniMeta)) {
  assert.ok(meta.label && meta.short, `${tipo}: etichette presenti`);
}

console.log("scout-store: ok");
