/**
 * Sondaggio pre-partita in-app ed email (M24, DD-038): `bun test/integration/sondaggio-notifiche.test.ts`.
 *
 * La route `apri-sondaggio` mandava solo la push. Ora scrive anche `notifiche_utente` (tipo
 * `sondaggio_cacche`) per i giocatori attivi, allenatori esclusi: compare nel centro notifiche e
 * la mail parte dal trigger di M22. Qui si verifica quella scrittura chiamando la route vera.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e avvia il server di sviluppo puntato al
 * database locale (o usa quello indicato da `BASE_URL`). Usa gli slot `g5` (reso non attivo) e
 * `g6` (reso allenatore) della rosa seed, ripristinati alla fine.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { avviaServer } from "../helpers/server";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("sondaggio in-app", "stack locale non attivo (npx supabase start)");
  riepilogo("sondaggio-notifiche");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`sondaggio in-app su ${URL_BASE}`);

  // Il server di sviluppo eredita queste: senza, le route punterebbero al progetto cloud.
  process.env["SUPABASE_URL"] = URL_BASE;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVIZIO;

  const PREFISSO = "test-sondaggio-notifiche";
  const PARTITA = `${PREFISSO}-partita`;
  const INATTIVO = "g5";
  const ALLENATORE = "g6";
  const PASSWORD = "prova-sondaggio-notifiche-123";

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

  async function leggi<T>(percorso: string): Promise<T[]> {
    const res = await rest(percorso, SERVIZIO);
    if (!res.ok) throw new Error(`select su ${percorso}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T[];
  }

  async function scrivi(percorso: string, token: string, metodo: string, corpo?: unknown) {
    const res = await rest(percorso, token, {
      method: metodo,
      body: corpo === undefined ? null : JSON.stringify(corpo),
    });
    if (!res.ok) throw new Error(`${metodo} su ${percorso}: ${res.status} ${await res.text()}`);
  }

  async function creaUtente(email: string): Promise<{ id: string; token: string }> {
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
    const login = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    const t = (await login.json()) as { access_token?: string };
    if (!t.access_token) throw new Error("accesso fallito");
    return { id: corpo.id, token: t.access_token };
  }

  type Notifica = {
    id: string;
    giocatore_id: string;
    letta: boolean;
    titolo: string;
    creato_il: string;
  };
  const notifiche = () =>
    leggi<Notifica>(
      `notifiche_utente?evento_id=eq.${PARTITA}&tipo=eq.sondaggio_cacche&select=id,giocatore_id,letta,titolo,creato_il&order=giocatore_id`,
    );

  const idUtenti: string[] = [];
  let server: { baseUrl: string; stop: () => void } | null = null;
  let tokenAdmin = "";
  const originali = new Map<string, { attivo: boolean; tipo: string }>();

  try {
    const admin = await creaUtente(`${PREFISSO}-admin-${Date.now()}@example.test`);
    const giocatore = await creaUtente(`${PREFISSO}-giocatore-${Date.now()}@example.test`);
    idUtenti.push(admin.id, giocatore.id);
    await scrivi("user_roles", SERVIZIO, "POST", { user_id: admin.id, role: "admin" });
    tokenAdmin = admin.token;

    for (const id of [INATTIVO, ALLENATORE]) {
      const [riga] = await leggi<{ attivo: boolean; tipo: string }>(
        `giocatori_squadra?id=eq.${id}&select=attivo,tipo`,
      );
      originali.set(id, riga ?? { attivo: true, tipo: "giocatore" });
    }
    // Il trigger di `giocatori_squadra` rifiuta la service key: serve il JWT dell'admin.
    await scrivi(`giocatori_squadra?id=eq.${INATTIVO}`, tokenAdmin, "PATCH", { attivo: false });
    await scrivi(`giocatori_squadra?id=eq.${ALLENATORE}`, tokenAdmin, "PATCH", {
      tipo: "allenatore",
    });
    await scrivi("eventi_app", SERVIZIO, "POST", {
      id: PARTITA,
      tipo: "partita",
      titolo: `${PREFISSO} partita`,
      data: "2030-01-01",
      ora: "21:00",
      convocati: [],
    });

    const attesi = (
      await leggi<{ id: string }>("giocatori_squadra?attivo=eq.true&tipo=eq.giocatore&select=id")
    )
      .map((g) => g.id)
      .sort();
    assert.ok(attesi.length > 3, "la rosa seed ha più giocatori attivi");
    assert.ok(!attesi.includes(INATTIVO) && !attesi.includes(ALLENATORE));

    server = await avviaServer();
    console.log(`route apri-sondaggio su ${server.baseUrl}`);
    const chiama = (token: string) =>
      fetch(`${server!.baseUrl}/api/public/apri-sondaggio`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventoId: PARTITA }),
      });

    await prova("chi non è admin non può aprire il sondaggio e non scrive nulla", async () => {
      const res = await chiama(giocatore.token);
      assert.ok(!res.ok, `stato ${res.status}`);
      assert.equal((await notifiche()).length, 0);
    });

    await prova("l'admin apre il sondaggio: una notifica per ogni giocatore attivo", async () => {
      const res = await chiama(tokenAdmin);
      assert.equal(res.status, 200);
      const righe = await notifiche();
      assert.deepEqual(righe.map((r) => r.giocatore_id).sort(), attesi);
      assert.ok(righe.every((r) => r.titolo === "💩 Sondaggio pre-partita aperto"));
      assert.ok(righe.every((r) => !r.letta));
    });

    await prova("l'allenatore e chi non è attivo non ricevono l'avviso in-app", async () => {
      const righe = await notifiche();
      assert.ok(!righe.some((r) => r.giocatore_id === ALLENATORE));
      assert.ok(!righe.some((r) => r.giocatore_id === INATTIVO));
    });

    await prova(
      "l'avviso arriva anche a chi non ha nessun dispositivo iscritto alla push",
      async () => {
        const iscritti = await leggi<{ giocatore_id: string }>(
          "push_subscriptions?select=giocatore_id",
        );
        const conPush = new Set(iscritti.map((i) => i.giocatore_id));
        const senza = attesi.filter((id) => !conPush.has(id));
        assert.ok(senza.length > 0, "nel database di prova nessuno ha la push");
        const righe = await notifiche();
        for (const id of senza)
          assert.ok(
            righe.some((r) => r.giocatore_id === id),
            id,
          );
      },
    );

    await prova(
      "ogni notifica del sondaggio ha la sua mail in coda e nessuna riga push",
      async () => {
        const righe = await notifiche();
        const ids = righe.map((r) => r.id).join(",");
        const email = await leggi<{ notifica_id: string }>(
          `notifiche_email_coda?notifica_id=in.(${ids})&select=notifica_id`,
        );
        assert.equal(email.length, righe.length, "una mail per notifica");
        const push = await leggi<{ notifica_id: string }>(
          `notifiche_push_coda?notifica_id=in.(${ids})&select=notifica_id`,
        );
        assert.equal(push.length, 0, "la push del sondaggio parte già dalla route");
      },
    );

    await prova(
      "ripremere il pulsante aggiorna le notifiche, riporta a non letta e rimanda la mail",
      async () => {
        const prima = await notifiche();
        const [scelta] = prima;
        assert.ok(scelta);
        await scrivi(`notifiche_utente?id=eq.${scelta.id}`, SERVIZIO, "PATCH", { letta: true });
        await scrivi(`notifiche_email_coda?notifica_id=eq.${scelta.id}`, SERVIZIO, "PATCH", {
          stato: "inviata",
        });

        const res = await chiama(tokenAdmin);
        assert.equal(res.status, 200);

        const dopo = await notifiche();
        assert.equal(
          dopo.length,
          prima.length,
          "nessun doppione: upsert su giocatore, evento e tipo",
        );
        const aggiornata = dopo.find((r) => r.id === scelta.id);
        assert.equal(aggiornata?.letta, false);
        assert.ok(aggiornata!.creato_il > scelta.creato_il, "creato_il rinnovato");
        const [coda] = await leggi<{ stato: string }>(
          `notifiche_email_coda?notifica_id=eq.${scelta.id}&select=stato`,
        );
        assert.equal(coda?.stato, "in_coda", "la mail riparte");
      },
    );
  } finally {
    server?.stop();
    await rest(`notifiche_utente?evento_id=eq.${PARTITA}`, SERVIZIO, { method: "DELETE" });
    await rest(`eventi_app?id=eq.${PARTITA}`, SERVIZIO, { method: "DELETE" });
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
      await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: { apikey: SERVIZIO, Authorization: `Bearer ${SERVIZIO}` },
      });
    }
    riepilogo("sondaggio-notifiche");
  }
}
