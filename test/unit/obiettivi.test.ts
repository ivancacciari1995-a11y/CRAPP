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
assert.equal(trova(vuoti, "o13").valore, 0, "nessuna pagella: conteggio 0");
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

// --- o1: chi non è convocato non occupa un posto, la sua assenza non pesa -------
{
  const [g1, g2] = giocatori;
  const mese: ContestoObiettivi = {
    ...contestoVuoto,
    eventi: [{ ...evento("m1", "2026-08-10", "allenamento"), convocati: [g1!.id, g2!.id] }],
    presenze: { m1: { [g1!.id]: "presente", [g2!.id]: "assente" } },
  };
  assert.equal(
    trova(obiettiviSquadra(giocatori, mese, OGGI_AGOSTO), "o1").valore,
    50,
    "su 2 convocati 1 presente e 1 assente: 50%, il resto della rosa non conta",
  );
  assert.equal(
    trova(
      obiettiviSquadra(
        giocatori,
        { ...mese, eventi: [evento("m1", "2026-08-10", "allenamento")] },
        OGGI_AGOSTO,
      ),
      "o1",
    ).valore,
    Math.round((1 / giocatori.length) * 100),
    "senza convocati i posti sono tutta la rosa",
  );
}

// --- presenze (o1 mese, o7 totale): casi limite del calcolo ------------------------
{
  const [g1, g2, g3, g4] = giocatori;
  const P = (...x: [string, "presente" | "ritardo" | "assente" | "forse" | "infortunato"][]) =>
    Object.fromEntries(x);
  const o1v = (c: ContestoObiettivi, oggi = OGGI_AGOSTO) =>
    trova(obiettiviSquadra(giocatori, c, oggi), "o1").valore;
  const o7v = (c: ContestoObiettivi) => trova(obiettiviSquadra(giocatori, c), "o7").valore;
  const conv = (id: string, data: string, tipo: Evento["tipo"], convocati: string[]) => ({
    ...evento(id, data, tipo),
    convocati,
  });

  // Solo allenamenti e partite entrano nel conto: cene, eventi e compleanni restano fuori
  // anche se hanno risposte di presenza.
  const conAltri: ContestoObiettivi = {
    ...contestoVuoto,
    eventi: [
      conv("t1", "2026-08-05", "allenamento", [g1!.id, g2!.id]),
      conv("t2", "2026-08-06", "evento", [g1!.id, g2!.id]),
      conv("t3", "2026-08-07", "compleanno", [g1!.id, g2!.id]),
    ],
    presenze: {
      t1: P([g1!.id, "presente"], [g2!.id, "assente"]),
      t2: P([g1!.id, "assente"], [g2!.id, "assente"]),
      t3: P([g1!.id, "presente"], [g2!.id, "presente"]),
    },
  };
  assert.equal(o1v(conAltri), 50, "o1: solo l'allenamento conta (1 su 2)");
  assert.equal(o7v(conAltri), 50, "o7: solo l'allenamento conta (1 su 2)");

  // Assente, forse, infortunato e nessuna risposta sono tutti presenze perse: posto vuoto.
  const perse: ContestoObiettivi = {
    ...contestoVuoto,
    eventi: [conv("p1", "2026-08-05", "partita", [g1!.id, g2!.id, g3!.id, g4!.id])],
    presenze: { p1: P([g1!.id, "assente"], [g2!.id, "forse"], [g3!.id, "infortunato"]) },
  };
  assert.equal(o1v(perse), 0, "o1: nessuna presenza, 0 su 4");
  assert.equal(o7v(perse), 0, "o7: nessuna presenza, 0 su 4");
  const unaPresente = {
    ...perse,
    presenze: { p1: P([g1!.id, "presente"], [g2!.id, "forse"], [g3!.id, "infortunato"]) },
  };
  assert.equal(o1v(unaPresente), 25, "o1: 1 presente su 4 convocati");
  assert.equal(o7v(unaPresente), 25, "o7: 1 presente su 4 convocati");

  // Un non convocato che risponde non gonfia la percentuale, e se è assente non la abbassa.
  const nonConv: ContestoObiettivi = {
    ...contestoVuoto,
    eventi: [conv("n1", "2026-08-05", "allenamento", [g1!.id])],
    presenze: { n1: P([g1!.id, "presente"], [g2!.id, "assente"], [g3!.id, "presente"]) },
  };
  assert.equal(o1v(nonConv), 100, "o1: l'assente non convocato non pesa, il presente nemmeno");
  assert.equal(o7v(nonConv), 100, "o7: idem");

  // Il mese e il totale coincidono quando tutti gli eventi sono del mese corrente;
  // il totale invece comprende anche gli altri mesi.
  const dueMesi: ContestoObiettivi = {
    ...contestoVuoto,
    eventi: [
      conv("m1", "2026-08-05", "allenamento", [g1!.id, g2!.id]),
      conv("m2", "2026-07-05", "allenamento", [g1!.id, g2!.id]),
    ],
    presenze: {
      m1: P([g1!.id, "presente"], [g2!.id, "presente"]),
      m2: P([g1!.id, "assente"], [g2!.id, "assente"]),
    },
  };
  assert.equal(o1v(dueMesi), 100, "o1: guarda solo agosto");
  assert.equal(o7v(dueMesi), 50, "o7: guarda agosto e luglio insieme");
  assert.equal(o1v(dueMesi, new Date("2026-07-15T10:00:00Z")), 0, "o1 a luglio: solo luglio");
  const soloAgosto = { ...dueMesi, eventi: [dueMesi.eventi[0]!] };
  assert.equal(o1v(soloAgosto), o7v(soloAgosto), "stessi eventi: stessa percentuale");

  // Confine di mese nel fuso Europe/Rome: il 30 giugno alle 22:30 UTC a Roma è già luglio.
  const sera = new Date("2026-06-30T22:30:00Z");
  const luglio: ContestoObiettivi = {
    ...contestoVuoto,
    eventi: [conv("l1", "2026-07-01", "allenamento", [g1!.id])],
    presenze: { l1: P([g1!.id, "presente"]) },
  };
  assert.equal(o1v(luglio, sera), 100, "a Roma è già il 1° luglio: l'evento di luglio conta");
  const giugno = { ...luglio, eventi: [conv("l1", "2026-06-30", "allenamento", [g1!.id])] };
  assert.equal(o1v(giugno, sera), 0, "a Roma giugno è finito: l'evento del 30 giugno non conta");

  // Convocato sconosciuto (non in rosa): nessun posto, quindi 0 e non NaN.
  const fantasma: ContestoObiettivi = {
    ...contestoVuoto,
    eventi: [conv("f1", "2026-08-05", "allenamento", ["fantasma"])],
    presenze: { f1: P(["fantasma", "presente"]) },
  };
  assert.equal(o1v(fantasma), 0, "o1: convocato fuori rosa, 0 posti");
  assert.equal(o7v(fantasma), 0, "o7: convocato fuori rosa, 0 posti");

  // Evento senza nessuna risposta: i posti ci sono, le presenze no.
  const senzaRisposte: ContestoObiettivi = {
    ...contestoVuoto,
    eventi: [conv("r1", "2026-08-05", "allenamento", [g1!.id, g2!.id])],
  };
  assert.equal(o1v(senzaRisposte), 0, "o1: nessuna risposta = 0%");

  // Rosa vuota: nessuna divisione per zero.
  assert.equal(
    trova(obiettiviSquadra([], conAltri, OGGI_AGOSTO), "o1").valore,
    0,
    "rosa vuota: o1",
  );
  assert.equal(
    trova(obiettiviSquadra([], conAltri, OGGI_AGOSTO), "o7").valore,
    0,
    "rosa vuota: o7",
  );

  // Arrotondamento: 2 su 3 = 67%, e il progresso non supera mai il 100%.
  const treConvocati: ContestoObiettivi = {
    ...contestoVuoto,
    eventi: [conv("a3", "2026-08-05", "allenamento", [g1!.id, g2!.id, g3!.id])],
    presenze: { a3: P([g1!.id, "presente"], [g2!.id, "ritardo"], [g3!.id, "assente"]) },
  };
  assert.equal(o1v(treConvocati), 67, "o1: 2 su 3 arrotondato");
  assert.equal(o7v(treConvocati), 67, "o7: 2 su 3 arrotondato");

  // Soglia del 90%: la percentuale arriva al target e l'obiettivo risulta completato.
  const dieci = giocatori.slice(0, 10).map((g) => g.id);
  const novePresenti: ContestoObiettivi = {
    ...contestoVuoto,
    eventi: [conv("d1", "2026-08-05", "allenamento", dieci)],
    presenze: {
      d1: Object.fromEntries(dieci.map((id, i) => [id, i === 0 ? "assente" : "presente"])),
    },
  };
  const ob1 = trova(obiettiviSquadra(giocatori, novePresenti, OGGI_AGOSTO), "o1");
  assert.equal(ob1.valore, 90, "9 su 10 = 90%");
  assert.equal(progressoObiettivo(ob1), 100, "90% su target 90% = completato");
}

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
  assert.ok(
    o1Settembre.titolo.includes("settembre"),
    "titolo o1 riflette il mese iniettato (settembre)",
  );
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
    eventi: [evento("dr1", "2026-08-03", "allenamento"), evento("dr2", "2026-08-17", "partita")],
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
  const OGGI_SETTEMBRE = new Date("2026-09-20T10:00:00Z");
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

  // Definito ma non ancora arrivato: non conta finché non scatta l'ora dell'evento.
  const pizzataFutura: ContestoObiettivi = {
    eventi: [{ ...evento("pf1", "2026-09-28", "evento"), ora: "20:30" }],
    presenze: {},
    pagelle: [],
  };
  assert.equal(
    trova(obiettiviSquadra(giocatori, pizzataFutura, OGGI_SETTEMBRE), "o6").valore,
    0,
    "un evento futuro non completa l'obiettivo al momento della definizione",
  );
  const serata = { ...evento("ps1", "2026-09-20", "evento"), ora: "20:30" };
  const conSerata: ContestoObiettivi = { eventi: [serata], presenze: {}, pagelle: [] };
  // 20/09 10:00Z = 12:00 a Roma (CEST): prima delle 20:30 non conta, dopo sì.
  assert.equal(
    trova(obiettiviSquadra(giocatori, conSerata, OGGI_SETTEMBRE), "o6").valore,
    0,
    "stesso giorno ma ora non ancora arrivata: non conta",
  );
  assert.equal(
    trova(obiettiviSquadra(giocatori, conSerata, new Date("2026-09-20T18:30:00Z")), "o6").valore,
    1,
    "arrivata l'ora dell'evento (20:30 a Roma): conta",
  );

  // Senza ora vale 00:00: conta dal giorno stesso, non il giorno prima.
  const senzaOra: ContestoObiettivi = {
    eventi: [{ ...evento("so1", "2026-09-20", "evento"), ora: "" }],
    presenze: {},
    pagelle: [],
  };
  assert.equal(
    trova(obiettiviSquadra(giocatori, senzaOra, OGGI_SETTEMBRE), "o6").valore,
    1,
    "evento senza ora: conta dal giorno stesso",
  );
  assert.equal(
    trova(obiettiviSquadra(giocatori, senzaOra, new Date("2026-09-19T21:00:00Z")), "o6").valore,
    0,
    "evento senza ora: la sera prima (Roma) non conta",
  );
  // Ora legale: il 20/09 vale CEST (UTC+2), il 20/12 CET (UTC+1): 20:30 Roma = 18:30Z / 19:30Z.
  const inverno = { ...evento("iv1", "2026-12-20", "evento"), ora: "20:30" };
  const ctxInverno: ContestoObiettivi = { eventi: [inverno], presenze: {}, pagelle: [] };
  assert.equal(
    trova(obiettiviSquadra(giocatori, ctxInverno, new Date("2026-12-20T19:29:00Z")), "o6").valore,
    0,
    "inverno: 19:29Z = 20:29 a Roma, non ancora",
  );
  assert.equal(
    trova(obiettiviSquadra(giocatori, ctxInverno, new Date("2026-12-20T19:30:00Z")), "o6").valore,
    1,
    "inverno: 19:30Z = 20:30 a Roma, conta",
  );
  // Cambio mese a mezzanotte di Roma: 30/09 23:30Z è già 01/10 a Roma (CEST).
  const fineSett = { ...evento("fs1", "2026-09-30", "evento"), ora: "20:00" };
  const ctxFine: ContestoObiettivi = { eventi: [fineSett], presenze: {}, pagelle: [] };
  assert.equal(
    trova(obiettiviSquadra(giocatori, ctxFine, new Date("2026-09-30T21:59:00Z")), "o6").valore,
    1,
    "30/09 23:59 a Roma: ancora settembre, conta",
  );
  assert.equal(
    trova(obiettiviSquadra(giocatori, ctxFine, new Date("2026-09-30T22:00:00Z")), "o6").valore,
    0,
    "01/10 00:00 a Roma: nuovo mese, si azzera",
  );
  // Più eventi: ne basta uno passato; quello futuro non si somma.
  const misti: ContestoObiettivi = {
    eventi: [evento("m1", "2026-09-05", "evento"), evento("m2", "2026-09-28", "evento")],
    presenze: {},
    pagelle: [],
  };
  assert.equal(
    trova(obiettiviSquadra(giocatori, misti, OGGI_SETTEMBRE), "o6").valore,
    1,
    "conta solo l'evento già passato",
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

// --- o7: presenze collettive (% su allenamenti e partite definiti, passati e futuri) ---
{
  const [g1, g2, g3, g4] = giocatori;
  const rosa4 = [g1!, g2!, g3!, g4!];
  const o7 = (c: ContestoObiettivi, r = rosa4) => trova(obiettiviSquadra(r, c, OGGI_AGOSTO), "o7");

  assert.equal(o7(contestoVuoto).titolo, "Presenze collettive");
  assert.equal(o7(contestoVuoto).target, 90);
  assert.equal(o7(contestoVuoto).valore, 0, "nessun evento: 0, non NaN");
  assert.equal(o7({ ...contestoVuoto }, []).valore, 0, "rosa vuota: 0");

  // Allenamento passato (3 presenti su 4) + partita futura (1 presente su 4): 4 su 8 = 50%.
  const base: ContestoObiettivi = {
    eventi: [evento("c1", "2026-07-01", "allenamento"), evento("c2", "2026-12-01", "partita")],
    presenze: {
      c1: { [g1!.id]: "presente", [g2!.id]: "ritardo", [g3!.id]: "presente", [g4!.id]: "assente" },
      c2: { [g1!.id]: "presente", [g2!.id]: "assente" },
    },
    pagelle: [],
  };
  assert.equal(o7(base).valore, 50, "passati e futuri nel denominatore, ritardo conta");

  // Con convocati il denominatore sono solo loro: c1 per g1 e g2 (2 presenti su 2) = 100%.
  const conConvocati: ContestoObiettivi = {
    ...base,
    eventi: [{ ...evento("c1", "2026-07-01", "allenamento"), convocati: [g1!.id, g2!.id] }],
  };
  assert.equal(o7(conConvocati).valore, 100, "denominatore = convocati");

  // Un non convocato che risponde "presente" non gonfia la percentuale.
  const nonConvocato: ContestoObiettivi = {
    ...conConvocati,
    presenze: { c1: { [g1!.id]: "presente", [g3!.id]: "presente" } },
  };
  assert.equal(o7(nonConvocato).valore, 50, "i non convocati non contano (1 su 2)");

  // Arrotondamento: 179 presenze su 200 posti = 89,5% -> 90; 178 su 200 = 89%.
  const rosa100 = Array.from({ length: 100 }, (_, i) => ({ ...g1!, id: `r${i}` }));
  const rispondi = (presenti: number) =>
    Object.fromEntries(rosa100.map((g, i) => [g.id, i < presenti ? "presente" : "assente"]));
  const duePartite = (a: number, b: number): ContestoObiettivi => ({
    eventi: [evento("t1", "2026-07-01", "allenamento"), evento("t2", "2026-07-02", "allenamento")],
    presenze: {
      t1: rispondi(a) as Record<string, "presente" | "assente">,
      t2: rispondi(b) as Record<string, "presente" | "assente">,
    },
    pagelle: [],
  });
  assert.equal(o7(duePartite(90, 89), rosa100).valore, 90, "89,5% arrotonda a 90");
  assert.equal(o7(duePartite(90, 88), rosa100).valore, 89, "89% resta 89");
  assert.equal(o7(duePartite(100, 100), rosa100).valore, 100);

  // Evento privo di risposte: pesa nel denominatore ma non nel numeratore.
  const senzaRisposte: ContestoObiettivi = {
    eventi: [evento("n1", "2026-07-01", "allenamento")],
    presenze: {},
    pagelle: [],
  };
  assert.equal(o7(senzaRisposte).valore, 0, "nessuna risposta: 0%");

  // Convocati che non sono in rosa: non entrano nei posti.
  const fuoriRosa: ContestoObiettivi = {
    eventi: [{ ...evento("f1", "2026-07-01", "allenamento"), convocati: ["sconosciuto"] }],
    presenze: {},
    pagelle: [],
  };
  assert.equal(o7(fuoriRosa).valore, 0, "nessun posto valido: 0, non NaN");

  // Eventi sociali e compleanni non fanno parte del denominatore.
  const sociali: ContestoObiettivi = {
    ...base,
    eventi: [
      ...base.eventi,
      evento("c3", "2026-07-10", "evento"),
      evento("c4", "2026-07-11", "compleanno"),
    ],
  };
  assert.equal(o7(sociali).valore, 50, "solo allenamenti e partite");
}

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
assert.equal(
  trova(obiettiviSquadra(giocatori, { ...contestoVuoto, pagelle: pagellePiuPartite }), "o13")
    .valore,
  2,
  "il conteggio somma i voti di più match_id, non solo dell'ultima",
);

// --- o11: continuità di squadra (giocatori con serieAllenamenti >= 3) --------
{
  assert.equal(
    trova(obiettiviSquadra([], contestoVuoto), "o11").valore,
    0,
    "rosa vuota: nessuno può essere in serie",
  );

  // Target 12 su una rosa di 17: il minimo per schierare due sestetti (6vs6), non un
  // valore arbitrario — vedi docs/modules/obiettivi-squadra.md.
  assert.equal(trova(vuoti, "o11").target, 12, "il target resta 12: minimo per un 6vs6");

  // Il confine è >= 3, non > 3: 2 non basta, 3 sì.
  const rosaConfine = giocatori
    .slice(0, 3)
    .map((g, i) => ({ ...g, serieAllenamenti: [2, 3, 10][i]! }));
  assert.equal(
    trova(obiettiviSquadra(rosaConfine, contestoVuoto), "o11").valore,
    2,
    "conta solo chi ha almeno 3 allenamenti consecutivi (2 non basta, 3 sì)",
  );
}

// --- o3/o4/o5: vittorie in campionato (1/5/10), tutte cappate al target -------
{
  const conVittorie = (n: number) => obiettiviSquadra(giocatori, { ...contestoVuoto, vittorie: n });

  // Senza dato CSI (undefined) o a zero vittorie: tutti fermi a 0, nessun NaN.
  for (const senzaVittorie of [contestoVuoto, { ...contestoVuoto, vittorie: 0 }]) {
    const obiettivi = obiettiviSquadra(giocatori, senzaVittorie);
    assert.equal(trova(obiettivi, "o3").valore, 0);
    assert.equal(trova(obiettivi, "o4").valore, 0);
    assert.equal(trova(obiettivi, "o5").valore, 0);
  }

  // I target restano fissi: 1, 5, 10.
  assert.deepEqual(
    [trova(vuoti, "o3").target, trova(vuoti, "o4").target, trova(vuoti, "o5").target],
    [1, 5, 10],
  );

  // Progressione realistica: con 1 vittoria tutti e tre valgono 1 (o3 già al target,
  // o4/o5 solo all'inizio).
  assert.deepEqual(
    [1, 2, 3].map((n) => trova(conVittorie(1), `o${n + 2}`).valore),
    [1, 1, 1],
    "1 vittoria: o3 al target, o4/o5 ancora lontani ma valgono 1",
  );
  const conCinque = conVittorie(5);
  assert.deepEqual(
    [trova(conCinque, "o3").valore, trova(conCinque, "o4").valore, trova(conCinque, "o5").valore],
    [1, 5, 5],
    "5 vittorie: o3 e o4 al target, o5 a metà",
  );
  const conDieci = conVittorie(10);
  assert.deepEqual(
    [trova(conDieci, "o3").valore, trova(conDieci, "o4").valore, trova(conDieci, "o5").valore],
    [1, 5, 10],
    "10 vittorie: tutti e tre al target",
  );

  // Oltre il target: o3 e o4 restavano già cappati con Math.min, o5 no (bug fixato:
  // valore = vittorie invece di Math.min(vittorie, 10), incoerente con gli altri due e
  // mostrato senza cap in squadra.tsx/index.tsx come "15/10 vittorie").
  const conQuindici = conVittorie(15);
  assert.deepEqual(
    [
      trova(conQuindici, "o3").valore,
      trova(conQuindici, "o4").valore,
      trova(conQuindici, "o5").valore,
    ],
    [1, 5, 10],
    "oltre il target tutti e tre restano cappati, o5 incluso",
  );
}

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
  dettaglio: { comeSiCalcola: "", conta: [], nonConta: [], periodo: "", fonte: "", esempio: "" },
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

// --- dettaglio: ogni obiettivo spiega tutto, senza campi vuoti ---------------------
for (const ob of obiettiviSquadra(giocatori, contestoVuoto)) {
  const d = ob.dettaglio;
  for (const campo of [d.comeSiCalcola, d.periodo, d.fonte, d.esempio]) {
    assert.ok(campo.trim().length > 0, `${ob.id}: testo di dettaglio vuoto`);
  }
  assert.ok(d.conta.length > 0, `${ob.id}: manca «cosa conta»`);
  assert.ok(d.nonConta.length > 0, `${ob.id}: manca «cosa non conta»`);
  if (ob.id === "o1" || ob.id === "o7") {
    assert.ok(d.perse && d.perse.length > 0, `${ob.id}: manca «presenza persa»`);
  }
}

console.log("obiettivi: ok");
