/**
 * Destinatari delle notifiche per ruolo: `bun test/integration/destinatari-notifiche.test.ts`.
 *
 * Verifica, chiamando le route vere, le regole del catalogo delle notifiche
 * (docs/modules/notifiche.md) che finora erano coperte solo dalla lettura del codice:
 *
 * - i promemoria a 24 e 3 ore arrivano ai convocati (a tutti i giocatori attivi se `convocati`
 *   è vuoto), mai all'allenatore (DD-039);
 * - la push del sondaggio pre-partita non arriva ai dispositivi dell'allenatore, quella del
 *   messaggio dello staff sì (DD-034, DD-038);
 * - il sollecito presenze arriva a chi non ha risposto o ha risposto «forse», mai all'allenatore,
 *   ed è permesso ad allenatore e admin ma non a un giocatore;
 * - il turno palloni arriva all'incaricato e a chi li aveva prima, solo per allenamenti e partite,
 *   ed è riservato agli admin.
 *
 * Le push vanno a un servizio push finto in locale: nessuna richiesta esce dalla macchina.
 * Gira solo sullo stack locale (`npx supabase start`). Il server di sviluppo che riceve le
 * chiamate deve avere chiavi VAPID (il test le imposta se avvia lui il server; con `BASE_URL`
 * valgono quelle di quel server) e usa gli slot `g1`, `g2`, `g4`, `g5` e `g6` della rosa seed,
 * ripristinati alla fine.
 */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { statoLocale } from "../helpers/locale";
import { avviaServer } from "../helpers/server";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("destinatari notifiche", "stack locale non attivo (npx supabase start)");
  riepilogo("destinatari-notifiche");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`destinatari notifiche su ${URL_BASE}`);

  // Il server di sviluppo eredita queste: senza, le route punterebbero al progetto cloud.
  process.env["SUPABASE_URL"] = URL_BASE;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVIZIO;

  const b64u = (dati: ArrayBuffer | Uint8Array) =>
    Buffer.from(dati as ArrayBuffer).toString("base64url");

  // Chiavi VAPID di prova (P-256), nel formato di `webpush.server.ts`: la chiave privata reale
  // non deve mai servire ai test.
  const vapid = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", vapid.privateKey);
  process.env["VAPID_PUBLIC_KEY"] = b64u(
    new Uint8Array([
      4,
      ...Buffer.from(jwk.x ?? "", "base64url"),
      ...Buffer.from(jwk.y ?? "", "base64url"),
    ]),
  );
  process.env["VAPID_PRIVATE_KEY"] = jwk.d ?? "";

  async function chiaviDispositivo() {
    const k = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ]);
    return {
      p256dh: b64u(await crypto.subtle.exportKey("raw", k.publicKey)),
      auth: b64u(crypto.getRandomValues(new Uint8Array(16))),
    };
  }

  const PREFISSO = "test-destinatari-notifiche";
  const PASSWORD = "prova-destinatari-notifiche-123";
  const G_UNO = "g1";
  const G_DUE = "g2";
  const G_QUATTRO = "g4";
  const G_CINQUE = "g5";
  const ALLENATORE = "g6";
  const PARTITA = `${PREFISSO}-partita`;
  const PRESENZE = `${PREFISSO}-presenze`;
  const PALLONI_1 = `${PREFISSO}-palloni-1`;
  const PALLONI_2 = `${PREFISSO}-palloni-2`;
  const GENERICO = `${PREFISSO}-generico`;
  const PROMEMORIA_CONVOCATI = `${PREFISSO}-promemoria-convocati`;
  const PROMEMORIA_TUTTI = `${PREFISSO}-promemoria-tutti`;
  const TITOLO_STAFF = `${PREFISSO} messaggio ${Date.now()}`;

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

  // --- Servizio push finto: registra a quale dispositivo arriva ogni push ------------------
  const ricevute: string[] = [];
  const servizioPush: Server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      ricevute.push((req.url ?? "").replace(/^\//, ""));
      res.statusCode = 201;
      res.end();
    });
  });
  await new Promise<void>((ok) => servizioPush.listen(0, "127.0.0.1", ok));
  const porta = (servizioPush.address() as AddressInfo).port;
  const endpoint = (slot: string) => `http://127.0.0.1:${porta}/${slot}`;
  const svuota = () => {
    ricevute.length = 0;
  };
  /** A quali slot è arrivata una push dall'ultimo `svuota()`, senza ripetizioni e in ordine. */
  const destinatariPush = () => [...new Set(ricevute)].sort();

  type Notifica = { giocatore_id: string; titolo: string; tipo: string };
  const notifiche = (filtro: string) =>
    leggi<Notifica>(
      `notifiche_utente?${filtro}&select=giocatore_id,titolo,tipo&order=giocatore_id`,
    );
  const slot = (righe: Notifica[]) => righe.map((r) => r.giocatore_id);

  const idUtenti: string[] = [];
  let server: { baseUrl: string; stop: () => void } | null = null;
  let tokenAdmin = "";
  const originali = new Map<string, { tipo: string; auth_user_id: string | null }>();

  try {
    const admin = await creaUtente(`${PREFISSO}-admin-${Date.now()}@example.test`);
    const allenatore = await creaUtente(`${PREFISSO}-allenatore-${Date.now()}@example.test`);
    const giocatore = await creaUtente(`${PREFISSO}-giocatore-${Date.now()}@example.test`);
    idUtenti.push(admin.id, allenatore.id, giocatore.id);
    await scrivi("user_roles", SERVIZIO, "POST", { user_id: admin.id, role: "admin" });
    tokenAdmin = admin.token;

    const [g6] = await leggi<{ tipo: string; auth_user_id: string | null }>(
      `giocatori_squadra?id=eq.${ALLENATORE}&select=tipo,auth_user_id`,
    );
    originali.set(ALLENATORE, g6 ?? { tipo: "giocatore", auth_user_id: null });
    // Il trigger di `giocatori_squadra` rifiuta la service key: serve il JWT dell'admin. Il
    // trigger di M21 assegna il ruolo `allenatore` all'account collegato a uno slot allenatore.
    await scrivi(`giocatori_squadra?id=eq.${ALLENATORE}`, tokenAdmin, "PATCH", {
      tipo: "allenatore",
      auth_user_id: allenatore.id,
    });

    for (const s of [G_QUATTRO, G_CINQUE, ALLENATORE]) {
      await scrivi("push_subscriptions", SERVIZIO, "POST", {
        giocatore_id: s,
        endpoint: endpoint(s),
        ...(await chiaviDispositivo()),
      });
    }
    for (const [id, tipo, data] of [
      [PARTITA, "partita", "2031-04-01"],
      [PRESENZE, "allenamento", "2031-04-02"],
      [PALLONI_1, "allenamento", "2031-05-01"],
      [PALLONI_2, "allenamento", "2031-05-08"],
      [GENERICO, "evento", "2031-05-09"],
    ] as const) {
      await scrivi("eventi_app", SERVIZIO, "POST", {
        id,
        tipo,
        titolo: `${PREFISSO} ${id}`,
        data,
        ora: "20:00",
        convocati: [],
      });
    }

    // Promemoria: eventi che iniziano tra 2 ore, dentro le finestre dei job a 24 e a 3 ore.
    const tra2Ore = new Date(Date.now() + 2 * 3_600_000);
    const dataRoma = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(tra2Ore);
    const oraRoma = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(tra2Ore);
    for (const [id, convocati] of [
      [PROMEMORIA_CONVOCATI, [G_QUATTRO]],
      [PROMEMORIA_TUTTI, []],
    ] as const) {
      await scrivi("eventi_app", SERVIZIO, "POST", {
        id,
        tipo: "allenamento",
        titolo: `${PREFISSO} ${id}`,
        data: dataRoma,
        ora: oraRoma,
        convocati: [...convocati],
      });
    }

    server = await avviaServer();
    console.log(`route su ${server.baseUrl}`);
    const chiama = (percorso: string, token: string, corpo: unknown) =>
      fetch(`${server!.baseUrl}/api/public/${percorso}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });

    const attivi = (
      await leggi<{ id: string; tipo: string }>("giocatori_squadra?attivo=eq.true&select=id,tipo")
    ).sort((a, b) => a.id.localeCompare(b.id));
    const giocatoriAttivi = attivi.filter((g) => g.tipo === "giocatore").map((g) => g.id);
    assert.ok(attivi.some((g) => g.id === ALLENATORE && g.tipo === "allenatore"));

    // --- 0. Promemoria a 24 e 3 ore (generati dal database) --------------------------------
    await prova(
      "il promemoria arriva ai soli convocati: l'allenatore non lo riceve (DD-039)",
      async () => {
        for (const [tipo, finestra] of [
          ["evento_promemoria_24h", "24 hours"],
          ["evento_promemoria_3h", "3 hours"],
        ] as const) {
          const res = await fetch(`${URL_BASE}/rest/v1/rpc/genera_promemoria_eventi`, {
            method: "POST",
            headers: {
              apikey: SERVIZIO,
              Authorization: `Bearer ${SERVIZIO}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ p_tipo: tipo, p_finestra: finestra }),
          });
          assert.ok(res.ok, `genera_promemoria_eventi ${tipo}`);
          const righe = await notifiche(`evento_id=eq.${PROMEMORIA_CONVOCATI}&tipo=eq.${tipo}`);
          assert.deepEqual(slot(righe), [G_QUATTRO], tipo);
        }
      },
    );

    await prova(
      "con convocati vuoto il promemoria arriva a tutti i giocatori attivi, mai all'allenatore",
      async () => {
        for (const tipo of ["evento_promemoria_24h", "evento_promemoria_3h"]) {
          const righe = await notifiche(`evento_id=eq.${PROMEMORIA_TUTTI}&tipo=eq.${tipo}`);
          assert.deepEqual(slot(righe), giocatoriAttivi, tipo);
        }
      },
    );

    // --- 1. Messaggio dello staff ---------------------------------------------------------
    await prova(
      "controllo: la push arriva al servizio finto (il server ha le chiavi VAPID)",
      async () => {
        svuota();
        const res = await chiama("notifica-personalizzata", tokenAdmin, {
          messaggio: `${TITOLO_STAFF} controllo`,
          giocatoreId: G_QUATTRO,
        });
        assert.equal(res.status, 200);
        assert.deepEqual(
          destinatariPush(),
          [G_QUATTRO],
          "il server di prova non manda push: servono VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY, oppure non usare BASE_URL",
        );
      },
    );

    await prova(
      "il messaggio dello staff a tutti raggiunge anche i dispositivi dell'allenatore",
      async () => {
        svuota();
        const res = await chiama("notifica-personalizzata", tokenAdmin, {
          messaggio: TITOLO_STAFF,
        });
        assert.equal(res.status, 200);
        assert.deepEqual(destinatariPush(), [ALLENATORE, G_QUATTRO, G_CINQUE].sort());
        const righe = await notifiche(`corpo=eq.${encodeURIComponent(TITOLO_STAFF)}&tipo=eq.admin`);
        assert.deepEqual(
          slot(righe),
          attivi.map((g) => g.id),
          "in-app: tutta la rosa attiva, allenatore compreso",
        );
      },
    );

    await prova("il messaggio a un solo giocatore non arriva agli altri dispositivi", async () => {
      svuota();
      await chiama("notifica-personalizzata", tokenAdmin, {
        messaggio: `${TITOLO_STAFF} solo g5`,
        giocatoreId: G_CINQUE,
      });
      assert.deepEqual(destinatariPush(), [G_CINQUE]);
    });

    await prova(
      "un allenatore o un giocatore non possono mandare il messaggio dello staff",
      async () => {
        for (const token of [allenatore.token, giocatore.token]) {
          const res = await chiama("notifica-personalizzata", token, { messaggio: "no" });
          assert.ok(!res.ok, `stato ${res.status}`);
        }
      },
    );

    // --- 2. Sondaggio pre-partita ---------------------------------------------------------
    await prova("il sondaggio non manda la push ai dispositivi dell'allenatore", async () => {
      svuota();
      const res = await chiama("apri-sondaggio", tokenAdmin, { eventoId: PARTITA });
      assert.equal(res.status, 200);
      assert.deepEqual(destinatariPush(), [G_QUATTRO, G_CINQUE].sort());
    });

    await prova("il sondaggio non crea l'avviso in-app per l'allenatore", async () => {
      const righe = await notifiche(`evento_id=eq.${PARTITA}&tipo=eq.sondaggio_cacche`);
      assert.deepEqual(slot(righe), giocatoriAttivi);
    });

    await prova("un allenatore non può aprire il sondaggio", async () => {
      const res = await chiama("apri-sondaggio", allenatore.token, { eventoId: PARTITA });
      assert.ok(!res.ok, `stato ${res.status}`);
    });

    // --- 3. Sollecito presenze ------------------------------------------------------------
    await scrivi("risposte_presenze", SERVIZIO, "POST", [
      { evento_id: PRESENZE, giocatore_id: G_QUATTRO, stato: "presente" },
      { evento_id: PRESENZE, giocatore_id: G_CINQUE, stato: "forse" },
    ]);

    await prova(
      "l'allenatore può sollecitare: arriva a chi non ha risposto e a chi ha detto «forse»",
      async () => {
        svuota();
        const res = await chiama("sollecita-presenze", allenatore.token, { eventoId: PRESENZE });
        assert.equal(res.status, 200);
        const righe = await notifiche(`evento_id=eq.${PRESENZE}&tipo=eq.sollecita_presenze`);
        assert.deepEqual(
          slot(righe),
          giocatoriAttivi.filter((id) => id !== G_QUATTRO),
          "esclusi chi ha già risposto e l'allenatore, incluso chi ha risposto «forse»",
        );
        assert.ok(slot(righe).includes(G_CINQUE));
        assert.deepEqual(destinatariPush(), [G_CINQUE], "push solo ai dispositivi dei sollecitati");
      },
    );

    await prova("un giocatore non può sollecitare le presenze", async () => {
      const res = await chiama("sollecita-presenze", giocatore.token, { eventoId: PRESENZE });
      assert.ok(!res.ok, `stato ${res.status}`);
    });

    // --- 4. Turno palloni -----------------------------------------------------------------
    await scrivi("turni_palloni", SERVIZIO, "POST", [
      { evento_id: PALLONI_1, giocatore_id: G_UNO },
      { evento_id: PALLONI_2, giocatore_id: G_DUE },
    ]);

    await prova("il turno palloni arriva all'incaricato e a chi li aveva prima", async () => {
      const res = await chiama("promemoria-palloni", tokenAdmin, { eventoId: PALLONI_2 });
      assert.equal(res.status, 200);
      const righe = await notifiche(`evento_id=eq.${PALLONI_2}&tipo=eq.turno_palloni`);
      assert.deepEqual(slot(righe), [G_UNO, G_DUE]);
      const per = new Map(righe.map((r) => [r.giocatore_id, r.titolo]));
      assert.equal(per.get(G_DUE), "Tocca a te prendere i palloni");
      assert.equal(per.get(G_UNO), "Porta i palloni");
    });

    await prova(
      "per un evento che non è allenamento né partita non parte nessun avviso",
      async () => {
        await scrivi("turni_palloni", SERVIZIO, "POST", {
          evento_id: GENERICO,
          giocatore_id: G_QUATTRO,
        });
        const res = await chiama("promemoria-palloni", tokenAdmin, { eventoId: GENERICO });
        assert.equal(res.status, 200);
        assert.equal((await notifiche(`evento_id=eq.${GENERICO}&tipo=eq.turno_palloni`)).length, 0);
      },
    );

    await prova("un allenatore non può far partire il turno palloni", async () => {
      const res = await chiama("promemoria-palloni", allenatore.token, { eventoId: PALLONI_2 });
      assert.ok(!res.ok, `stato ${res.status}`);
    });
  } finally {
    server?.stop();
    servizioPush.close();
    await rest(
      `push_subscriptions?endpoint=like.${encodeURIComponent(`http://127.0.0.1:${porta}/*`)}`,
      SERVIZIO,
      {
        method: "DELETE",
      },
    );
    await rest(`notifiche_utente?corpo=like.${encodeURIComponent(`${PREFISSO}*`)}`, SERVIZIO, {
      method: "DELETE",
    });
    for (const id of [
      PARTITA,
      PRESENZE,
      PALLONI_1,
      PALLONI_2,
      GENERICO,
      PROMEMORIA_CONVOCATI,
      PROMEMORIA_TUTTI,
    ]) {
      await rest(`notifiche_utente?evento_id=eq.${id}`, SERVIZIO, { method: "DELETE" });
      await rest(`turni_palloni?evento_id=eq.${id}`, SERVIZIO, { method: "DELETE" });
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
      await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: { apikey: SERVIZIO, Authorization: `Bearer ${SERVIZIO}` },
      });
    }
    riepilogo("destinatari-notifiche");
  }
}
