/** Check delle presenze dell'ultimo mese: `bun test/unit/presenze-mese.test.ts`. */
import assert from "node:assert/strict";
import type { Evento } from "@/lib/eventi";
import type { MappaPresenze } from "@/lib/presenze";
import {
  finestraMese,
  presenzeUltimoMese,
  presenzeUltimoMeseTutti,
} from "@/lib/presenze-mese-core";

const ev = (id: string, tipo: Evento["tipo"], data: string, convocati: string[] = []): Evento => ({
  id,
  tipo,
  titolo: id,
  luogo: "",
  data,
  ora: "20:00",
  note: "",
  convocati,
  campionato: false,
  casa: true,
  pagelleChiuse: false,
});

const OGGI = new Date("2026-09-04T12:00:00Z");

// --- la finestra ------------------------------------------------------------------
const { da, a } = finestraMese(OGGI);
assert.equal(a, "2026-09-04", "la finestra si chiude oggi");
assert.equal(da, "2026-08-05", "e si apre 30 giorni prima");

// --- un singolo giocatore ----------------------------------------------------------
const eventi: Evento[] = [
  ev("a1", "allenamento", "2026-08-06"), // dentro
  ev("a2", "allenamento", "2026-08-20"), // dentro, ritardo
  ev("p1", "partita", "2026-09-01"), // dentro, assente
  ev("a0", "allenamento", "2026-07-30"), // fuori: più vecchio di 30 giorni
  ev("c1", "compleanno", "2026-08-15"), // dentro, ma non è né partita né allenamento
  ev("a3", "allenamento", "2026-08-25", ["g2"]), // dentro, ma g1 non è convocato
];

const presenze: MappaPresenze = {
  a1: { g1: "presente", g2: "presente" },
  a2: { g1: "ritardo", g2: "assente" },
  p1: { g1: "assente", g2: "presente" },
  a0: { g1: "presente" },
  c1: { g1: "presente" },
  a3: { g2: "presente" },
};

const g1 = presenzeUltimoMese("g1", eventi, presenze, OGGI);
assert.deepEqual(
  g1,
  { presenti: 2, totali: 3, percentuale: 67 },
  "3 eventi rilevanti su 6: il ritardo conta come presenza, la percentuale è arrotondata",
);

assert.equal(
  presenzeUltimoMese("g1", [ev("a0", "allenamento", "2026-07-30")], presenze, OGGI).percentuale,
  0,
  "senza eventi nella finestra la percentuale è 0, non NaN",
);

assert.deepEqual(
  presenzeUltimoMese(undefined, eventi, presenze, OGGI),
  { presenti: 0, totali: 0, percentuale: 0 },
  "senza giocatore selezionato non si calcola niente",
);

assert.equal(
  presenzeUltimoMese("g9", eventi, presenze, OGGI).totali,
  3,
  "chi non ha mai risposto ha comunque il denominatore degli eventi aperti a tutti",
);

// --- tutta la rosa ------------------------------------------------------------------
const tutti = presenzeUltimoMeseTutti(eventi, presenze, ["g1", "g2"], OGGI);

assert.deepEqual(tutti["g1"], g1, "la mappa e il calcolo singolo dicono la stessa cosa su g1");
assert.deepEqual(
  tutti["g2"],
  { presenti: 3, totali: 4, percentuale: 75 },
  "g2 ha anche l'allenamento in cui era l'unico convocato",
);

// Il caso che distingue le due regole: un evento con l'elenco dei convocati non
// entra nel denominatore di chi non è stato chiamato.
const soloConvocati = presenzeUltimoMeseTutti(
  [ev("a3", "allenamento", "2026-08-25", ["g2"])],
  presenze,
  ["g1", "g2"],
  OGGI,
);
assert.equal(soloConvocati["g1"], undefined, "chi non è convocato non compare nella mappa");
assert.equal(soloConvocati["g2"]?.totali, 1, "il convocato sì");

assert.deepEqual(
  presenzeUltimoMeseTutti([], presenze, ["g1"], OGGI),
  {},
  "senza eventi la mappa è vuota",
);

console.log("presenze mese: ok");
