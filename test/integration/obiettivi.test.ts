/**
 * Obiettivi di squadra end-to-end contro il database locale: `bun test/integration/obiettivi.test.ts`.
 * Copre gli obiettivi con scadenza/mese dinamici ("presenze del mese", "evento di squadra al
 * mese", "tutti rispondono alle convocazioni") e quelli la cui logica dipende da dati scritti
 * su altre tabelle ("250 presenze complessive" via `contaPresenzeGiocatore()`, "media pagelle
 * da 7.5" e "200 pagelle compilate" via `pagelle_voti`).
 *
 * I test unitari (`test/unit/obiettivi.test.ts`) verificano `obiettiviSquadra()` come funzione
 * pura, con un `ContestoObiettivi` costruito a mano. Qui invece si scrivono righe vere su
 * `eventi_app` e `risposte_presenze`, si rileggono con `leggiEventi()` (la stessa funzione che
 * usa l'app lato server) e una query REST equivalente a `fetchPresenze()`, e si verifica che il
 * risultato che arriva a `obiettiviSquadra()` sia quello atteso: se una colonna cambia nome o
 * la mappatura si rompe, qui il valore torna sbagliato (o NaN) anche se i test unitari restano
 * verdi, perché quelli non toccano mai il database.
 *
 * Il mese di test è marzo 2099: non collide con gli eventi del seed (tutti in agosto 2026), così
 * questi due obiettivi — che ora aggregano su TUTTI gli eventi del mese corrente, non solo
 * quelli del test — restano prevedibili senza dover filtrare gli eventi letti dal database.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-obiettivi`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { giocatori } from "@/lib/crapp-data";
import { obiettiviSquadra } from "@/lib/obiettivi";
import { contaPresenzeGiocatore, serieConsecutiva, type MappaPresenze } from "@/lib/presenze";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("obiettivi (o1) sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("obiettivi");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`obiettivi su ${URL_BASE}`);

  // Prima di qualsiasi import dei moduli server: è da qui che nasce `supabaseAdmin`.
  process.env["SUPABASE_URL"] = URL_BASE;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVIZIO;

  const { leggiEventi } = await import("@/lib/eventi.server");

  const PREFISSO = "test-obiettivi";
  const MESE_TEST = "2099-03";
  const OGGI = new Date("2099-03-15T10:00:00Z");

  const rest = (percorso: string, init?: RequestInit) =>
    fetch(`${URL_BASE}/rest/v1/${percorso}`, {
      ...init,
      headers: {
        apikey: SERVIZIO,
        Authorization: `Bearer ${SERVIZIO}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

  /** Stessa query di `fetchPresenze()` (`src/lib/presenze.ts`), raggruppata a mano. */
  async function leggiPresenze(eventoId: string): Promise<MappaPresenze> {
    const res = await rest(
      `risposte_presenze?evento_id=eq.${eventoId}&select=evento_id,giocatore_id,stato`,
    );
    const righe = (await res.json()) as Array<{
      evento_id: string;
      giocatore_id: string;
      stato: string;
    }>;
    const mappa: MappaPresenze = {};
    for (const r of righe) {
      (mappa[r.evento_id] ??= {})[r.giocatore_id] = r.stato as never;
    }
    return mappa;
  }

  try {
    const eventoId = `${PREFISSO}-e1`;

    await prova("prepara evento e presenze reali su Supabase locale", async () => {
      const inserito = await rest("eventi_app", {
        method: "POST",
        body: JSON.stringify({
          id: eventoId,
          tipo: "allenamento",
          titolo: "Test obiettivi o1",
          data: `${MESE_TEST}-10`,
        }),
      });
      if (!inserito.ok) throw new Error(`inserimento evento fallito: ${await inserito.text()}`);

      // 9 presenti su 17 giocatori del roster reale (`crapp-data.ts`, id g1..g17).
      const presenti = giocatori.slice(0, 9).map((g) => g.id);
      const righe = giocatori.map((g) => ({
        evento_id: eventoId,
        giocatore_id: g.id,
        stato: presenti.includes(g.id) ? "presente" : "assente",
      }));
      const inseritePresenze = await rest("risposte_presenze", {
        method: "POST",
        body: JSON.stringify(righe),
      });
      if (!inseritePresenze.ok) {
        throw new Error(`inserimento presenze fallito: ${await inseritePresenze.text()}`);
      }
    });

    await prova(
      "o1 legge l'evento e le presenze vere dal database e calcola la percentuale del mese",
      async () => {
        const eventiReali = await leggiEventi();
        assert.ok(
          eventiReali.some((e) => e.id === eventoId),
          "leggiEventi() include l'evento appena inserito",
        );
        const presenzeReali = await leggiPresenze(eventoId);

        const obiettivi = obiettiviSquadra(
          giocatori,
          { eventi: eventiReali, presenze: presenzeReali, pagelle: [] },
          OGGI,
        );
        const o1 = obiettivi.find((o) => o.id === "o1")!;

        assert.equal(
          o1.valore,
          Math.round((9 / giocatori.length) * 100),
          "9 presenti su tutta la rosa, letti dal database",
        );
        assert.equal(o1.titolo, "90% di presenze a marzo", "titolo segue il mese iniettato");
        assert.equal(o1.scadenza, "2099-03-31", "scadenza = ultimo giorno di marzo");
      },
    );

    await prova("un evento fuori dal mese di test non sposta o1", async () => {
      const eventoFuoriMese = `${PREFISSO}-e2`;
      const fuori = await rest("eventi_app", {
        method: "POST",
        body: JSON.stringify({
          id: eventoFuoriMese,
          tipo: "allenamento",
          titolo: "Test obiettivi o1 - fuori mese",
          data: "2099-04-01",
        }),
      });
      if (!fuori.ok) throw new Error(`inserimento evento fallito: ${await fuori.text()}`);
      try {
        const presenzeFuoriMese = giocatori.map((g) => ({
          evento_id: eventoFuoriMese,
          giocatore_id: g.id,
          stato: "presente",
        }));
        const scritte = await rest("risposte_presenze", {
          method: "POST",
          body: JSON.stringify(presenzeFuoriMese),
        });
        if (!scritte.ok) throw new Error(`inserimento presenze fallito: ${await scritte.text()}`);

        const eventiReali = await leggiEventi();
        const presenzeReali = {
          ...(await leggiPresenze(eventoId)),
          ...(await leggiPresenze(eventoFuoriMese)),
        };
        const o1 = obiettiviSquadra(
          giocatori,
          { eventi: eventiReali, presenze: presenzeReali, pagelle: [] },
          OGGI,
        ).find((o) => o.id === "o1")!;
        assert.equal(
          o1.valore,
          Math.round((9 / giocatori.length) * 100),
          "l'evento di aprile non entra nel calcolo di marzo",
        );
      } finally {
        await rest(`eventi_app?id=eq.${eventoFuoriMese}`, { method: "DELETE" });
        await rest(`risposte_presenze?evento_id=eq.${eventoFuoriMese}`, { method: "DELETE" });
      }
    });

    await prova(
      "o1 aggrega su più eventi reali dello stesso mese, incluse le partite",
      async () => {
        // Isolati dal resto del database (come per o2/o7/o12): l'evento "e1" di un test
        // precedente resta nello stesso mese e andrebbe a sporcare l'aggregazione se non
        // filtrassimo sui soli eventi di questo blocco.
        const allenamentoId = `${PREFISSO}-o1b-allenamento`;
        const partitaId = `${PREFISSO}-o1b-partita`;
        for (const [id, tipo, data] of [
          [allenamentoId, "allenamento", `${MESE_TEST}-12`],
          [partitaId, "partita", `${MESE_TEST}-19`],
        ] as const) {
          const inserito = await rest("eventi_app", {
            method: "POST",
            body: JSON.stringify({ id, tipo, titolo: `Test obiettivi o1 (${tipo})`, data }),
          });
          if (!inserito.ok) throw new Error(`inserimento evento fallito: ${await inserito.text()}`);
        }

        // Tutta la rosa presente all'allenamento, nessuno alla partita: 50% aggregato sui due.
        const risposte = [
          ...giocatori.map((g) => ({
            evento_id: allenamentoId,
            giocatore_id: g.id,
            stato: "presente",
          })),
          ...giocatori.map((g) => ({ evento_id: partitaId, giocatore_id: g.id, stato: "assente" })),
        ];
        const scritte = await rest("risposte_presenze", {
          method: "POST",
          body: JSON.stringify(risposte),
        });
        if (!scritte.ok) throw new Error(`inserimento presenze fallito: ${await scritte.text()}`);

        const eventiReali = (await leggiEventi()).filter(
          (e) => e.id === allenamentoId || e.id === partitaId,
        );
        const presenzeReali = {
          ...(await leggiPresenze(allenamentoId)),
          ...(await leggiPresenze(partitaId)),
        };

        const o1 = obiettiviSquadra(
          giocatori,
          { eventi: eventiReali, presenze: presenzeReali, pagelle: [] },
          OGGI,
        ).find((o) => o.id === "o1")!;
        assert.equal(
          o1.valore,
          50,
          "le partite contano quanto gli allenamenti: 100% + 0% su due eventi reali = 50%",
        );
      },
    );

    await prova("o2 aggrega le risposte su più eventi reali, non solo su uno", async () => {
      const eventoA = `${PREFISSO}-o2b-a`;
      const eventoB = `${PREFISSO}-o2b-b`;
      for (const [id, data] of [
        [eventoA, `${MESE_TEST}-02`],
        [eventoB, `${MESE_TEST}-22`],
      ] as const) {
        const inserito = await rest("eventi_app", {
          method: "POST",
          body: JSON.stringify({
            id,
            tipo: "allenamento",
            titolo: "Test obiettivi o2 aggregato",
            data,
          }),
        });
        if (!inserito.ok) throw new Error(`inserimento evento fallito: ${await inserito.text()}`);
      }

      // Tutti rispondono al primo evento, nessuno al secondo: 50% aggregato sui due.
      const risposteA = giocatori.map((g) => ({
        evento_id: eventoA,
        giocatore_id: g.id,
        stato: "presente",
      }));
      const scritte = await rest("risposte_presenze", {
        method: "POST",
        body: JSON.stringify(risposteA),
      });
      if (!scritte.ok) throw new Error(`inserimento presenze fallito: ${await scritte.text()}`);

      const eventiReali = (await leggiEventi()).filter((e) => e.id === eventoA || e.id === eventoB);
      const presenzeReali = await leggiPresenze(eventoA);

      const o2 = obiettiviSquadra(
        giocatori,
        { eventi: eventiReali, presenze: presenzeReali, pagelle: [] },
        OGGI,
      ).find((o) => o.id === "o2")!;
      assert.equal(
        o2.valore,
        50,
        "risposte piene su un evento, zero sull'altro = 50% aggregato sui due",
      );
    });

    await prova(
      "o6 legge dal database l'evento sociale del mese, azzerandosi come o1",
      async () => {
        const pizzataId = `${PREFISSO}-pizzata`;
        const inserita = await rest("eventi_app", {
          method: "POST",
          body: JSON.stringify({
            id: pizzataId,
            tipo: "evento",
            titolo: "Test obiettivi o6",
            data: `${MESE_TEST}-20`,
          }),
        });
        if (!inserita.ok) throw new Error(`inserimento evento fallito: ${await inserita.text()}`);

        const eventiReali = await leggiEventi();
        const o6InMese = obiettiviSquadra(
          giocatori,
          { eventi: eventiReali, presenze: {}, pagelle: [] },
          OGGI,
        ).find((o) => o.id === "o6")!;
        assert.equal(o6InMese.valore, 1, "l'evento sociale di marzo conta letto dal database");

        const OGGI_MESE_DOPO = new Date("2099-04-15T10:00:00Z");
        const o6MeseDopo = obiettiviSquadra(
          giocatori,
          { eventi: eventiReali, presenze: {}, pagelle: [] },
          OGGI_MESE_DOPO,
        ).find((o) => o.id === "o6")!;
        assert.equal(
          o6MeseDopo.valore,
          0,
          "lo stesso evento non conta più il mese successivo (si azzera)",
        );
      },
    );

    await prova(
      "o2 legge dal database risposte reali ed esclude i compleanni, con scadenza dinamica",
      async () => {
        // o2 (percentualeRisposte) aggrega su TUTTI gli eventi non-compleanno, senza filtro di
        // mese: per un'asserzione deterministica isoliamo dal risultato reale solo i due eventi
        // di questo test, invece di dipendere dal numero di eventi già presenti nel database
        // (seed incluso).
        const partitaId = `${PREFISSO}-o2-partita`;
        const compleannoId = `${PREFISSO}-o2-compleanno`;

        const inseritaPartita = await rest("eventi_app", {
          method: "POST",
          body: JSON.stringify({
            id: partitaId,
            tipo: "partita",
            titolo: "Test obiettivi o2",
            data: `${MESE_TEST}-05`,
          }),
        });
        if (!inseritaPartita.ok) {
          throw new Error(`inserimento evento fallito: ${await inseritaPartita.text()}`);
        }
        const inseritoCompleanno = await rest("eventi_app", {
          method: "POST",
          body: JSON.stringify({
            id: compleannoId,
            tipo: "compleanno",
            titolo: "Test obiettivi o2 - compleanno",
            data: `${MESE_TEST}-06`,
          }),
        });
        if (!inseritoCompleanno.ok) {
          throw new Error(`inserimento evento fallito: ${await inseritoCompleanno.text()}`);
        }

        // Solo 12 giocatori su tutta la rosa rispondono alla partita; nessuno "risponde" al
        // compleanno, perché non richiede risposta.
        const rispondenti = giocatori.slice(0, 12);
        const righe = rispondenti.map((g, i) => ({
          evento_id: partitaId,
          giocatore_id: g.id,
          stato: i % 2 === 0 ? "presente" : "forse",
        }));
        const inseriteRisposte = await rest("risposte_presenze", {
          method: "POST",
          body: JSON.stringify(righe),
        });
        if (!inseriteRisposte.ok) {
          throw new Error(`inserimento presenze fallito: ${await inseriteRisposte.text()}`);
        }

        const eventiReali = (await leggiEventi()).filter(
          (e) => e.id === partitaId || e.id === compleannoId,
        );
        const presenzeReali = await leggiPresenze(partitaId);

        const o2 = obiettiviSquadra(
          giocatori,
          { eventi: eventiReali, presenze: presenzeReali, pagelle: [] },
          OGGI,
        ).find((o) => o.id === "o2")!;

        assert.equal(
          o2.valore,
          Math.round((12 / giocatori.length) * 100),
          "12 risposte reali su un solo evento che le richiede (il compleanno è escluso)",
        );
        assert.equal(o2.scadenza, "2099-03-31", "scadenza o2 = ultimo giorno del mese iniettato");
      },
    );

    await prova("o7 somma presenze calcolate da eventi/risposte reali del database", async () => {
      // o7 non calcola nulla da `ctx`: somma `g.presenze`, un campo già calcolato a monte da
      // `contaPresenzeGiocatore()` (che in produzione alimenta `useRosa()`). Qui si esercita
      // la stessa funzione pura sui dati appena scritti, per verificare l'intera catena
      // DB -> contaPresenzeGiocatore -> o7, non solo la somma finale.
      const allenamentoId = `${PREFISSO}-o7-allenamento`;
      const partitaId = `${PREFISSO}-o7-partita`;
      const OGGI_STR = "2099-01-20";

      for (const [id, tipo, data] of [
        [allenamentoId, "allenamento", "2099-01-05"],
        [partitaId, "partita", "2099-01-08"],
      ] as const) {
        const inserito = await rest("eventi_app", {
          method: "POST",
          body: JSON.stringify({ id, tipo, titolo: `Test obiettivi o7 (${tipo})`, data }),
        });
        if (!inserito.ok) throw new Error(`inserimento evento fallito: ${await inserito.text()}`);
      }

      // g1: presente ai due eventi (2 presenze). g2: presente e in ritardo (2 presenze,
      // il ritardo conta). g3: assente a entrambi (0 presenze).
      const [g1, g2, g3] = giocatori;
      const righe = [
        { evento_id: allenamentoId, giocatore_id: g1!.id, stato: "presente" },
        { evento_id: partitaId, giocatore_id: g1!.id, stato: "presente" },
        { evento_id: allenamentoId, giocatore_id: g2!.id, stato: "presente" },
        { evento_id: partitaId, giocatore_id: g2!.id, stato: "ritardo" },
        { evento_id: allenamentoId, giocatore_id: g3!.id, stato: "assente" },
        { evento_id: partitaId, giocatore_id: g3!.id, stato: "assente" },
      ];
      const inserite = await rest("risposte_presenze", {
        method: "POST",
        body: JSON.stringify(righe),
      });
      if (!inserite.ok) throw new Error(`inserimento presenze fallito: ${await inserite.text()}`);

      const eventiReali = (await leggiEventi()).filter(
        (e) => e.id === allenamentoId || e.id === partitaId,
      );
      const presenzeReali = {
        ...(await leggiPresenze(allenamentoId)),
        ...(await leggiPresenze(partitaId)),
      };

      const rosaConPresenzeReali = [g1!, g2!, g3!].map((g) => ({
        ...g,
        presenze: contaPresenzeGiocatore(g.id, eventiReali, presenzeReali, OGGI_STR),
      }));

      const o7 = obiettiviSquadra(rosaConPresenzeReali, {
        eventi: [],
        presenze: {},
        pagelle: [],
      }).find((o) => o.id === "o7")!;

      assert.equal(
        o7.valore,
        4,
        "g1 (2) + g2 (2, il ritardo conta) + g3 (0) = 4, calcolate dal database",
      );
    });

    await prova("o12/o13 media e conteggio pagelle vere lette da pagelle_voti", async () => {
      const matchId = `${PREFISSO}-o12-m1`;
      const [g1, g2, g3] = giocatori;
      // 7 + 7 + 9 = 23 -> media 7.666... arrotondata a 7.7. Vincoli reali della tabella:
      // niente autovoto (pagelle_no_autovoto), voto 1-10 (pagelle_voto_range).
      const voti = [
        { match_id: matchId, votante_id: g1!.id, votato_id: g2!.id, voto: 7 },
        { match_id: matchId, votante_id: g2!.id, votato_id: g1!.id, voto: 7 },
        { match_id: matchId, votante_id: g3!.id, votato_id: g1!.id, voto: 9 },
      ];
      const inseriti = await rest("pagelle_voti", { method: "POST", body: JSON.stringify(voti) });
      if (!inseriti.ok) throw new Error(`inserimento pagelle fallito: ${await inseriti.text()}`);

      const lette = await rest(
        `pagelle_voti?match_id=eq.${matchId}&select=match_id,votante_id,votato_id,voto`,
      );
      const pagelleReali = (await lette.json()) as Array<{
        match_id: string;
        votante_id: string;
        votato_id: string;
        voto: number;
      }>;
      assert.equal(pagelleReali.length, 3, "i tre voti sono stati scritti e riletti dal database");

      const obiettivi = obiettiviSquadra(giocatori, {
        eventi: [],
        presenze: {},
        pagelle: pagelleReali,
      });
      assert.equal(
        obiettivi.find((o) => o.id === "o12")!.valore,
        7.7,
        "media dei voti reali, arrotondata a una cifra decimale",
      );
      assert.equal(
        obiettivi.find((o) => o.id === "o13")!.valore,
        3,
        "conteggio dei voti reali scritti sul database",
      );
    });

    await prova(
      "o11 conta chi ha almeno 3 allenamenti consecutivi, calcolati da eventi/risposte reali",
      async () => {
        // o11 non calcola nulla da `ctx`: legge `g.serieAllenamenti`, un campo già calcolato a
        // monte da `serieConsecutiva()` (la stessa funzione pura usata da `useRosa()` in
        // produzione). Qui si esercita l'intera catena DB -> serieConsecutiva -> o11.
        const OGGI_STR = "2098-01-20";
        const eventi = [
          [`${PREFISSO}-o11-a1`, "2098-01-05"],
          [`${PREFISSO}-o11-a2`, "2098-01-08"],
          [`${PREFISSO}-o11-a3`, "2098-01-11"],
        ] as const;
        for (const [id, data] of eventi) {
          const inserito = await rest("eventi_app", {
            method: "POST",
            body: JSON.stringify({ id, tipo: "allenamento", titolo: "Test obiettivi o11", data }),
          });
          if (!inserito.ok) throw new Error(`inserimento evento fallito: ${await inserito.text()}`);
        }

        const [g1, g2, g3] = giocatori;
        // g1: presente ai tre allenamenti -> serie 3 (conta). g2: presente, presente, assente
        // -> la serie si azzera all'ultimo (non conta). g3: assente, assente, presente -> serie
        // 1 (non basta).
        const stati: Record<string, [string, string, string]> = {
          [g1!.id]: ["presente", "presente", "presente"],
          [g2!.id]: ["presente", "presente", "assente"],
          [g3!.id]: ["assente", "assente", "presente"],
        };
        const righe = Object.entries(stati).flatMap(([giocatoreId, statiPerEvento]) =>
          eventi.map(([eventoId], i) => ({
            evento_id: eventoId,
            giocatore_id: giocatoreId,
            stato: statiPerEvento[i],
          })),
        );
        const inserite = await rest("risposte_presenze", {
          method: "POST",
          body: JSON.stringify(righe),
        });
        if (!inserite.ok) throw new Error(`inserimento presenze fallito: ${await inserite.text()}`);

        const eventiReali = (await leggiEventi()).filter((e) => eventi.some(([id]) => id === e.id));
        const presenzeReali: MappaPresenze = {};
        for (const [id] of eventi) Object.assign(presenzeReali, await leggiPresenze(id));

        const rosaConSerieReali = [g1!, g2!, g3!].map((g) => ({
          ...g,
          serieAllenamenti: serieConsecutiva(
            g.id,
            eventiReali,
            presenzeReali,
            "allenamento",
            OGGI_STR,
          ),
        }));

        const o11 = obiettiviSquadra(rosaConSerieReali, {
          eventi: [],
          presenze: {},
          pagelle: [],
        }).find((o) => o.id === "o11")!;
        assert.equal(
          o11.valore,
          1,
          "solo g1 (presente ai tre allenamenti) resta in serie, calcolato dal database",
        );
      },
    );
  } finally {
    await rest(`risposte_presenze?evento_id=like.${PREFISSO}*`, { method: "DELETE" });
    await rest(`eventi_app?id=like.${PREFISSO}*`, { method: "DELETE" });
    await rest(`pagelle_voti?match_id=like.${PREFISSO}*`, { method: "DELETE" });
    riepilogo("obiettivi");
  }
}
