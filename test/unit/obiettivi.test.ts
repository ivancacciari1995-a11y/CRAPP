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

// --- o1/o2: rosa vuota, filtro sui tipi di evento, aggregazione su più eventi ---
{
  const evetoAgostoSingolo: ContestoObiettivi = {
    eventi: [evento("rv1", "2026-08-10", "allenamento")],
    presenze: { rv1: { g1: "presente" } },
    pagelle: [],
  };
  assert.equal(
    trova(obiettiviSquadra([], evetoAgostoSingolo, OGGI_AGOSTO), "o1").valore,
    0,
    "rosa vuota: 0%, non divide per zero (o1)",
  );
  assert.equal(
    trova(obiettiviSquadra([], evetoAgostoSingolo, OGGI_AGOSTO), "o2").valore,
    0,
    "rosa vuota: 0%, non divide per zero (o2)",
  );

  // o1 conta solo partita+allenamento: se "evento"/"compleanno" trapelassero nel calcolo,
  // il risultato scenderebbe dal 100% atteso (nessuno "presente" su quei due).
  const filtriTipo: ContestoObiettivi = {
    eventi: [
      evento("ft-partita", "2026-08-05", "partita"),
      evento("ft-allenamento", "2026-08-06", "allenamento"),
      evento("ft-evento", "2026-08-07", "evento"),
      evento("ft-compleanno", "2026-08-08", "compleanno"),
    ],
    presenze: {
      "ft-partita": Object.fromEntries(giocatori.map((g) => [g.id, "presente" as const])),
      "ft-allenamento": Object.fromEntries(giocatori.map((g) => [g.id, "presente" as const])),
      "ft-evento": Object.fromEntries(giocatori.map((g) => [g.id, "assente" as const])),
      "ft-compleanno": {},
    },
    pagelle: [],
  };
  assert.equal(
    trova(obiettiviSquadra(giocatori, filtriTipo, OGGI_AGOSTO), "o1").valore,
    100,
    "o1 conta le partite come gli allenamenti, ignora eventi sociali e compleanni",
  );

  // Aggregazione su più eventi dello stesso mese: 100% su uno, 0% sull'altro = 50% aggregato.
  const dueEventi: ContestoObiettivi = {
    eventi: [
      evento("de1", "2026-08-03", "allenamento"),
      evento("de2", "2026-08-17", "allenamento"),
    ],
    presenze: {
      de1: Object.fromEntries(giocatori.map((g) => [g.id, "presente" as const])),
      de2: Object.fromEntries(giocatori.map((g) => [g.id, "assente" as const])),
    },
    pagelle: [],
  };
  assert.equal(
    trova(obiettiviSquadra(giocatori, dueEventi, OGGI_AGOSTO), "o1").valore,
    50,
    "o1 aggrega su più eventi dello stesso mese, non solo sull'ultimo",
  );

  const dueEventiRisposte: ContestoObiettivi = {
    eventi: [
      evento("dr1", "2026-08-03", "allenamento"),
      evento("dr2", "2026-08-17", "partita"),
    ],
    presenze: {
      dr1: Object.fromEntries(giocatori.map((g) => [g.id, "presente" as const])),
      dr2: {},
    },
    pagelle: [],
  };
  assert.equal(
    trova(obiettiviSquadra(giocatori, dueEventiRisposte, OGGI_AGOSTO), "o2").valore,
    50,
    "o2 aggrega le risposte su più eventi, non solo sull'ultimo",
  );
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

// Valori noti e indipendenti dai dati reali della rosa: non solo la stessa formula
// ricalcolata sugli stessi dati, ma una somma verificabile a mente (5 + 10 + 15 = 30).
const rosaControllata = giocatori.slice(0, 3).map((g, i) => ({ ...g, presenze: [5, 10, 15][i]! }));
assert.equal(
  trova(obiettiviSquadra(rosaControllata, contestoVuoto), "o7").valore,
  30,
  "somma di presenze note, indipendente dal roster reale",
);

const pagelle: VotoPagella[] = [
  { match_id: "m1", votante_id: "g1", votato_id: "g2", voto: 7 },
  { match_id: "m1", votante_id: "g2", votato_id: "g1", voto: 8 },
];
const conPagelle = obiettiviSquadra(giocatori, { ...contestoVuoto, pagelle });
assert.equal(trova(conPagelle, "o12").valore, 7.5);
assert.equal(trova(conPagelle, "o13").valore, 2, "conta i voti compilati");

// La media arrotonda a una cifra decimale, non tronca: 23/3 = 7.666... -> 7.7.
const pagelleDaArrotondare: VotoPagella[] = [
  { match_id: "m2", votante_id: "g1", votato_id: "g2", voto: 7 },
  { match_id: "m2", votante_id: "g2", votato_id: "g1", voto: 7 },
  { match_id: "m2", votante_id: "g3", votato_id: "g1", voto: 9 },
];
assert.equal(
  trova(obiettiviSquadra(giocatori, { ...contestoVuoto, pagelle: pagelleDaArrotondare }), "o12")
    .valore,
  7.7,
  "media arrotondata a una cifra decimale (23/3 = 7.666... -> 7.7)",
);

// La media aggrega i voti di più partite insieme, non solo dell'ultima.
const pagellePiuPartite: VotoPagella[] = [
  { match_id: "m3", votante_id: "g1", votato_id: "g2", voto: 5 },
  { match_id: "m4", votante_id: "g1", votato_id: "g2", voto: 9 },
];
assert.equal(
  trova(obiettiviSquadra(giocatori, { ...contestoVuoto, pagelle: pagellePiuPartite }), "o12")
    .valore,
  7,
  "la media aggrega i voti di più partite, non guarda solo una match_id",
);

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
