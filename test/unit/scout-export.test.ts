/** Check dell'export CSV dello scout: `bun test/unit/scout-export.test.ts`. */
import assert from "node:assert/strict";
import { giocatori } from "@/lib/crapp-data";
import { csvScoutMatch } from "@/lib/scout-export";
import type { Azione, ScoutMatch } from "@/lib/scout-store";

const g1 = giocatori.find((g) => g.id === "g1")!;
const g2 = giocatori.find((g) => g.id === "g2")!;

const a = (tipo: Azione["tipo"], giocatoreId?: string, set = 1): Azione => ({
  id: `${tipo}-${set}-${giocatoreId ?? "team"}`,
  tipo,
  ...(giocatoreId ? { giocatoreId } : {}),
  set,
  ts: 0,
});

const match: ScoutMatch = {
  id: "m1",
  data: "2026-09-01",
  avversario: "Volley; Bologna",
  casa: true,
  setNostri: 3,
  setLoro: 1,
  parziali: [
    [25, 19],
    [23, 25],
    [25, 21],
    [25, 18],
  ],
  azioni: [a("attacco", g1.id), a("ace", g1.id, 2), a("errore", g2.id, 2), a("punto_avv")],
  valutazioni: [],
};

const csv = csvScoutMatch(match, giocatori);
const righe = csv.split("\n");

// --- intestazione ------------------------------------------------------------
assert.equal(
  righe[0],
  'Partita;CRAP Volley;vs;"Volley; Bologna"',
  "il ; nel nome va tra virgolette",
);
assert.equal(righe[1], "Data;2026-09-01;Set;3-1");
assert.ok(csv.includes("Set;Parziale nostro;Parziale loro"));
assert.ok(csv.includes("1;25;19"), "primo parziale");
assert.ok(csv.includes("4;25;18"), "ultimo parziale");

// --- totali per giocatore ----------------------------------------------------
assert.ok(csv.includes("Numero;Giocatore;Ruolo;Punti;Ace;Muri;Errori"));
assert.ok(
  csv.includes(`${g1.numero};${g1.nome};${g1.ruolo};2;1;0;0`),
  "attacco + ace = 2 punti di cui 1 ace",
);
assert.ok(csv.includes(`${g2.numero};${g2.nome};${g2.ruolo};0;0;0;1`));
assert.ok(
  !righe.some((r) => r.startsWith(`${giocatori[2]!.numero};${giocatori[2]!.nome};`)),
  "chi non ha azioni non compare tra i totali",
);

// --- dettaglio azioni --------------------------------------------------------
assert.ok(csv.includes("Set;Giocatore;Azione"));
assert.ok(csv.includes(`1;${g1.nome};Attacco vincente`) || csv.includes(`1;${g1.nome};`));
assert.ok(
  righe.some((r) => r.startsWith("1;") && r.includes("—")),
  "l'azione senza giocatore usa il trattino",
);

// --- trasferta e match vuoto -------------------------------------------------
const fuori = csvScoutMatch({ ...match, casa: false, avversario: "Ospiti" }, giocatori);
assert.equal(fuori.split("\n")[0], "Partita;Ospiti;vs;CRAP Volley", "in trasferta si invertono");

const vuoto = csvScoutMatch({ ...match, azioni: [], parziali: [] }, giocatori);
assert.ok(vuoto.includes("Data;2026-09-01"), "un match senza azioni resta esportabile");
assert.ok(!vuoto.includes(`;${g1.nome};`), "nessun totale senza azioni");

// Le virgolette nel testo vanno raddoppiate (regola CSV).
const conVirgolette = csvScoutMatch({ ...match, avversario: 'Team "X"' }, giocatori);
assert.ok(conVirgolette.includes('"Team ""X"""'));

console.log("scout-export: ok");

// --- valutazioni − / + per set -------------------------------------------------
assert.ok(!csv.includes("Battuta +"), "senza valutazioni la sezione non c'è");
const val = (
  giocatoreId: string,
  fondamentale: "battuta" | "muro",
  segno: "+" | "-",
  set: number,
) => ({
  id: `${giocatoreId}-${fondamentale}-${segno}-${set}-${Math.random()}`,
  giocatoreId,
  fondamentale,
  segno,
  set,
  ts: 0,
});
const conVal = csvScoutMatch(
  {
    ...match,
    valutazioni: [
      val(g1.id, "battuta", "+", 1),
      val(g1.id, "battuta", "+", 1),
      val(g1.id, "battuta", "-", 1),
      val(g1.id, "muro", "-", 2),
    ],
  },
  giocatori,
);
assert.ok(
  conVal.includes(
    "Set;Numero;Giocatore;Battuta +;Battuta -;Ricezione +;Ricezione -;Attacco +;Attacco -;Muro +;Muro -",
  ),
);
assert.ok(
  conVal.includes(`1;${g1.numero};${g1.nome};2;1;0;0;0;0;0;0`),
  "set 1: 2 più e 1 meno in battuta",
);
assert.ok(conVal.includes(`2;${g1.numero};${g1.nome};0;0;0;0;0;0;0;1`), "set 2: 1 meno a muro");
assert.ok(!conVal.includes(`;${g2.nome};0;0;0;0;0;0;0;0`), "chi non ha valutazioni non ha riga");
