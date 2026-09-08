/**
 * Badge segreto Mai un forfait end-to-end contro il database locale:
 * `bun test/integration/s-mai-forfait-badge.test.ts`.
 *
 * I test unitari (`test/unit/presenze.test.ts`, `test/unit/badges.test.ts`) verificano
 * `serieConferme()`, `contaPresenzeGiocatore()` e `statoBadge()` come funzioni pure. Qui invece
 * si scrivono eventi con `creato_il` esplicito e risposte con `risposto_il` esplicito su
 * `eventi_app`/`risposte_presenze`, si rileggono via REST e si passa il risultato attraverso
 * entrambe le funzioni fino a `statoBadge()` sul badge segreto `s-mai-forfait`, che è l'unico a
 * combinare due statistiche indipendenti (serie di conferme rapide **e** presenze totali).
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-s-mai-forfait-badge`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { badgeSegreti, statoBadge } from "@/lib/badges";
import { serieConferme, contaPresenzeGiocatore } from "@/lib/presenze";
import { daRiga, type RigaEvento, type Evento } from "@/lib/eventi";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("badge Mai un forfait sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("s-mai-forfait-badge");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`badge Mai un forfait su ${URL_BASE}`);

  const PREFISSO = "test-s-mai-forfait-badge";
  const def = badgeSegreti.find((b) => b.id === "s-mai-forfait")!;
  const OGGI = "2099-01-01";

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

  const dataEvento = (i: number) => {
    const d = new Date(Date.UTC(2020, 0, 1));
    d.setUTCDate(d.getUTCDate() + i - 1);
    return d.toISOString().slice(0, 10);
  };

  async function creaEvento(id: string, i: number) {
    const res = await rest("eventi_app", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id,
        tipo: "allenamento",
        titolo: `Evento ${id}`,
        data: dataEvento(i),
        creato_il: `${dataEvento(i)}T08:00:00Z`,
      }),
    });
    if (!res.ok) throw new Error(`creazione evento ${id}: ${res.status} ${await res.text()}`);
  }

  async function rispondi(eventoId: string, giocatoreId: string, i: number) {
    const res = await rest("risposte_presenze?on_conflict=evento_id,giocatore_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        evento_id: eventoId,
        giocatore_id: giocatoreId,
        stato: "presente",
        risposto_il: `${dataEvento(i)}T08:30:00Z`,
      }),
    });
    if (!res.ok) throw new Error(`upsert su risposte_presenze: ${res.status} ${await res.text()}`);
  }

  async function leggiEventi(): Promise<Evento[]> {
    const res = await rest(
      "eventi_app?id=like." +
        PREFISSO +
        "*&select=id,tipo,titolo,luogo,data,ora,note,convocati,campionato,casa,pagelle_chiuse,creato_il",
    );
    const righe = (await res.json()) as RigaEvento[];
    return righe.map(daRiga);
  }

  async function leggiPresenzeETempi(): Promise<{
    presenze: Record<string, Record<string, string>>;
    tempi: Record<string, Record<string, string>>;
  }> {
    const res = await rest(
      `risposte_presenze?evento_id=like.${PREFISSO}*&select=evento_id,giocatore_id,stato,risposto_il`,
    );
    const righe = (await res.json()) as Array<{
      evento_id: string;
      giocatore_id: string;
      stato: string;
      risposto_il: string;
    }>;
    const presenze: Record<string, Record<string, string>> = {};
    const tempi: Record<string, Record<string, string>> = {};
    for (const r of righe) {
      (presenze[r.evento_id] ??= {})[r.giocatore_id] = r.stato;
      (tempi[r.evento_id] ??= {})[r.giocatore_id] = r.risposto_il;
    }
    return { presenze, tempi };
  }

  function giocatoreAzzerato(serieConferme: number, presenze: number): Giocatore {
    return {
      ...giocatori[0]!,
      serieConferme,
      presenze,
      mvp: 0,
      mediaVoto: 0,
      votiPagella: 0,
      palloni: 0,
    };
  }

  try {
    await prova(
      "il segreto si sblocca solo quando entrambe le condizioni sono vere insieme",
      async () => {
        // "mf1": 15 eventi passati, presente e confermato in fretta a tutti — soddisfa
        // ampiamente sia la serie di conferme (>=10) sia le presenze (>=15).
        for (let i = 1; i <= 15; i += 1) {
          const id = `${PREFISSO}-a${String(i).padStart(2, "0")}`;
          await creaEvento(id, i);
          await rispondi(id, "mf1", i);
        }

        const eventi15 = await leggiEventi();
        const { presenze: p15, tempi: t15 } = await leggiPresenzeETempi();

        // Solo 9 eventi: serie di conferme appena sotto soglia, presenze sotto soglia.
        const eventi9 = eventi15.slice(0, 9);
        const serie9 = serieConferme("mf1", eventi9, t15, OGGI);
        const pres9 = contaPresenzeGiocatore("mf1", eventi9, p15, OGGI);
        assert.equal(serie9, 9);
        assert.equal(pres9, 9);
        assert.equal(
          statoBadge(def, giocatoreAzzerato(serie9, pres9)).grado,
          null,
          "9 conferme e 9 presenze: nessuna delle due soglie raggiunta",
        );

        const serie15 = serieConferme("mf1", eventi15, t15, OGGI);
        const pres15 = contaPresenzeGiocatore("mf1", eventi15, p15, OGGI);
        assert.equal(serie15, 15);
        assert.equal(pres15, 15);
        assert.equal(
          statoBadge(def, giocatoreAzzerato(serie15, pres15)).grado,
          "oro",
          "serie conferme >=10 e presenze >=15: il segreto si sblocca",
        );
      },
    );

    await prova("una risposta lenta rompe la serie ma non le presenze già accumulate", async () => {
      // Un sedicesimo evento con risposta arrivata oltre le 24h: la serie conferme torna a 0,
      // ma le presenze (indipendenti) restano a 16 — il segreto deve richiudersi, non serve
      // ripartire da zero anche sulle presenze.
      const idLento = `${PREFISSO}-a16`;
      await creaEvento(idLento, 16);
      const res = await rest("risposte_presenze?on_conflict=evento_id,giocatore_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          evento_id: idLento,
          giocatore_id: "mf1",
          stato: "presente",
          risposto_il: `${dataEvento(18)}T08:00:00Z`, // 2 giorni dopo la convocazione
        }),
      });
      if (!res.ok)
        throw new Error(`upsert su risposte_presenze: ${res.status} ${await res.text()}`);

      const eventi = await leggiEventi();
      const { presenze, tempi } = await leggiPresenzeETempi();
      const serie = serieConferme("mf1", eventi, tempi, OGGI);
      const conto = contaPresenzeGiocatore("mf1", eventi, presenze, OGGI);
      assert.equal(serie, 0, "la risposta lenta azzera la serie di conferme");
      assert.equal(conto, 16, "le presenze restano quelle di sempre, indipendenti dalla serie");
      assert.equal(
        statoBadge(def, giocatoreAzzerato(serie, conto)).grado,
        null,
        "presenze abbondanti ma serie azzerata: il segreto si richiude",
      );
    });
  } finally {
    await rest(`risposte_presenze?evento_id=like.${PREFISSO}*`, { method: "DELETE" });
    await rest(`eventi_app?id=like.${PREFISSO}*`, { method: "DELETE" });
  }

  riepilogo("s-mai-forfait-badge");
}
