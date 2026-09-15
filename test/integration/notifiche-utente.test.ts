/**
 * Centro notifiche in-app (M17): `bun test/integration/notifiche-utente.test.ts`.
 *
 * Copre le quattro sorgenti che scrivono in `notifiche_utente` mai dal client (le due
 * funzioni `pg_cron` dei promemoria evento, la route `notifica-personalizzata`, la route
 * `promemoria-palloni`, la route `sollecita-presenze`), più la RLS che decide chi può
 * leggerle e segnarle come lette. `notifiche-utente.test.ts` (unit) copre la sola
 * conversione riga->modello e il badge; qui serve un database vero per funzioni, trigger
 * e policy scritte su `auth.uid()`.
 *
 * Gira solo sullo stack locale (`npx supabase start`): usa id con il prefisso
 * `test-notifiche-utente` per gli eventi e lo slot `g4` della rosa seed per la RLS,
 * ripristinati alla fine.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { avviaServer } from "../helpers/server";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("notifiche in-app", "stack locale non attivo (npx supabase start)");
  riepilogo("notifiche-utente");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`notifiche in-app su ${URL_BASE}`);

  // Il server di sviluppo (per le sezioni con le route) eredita queste: le route leggono
  // i nomi senza prefisso e senza questo override punterebbero al progetto cloud di `.env`.
  process.env["SUPABASE_URL"] = URL_BASE;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVIZIO;

  const PREFISSO = "test-notifiche-utente";
  const EVENTO_24H = `${PREFISSO}-24h`;
  const EVENTO_3H = `${PREFISSO}-3h`;
  const EVENTO_ORA_VALIDA = `${PREFISSO}-ora-valida`;
  const EVENTO_ORA_ROTTA = `${PREFISSO}-ora-rotta`;
  const EVENTO_PALLONI = `${PREFISSO}-palloni`;
  const EVENTO_PRESENZE = `${PREFISSO}-presenze`;
  const GIOCATORE_RLS = "g4";
  const MESSAGGIO_UNICO = `${PREFISSO}-messaggio-${Date.now()}`;

  /**
   * `data`/`ora` sono ora locale Italia (stessa convenzione del resto dell'app, vedi
   * `m10_azzera_turni_palloni_allenamenti` e la funzione `genera_promemoria_eventi`):
   * calcolarle da `Date` in UTC senza passare da `Europe/Rome` sfaserebbe il confronto
   * con `now()` lato database fino a due ore, abbastanza da far scattare il promemoria
   * sbagliato vicino ai bordi delle finestre di 3 e 24 ore.
   */
  function dataOraRoma(quando: Date): { data: string; ora: string } {
    const data = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(quando);
    const ora = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(quando);
    return { data, ora };
  }

  const rest = (percorso: string, token: string, init?: RequestInit) =>
    fetch(`${URL_BASE}/rest/v1/${percorso}`, {
      ...init,
      headers: {
        apikey: token === SERVIZIO ? SERVIZIO : ANON,
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

  async function inserisci(tabella: string, riga: Record<string, unknown>) {
    const res = await rest(tabella, SERVIZIO, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(riga),
    });
    if (!res.ok) throw new Error(`insert su ${tabella}: ${res.status} ${await res.text()}`);
  }

  async function leggi<T>(percorso: string): Promise<T[]> {
    const res = await rest(percorso, SERVIZIO);
    if (!res.ok) throw new Error(`select su ${percorso}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T[];
  }

  async function contaAttivi(): Promise<number> {
    const righe = await leggi<{ id: string }>("giocatori_squadra?attivo=eq.true&select=id");
    return righe.length;
  }

  async function chiamaRpc(nome: string, corpo: Record<string, unknown>) {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
      method: "POST",
      headers: {
        apikey: SERVIZIO,
        Authorization: `Bearer ${SERVIZIO}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(corpo),
    });
    if (!res.ok) throw new Error(`rpc ${nome}: ${res.status} ${await res.text()}`);
  }

  async function creaUtente(email: string, password: string): Promise<string> {
    const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVIZIO,
        Authorization: `Bearer ${SERVIZIO}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const corpo = (await res.json()) as { id?: string };
    if (!corpo.id) throw new Error(`creazione utente fallita: ${JSON.stringify(corpo)}`);
    return corpo.id;
  }

  async function accedi(email: string, password: string): Promise<string> {
    const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const corpo = (await res.json()) as { access_token?: string };
    if (!corpo.access_token) throw new Error(`accesso fallito: ${JSON.stringify(corpo)}`);
    return corpo.access_token;
  }

  const eliminaUtente = (id: string) =>
    fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: SERVIZIO, Authorization: `Bearer ${SERVIZIO}` },
    });

  const PASSWORD = "prova-notifiche-utente-123";
  const idUtenti: string[] = [];
  let tokenAdmin = "";
  let server: { baseUrl: string; stop: () => void } | null = null;

  try {
    // --- preparazione: un amministratore, un giocatore collegato a g4 -----------------
    const emailAdmin = `test-notifiche-utente-admin-${Date.now()}@example.test`;
    const emailGiocatore = `test-notifiche-utente-giocatore-${Date.now()}@example.test`;
    const idAdmin = await creaUtente(emailAdmin, PASSWORD);
    const idGiocatore = await creaUtente(emailGiocatore, PASSWORD);
    idUtenti.push(idAdmin, idGiocatore);

    await rest("user_roles", SERVIZIO, {
      method: "POST",
      body: JSON.stringify({ user_id: idAdmin, role: "admin" }),
    });

    tokenAdmin = await accedi(emailAdmin, PASSWORD);
    const tokenGiocatore = await accedi(emailGiocatore, PASSWORD);

    // Il trigger `enforce_giocatori_squadra_update` rifiuta la service key (auth.uid() NULL):
    // serve il JWT dell'admin, come in `permessi.test.ts`.
    const collega = (utente: string | null) =>
      rest(`giocatori_squadra?id=eq.${GIOCATORE_RLS}`, tokenAdmin, {
        method: "PATCH",
        body: JSON.stringify({ auth_user_id: utente }),
      });
    await collega(idGiocatore);

    // --- 1. Promemoria: finestre 24h/3h e deduplica -----------------------------------
    await prova("il promemoria 24h scatta per un evento a 20 ore, non il 3h", async () => {
      const { data, ora } = dataOraRoma(new Date(Date.now() + 20 * 60 * 60 * 1000));
      await inserisci("eventi_app", {
        id: EVENTO_24H,
        tipo: "allenamento",
        titolo: "Allenamento imminente",
        data,
        ora,
        convocati: [GIOCATORE_RLS],
      });

      await chiamaRpc("genera_promemoria_eventi", {
        p_tipo: "evento_promemoria_24h",
        p_finestra: "24 hours",
      });
      await chiamaRpc("genera_promemoria_eventi", {
        p_tipo: "evento_promemoria_3h",
        p_finestra: "3 hours",
      });

      const promemoria24h = await leggi(
        `notifiche_utente?evento_id=eq.${EVENTO_24H}&tipo=eq.evento_promemoria_24h&select=id`,
      );
      const promemoria3h = await leggi(
        `notifiche_utente?evento_id=eq.${EVENTO_24H}&tipo=eq.evento_promemoria_3h&select=id`,
      );
      assert.equal(promemoria24h.length, 1, "il promemoria 24h è stato generato");
      assert.equal(
        promemoria3h.length,
        0,
        "il promemoria 3h non scatta ancora a 20 ore di distanza",
      );
    });

    await prova(
      "il promemoria 3h scatta per un evento a 2 ore, ed entrambi non duplicano",
      async () => {
        const { data, ora } = dataOraRoma(new Date(Date.now() + 2 * 60 * 60 * 1000));
        await inserisci("eventi_app", {
          id: EVENTO_3H,
          tipo: "allenamento",
          titolo: "Allenamento imminentissimo",
          data,
          ora,
          convocati: [GIOCATORE_RLS],
        });

        for (let i = 0; i < 2; i += 1) {
          await chiamaRpc("genera_promemoria_eventi", {
            p_tipo: "evento_promemoria_24h",
            p_finestra: "24 hours",
          });
          await chiamaRpc("genera_promemoria_eventi", {
            p_tipo: "evento_promemoria_3h",
            p_finestra: "3 hours",
          });
        }

        const promemoria24h = await leggi(
          `notifiche_utente?evento_id=eq.${EVENTO_3H}&tipo=eq.evento_promemoria_24h&select=id`,
        );
        const promemoria3h = await leggi(
          `notifiche_utente?evento_id=eq.${EVENTO_3H}&tipo=eq.evento_promemoria_3h&select=id`,
        );
        assert.equal(promemoria24h.length, 1, "un solo promemoria 24h anche a due esecuzioni");
        assert.equal(promemoria3h.length, 1, "un solo promemoria 3h anche a due esecuzioni");
      },
    );

    // `ora` è testo libero (input nativo `type="time"`, ma la form non impedisce di
    // svuotarlo): un evento con l'ora scritta male non deve rompere la generazione dei
    // promemoria per tutti gli altri (era il caso prima che `ora_evento_a_time()`
    // assorbisse l'errore riga per riga invece di far fallire l'intera INSERT...SELECT).
    await prova(
      "un evento con l'ora scritta male non blocca i promemoria degli altri eventi",
      async () => {
        const { data, ora } = dataOraRoma(new Date(Date.now() + 2 * 60 * 60 * 1000));
        await inserisci("eventi_app", {
          id: EVENTO_ORA_VALIDA,
          tipo: "allenamento",
          titolo: "Allenamento imminentissimo",
          data,
          ora,
          convocati: [GIOCATORE_RLS],
        });
        await inserisci("eventi_app", {
          id: EVENTO_ORA_ROTTA,
          tipo: "allenamento",
          titolo: "Evento con ora vuota",
          data,
          ora: "",
          convocati: [GIOCATORE_RLS],
        });

        await chiamaRpc("genera_promemoria_eventi", {
          p_tipo: "evento_promemoria_3h",
          p_finestra: "3 hours",
        });

        const promemoria3h = await leggi(
          `notifiche_utente?evento_id=eq.${EVENTO_ORA_VALIDA}&tipo=eq.evento_promemoria_3h&select=id`,
        );
        assert.equal(
          promemoria3h.length,
          1,
          "l'evento con l'ora valida riceve comunque il suo promemoria",
        );
      },
    );

    // --- 2. RLS: ognuno legge e segna come lette solo le proprie ----------------------
    await prova("il giocatore legge solo le proprie notifiche", async () => {
      const mie = await rest(
        `notifiche_utente?giocatore_id=eq.${GIOCATORE_RLS}&select=id`,
        tokenGiocatore,
      );
      assert.equal(mie.status, 200);
      const righeMie = (await mie.json()) as unknown[];
      assert.ok(righeMie.length > 0, "g4 ha almeno una notifica dai test precedenti");

      const altrui = await rest("notifiche_utente?giocatore_id=eq.g1&select=id", tokenGiocatore);
      assert.equal(altrui.status, 200);
      assert.deepEqual(
        await altrui.json(),
        [],
        "le notifiche di un altro giocatore restano invisibili",
      );
    });

    await prova("il giocatore segna come lette solo le proprie notifiche", async () => {
      const res = await rest(
        `notifiche_utente?giocatore_id=eq.${GIOCATORE_RLS}&letta=eq.false`,
        tokenGiocatore,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ letta: true }),
        },
      );
      assert.equal(res.status, 200);
      const aggiornate = (await res.json()) as Array<{ letta: boolean }>;
      assert.ok(aggiornate.length > 0);
      assert.ok(aggiornate.every((r) => r.letta === true));

      const restaFalse = await leggi(
        `notifiche_utente?giocatore_id=eq.${GIOCATORE_RLS}&letta=eq.false&select=id`,
      );
      assert.equal(restaFalse.length, 0, "nessuna non letta è rimasta indietro");
    });

    await prova("il client non può inserire notifiche per sé", async () => {
      const res = await rest("notifiche_utente", tokenGiocatore, {
        method: "POST",
        body: JSON.stringify({ giocatore_id: GIOCATORE_RLS, tipo: "admin", titolo: "finta" }),
      });
      assert.ok(!res.ok, `l'insert dal client deve fallire, invece ha risposto ${res.status}`);
    });

    // --- 3. Route notifica-personalizzata: scrive anche lo storico in-app -------------
    server = await avviaServer();
    console.log(`route notifica-personalizzata su ${server.baseUrl}`);

    await prova("un messaggio a un giocatore specifico crea solo la sua notifica", async () => {
      const res = await fetch(`${server!.baseUrl}/api/public/notifica-personalizzata`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenAdmin}` },
        body: JSON.stringify({ messaggio: MESSAGGIO_UNICO, giocatoreId: GIOCATORE_RLS }),
      });
      assert.equal(res.status, 200);

      const righe = await leggi<{ giocatore_id: string; tipo: string }>(
        `notifiche_utente?corpo=eq.${encodeURIComponent(MESSAGGIO_UNICO)}&select=giocatore_id,tipo`,
      );
      assert.deepEqual(righe, [{ giocatore_id: GIOCATORE_RLS, tipo: "admin" }]);

      await rest(`notifiche_utente?corpo=eq.${encodeURIComponent(MESSAGGIO_UNICO)}`, SERVIZIO, {
        method: "DELETE",
      });
    });

    await prova("un messaggio senza destinatario notifica tutta la rosa attiva", async () => {
      const attesi = await contaAttivi();
      const res = await fetch(`${server!.baseUrl}/api/public/notifica-personalizzata`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenAdmin}` },
        body: JSON.stringify({ messaggio: MESSAGGIO_UNICO }),
      });
      assert.equal(res.status, 200);

      const righe = await leggi(
        `notifiche_utente?corpo=eq.${encodeURIComponent(MESSAGGIO_UNICO)}&tipo=eq.admin&select=giocatore_id`,
      );
      assert.equal(righe.length, attesi, "una notifica admin per ogni giocatore attivo");
    });

    await prova("il giocatore elimina solo le proprie notifiche", async () => {
      const [miaNotifica] = await leggi<{ id: string }>(
        `notifiche_utente?giocatore_id=eq.${GIOCATORE_RLS}&select=id&limit=1`,
      );
      const [notificaAltrui] = await leggi<{ id: string }>(
        "notifiche_utente?giocatore_id=eq.g1&select=id&limit=1",
      );
      assert.ok(miaNotifica, "g4 ha almeno una notifica da eliminare");
      assert.ok(notificaAltrui, "g1 ha almeno una notifica altrui da provare a eliminare");

      // Lo swipe/la × chiamano una DELETE per id: qui la RLS deve bloccare quella
      // sull'id di un altro giocatore (0 righe toccate) e permettere la propria.
      await rest(`notifiche_utente?id=eq.${notificaAltrui.id}`, tokenGiocatore, {
        method: "DELETE",
      });
      const altruiRestaAncora = await leggi(
        `notifiche_utente?id=eq.${notificaAltrui.id}&select=id`,
      );
      assert.equal(altruiRestaAncora.length, 1, "la notifica di un altro giocatore non si tocca");

      await rest(`notifiche_utente?id=eq.${miaNotifica.id}`, tokenGiocatore, {
        method: "DELETE",
      });
      const miaResta = await leggi(`notifiche_utente?id=eq.${miaNotifica.id}&select=id`);
      assert.equal(miaResta.length, 0, "la propria notifica è stata eliminata");
    });

    // --- 4. Route promemoria-palloni: scrive anche lo storico in-app ------------------
    await prova("il promemoria del turno palloni crea la notifica per l'incaricato", async () => {
      await inserisci("eventi_app", {
        id: EVENTO_PALLONI,
        tipo: "partita",
        titolo: "Partita con palloni assegnati",
        data: "2026-09-25",
        ora: "18:00",
        convocati: [],
      });
      await inserisci("turni_palloni", { evento_id: EVENTO_PALLONI, giocatore_id: "g1" });

      const res = await fetch(`${server!.baseUrl}/api/public/promemoria-palloni`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenAdmin}` },
        body: JSON.stringify({ eventoId: EVENTO_PALLONI }),
      });
      assert.equal(res.status, 200);

      const righe = await leggi<{ giocatore_id: string; letta: boolean }>(
        `notifiche_utente?evento_id=eq.${EVENTO_PALLONI}&tipo=eq.turno_palloni&giocatore_id=eq.g1&select=giocatore_id,letta`,
      );
      assert.equal(righe.length, 1, "una sola notifica per l'incaricato");
      assert.equal(righe[0]?.letta, false);

      // Ripremere il pulsante aggiorna la stessa riga (upsert) invece di duplicarla o
      // fallire per il vincolo UNIQUE.
      const res2 = await fetch(`${server!.baseUrl}/api/public/promemoria-palloni`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenAdmin}` },
        body: JSON.stringify({ eventoId: EVENTO_PALLONI }),
      });
      assert.equal(res2.status, 200);
      const dopo = await leggi(
        `notifiche_utente?evento_id=eq.${EVENTO_PALLONI}&tipo=eq.turno_palloni&giocatore_id=eq.g1&select=id`,
      );
      assert.equal(dopo.length, 1, "un secondo invio non duplica la notifica");
    });

    // --- 5. Route sollecita-presenze: scrive anche lo storico in-app ------------------
    await prova("il sollecito presenze notifica chi non ha ancora risposto", async () => {
      const attesi = await contaAttivi();
      await inserisci("eventi_app", {
        id: EVENTO_PRESENZE,
        tipo: "allenamento",
        titolo: "Allenamento da confermare",
        data: "2026-09-26",
        ora: "20:30",
        convocati: [],
      });

      const res = await fetch(`${server!.baseUrl}/api/public/sollecita-presenze`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenAdmin}` },
        body: JSON.stringify({ eventoId: EVENTO_PRESENZE }),
      });
      assert.equal(res.status, 200);

      const righe = await leggi(
        `notifiche_utente?evento_id=eq.${EVENTO_PRESENZE}&tipo=eq.sollecita_presenze&select=giocatore_id`,
      );
      assert.equal(righe.length, attesi, "nessuno ha ancora risposto: tutta la rosa attiva");
    });
  } finally {
    server?.stop();
    await rest(`notifiche_utente?corpo=eq.${encodeURIComponent(MESSAGGIO_UNICO)}`, SERVIZIO, {
      method: "DELETE",
    });
    await rest(`turni_palloni?evento_id=eq.${EVENTO_PALLONI}`, SERVIZIO, { method: "DELETE" });
    for (const id of [
      EVENTO_24H,
      EVENTO_3H,
      EVENTO_ORA_VALIDA,
      EVENTO_ORA_ROTTA,
      EVENTO_PALLONI,
      EVENTO_PRESENZE,
    ]) {
      await rest(`eventi_app?id=eq.${id}`, SERVIZIO, { method: "DELETE" });
    }
    if (tokenAdmin) {
      await rest(`giocatori_squadra?id=eq.${GIOCATORE_RLS}`, tokenAdmin, {
        method: "PATCH",
        body: JSON.stringify({ auth_user_id: null }),
      });
    }
    for (const id of idUtenti) {
      await rest(`user_roles?user_id=eq.${id}`, SERVIZIO, { method: "DELETE" });
      await eliminaUtente(id);
    }
    riepilogo("notifiche-utente");
  }
}
