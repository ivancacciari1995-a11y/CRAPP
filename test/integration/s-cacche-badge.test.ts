/**
 * Badge segreto Trono di ferro end-to-end contro il database locale:
 * `bun test/integration/s-cacche-badge.test.ts`.
 *
 * I test unitari (`test/unit/cacche.test.ts`, `test/unit/badges.test.ts`) verificano
 * `statisticheCacche()` e `statoBadge()` come funzioni pure. Qui invece si scrivono righe vere
 * su `cacche_partita`, si rileggono via REST con la stessa selezione di `useCacche()`, e si
 * passa il risultato attraverso `statisticheCacche()` fino a `statoBadge()` sul badge segreto
 * `s-cacche`.
 *
 * Copre in particolare un comportamento verificato in analisi e confermato intenzionale (non
 * un bug): **la descrizione del badge non distingue più campionato da amichevoli** ("almeno 3
 * partite affrontate con 3+ cacche pre-gara, campionato o amichevole") perché nessuna funzione
 * della pipeline (`statisticheCacche()`, `rosa.ts`, `badges.ts`) filtra mai su
 * `eventi_app.campionato` — la vecchia descrizione prometteva "partite di campionato" senza
 * che il codice lo verificasse mai. Qui si scrive apposta un evento con `campionato=false`
 * (amichevole) e si dimostra che conta lo stesso, così un domani chi reintroduce un filtro sul
 * campionato deve toccare anche questo test, non scoprirlo in produzione.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-s-cacche-badge`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { badgeSegreti, statoBadge } from "@/lib/badges";
import { statisticheCacche, type RigaCacche } from "@/lib/cacche";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("badge Trono di ferro sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("s-cacche-badge");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`badge Trono di ferro su ${URL_BASE}`);

  const PREFISSO = "test-s-cacche-badge";
  const def = badgeSegreti.find((b) => b.id === "s-cacche")!;

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

  async function creaEvento(id: string, campionato: boolean) {
    const res = await rest("eventi_app", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id,
        tipo: "partita",
        titolo: `Partita ${id}`,
        data: "2020-01-01",
        campionato,
      }),
    });
    if (!res.ok) throw new Error(`creazione evento ${id}: ${res.status} ${await res.text()}`);
  }

  async function dichiara(eventoId: string, giocatoreId: string, quantita: number) {
    const res = await rest("cacche_partita?on_conflict=evento_id,giocatore_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ evento_id: eventoId, giocatore_id: giocatoreId, quantita }),
    });
    if (!res.ok) throw new Error(`upsert su cacche_partita: ${res.status} ${await res.text()}`);
  }

  async function leggiCacche(): Promise<RigaCacche[]> {
    const res = await rest(
      `cacche_partita?evento_id=like.${PREFISSO}*&select=evento_id,giocatore_id,quantita`,
    );
    return (await res.json()) as RigaCacche[];
  }

  function giocatoreAzzerato(cacche: number): Giocatore {
    return {
      ...giocatori[0]!,
      cacche,
      mvp: 0,
      mediaVoto: 0,
      votiPagella: 0,
      palloni: 0,
      presenze: 0,
    };
  }

  try {
    await prova(
      "il segreto si sblocca con 3 giornate da record, comprese le amichevoli",
      async () => {
        // sc1: 2 giornate top su partite di campionato, 1 su un'amichevole. Il badge non fa
        // distinzione: le 3 contano tutte allo stesso modo.
        await creaEvento(`${PREFISSO}-c1`, true);
        await creaEvento(`${PREFISSO}-c2`, true);
        await creaEvento(`${PREFISSO}-a1`, false); // amichevole
        await dichiara(`${PREFISSO}-c1`, "sc1", 3);
        await dichiara(`${PREFISSO}-c2`, "sc1", 4);

        const righeA2 = await leggiCacche();
        const statsA2 = statisticheCacche(righeA2);
        assert.equal(statsA2["sc1"]?.giornateTop, 2, "solo le due di campionato per ora");
        assert.equal(
          statoBadge(def, giocatoreAzzerato(statsA2["sc1"]!.giornateTop)).grado,
          null,
          "2 giornate top non bastano",
        );

        await dichiara(`${PREFISSO}-a1`, "sc1", 3);
        const righe = await leggiCacche();
        const stats = statisticheCacche(righe);
        assert.equal(stats["sc1"]?.giornateTop, 3, "l'amichevole conta come le altre due");
        assert.equal(
          statoBadge(def, giocatoreAzzerato(stats["sc1"]!.giornateTop)).grado,
          "oro",
          "3 giornate top, campionato o amichevole: il segreto si sblocca",
        );
      },
    );
  } finally {
    await rest(`cacche_partita?evento_id=like.${PREFISSO}*`, { method: "DELETE" });
    await rest(`eventi_app?id=like.${PREFISSO}*`, { method: "DELETE" });
  }

  riepilogo("s-cacche-badge");
}
