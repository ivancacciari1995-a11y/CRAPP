/**
 * Badge Sempre in palestra end-to-end contro il database locale:
 * `bun test/integration/serie-allenamenti-badge.test.ts`.
 *
 * I test unitari (`test/unit/presenze.test.ts`, `test/unit/badges.test.ts`) verificano
 * `serieConsecutiva()` e `statoBadge()` come funzioni pure, con eventi e risposte costruiti a
 * mano. Qui invece si scrivono allenamenti e risposte veri su `eventi_app`/
 * `risposte_presenze`, si rileggono via REST con la stessa forma di `fetchPresenze()`/
 * `daRiga()`, e si passa il risultato attraverso `serieConsecutiva()` fino a `statoBadge()` sul
 * badge `serie-allenamenti`: se una colonna cambia nome o la mappatura si rompe, qui il grado
 * del badge torna sbagliato anche se i test unitari restano verdi, perché quelli non toccano
 * mai il database.
 *
 * Copre due comportamenti non ovvi con dati veri, non solo con numeri scelti a mano:
 * - un buco nella serie (assente o nessuna risposta) la azzera;
 * - un infortunio invece la **congela** (non la azzera): l'allenamento saltato per infortunio
 *   non conta né a favore né contro, e la serie riparte da dove si era fermata.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-serie-allenamenti-badge`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { badgeDefs, statoBadge } from "@/lib/badges";
import { serieConsecutiva } from "@/lib/presenze";
import { daRiga, type RigaEvento, type Evento } from "@/lib/eventi";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("badge Sempre in palestra sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("serie-allenamenti-badge");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`badge Sempre in palestra su ${URL_BASE}`);

  const PREFISSO = "test-serie-allenamenti-badge";
  const serieDef = badgeDefs.find((b) => b.id === "serie-allenamenti")!;
  // "Oggi" fissato nel futuro: gli allenamenti scritti sotto sono datati nel passato remoto,
  // così restano "passati" (quindi contati) a prescindere da quando gira il test.
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

  async function creaAllenamento(id: string, i: number) {
    const res = await rest("eventi_app", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id,
        tipo: "allenamento",
        titolo: `Allenamento ${id}`,
        data: dataEvento(i),
      }),
    });
    if (!res.ok) throw new Error(`creazione evento ${id}: ${res.status} ${await res.text()}`);
  }

  async function rispondi(eventoId: string, giocatoreId: string, stato: string) {
    const res = await rest("risposte_presenze?on_conflict=evento_id,giocatore_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ evento_id: eventoId, giocatore_id: giocatoreId, stato }),
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

  async function leggiPresenze(): Promise<Record<string, Record<string, string>>> {
    const res = await rest(
      `risposte_presenze?evento_id=like.${PREFISSO}*&select=evento_id,giocatore_id,stato`,
    );
    const righe = (await res.json()) as Array<{
      evento_id: string;
      giocatore_id: string;
      stato: string;
    }>;
    const mappa: Record<string, Record<string, string>> = {};
    for (const r of righe) (mappa[r.evento_id] ??= {})[r.giocatore_id] = r.stato;
    return mappa;
  }

  function giocatoreAzzerato(serieAllenamenti: number): Giocatore {
    return {
      ...giocatori[0]!,
      serieAllenamenti,
      mvp: 0,
      mediaVoto: 0,
      votiPagella: 0,
      palloni: 0,
      presenze: 0,
    };
  }

  try {
    await prova(
      "il badge passa da bronzo a oro con presenze consecutive vere, e un buco lo azzera",
      async () => {
        // 10 allenamenti passati, tutti presenti per "sa1": bronzo (3), poi argento (6), poi
        // oro (10) man mano che si rileggono i dati.
        for (let i = 1; i <= 10; i += 1) {
          await creaAllenamento(`${PREFISSO}-a${String(i).padStart(2, "0")}`, i);
          await rispondi(`${PREFISSO}-a${String(i).padStart(2, "0")}`, "sa1", "presente");
        }
        const eventi10 = await leggiEventi();
        const presenze10 = await leggiPresenze();
        const serieA3 = serieConsecutiva(
          "sa1",
          eventi10.slice(0, 3),
          presenze10,
          "allenamento",
          OGGI,
        );
        assert.equal(serieA3, 3);
        assert.equal(
          statoBadge(serieDef, giocatoreAzzerato(serieA3)).grado,
          "bronzo",
          "3 allenamenti di fila: soglia bronzo",
        );

        const serieCompleta = serieConsecutiva("sa1", eventi10, presenze10, "allenamento", OGGI);
        assert.equal(serieCompleta, 10, "presente a tutti e 10, nessun buco");
        assert.equal(
          statoBadge(serieDef, giocatoreAzzerato(serieCompleta)).grado,
          "oro",
          "10 allenamenti di fila: soglia oro",
        );

        // Un undicesimo allenamento con un buco (assente) azzera la serie.
        await creaAllenamento(`${PREFISSO}-a11`, 11);
        await rispondi(`${PREFISSO}-a11`, "sa1", "assente");
        const eventiConBuco = await leggiEventi();
        const presenzeConBuco = await leggiPresenze();
        const serieDopoBuco = serieConsecutiva(
          "sa1",
          eventiConBuco,
          presenzeConBuco,
          "allenamento",
          OGGI,
        );
        assert.equal(serieDopoBuco, 0, "un'assenza azzera la serie, anche dopo 10 di fila");
        assert.equal(
          statoBadge(serieDef, giocatoreAzzerato(serieDopoBuco)).grado,
          null,
          "serie azzerata: nessun grado, si riparte da zero",
        );
      },
    );

    await prova("un infortunio congela la serie invece di azzerarla", async () => {
      // "sa2": presente ai primi due allenamenti, poi infortunato al terzo (saltato, non
      // conta né a favore né contro), poi di nuovo presente: la serie deve restare a 3, non
      // ripartire da 1.
      const eventi = [`${PREFISSO}-b01`, `${PREFISSO}-b02`, `${PREFISSO}-b03`, `${PREFISSO}-b04`];
      for (let i = 0; i < eventi.length; i += 1) {
        await creaAllenamento(eventi[i]!, 20 + i);
      }
      await rispondi(eventi[0]!, "sa2", "presente");
      await rispondi(eventi[1]!, "sa2", "presente");
      await rispondi(eventi[2]!, "sa2", "infortunato");
      await rispondi(eventi[3]!, "sa2", "presente");

      const eventiLetti = await leggiEventi();
      const presenzeLette = await leggiPresenze();
      const serie = serieConsecutiva("sa2", eventiLetti, presenzeLette, "allenamento", OGGI);
      assert.equal(serie, 3, "l'infortunio è saltato: 3 presenze restano consecutive");
      assert.equal(
        statoBadge(serieDef, giocatoreAzzerato(serie)).grado,
        "bronzo",
        "3 di fila (infortunio escluso dal conteggio): soglia bronzo",
      );
    });
  } finally {
    await rest(`risposte_presenze?evento_id=like.${PREFISSO}*`, { method: "DELETE" });
    await rest(`eventi_app?id=like.${PREFISSO}*`, { method: "DELETE" });
  }

  riepilogo("serie-allenamenti-badge");
}
