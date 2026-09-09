/**
 * Funzione `bonifica_dati_evento_orfani()` (M16): `bun test/integration/bonifica-evento.test.ts`.
 *
 * M15 ha ripulito una tantum le righe orfane lasciate da eventi cancellati prima del trigger
 * di M14 (DD-029); M16 ha reso permanente la stessa logica come funzione RPC, così resta
 * richiamabile e testabile invece che verificata a mano una volta sola.
 *
 * Il punto delicato: per `mvp_voti`/`pagelle_voti`/`badge_social_voti` la funzione deve
 * cancellare solo i `match_id` nel formato id evento CrAPP ("e" + timestamp base36) senza
 * corrispondenza in `eventi_app` — mai i vecchi voti storici su id Scout ("s" + timestamp) o
 * CSI (numerico), che sono dati legittimi mai collegati a un evento CrAPP (`docs/modules/mvp.md`).
 * Questo test copre esattamente quella distinzione.
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
  const STORICO_CSI = "42"; // formato id CSI storico (numerico): va preservato

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
    await rest(`risposte_presenze?evento_id=eq.${ORFANO}`, { method: "DELETE" });
    await rest(`mvp_voti?match_id=eq.${ORFANO}`, { method: "DELETE" });
    await rest(`mvp_voti?match_id=eq.${STORICO_SCOUT}`, { method: "DELETE" });
    await rest(`pagelle_voti?match_id=eq.${ORFANO}`, { method: "DELETE" });
    await rest(`pagelle_voti?match_id=eq.${STORICO_CSI}&votante_id=eq.${PREFISSO}-va`, {
      method: "DELETE",
    });
  }

  try {
    await prova(
      "bonifica_dati_evento_orfani() rimuove solo gli orfani veri, non lo storico Scout/CSI",
      async () => {
        // Riga orfana: id in formato evento CrAPP, nessun evento corrispondente.
        await inserisci("risposte_presenze", {
          evento_id: ORFANO,
          giocatore_id: `${PREFISSO}-g1`,
          stato: "presente",
        });
        await inserisci("mvp_voti", {
          match_id: ORFANO,
          votante_id: `${PREFISSO}-va`,
          votato_id: `${PREFISSO}-vb`,
          votato_nome: "Orfano",
        });
        await inserisci("pagelle_voti", {
          match_id: ORFANO,
          votante_id: `${PREFISSO}-va`,
          votato_id: `${PREFISSO}-vb`,
          voto: 6,
        });

        // Voti storici legittimi su id Scout/CSI: nessun evento CrAPP li ha mai referenziati.
        await inserisci("mvp_voti", {
          match_id: STORICO_SCOUT,
          votante_id: `${PREFISSO}-va`,
          votato_id: `${PREFISSO}-vb`,
          votato_nome: "Storico",
        });
        await inserisci("pagelle_voti", {
          match_id: STORICO_CSI,
          votante_id: `${PREFISSO}-va`,
          votato_id: `${PREFISSO}-vb`,
          voto: 8,
        });

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

        assert.equal(
          await esiste("risposte_presenze", `evento_id=eq.${ORFANO}`),
          false,
          "riga orfana rimossa",
        );
        assert.equal(
          await esiste("mvp_voti", `match_id=eq.${ORFANO}`),
          false,
          "voto MVP orfano rimosso",
        );
        assert.equal(
          await esiste("pagelle_voti", `match_id=eq.${ORFANO}`),
          false,
          "voto pagella orfano rimosso",
        );
        assert.equal(
          await esiste("mvp_voti", `match_id=eq.${STORICO_SCOUT}`),
          true,
          "voto MVP storico su id Scout preservato",
        );
        assert.equal(
          await esiste("pagelle_voti", `match_id=eq.${STORICO_CSI}`),
          true,
          "voto pagella storico su id CSI preservato",
        );
      },
    );
  } finally {
    await pulisci();
  }

  riepilogo("bonifica-evento");
}
