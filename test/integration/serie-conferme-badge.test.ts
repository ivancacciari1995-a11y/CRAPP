/**
 * Badge Risposta lampo end-to-end contro il database locale:
 * `bun test/integration/serie-conferme-badge.test.ts`.
 *
 * I test unitari (`test/unit/presenze.test.ts`, `test/unit/badges.test.ts`) verificano
 * `serieConferme()` e `statoBadge()` come funzioni pure, con eventi e risposte costruiti a
 * mano. Qui invece si scrivono allenamenti/partite ed eventi veri su `eventi_app`, e risposte
 * vere su `risposte_presenze` con `creato_il`/`risposto_il` espliciti, si rileggono via REST
 * con la stessa forma di `daRiga()`/`fetchPresenze()`, e si passa il risultato attraverso
 * `serieConferme()` fino a `statoBadge()` sul badge `serie-conferme`: se una colonna cambia
 * nome, o la mappatura `creato_il`/`risposto_il` -> `creatoIl`/`tempi` si rompe, qui il grado
 * del badge torna sbagliato anche se i test unitari restano verdi, perché quelli non toccano
 * mai il database.
 *
 * Copre due comportamenti non ovvi con dati veri, non solo con numeri scelti a mano:
 * - una risposta arrivata oltre le 24h dalla convocazione azzera la serie, anche dopo una
 *   striscia lunga;
 * - partite e allenamenti contano nella stessa serie, senza bisogno di un filtro per tipo.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-serie-conferme-badge`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { badgeDefs, statoBadge } from "@/lib/badges";
import { serieConferme } from "@/lib/presenze";
import { daRiga, type RigaEvento, type Evento } from "@/lib/eventi";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("badge Risposta lampo sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("serie-conferme-badge");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`badge Risposta lampo su ${URL_BASE}`);

  const PREFISSO = "test-serie-conferme-badge";
  const serieDef = badgeDefs.find((b) => b.id === "serie-conferme")!;
  // "Oggi" fissato nel futuro: gli eventi scritti sotto sono datati nel passato remoto, così
  // restano "passati" (quindi contati) a prescindere da quando gira il test.
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

  /** `2020-01-01` per i=1, avanzando di un giorno per ogni evento: niente collisioni di data. */
  const dataEvento = (i: number) => {
    const d = new Date(Date.UTC(2020, 0, 1));
    d.setUTCDate(d.getUTCDate() + i - 1);
    return d.toISOString().slice(0, 10);
  };

  /** Istante di convocazione: le 8 del mattino del giorno dell'evento. */
  const creazioneEvento = (i: number) => `${dataEvento(i)}T08:00:00Z`;

  async function creaEvento(
    id: string,
    i: number,
    tipo: "allenamento" | "partita" = "allenamento",
  ) {
    const res = await rest("eventi_app", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id,
        tipo,
        titolo: `Evento ${id}`,
        data: dataEvento(i),
        creato_il: creazioneEvento(i),
      }),
    });
    if (!res.ok) throw new Error(`creazione evento ${id}: ${res.status} ${await res.text()}`);
  }

  async function rispondi(
    eventoId: string,
    giocatoreId: string,
    stato: string,
    rispostoIl: string,
  ) {
    const res = await rest("risposte_presenze?on_conflict=evento_id,giocatore_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        evento_id: eventoId,
        giocatore_id: giocatoreId,
        stato,
        risposto_il: rispostoIl,
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

  /** Stessa forma di `fetchPresenze()`: eventoId -> giocatoreId -> istante della risposta. */
  async function leggiTempi(): Promise<Record<string, Record<string, string>>> {
    const res = await rest(
      `risposte_presenze?evento_id=like.${PREFISSO}*&select=evento_id,giocatore_id,risposto_il`,
    );
    const righe = (await res.json()) as Array<{
      evento_id: string;
      giocatore_id: string;
      risposto_il: string;
    }>;
    const mappa: Record<string, Record<string, string>> = {};
    for (const r of righe) (mappa[r.evento_id] ??= {})[r.giocatore_id] = r.risposto_il;
    return mappa;
  }

  function giocatoreAzzerato(serieConferme: number): Giocatore {
    return {
      ...giocatori[0]!,
      serieConferme,
      mvp: 0,
      mediaVoto: 0,
      votiPagella: 0,
      palloni: 0,
      presenze: 0,
    };
  }

  try {
    await prova(
      "il badge passa da bronzo a oro con conferme rapide vere, e una risposta lenta lo azzera",
      async () => {
        // 15 eventi passati, tutti confermati mezz'ora dopo la convocazione per "sc1":
        // bronzo (3), poi argento (8), poi oro (15) man mano che si rileggono i dati.
        for (let i = 1; i <= 15; i += 1) {
          const id = `${PREFISSO}-a${String(i).padStart(2, "0")}`;
          await creaEvento(id, i);
          await rispondi(id, "sc1", "presente", `${dataEvento(i)}T08:30:00Z`);
        }
        const eventi15 = await leggiEventi();
        const tempi15 = await leggiTempi();

        const serieA3 = serieConferme("sc1", eventi15.slice(0, 3), tempi15, OGGI);
        assert.equal(serieA3, 3);
        assert.equal(
          statoBadge(serieDef, giocatoreAzzerato(serieA3)).grado,
          "bronzo",
          "3 conferme rapide di fila: soglia bronzo",
        );

        const serieA8 = serieConferme("sc1", eventi15.slice(0, 8), tempi15, OGGI);
        assert.equal(serieA8, 8);
        assert.equal(
          statoBadge(serieDef, giocatoreAzzerato(serieA8)).grado,
          "argento",
          "8 conferme rapide di fila: soglia argento",
        );

        const serieCompleta = serieConferme("sc1", eventi15, tempi15, OGGI);
        assert.equal(serieCompleta, 15, "confermato in fretta a tutti e 15, nessun buco");
        assert.equal(
          statoBadge(serieDef, giocatoreAzzerato(serieCompleta)).grado,
          "oro",
          "15 conferme rapide di fila: soglia oro",
        );

        // Un sedicesimo evento con una risposta arrivata dopo 2 giorni azzera la serie.
        const idLento = `${PREFISSO}-a16`;
        await creaEvento(idLento, 16);
        await rispondi(idLento, "sc1", "presente", `${dataEvento(18)}T08:00:00Z`);
        const eventiConRitardo = await leggiEventi();
        const tempiConRitardo = await leggiTempi();
        const serieDopoRitardo = serieConferme("sc1", eventiConRitardo, tempiConRitardo, OGGI);
        assert.equal(
          serieDopoRitardo,
          0,
          "una risposta oltre le 24h azzera la serie, anche dopo 15 conferme di fila",
        );
        assert.equal(
          statoBadge(serieDef, giocatoreAzzerato(serieDopoRitardo)).grado,
          null,
          "serie azzerata: nessun grado, si riparte da zero",
        );
      },
    );

    await prova(
      "partite e allenamenti contano nella stessa serie, senza filtro per tipo",
      async () => {
        // "sc2": conferma rapida su un allenamento, poi su una partita, poi su un altro
        // allenamento: la serie sale a 3 senza bisogno che siano tutti dello stesso tipo.
        await creaEvento(`${PREFISSO}-b01`, 30, "allenamento");
        await creaEvento(`${PREFISSO}-b02`, 31, "partita");
        await creaEvento(`${PREFISSO}-b03`, 32, "allenamento");
        await rispondi(`${PREFISSO}-b01`, "sc2", "presente", `${dataEvento(30)}T08:30:00Z`);
        await rispondi(`${PREFISSO}-b02`, "sc2", "presente", `${dataEvento(31)}T08:30:00Z`);
        await rispondi(`${PREFISSO}-b03`, "sc2", "presente", `${dataEvento(32)}T08:30:00Z`);

        const eventiLetti = await leggiEventi();
        const tempiLetti = await leggiTempi();
        const serie = serieConferme("sc2", eventiLetti, tempiLetti, OGGI);
        assert.equal(serie, 3, "partita in mezzo a due allenamenti: la serie resta a 3");
        assert.equal(
          statoBadge(serieDef, giocatoreAzzerato(serie)).grado,
          "bronzo",
          "3 conferme rapide di fila, tipo misto: soglia bronzo",
        );
      },
    );
  } finally {
    await rest(`risposte_presenze?evento_id=like.${PREFISSO}*`, { method: "DELETE" });
    await rest(`eventi_app?id=like.${PREFISSO}*`, { method: "DELETE" });
  }

  riepilogo("serie-conferme-badge");
}
