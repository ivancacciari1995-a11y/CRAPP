/**
 * Pulizia a cascata dei dati collegati alla cancellazione di un evento (M14):
 * `bun test/integration/pulizia-evento.test.ts`.
 *
 * Scrive una riga per ciascuna delle 9 tabelle collegate a un evento (`risposte_presenze`,
 * `cacche_partita`, `mvp_voti`, `pagelle_voti`, `badge_social_voti`, `turni_palloni`,
 * `scout_sessioni`, `scout_live`, `scout_partite`), cancella l'evento e verifica che il
 * trigger `eventi_app_pulisci_dati_collegati` le abbia rimosse tutte. Prima di M14 queste
 * righe restavano orfane a database (`docs/DESIGN_DECISIONS.md`, DD-029).
 *
 * Gira solo sullo stack locale (`npx supabase start`): usa id con il prefisso
 * `test-pulizia-evento`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("pulizia dati evento cancellato", "stack locale non attivo (npx supabase start)");
  riepilogo("pulizia-evento");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`pulizia dati evento cancellato su ${URL_BASE}`);

  const ID_EVENTO = "test-pulizia-evento-e1";

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

  async function conta(tabella: string, filtro: string): Promise<number> {
    const res = await rest(`${tabella}?${filtro}&select=*`, {
      headers: { Prefer: "count=exact" },
    });
    return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
  }

  const TABELLE_EVENTO_ID = [
    "risposte_presenze",
    "cacche_partita",
    "turni_palloni",
    "scout_sessioni",
    "scout_live",
    "scout_partite",
  ];
  const TABELLE_MATCH_ID = ["mvp_voti", "pagelle_voti", "badge_social_voti"];

  async function pulisciTutto() {
    await rest(`eventi_app?id=eq.${ID_EVENTO}`, { method: "DELETE" });
    for (const t of TABELLE_EVENTO_ID) {
      await rest(`${t}?evento_id=eq.${ID_EVENTO}`, { method: "DELETE" });
    }
    for (const t of TABELLE_MATCH_ID) {
      await rest(`${t}?match_id=eq.${ID_EVENTO}`, { method: "DELETE" });
    }
  }

  try {
    await prova("cancellare un evento pulisce a cascata tutte le tabelle collegate", async () => {
      await inserisci("eventi_app", {
        id: ID_EVENTO,
        tipo: "allenamento",
        titolo: "Test pulizia",
        data: "2026-09-01",
      });

      await inserisci("risposte_presenze", {
        evento_id: ID_EVENTO,
        giocatore_id: "test-g1",
        stato: "presente",
      });
      await inserisci("cacche_partita", {
        evento_id: ID_EVENTO,
        giocatore_id: "test-g1",
        quantita: 2,
      });
      await inserisci("turni_palloni", { evento_id: ID_EVENTO, giocatore_id: "test-g1" });
      await inserisci("scout_sessioni", {
        evento_id: ID_EVENTO,
        giocatore_id: "test-g1",
        giocatore_nome: "Uno",
      });
      await inserisci("scout_live", { evento_id: ID_EVENTO, stato: {} });
      await inserisci("scout_partite", {
        id: `${ID_EVENTO}-scout`,
        evento_id: ID_EVENTO,
        data: "2026-09-01",
        avversario: "Test",
        set_nostri: 3,
        set_loro: 0,
      });
      await inserisci("mvp_voti", {
        match_id: ID_EVENTO,
        votante_id: "test-g1",
        votato_id: "test-g2",
        votato_nome: "Due",
      });
      await inserisci("pagelle_voti", {
        match_id: ID_EVENTO,
        votante_id: "test-g1",
        votato_id: "test-g2",
        voto: 7,
      });
      await inserisci("badge_social_voti", {
        match_id: ID_EVENTO,
        categoria: "top",
        votante_id: "test-g1",
        votato_id: "test-g2",
        votato_nome: "Due",
      });

      // Tutte le righe esistono prima della cancellazione.
      for (const t of TABELLE_EVENTO_ID) {
        assert.equal(await conta(t, `evento_id=eq.${ID_EVENTO}`), 1, `${t}: riga presente`);
      }
      for (const t of TABELLE_MATCH_ID) {
        assert.equal(await conta(t, `match_id=eq.${ID_EVENTO}`), 1, `${t}: riga presente`);
      }

      const res = await rest(`eventi_app?id=eq.${ID_EVENTO}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete evento: ${res.status} ${await res.text()}`);

      // Il trigger deve aver ripulito tutte le righe collegate.
      for (const t of TABELLE_EVENTO_ID) {
        assert.equal(await conta(t, `evento_id=eq.${ID_EVENTO}`), 0, `${t}: pulita a cascata`);
      }
      for (const t of TABELLE_MATCH_ID) {
        assert.equal(await conta(t, `match_id=eq.${ID_EVENTO}`), 0, `${t}: pulita a cascata`);
      }
    });
  } finally {
    await pulisciTutto();
  }

  riepilogo("pulizia-evento");
}
