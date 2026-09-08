/** Check degli obiettivi di squadra: `bun test/unit/obiettivi.test.ts`. */
import assert from "node:assert/strict";
import { giocatori } from "@/lib/crapp-data";
import type { Evento } from "@/lib/eventi";
import type { VotoPagella } from "@/lib/pagelle";
import type { MappaPresenze } from "@/lib/presenze";
import {
  contestoVuoto,
  microcopyObiettivo,
  obiettiviOrdinati,
  obiettiviSquadra,
  progressoObiettivo,
  type ContestoObiettivi,
  type ObiettivoSquadra,
} from "@/lib/obiettivi";

const evento = (id: string, data: string, tipo: Evento["tipo"]): Evento => ({
  id,
  tipo,
  titolo: id,
  luogo: "",
  data,
  ora: "21:00",
  note: "",
  convocati: [],
  campionato: false,
  casa: true,
  pagelleChiuse: false,
});

const trova = (lista: ObiettivoSquadra[], id: string) => lista.find((o) => o.id === id)!;

// Data di riferimento fissa: o1 (presenze del mese) ora dipende dal mese corrente,
// quindi va iniettata esplicitamente per avere test deterministici.
const OGGI_AGOSTO = new Date("2026-08-15T10:00:00Z");

// --- contesto vuoto: nessuna divisione per zero ------------------------------
const vuoti = obiettiviSquadra(giocatori, contestoVuoto, OGGI_AGOSTO);
assert.equal(trova(vuoti, "o1").valore, 0, "nessun evento nel mese: 0%, non NaN");
assert.equal(trova(vuoti, "o2").valore, 0);
assert.equal(trova(vuoti, "o12").valore, 0, "nessuna pagella: media 0");
assert.ok(
  vuoti.every((o) => Number.isFinite(o.valore)),
  "nessun valore NaN o infinito",
);

// --- presenze del mese (agosto 2026) e risposte ------------------------------
const tuttiPresenti: MappaPresenze = {
  a1: Object.fromEntries(giocatori.map((g) => [g.id, "presente" as const])),
};
const ctx: ContestoObiettivi = {
  eventi: [evento("a1", "2026-08-10", "allenamento")],
  presenze: tuttiPresenti,
  pagelle: [],
};
assert.equal(
  trova(obiettiviSquadra(giocatori, ctx, OGGI_AGOSTO), "o1").valore,
  100,
  "rosa al completo = 100%",
);

const metaRosa: MappaPresenze = {
  a1: Object.fromEntries(
    giocatori.map((g, i) => [g.id, i % 2 === 0 ? ("presente" as const) : ("assente" as const)]),
  ),
};
const percentuale = trova(
  obiettiviSquadra(giocatori, { ...ctx, presenze: metaRosa }, OGGI_AGOSTO),
  "o1",
).valore;
assert.ok(percentuale > 40 && percentuale < 60, `metà rosa presente ≈ 50%, era ${percentuale}`);

// Il ritardo conta come presenza, il "forse" no.
const conRitardo: MappaPresenze = { a1: { g1: "ritardo", g2: "forse" } };
assert.equal(
  trova(obiettiviSquadra(giocatori, { ...ctx, presenze: conRitardo }, OGGI_AGOSTO), "o1").valore,
  Math.round((1 / giocatori.length) * 100),
  "solo il ritardo conta come presente",
);
assert.equal(
  trova(obiettiviSquadra(giocatori, { ...ctx, presenze: conRitardo }, OGGI_AGOSTO), "o2").valore,
  Math.round((2 / giocatori.length) * 100),
  "per le risposte anche il forse conta",
);

// Un evento fuori mese non sposta l'obiettivo mensile.
const fuoriMese: ContestoObiettivi = {
  eventi: [evento("s1", "2026-09-10", "allenamento")],
  presenze: { s1: { g1: "presente" } },
  pagelle: [],
};
assert.equal(trova(obiettiviSquadra(giocatori, fuoriMese, OGGI_AGOSTO), "o1").valore, 0);

// I compleanni non richiedono risposta.
const soloCompleanni: ContestoObiettivi = {
  eventi: [evento("c1", "2026-08-03", "compleanno")],
  presenze: {},
  pagelle: [],
};
assert.equal(trova(obiettiviSquadra(giocatori, soloCompleanni, OGGI_AGOSTO), "o2").valore, 0);

// --- o1: si azzera a ogni cambio mese, in base agli eventi a calendario ------
{
  // Stesso evento/presenze: "in mese" a settembre, "fuori mese" se letto da agosto.
  const OGGI_SETTEMBRE = new Date("2026-09-05T10:00:00Z");
  const eventoSettembre: ContestoObiettivi = {
    eventi: [evento("s2", "2026-09-04", "allenamento")],
    presenze: { s2: Object.fromEntries(giocatori.map((g) => [g.id, "presente" as const])) },
    pagelle: [],
  };
  assert.equal(
    trova(obiettiviSquadra(giocatori, eventoSettembre, OGGI_SETTEMBRE), "o1").valore,
    100,
    "evento di settembre conta se oggi è settembre",
  );
  assert.equal(
    trova(obiettiviSquadra(giocatori, eventoSettembre, OGGI_AGOSTO), "o1").valore,
    0,
    "lo stesso evento non conta se oggi è agosto",
  );

  // Titolo e scadenza seguono il mese corrente, non più una stagione fissa.
  const o1Agosto = trova(obiettiviSquadra(giocatori, contestoVuoto, OGGI_AGOSTO), "o1");
  assert.equal(o1Agosto.titolo, "90% di presenze ad agosto", "elisione 'ad' davanti a vocale");
  assert.equal(o1Agosto.scadenza, "2026-08-31", "scadenza = ultimo giorno del mese");

  const o1Settembre = trova(obiettiviSquadra(giocatori, contestoVuoto, OGGI_SETTEMBRE), "o1");
  assert.ok(o1Settembre.titolo.includes("settembre"), "titolo o1 riflette il mese iniettato (settembre)");
  assert.equal(o1Settembre.scadenza, "2026-09-30", "scadenza = ultimo giorno di settembre (30 gg)");

  // La scadenza di o2 ("Tutti rispondono alle convocazioni") era una data fissa
  // ("2026-09-30"): ora segue lo stesso mese dinamico di o1.
  const o2Agosto = trova(obiettiviSquadra(giocatori, contestoVuoto, OGGI_AGOSTO), "o2");
  assert.equal(o2Agosto.scadenza, "2026-08-31", "scadenza o2 = ultimo giorno del mese iniettato");
  const o2Settembre = trova(obiettiviSquadra(giocatori, contestoVuoto, OGGI_SETTEMBRE), "o2");
  assert.equal(o2Settembre.scadenza, "2026-09-30", "scadenza o2 cambia con il mese iniettato");
}

// --- o6: evento di squadra al mese, si azzera come o1 ------------------------
{
  const OGGI_SETTEMBRE = new Date("2026-09-05T10:00:00Z");
  const pizzataSettembre: ContestoObiettivi = {
    eventi: [evento("p1", "2026-09-12", "evento")],
    presenze: {},
    pagelle: [],
  };
  assert.equal(
    trova(obiettiviSquadra(giocatori, pizzataSettembre, OGGI_SETTEMBRE), "o6").valore,
    1,
    "l'evento sociale di settembre conta se oggi è settembre",
  );
  assert.equal(
    trova(obiettiviSquadra(giocatori, pizzataSettembre, OGGI_AGOSTO), "o6").valore,
    0,
    "lo stesso evento non conta se oggi è agosto",
  );

  const allenamentoNelMese: ContestoObiettivi = {
    eventi: [evento("al1", "2026-08-12", "allenamento")],
    presenze: {},
    pagelle: [],
  };
  assert.equal(
    trova(obiettiviSquadra(giocatori, allenamentoNelMese, OGGI_AGOSTO), "o6").valore,
    0,
    "un allenamento nel mese non è un evento sociale",
  );
}

// --- somme sulla rosa --------------------------------------------------------
const sommaPresenze = giocatori.reduce((s, g) => s + g.presenze, 0);
assert.equal(trova(vuoti, "o7").valore, sommaPresenze);
assert.equal(
  trova(obiettiviSquadra([], contestoVuoto), "o7").valore,
  0,
  "rosa vuota: nessuna presenza",
);

const pagelle: VotoPagella[] = [
  { match_id: "m1", votante_id: "g1", votato_id: "g2", voto: 7 },
  { match_id: "m1", votante_id: "g2", votato_id: "g1", voto: 8 },
];
const conPagelle = obiettiviSquadra(giocatori, { ...contestoVuoto, pagelle });
assert.equal(trova(conPagelle, "o12").valore, 7.5);
assert.equal(trova(conPagelle, "o13").valore, 2, "conta i voti compilati");

// --- progressoObiettivo ------------------------------------------------------
const o = (valore: number, target: number): ObiettivoSquadra => ({
  id: "x",
  titolo: "t",
  descrizione: "d",
  valore,
  target,
  unita: "%",
  emoji: "🎯",
  impatto: "i",
});
assert.equal(progressoObiettivo(o(0, 10)), 0);
assert.equal(progressoObiettivo(o(5, 10)), 50);
assert.equal(progressoObiettivo(o(20, 10)), 100, "il progresso non supera il 100%");

// --- obiettiviOrdinati: i completati vanno in fondo --------------------------
const ordinati = obiettiviOrdinati(giocatori, contestoVuoto);
assert.equal(ordinati.length, vuoti.length, "nessun obiettivo perso nell'ordinamento");
const percentuali = ordinati.map(progressoObiettivo);
const completati = percentuali.filter((p) => p >= 100);
assert.deepEqual(
  percentuali.slice(percentuali.length - completati.length),
  completati,
  "i completati stanno tutti in coda",
);
const inCorso = percentuali.slice(0, percentuali.length - completati.length);
assert.deepEqual(
  inCorso,
  [...inCorso].sort((a, b) => b - a),
  "gli altri dal più avanzato",
);

// --- microcopy ---------------------------------------------------------------
assert.equal(microcopyObiettivo(o(10, 10)), "Obiettivo centrato: grande squadra!");
assert.equal(microcopyObiettivo(o(95, 100)), "Ci siamo quasi: mancano 5 %.");
assert.equal(microcopyObiettivo(o(60, 100)), "Oltre metà strada: ancora 40 %.");
assert.equal(microcopyObiettivo(o(10, 100)), "Si parte: 90 % al traguardo.");
assert.equal(microcopyObiettivo(o(0, 100)), "Tocca a noi far partire questo obiettivo.");

console.log("obiettivi: ok");
