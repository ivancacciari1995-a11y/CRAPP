/**
 * Funzione `bonifica_dati_evento_orfani()` (M16): `bun test/integration/bonifica-evento.test.ts`.
 *
 * M15 ha ripulito una tantum le righe orfane lasciate da eventi cancellati prima del trigger
 * di M14 (DD-029); M16 ha reso permanente la stessa logica come funzione RPC, così resta
 * richiamabile e testabile invece che verificata a mano una volta sola.
 *
 * Copre tutte e nove le istruzioni dentro la funzione, non solo un sottoinsieme: le sei
 * tabelle che usano `evento_id` (`risposte_presenze`, `cacche_partita`, `turni_palloni`,
 * `scout_sessioni`, `scout_live`, `scout_partite`) e le tre che usano `match_id`
 * (`mvp_voti`, `pagelle_voti`, `badge_social_voti`).
 *
 * Il punto delicato è sulle tre tabelle `match_id`: la funzione deve cancellare solo i
 * `match_id` nel formato id evento CrAPP ("e" + timestamp base36) senza corrispondenza in
 * `eventi_app` — mai i vecchi voti storici su id Scout ("s" + timestamp) o CSI (numerico),
 * che sono dati legittimi mai collegati a un evento CrAPP (`docs/modules/mvp.md`). Questo
 * test verifica la distinzione su tutte e tre, non solo su due delle tre.
 *
 * Gira solo sullo stack locale (`npx supabase start`): usa id con il prefisso
 * `test-bonifica-evento`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("bonifica dati evento orfani", "stack locale non attivo (npx supabase start)");
  riepilogo("bonifica-evento");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`bonifica dati evento orfani su ${URL_BASE}`);

  const PREFISSO = "test-bonifica-evento";
  // Deve rispettare ^e[0-9a-z]+$ (formato di nuovoIdEvento()): un id con trattini non
  // verrebbe mai filtrato dalla funzione, quindi non testerebbe la regola che conta.
  const ORFANO = `etestbonificaevento${Date.now().toString(36)}`;
  const STORICO_SCOUT = `s${Date.now()}`; // formato id Scout storico: va preservato
  const STORICO_CSI = `${Date.now()}`; // formato id CSI storico (numerico): va preservato

  const TABELLE_EVENTO_ID = [
    "risposte_presenze",
    "cacche_partita",
    "turni_palloni",
    "scout_sessioni",
    "scout_live",
    "scout_partite",
  ];
  const TABELLE_MATCH_ID = ["mvp_voti", "pagelle_voti", "badge_social_voti"];

  const rest = (percorso: string, init?: RequestInit) =>
    fetch(`${URL_BASE}/rest/v1/${percorso}`, {
      ...init,
      headers: {
        apikey: SERVIZIO,
        Authorization: `Bearer ${SERVIZIO}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
        ...(init?.headers ?? {}),
      },
    });

  async function inserisci(tabella: string, riga: Record<string, unknown>) {
    const res = await rest(tabella, { method: "POST", body: JSON.stringify(riga) });
    if (!res.ok) throw new Error(`insert su ${tabella}: ${res.status} ${await res.text()}`);
  }

  async function esiste(tabella: string, filtro: string): Promise<boolean> {
    const res = await rest(`${tabella}?${filtro}&select=*`, {
      headers: { Prefer: "count=exact" },
    });
    return Number(res.headers.get("content-range")?.split("/")[1] ?? 0) > 0;
  }

  async function pulisci() {
    for (const t of TABELLE_EVENTO_ID) {
      await rest(`${t}?evento_id=eq.${ORFANO}`, { method: "DELETE" });
    }
    for (const t of TABELLE_MATCH_ID) {
      await rest(`${t}?match_id=eq.${ORFANO}`, { method: "DELETE" });
      await rest(`${t}?match_id=eq.${STORICO_SCOUT}`, { method: "DELETE" });
      await rest(`${t}?match_id=eq.${STORICO_CSI}`, { method: "DELETE" });
    }
  }

  try {
    await prova(
      "bonifica_dati_evento_orfani() rimuove solo gli orfani veri, non lo storico Scout/CSI",
      async () => {
        // Una riga orfana per ciascuna delle sei tabelle evento_id.
        await inserisci("risposte_presenze", {
          evento_id: ORFANO,
          giocatore_id: `${PREFISSO}-g1`,
          stato: "presente",
        });
        await inserisci("cacche_partita", {
          evento_id: ORFANO,
          giocatore_id: `${PREFISSO}-g1`,
          quantita: 1,
        });
        await inserisci("turni_palloni", { evento_id: ORFANO, giocatore_id: `${PREFISSO}-g1` });
        await inserisci("scout_sessioni", {
          evento_id: ORFANO,
          giocatore_id: `${PREFISSO}-g1`,
          giocatore_nome: "Uno",
        });
        await inserisci("scout_live", { evento_id: ORFANO, stato: {} });
        await inserisci("scout_partite", {
          id: `${ORFANO}-scout`,
          evento_id: ORFANO,
          data: "2026-09-01",
          avversario: "Test",
          set_nostri: 3,
          set_loro: 0,
        });

        // Una riga orfana + due storiche (Scout, CSI) per ciascuna delle tre tabelle match_id.
        for (const t of TABELLE_MATCH_ID) {
          const base = { votante_id: `${PREFISSO}-va`, votato_id: `${PREFISSO}-vb` };
          const extra =
            t === "pagelle_voti"
              ? { voto: 7 }
              : t === "badge_social_voti"
                ? { categoria: "top", votato_nome: "Test" }
                : { votato_nome: "Test" };
          await inserisci(t, { match_id: ORFANO, ...base, ...extra });
          await inserisci(t, { match_id: STORICO_SCOUT, ...base, ...extra });
          await inserisci(t, { match_id: STORICO_CSI, ...base, ...extra });
        }

        const res = await fetch(`${URL_BASE}/rest/v1/rpc/bonifica_dati_evento_orfani`, {
          method: "POST",
          headers: {
            apikey: SERVIZIO,
            Authorization: `Bearer ${SERVIZIO}`,
            "content-type": "application/json",
          },
          body: "{}",
        });
        if (!res.ok)
          throw new Error(`rpc bonifica_dati_evento_orfani: ${res.status} ${await res.text()}`);

        for (const t of TABELLE_EVENTO_ID) {
          assert.equal(await esiste(t, `evento_id=eq.${ORFANO}`), false, `${t}: orfano rimosso`);
        }
        for (const t of TABELLE_MATCH_ID) {
          assert.equal(await esiste(t, `match_id=eq.${ORFANO}`), false, `${t}: orfano rimosso`);
          assert.equal(
            await esiste(t, `match_id=eq.${STORICO_SCOUT}`),
            true,
            `${t}: storico Scout preservato`,
          );
          assert.equal(
            await esiste(t, `match_id=eq.${STORICO_CSI}`),
            true,
            `${t}: storico CSI preservato`,
          );
        }
      },
    );
  } finally {
    await pulisci();
  }

  riepilogo("bonifica-evento");
}
