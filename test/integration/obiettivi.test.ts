/**
 * Obiettivi mensili di squadra ("presenze del mese" e "evento di squadra al mese")
 * end-to-end contro il database locale: `bun test/integration/obiettivi.test.ts`.
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
import type { MappaPresenze } from "@/lib/presenze";
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
      const inseritePresenze = await rest("risposte_presenze", { method: "POST", body: JSON.stringify(righe) });
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
  } finally {
    await rest(`risposte_presenze?evento_id=like.${PREFISSO}*`, { method: "DELETE" });
    await rest(`eventi_app?id=like.${PREFISSO}*`, { method: "DELETE" });
    riepilogo("obiettivi");
  }
}
