/**
 * Notifiche email (M22, DD-036): `bun test/integration/notifiche-email.test.ts`.
 *
 * Copre il lato database del canale email: il trigger che accoda ogni notifica di
 * `notifiche_utente`, le tre funzioni RPC del worker (`prendi_notifiche_email`,
 * `esito_notifica_email`, `email_inviate_ultime_24h`), la preferenza per account e la RLS che
 * tiene la coda lontana dai client. Il worker vero e la logica di invio sono coperti da
 * `unit/mailer-core.test.ts`; qui non parte nessuna mail.
 *
 * Gira solo sullo stack locale (`npx supabase start`): usa gli slot `g4` (collegato a un
 * account di prova) e `g5` (senza account) della rosa seed, con l'email impostata per la
 * durata del test e ripristinata alla fine.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("notifiche email", "stack locale non attivo (npx supabase start)");
  riepilogo("notifiche-email");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`notifiche email su ${URL_BASE}`);

  const PREFISSO = "test-notifiche-email";
  // Un evento per test che ne ha bisogno: (giocatore, evento, tipo) è UNIQUE.
  const EVENTO_TIPI = `${PREFISSO}-tipi`;
  const EVENTO_UPSERT = `${PREFISSO}-upsert`;
  const EVENTO_PRESA = `${PREFISSO}-presa`;
  const EVENTO_CRON = `${PREFISSO}-cron`;
  const SLOT_COLLEGATO = "g4";
  const SLOT_LIBERO = "g5";
  const EMAIL_COLLEGATO = `${PREFISSO}-g4@example.test`;
  const EMAIL_LIBERO = `${PREFISSO}-g5@example.test`;
  const PASSWORD = "prova-notifiche-email-123";

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

  async function leggi<T>(percorso: string, token = SERVIZIO): Promise<T[]> {
    const res = await rest(percorso, token);
    if (!res.ok) throw new Error(`select su ${percorso}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T[];
  }

  async function scrivi(percorso: string, token: string, metodo: string, corpo: unknown) {
    const res = await rest(percorso, token, { method: metodo, body: JSON.stringify(corpo) });
    if (!res.ok) throw new Error(`${metodo} su ${percorso}: ${res.status} ${await res.text()}`);
  }

  async function rpc<T = unknown>(nome: string, corpo: Record<string, unknown>, token = SERVIZIO) {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
      method: "POST",
      headers: {
        apikey: token === SERVIZIO ? SERVIZIO : ANON,
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(corpo),
    });
    const testo = await res.text();
    return { ok: res.ok, stato: res.status, dati: (testo ? JSON.parse(testo) : null) as T };
  }

  async function creaUtente(email: string): Promise<string> {
    const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVIZIO,
        Authorization: `Bearer ${SERVIZIO}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
    });
    const corpo = (await res.json()) as { id?: string };
    if (!corpo.id) throw new Error(`creazione utente fallita: ${JSON.stringify(corpo)}`);
    return corpo.id;
  }

  async function accedi(email: string): Promise<string> {
    const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
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

  type Coda = {
    notifica_id: string;
    stato: string;
    tentativi: number;
    prossimo_tentativo: string;
    errore: string | null;
    inviata_il: string | null;
  };
  type Preso = {
    id_notifica: string;
    destinatario: string;
    oggetto: string;
    testo: string;
    id_evento: string | null;
    tipo_notifica: string;
    tentativi_fatti: number;
  };

  const creaNotifica = async (
    giocatoreId: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> => {
    const res = await rest("notifiche_utente", SERVIZIO, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        giocatore_id: giocatoreId,
        tipo: "admin",
        titolo: `${PREFISSO} titolo`,
        corpo: `${PREFISSO} corpo`,
        ...extra,
      }),
    });
    if (!res.ok) throw new Error(`insert notifica: ${res.status} ${await res.text()}`);
    return ((await res.json()) as { id: string }[])[0]!.id;
  };

  const coda = async (id: string): Promise<Coda | undefined> =>
    (await leggi<Coda>(`notifiche_email_coda?notifica_id=eq.${id}&select=*`))[0];

  /** Prende il lotto e tiene solo le righe di questo test: la coda locale può avere altro. */
  const prendi = async (mie: string[], max = 100): Promise<Preso[]> => {
    const r = await rpc<Preso[]>("prendi_notifiche_email", { p_max: max });
    assert.ok(r.ok, `prendi_notifiche_email: ${r.stato}`);
    return r.dati.filter((p) => mie.includes(p.id_notifica));
  };

  const esito = async (
    id: string,
    tipo: string,
    errore: string | null = null,
    prossimo: string | null = null,
  ) => {
    const r = await rpc("esito_notifica_email", {
      p_id: id,
      p_esito: tipo,
      p_errore: errore,
      p_prossimo: prossimo,
    });
    assert.ok(r.ok, `esito_notifica_email: ${r.stato}`);
  };

  const idUtenti: string[] = [];
  const creati: string[] = [];
  let tokenAdmin = "";
  const originali = new Map<string, { email: string | null; auth_user_id: string | null }>();

  try {
    // --- preparazione: un admin, un giocatore collegato a g4, g5 senza account -----------
    const emailAdmin = `${PREFISSO}-admin-${Date.now()}@example.test`;
    const emailGiocatore = `${PREFISSO}-giocatore-${Date.now()}@example.test`;
    const idAdmin = await creaUtente(emailAdmin);
    const idGiocatore = await creaUtente(emailGiocatore);
    idUtenti.push(idAdmin, idGiocatore);
    await scrivi("user_roles", SERVIZIO, "POST", { user_id: idAdmin, role: "admin" });
    tokenAdmin = await accedi(emailAdmin);
    const tokenGiocatore = await accedi(emailGiocatore);

    for (const id of [SLOT_COLLEGATO, SLOT_LIBERO]) {
      const [riga] = await leggi<{ email: string | null; auth_user_id: string | null }>(
        `giocatori_squadra?id=eq.${id}&select=email,auth_user_id`,
      );
      originali.set(id, riga ?? { email: null, auth_user_id: null });
    }
    // Il trigger `enforce_giocatori_squadra_update` rifiuta la service key: serve l'admin.
    await scrivi(`giocatori_squadra?id=eq.${SLOT_COLLEGATO}`, tokenAdmin, "PATCH", {
      email: EMAIL_COLLEGATO,
      auth_user_id: idGiocatore,
    });
    await scrivi(`giocatori_squadra?id=eq.${SLOT_LIBERO}`, tokenAdmin, "PATCH", {
      email: EMAIL_LIBERO,
    });
    for (const id of [EVENTO_TIPI, EVENTO_UPSERT, EVENTO_PRESA]) {
      await scrivi("eventi_app", SERVIZIO, "POST", {
        id,
        tipo: "allenamento",
        titolo: `${PREFISSO} evento`,
        data: "2030-01-01",
        ora: "20:00",
        convocati: [],
      });
    }

    // --- 1. Trigger ---------------------------------------------------------------------
    await prova("una notifica nuova finisce in coda, in_coda e con zero tentativi", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      const riga = await coda(id);
      assert.equal(riga?.stato, "in_coda");
      assert.equal(riga?.tentativi, 0);
      assert.equal(riga?.inviata_il, null);
    });

    await prova("ogni tipo di notifica con email viene accodato", async () => {
      for (const tipo of [
        "evento_promemoria_24h",
        "evento_promemoria_3h",
        "sollecita_presenze",
        "sollecita_presenze_24h",
        "sollecita_presenze_12h",
        "sollecita_presenze_6h",
        "sondaggio_cacche",
      ]) {
        const id = await creaNotifica(SLOT_COLLEGATO, { tipo, evento_id: EVENTO_TIPI });
        creati.push(id);
        assert.equal((await coda(id))?.stato, "in_coda", tipo);
      }
    });

    await prova(
      "il turno palloni non genera email, in nessuna delle sue forme (DD-040)",
      async () => {
        for (const tipo of [
          "turno_palloni",
          "turno_palloni_12h",
          "turno_palloni_6h",
          "turno_palloni_3h",
          "turno_palloni_revocato",
        ]) {
          const id = await creaNotifica(SLOT_COLLEGATO, { tipo, evento_id: EVENTO_TIPI });
          creati.push(id);
          assert.equal(await coda(id), undefined, `${tipo}: nessuna riga nella coda email`);
        }
      },
    );

    await prova("segnare come letta non rimette in coda una mail già inviata", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      const [presa] = await prendi([id]);
      assert.ok(presa);
      await esito(id, "inviata");
      await scrivi(`notifiche_utente?id=eq.${id}`, tokenGiocatore, "PATCH", { letta: true });
      assert.equal((await coda(id))?.stato, "inviata");
    });

    await prova("il rinvio con upsert (creato_il riscritto) rimette in coda la mail", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO, {
        tipo: "sollecita_presenze",
        evento_id: EVENTO_UPSERT,
      });
      creati.push(id);
      await prendi([id]);
      await esito(id, "inviata");
      assert.equal((await coda(id))?.stato, "inviata");

      // Come `sollecita-presenze.ts`: stesso (giocatore, evento, tipo).
      const res = await rest("notifiche_utente?on_conflict=giocatore_id,evento_id,tipo", SERVIZIO, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          giocatore_id: SLOT_COLLEGATO,
          tipo: "sollecita_presenze",
          titolo: `${PREFISSO} aggiornato`,
          corpo: "nuovo testo",
          evento_id: EVENTO_UPSERT,
          letta: false,
          creato_il: new Date().toISOString(),
        }),
      });
      assert.ok(res.ok, `upsert: ${res.status}`);
      const riga = await coda(id);
      assert.equal(riga?.stato, "in_coda");
      assert.equal(riga?.tentativi, 0);
      assert.equal(riga?.inviata_il, null);
    });

    await prova("il rinvio con upsert del turno palloni non accoda nessuna mail", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO, {
        tipo: "turno_palloni",
        evento_id: EVENTO_UPSERT,
      });
      creati.push(id);
      assert.equal(await coda(id), undefined);

      // Come `promemoria-palloni.ts`: stesso (giocatore, evento, tipo), `creato_il` riscritto.
      const res = await rest("notifiche_utente?on_conflict=giocatore_id,evento_id,tipo", SERVIZIO, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          giocatore_id: SLOT_COLLEGATO,
          tipo: "turno_palloni",
          titolo: `${PREFISSO} aggiornato`,
          corpo: "nuovo testo",
          evento_id: EVENTO_UPSERT,
          letta: false,
          creato_il: new Date().toISOString(),
        }),
      });
      assert.ok(res.ok, `upsert: ${res.status}`);
      assert.equal(await coda(id), undefined, "nemmeno dopo il rinvio");
    });

    await prova(
      "il promemoria del cron accoda una volta sola, anche se il cron rigira",
      async () => {
        const adesso = new Date(Date.now() + 20 * 60 * 60 * 1000);
        const data = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(adesso);
        const ora = new Intl.DateTimeFormat("it-IT", {
          timeZone: "Europe/Rome",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(adesso);
        await scrivi("eventi_app", SERVIZIO, "POST", {
          id: EVENTO_CRON,
          tipo: "allenamento",
          titolo: `${PREFISSO} cron`,
          data,
          ora,
          convocati: [SLOT_COLLEGATO],
        });
        const args = { p_tipo: "evento_promemoria_24h", p_finestra: "24 hours" };
        await rpc("genera_promemoria_eventi", args);
        const [notifica] = await leggi<{ id: string }>(
          `notifiche_utente?evento_id=eq.${EVENTO_CRON}&tipo=eq.evento_promemoria_24h&select=id`,
        );
        assert.ok(notifica, "il cron ha creato la notifica");
        assert.equal((await coda(notifica.id))?.stato, "in_coda");

        await prendi([notifica.id]);
        await esito(notifica.id, "inviata");
        await rpc("genera_promemoria_eventi", args);
        assert.equal(
          (await coda(notifica.id))?.stato,
          "inviata",
          "ON CONFLICT DO NOTHING: nessun rinvio",
        );
      },
    );

    await prova("cancellare la notifica (swipe) toglie anche la riga in coda", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO);
      assert.ok(await coda(id));
      await scrivi(`notifiche_utente?id=eq.${id}`, tokenGiocatore, "DELETE", undefined);
      assert.equal(await coda(id), undefined);
    });

    // --- 2. prendi_notifiche_email ------------------------------------------------------
    await prova("prendi restituisce destinatario e testo e marca la riga in_invio", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO, {
        titolo: `${PREFISSO} oggetto`,
        corpo: `${PREFISSO} testo`,
        evento_id: EVENTO_PRESA,
        tipo: "sollecita_presenze",
      });
      creati.push(id);
      const [p] = await prendi([id]);
      assert.ok(p, "la riga è stata presa");
      assert.equal(p.destinatario, EMAIL_COLLEGATO);
      assert.equal(p.id_evento, EVENTO_PRESA);
      assert.equal(p.tipo_notifica, "sollecita_presenze");
      assert.equal((await coda(id))?.stato, "in_invio");
    });

    await prova("una seconda chiamata non restituisce di nuovo la stessa riga", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      assert.equal((await prendi([id])).length, 1);
      assert.equal((await prendi([id])).length, 0);
    });

    await prova("due chiamate concorrenti si dividono le righe senza doppioni", async () => {
      const ids = await Promise.all(Array.from({ length: 6 }, () => creaNotifica(SLOT_COLLEGATO)));
      creati.push(...ids);
      const [a, b] = await Promise.all([prendi(ids, 3), prendi(ids, 3)]);
      const tutti = [...a, ...b].map((p) => p.id_notifica);
      assert.equal(tutti.length, new Set(tutti).size, "nessuna riga presa due volte");
      assert.ok(tutti.length >= 3 && tutti.length <= 6);
      // Le righe rimaste tornano prese al giro dopo, una sola volta ciascuna.
      const resto = (await prendi(ids)).map((p) => p.id_notifica);
      assert.deepEqual([...tutti, ...resto].sort(), [...ids].sort());
    });

    await prova("slot senza account collegato: mail 'saltata', mai presa", async () => {
      const id = await creaNotifica(SLOT_LIBERO);
      creati.push(id);
      assert.equal((await prendi([id])).length, 0);
      const riga = await coda(id);
      assert.equal(riga?.stato, "saltata");
      assert.equal(riga?.errore, null);
    });

    await prova("slot collegato ma senza email: 'saltata'", async () => {
      await scrivi(`giocatori_squadra?id=eq.${SLOT_COLLEGATO}`, tokenAdmin, "PATCH", {
        email: null,
      });
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      assert.equal((await prendi([id])).length, 0);
      assert.equal((await coda(id))?.stato, "saltata");
      await scrivi(`giocatori_squadra?id=eq.${SLOT_COLLEGATO}`, tokenAdmin, "PATCH", {
        email: EMAIL_COLLEGATO,
      });
    });

    await prova("la mail in coda viene ripresa dopo 10 minuti se il worker è morto", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      assert.equal((await prendi([id])).length, 1);
      assert.equal((await prendi([id])).length, 0, "ancora in invio");
      const vecchia = new Date(Date.now() - 11 * 60_000).toISOString();
      await scrivi(`notifiche_email_coda?notifica_id=eq.${id}`, SERVIZIO, "PATCH", {
        aggiornata_il: vecchia,
      });
      assert.equal((await prendi([id])).length, 1, "recuperata");
    });

    // --- 3. Preferenza per account ------------------------------------------------------
    await prova("nessuna riga in preferenze_utente vuol dire mail attive", async () => {
      const righe = await leggi(`preferenze_utente?auth_user_id=eq.${idGiocatore}`);
      assert.equal(righe.length, 0);
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      assert.equal((await prendi([id])).length, 1);
    });

    await prova("il giocatore spegne le email dal proprio account: 'saltata'", async () => {
      const res = await rest("preferenze_utente?on_conflict=auth_user_id", tokenGiocatore, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ auth_user_id: idGiocatore, email_notifiche: false }),
      });
      assert.ok(res.ok, `upsert preferenza: ${res.status}`);

      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      assert.equal((await prendi([id])).length, 0);
      assert.equal((await coda(id))?.stato, "saltata");
    });

    await prova("riacceso l'interruttore le mail nuove ripartono", async () => {
      await scrivi(`preferenze_utente?auth_user_id=eq.${idGiocatore}`, tokenGiocatore, "PATCH", {
        email_notifiche: true,
      });
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      assert.equal((await prendi([id])).length, 1);
    });

    await prova("un giocatore non scrive né legge le preferenze di un altro account", async () => {
      const res = await rest("preferenze_utente", tokenGiocatore, {
        method: "POST",
        body: JSON.stringify({ auth_user_id: idAdmin, email_notifiche: false }),
      });
      assert.ok(!res.ok, "insert per un altro account rifiutato dalla RLS");
      await scrivi("preferenze_utente", SERVIZIO, "POST", {
        auth_user_id: idAdmin,
        email_notifiche: false,
      });
      const viste = await leggi(`preferenze_utente?auth_user_id=eq.${idAdmin}`, tokenGiocatore);
      assert.equal(viste.length, 0, "la riga altrui è invisibile");
      await scrivi(`preferenze_utente?auth_user_id=eq.${idAdmin}`, tokenGiocatore, "PATCH", {
        email_notifiche: true,
      });
      const [altrui] = await leggi<{ email_notifiche: boolean }>(
        `preferenze_utente?auth_user_id=eq.${idAdmin}`,
      );
      assert.equal(altrui?.email_notifiche, false, "l'update altrui non ha toccato nulla");
    });

    // --- 4. esito_notifica_email --------------------------------------------------------
    await prova(
      "'inviata': stato, orario, e la riga entra nel conteggio delle 24 ore",
      async () => {
        const prima = (await rpc<number>("email_inviate_ultime_24h", {})).dati;
        const id = await creaNotifica(SLOT_COLLEGATO);
        creati.push(id);
        await prendi([id]);
        await esito(id, "inviata");
        const riga = await coda(id);
        assert.equal(riga?.stato, "inviata");
        assert.ok(riga?.inviata_il);
        assert.equal((await rpc<number>("email_inviate_ultime_24h", {})).dati, prima + 1);
      },
    );

    await prova(
      "'riprova': conta un tentativo e non viene ripresa prima dell'ora fissata",
      async () => {
        const id = await creaNotifica(SLOT_COLLEGATO);
        creati.push(id);
        await prendi([id]);
        const tra1h = new Date(Date.now() + 60 * 60_000).toISOString();
        await esito(id, "riprova", "ETIMEDOUT", tra1h);
        const riga = await coda(id);
        assert.equal(riga?.stato, "in_coda");
        assert.equal(riga?.tentativi, 1);
        assert.equal(riga?.errore, "ETIMEDOUT");
        assert.equal((await prendi([id])).length, 0, "non ancora scaduto il ritardo");

        const passato = new Date(Date.now() - 1000).toISOString();
        await scrivi(`notifiche_email_coda?notifica_id=eq.${id}`, SERVIZIO, "PATCH", {
          prossimo_tentativo: passato,
        });
        const [p] = await prendi([id]);
        assert.equal(p?.tentativi_fatti, 1, "il worker vede quanti tentativi sono già stati fatti");
      },
    );

    await prova("'differita': torna in coda senza consumare un tentativo", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      await prendi([id]);
      await esito(id, "differita", "550", new Date(Date.now() + 60 * 60_000).toISOString());
      const riga = await coda(id);
      assert.equal(riga?.stato, "in_coda");
      assert.equal(riga?.tentativi, 0);
    });

    await prova("'fallita' è definitiva e non viene più presa", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      await prendi([id]);
      await esito(id, "fallita", "550");
      assert.equal((await coda(id))?.stato, "fallita");
      assert.equal((await prendi([id])).length, 0);
    });

    await prova("un esito su una riga non 'in_invio' non cambia nulla", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      await esito(id, "inviata"); // ancora in_coda: nessuno l'ha presa
      assert.equal((await coda(id))?.stato, "in_coda");
    });

    await prova("un esito sconosciuto è rifiutato", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      const r = await rpc("esito_notifica_email", { p_id: id, p_esito: "boh" });
      assert.ok(!r.ok);
    });

    // --- 5. Permessi --------------------------------------------------------------------
    await prova("un giocatore non vede né scrive la coda", async () => {
      const id = await creaNotifica(SLOT_COLLEGATO);
      creati.push(id);
      const lettura = await rest("notifiche_email_coda?select=*", tokenGiocatore);
      const righe = lettura.ok ? ((await lettura.json()) as unknown[]) : [];
      assert.equal(righe.length, 0);
      const scrittura = await rest(`notifiche_email_coda?notifica_id=eq.${id}`, tokenGiocatore, {
        method: "PATCH",
        body: JSON.stringify({ stato: "in_coda", tentativi: 0 }),
      });
      assert.ok(!scrittura.ok || (await scrittura.text()) === "");
      const inserimento = await rest("notifiche_email_coda", tokenGiocatore, {
        method: "POST",
        body: JSON.stringify({ notifica_id: id }),
      });
      assert.ok(!inserimento.ok);
      assert.equal((await coda(id))?.stato, "in_coda");
    });

    await prova("un admin non può usare le funzioni del worker: solo la service role", async () => {
      for (const [nome, corpo] of [
        ["prendi_notifiche_email", { p_max: 1 }],
        ["esito_notifica_email", { p_id: creati[0], p_esito: "fallita" }],
        ["email_inviate_ultime_24h", {}],
      ] as const) {
        for (const token of [tokenAdmin, tokenGiocatore]) {
          const r = await rpc(nome, { ...corpo }, token);
          assert.ok(!r.ok, `${nome} non deve essere chiamabile da un utente`);
        }
      }
    });
  } finally {
    await rest(`notifiche_utente?titolo=like.${PREFISSO}*`, SERVIZIO, { method: "DELETE" });
    await rest(
      `notifiche_utente?evento_id=in.(${[EVENTO_TIPI, EVENTO_UPSERT, EVENTO_PRESA, EVENTO_CRON].join(",")})`,
      SERVIZIO,
      { method: "DELETE" },
    );
    for (const id of [EVENTO_TIPI, EVENTO_UPSERT, EVENTO_PRESA, EVENTO_CRON]) {
      await rest(`eventi_app?id=eq.${id}`, SERVIZIO, { method: "DELETE" });
    }
    if (tokenAdmin) {
      for (const [id, valori] of originali) {
        await rest(`giocatori_squadra?id=eq.${id}`, tokenAdmin, {
          method: "PATCH",
          body: JSON.stringify(valori),
        });
      }
    }
    for (const id of idUtenti) {
      await rest(`user_roles?user_id=eq.${id}`, SERVIZIO, { method: "DELETE" });
      await eliminaUtente(id);
    }
    riepilogo("notifiche-email");
  }
}
