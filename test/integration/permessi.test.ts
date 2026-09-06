/**
 * Permessi per ruolo sul database locale: `bun test/integration/permessi.test.ts`.
 *
 * A differenza di `schema-profili`, che si limita a provare l'utente anonimo, qui si
 * creano utenti veri e si interroga il database *come loro*: è l'unico modo per
 * verificare le policy scritte su `auth.uid()` e la funzione `mio_giocatore_id()`.
 *
 * Il test **scrive**, quindi gira solo contro l'istanza locale di `npx supabase start`:
 * le credenziali le legge da `supabase status`, non da `.env`, così non può puntare per
 * sbaglio alla produzione. Senza stack locale si salta con il motivo.
 *
 * Stato toccato e ripristinato alla fine: gli utenti creati (cancellati), lo slot
 * reclamato in `giocatori_squadra` e il telefono del profilo g1.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("permessi per ruolo", "stack locale non attivo (npx supabase start)");
  riepilogo("permessi");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`permessi su ${URL_BASE}`);

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

  /** Numero di righe toccate da una scrittura: con `return=representation` è il corpo. */
  const righeToccate = async (res: Response): Promise<number> => {
    if (!res.ok) return 0;
    const corpo = (await res.json()) as unknown[];
    return Array.isArray(corpo) ? corpo.length : 0;
  };

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
    const corpo = (await res.json()) as { id?: string; msg?: string };
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

  const PASSWORD = "prova-permessi-123";
  const idUtenti: string[] = [];
  let telefonoOriginale: string | null = null;
  let tokenAdmin = "";

  try {
    // --- preparazione: un giocatore collegato a g1, un amministratore --------------
    const emailGiocatore = `test-giocatore-${Date.now()}@example.test`;
    const emailAdmin = `test-admin-${Date.now()}@example.test`;
    const idGiocatore = await creaUtente(emailGiocatore, PASSWORD);
    const idAdmin = await creaUtente(emailAdmin, PASSWORD);
    idUtenti.push(idGiocatore, idAdmin);

    await rest("user_roles", SERVIZIO, {
      method: "POST",
      body: JSON.stringify({ user_id: idAdmin, role: "admin" }),
    });

    const tokenGiocatore = await accedi(emailGiocatore, PASSWORD);
    tokenAdmin = await accedi(emailAdmin, PASSWORD);

    // La rosa si tocca con il JWT dell'admin, non con la service key: per il trigger
    // `enforce_giocatori_squadra_update` la service key non è un amministratore
    // (`auth.uid()` è NULL) e vede rifiutato qualsiasi UPDATE.
    const collega = (id: string, utente: string | null) =>
      rest(`giocatori_squadra?id=eq.${id}`, tokenAdmin, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ auth_user_id: utente }),
      });

    assert.equal(await righeToccate(await collega("g1", idGiocatore)), 1, "g1 collegato al test");
    assert.equal(await righeToccate(await collega("g2", idAdmin)), 1, "g2 collegato all'admin");

    const primaProfilo = await rest(
      "profili_giocatore?giocatore_id=eq.g1&select=telefono",
      SERVIZIO,
    );
    telefonoOriginale =
      ((await primaProfilo.json()) as Array<{ telefono: string | null }>)[0]?.telefono ?? null;

    // --- profili: dati personali, la RLS è l'unica barriera -----------------------
    // Senza queste due il documento d'identità di un compagno sarebbe leggibile da
    // chiunque abbia un account.
    await prova("il giocatore vede solo il proprio profilo", async () => {
      const res = await rest("profili_giocatore?select=giocatore_id", tokenGiocatore);
      assert.equal(res.status, 200);
      const righe = (await res.json()) as Array<{ giocatore_id: string }>;
      assert.deepEqual(
        righe.map((r) => r.giocatore_id),
        ["g1"],
        "solo il proprio profilo, mai quello degli altri",
      );
    });

    await prova("il giocatore non modifica il profilo di un altro", async () => {
      const res = await rest("profili_giocatore?giocatore_id=eq.g2", tokenGiocatore, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ telefono: "999" }),
      });
      assert.equal(await righeToccate(res), 0, "nessuna riga altrui aggiornata");
      const dopo = await rest("profili_giocatore?giocatore_id=eq.g2&select=telefono", SERVIZIO);
      const righe = (await dopo.json()) as Array<{ telefono: string | null }>;
      assert.notEqual(righe[0]?.telefono, "999", "il telefono di g2 è rimasto quello di prima");
    });

    // Controllo positivo: senza questo, un database completamente rotto passerebbe
    // tutti i test di negazione qui sopra.
    await prova("il giocatore aggiorna il proprio profilo", async () => {
      const res = await rest("profili_giocatore?giocatore_id=eq.g1", tokenGiocatore, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ telefono: "3331234567" }),
      });
      assert.equal(await righeToccate(res), 1, "il proprio profilo si aggiorna");
    });

    await prova("il giocatore non cancella profili", async () => {
      const res = await rest("profili_giocatore?giocatore_id=eq.g2", tokenGiocatore, {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      });
      assert.equal(await righeToccate(res), 0, "la cancellazione è riservata agli admin");
      const dopo = await rest("profili_giocatore?giocatore_id=eq.g2&select=giocatore_id", SERVIZIO);
      assert.equal(((await dopo.json()) as unknown[]).length, 1, "il profilo g2 esiste ancora");
    });

    await prova("l'amministratore vede tutti i profili", async () => {
      const res = await rest("profili_giocatore?select=giocatore_id", tokenAdmin);
      assert.equal(res.status, 200);
      const righe = (await res.json()) as unknown[];
      assert.ok(righe.length > 1, `l'admin vede l'intero elenco, ne ha visti ${righe.length}`);
    });

    // --- rosa: il trigger di DD-016 ------------------------------------------------
    // La policy da sola lascerebbe passare un UPDATE che cambia anche numero e ruolo:
    // a chiudere il buco è il trigger `enforce_giocatori_squadra_update`.
    await prova(
      "reclamando uno slot libero il giocatore non cambia anche i suoi dati",
      async () => {
        const res = await rest("giocatori_squadra?id=eq.g3", tokenGiocatore, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ auth_user_id: idGiocatore, numero: 99 }),
        });
        assert.ok(!res.ok, `il trigger deve rifiutare, invece ha risposto ${res.status}`);
        const dopo = await rest("giocatori_squadra?id=eq.g3&select=numero,auth_user_id", SERVIZIO);
        const righe = (await dopo.json()) as Array<{ numero: number; auth_user_id: string | null }>;
        assert.notEqual(righe[0]?.numero, 99, "il numero di maglia non è cambiato");
        assert.equal(righe[0]?.auth_user_id ?? null, null, "lo slot g3 è rimasto libero");
      },
    );

    await prova("il giocatore non prende lo slot già assegnato a un altro", async () => {
      const res = await rest("giocatori_squadra?id=eq.g2", tokenGiocatore, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ auth_user_id: idGiocatore }),
      });
      assert.equal(await righeToccate(res), 0, "gli slot già occupati non si rivendicano");
      const dopo = await rest("giocatori_squadra?id=eq.g2&select=auth_user_id", SERVIZIO);
      const righe = (await dopo.json()) as Array<{ auth_user_id: string | null }>;
      assert.equal(righe[0]?.auth_user_id, idAdmin, "g2 è rimasto del suo proprietario");
    });

    // --- ruoli: la scalata di privilegi --------------------------------------------
    await prova("il giocatore non si assegna il ruolo admin", async () => {
      const res = await rest("user_roles", tokenGiocatore, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ user_id: idGiocatore, role: "admin" }),
      });
      assert.ok(!res.ok, `l'auto-promozione deve fallire, invece ha risposto ${res.status}`);
      const dopo = await rest(`user_roles?user_id=eq.${idGiocatore}&select=role`, SERVIZIO);
      assert.equal(((await dopo.json()) as unknown[]).length, 0, "nessun ruolo assegnato");
    });

    await prova("il giocatore non vede i ruoli degli altri", async () => {
      const res = await rest("user_roles?select=user_id,role", tokenGiocatore);
      assert.equal(res.status, 200);
      const righe = (await res.json()) as Array<{ user_id: string }>;
      assert.ok(
        righe.every((r) => r.user_id === idGiocatore),
        "l'elenco degli amministratori non è pubblico",
      );
    });
  } finally {
    // Ripristino: prima gli slot (serve il JWT admin, il trigger rifiuta la service key),
    // poi il telefono, infine gli utenti.
    for (const id of ["g1", "g2"]) {
      if (tokenAdmin) {
        await rest(`giocatori_squadra?id=eq.${id}`, tokenAdmin, {
          method: "PATCH",
          body: JSON.stringify({ auth_user_id: null }),
        });
      }
    }
    await rest("profili_giocatore?giocatore_id=eq.g1", SERVIZIO, {
      method: "PATCH",
      body: JSON.stringify({ telefono: telefonoOriginale }),
    });
    for (const id of idUtenti) {
      await rest(`user_roles?user_id=eq.${id}`, SERVIZIO, { method: "DELETE" });
      await eliminaUtente(id);
    }
    riepilogo("permessi");
  }
}
