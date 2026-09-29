/**
 * Push dei promemoria e sondaggio in-app (M24, DD-038): `bun test/integration/push-promemoria.test.ts`.
 *
 * Lato database: il trigger che accoda solo i promemoria a 24 e 3 ore, le funzioni RPC del worker
 * (`prendi_push_promemoria`, `esito_push_promemoria`), la RLS che tiene la coda lontana dai
 * client, e il nuovo tipo `sondaggio_cacche`. Il worker vero e la logica degli esiti sono coperti
 * da `unit/mailer-core.test.ts`; qui non parte nessuna push.
 *
 * Gira solo sullo stack locale (`npx supabase start`): usa lo slot `g4` della rosa seed e
 * iscrizioni push con endpoint `https://push.test-push-promemoria.example/…`, tolte alla fine.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("push promemoria", "stack locale non attivo (npx supabase start)");
  riepilogo("push-promemoria");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`push promemoria su ${URL_BASE}`);

  const PREFISSO = "test-push-promemoria";
  const G4 = "g4";
  const G5 = "g5";
  const ENDPOINT = (n: number) => `https://push.${PREFISSO}.example/${n}`;
  const EVENTI = ["a", "b", "c", "d"].map((x) => `${PREFISSO}-${x}`);
  let contatore = 0;
  const PASSWORD = "prova-push-promemoria-123";

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

  async function scrivi(percorso: string, metodo: string, corpo?: unknown) {
    const res = await rest(percorso, SERVIZIO, {
      method: metodo,
      body: corpo === undefined ? null : JSON.stringify(corpo),
    });
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
    return { ok: res.ok, dati: (testo ? JSON.parse(testo) : null) as T };
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
    oggetto: string;
    testo: string;
    tentativi_fatti: number;
    iscrizioni: Array<{ endpoint: string; p256dh: string; auth: string }>;
  };

  const evento = async (id: string, ore = 2) => {
    const quando = new Date(Date.now() + ore * 3_600_000);
    await scrivi("eventi_app", "POST", {
      id,
      tipo: "allenamento",
      titolo: `${PREFISSO} ${id}`,
      data: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(quando),
      ora: new Intl.DateTimeFormat("it-IT", {
        timeZone: "Europe/Rome",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(quando),
      convocati: [G4],
    });
  };

  const creaNotifica = async (
    giocatoreId: string,
    tipo: string,
    eventoId: string | null = null,
  ): Promise<string> => {
    contatore += 1;
    const res = await rest("notifiche_utente", SERVIZIO, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        giocatore_id: giocatoreId,
        tipo,
        titolo: `${PREFISSO} titolo ${contatore}`,
        corpo: `${PREFISSO} corpo`,
        ...(eventoId ? { evento_id: eventoId } : {}),
      }),
    });
    if (!res.ok) throw new Error(`insert notifica: ${res.status} ${await res.text()}`);
    return ((await res.json()) as { id: string }[])[0]!.id;
  };

  /** Evento nuovo e un promemoria per g4: (giocatore, evento, tipo) è UNIQUE, ogni prova ha il suo. */
  const eventiCreati: string[] = [];
  const fresco = async (tipo = "evento_promemoria_24h"): Promise<string> => {
    contatore += 1;
    const id = `${PREFISSO}-x${contatore}`;
    await evento(id, 40);
    eventiCreati.push(id);
    return creaNotifica(G4, tipo, id);
  };

  const coda = async (id: string): Promise<Coda | undefined> =>
    (await leggi<Coda>(`notifiche_push_coda?notifica_id=eq.${id}&select=*`))[0];
  const codaEmail = async (id: string) =>
    (await leggi<{ stato: string }>(`notifiche_email_coda?notifica_id=eq.${id}&select=stato`))[0];

  const prendi = async (mie: string[], max = 100): Promise<Preso[]> => {
    const r = await rpc<Preso[]>("prendi_push_promemoria", { p_max: max });
    assert.ok(r.ok, "prendi_push_promemoria");
    return r.dati.filter((p) => mie.includes(p.id_notifica));
  };

  const esito = async (
    id: string,
    tipo: string,
    errore: string | null = null,
    prossimo: string | null = null,
  ) => {
    const r = await rpc("esito_push_promemoria", {
      p_id: id,
      p_esito: tipo,
      p_errore: errore,
      p_prossimo: prossimo,
    });
    assert.ok(r.ok, `esito_push_promemoria ${tipo}`);
  };

  const iscrivi = (giocatoreId: string, n: number) =>
    scrivi("push_subscriptions", "POST", {
      giocatore_id: giocatoreId,
      endpoint: ENDPOINT(n),
      p256dh: `k${n}`,
      auth: `a${n}`,
    });

  const idUtenti: string[] = [];
  try {
    const utente = await creaUtente(`${PREFISSO}-giocatore-${Date.now()}@example.test`);
    idUtenti.push(utente.id);
    for (const id of EVENTI) await evento(id);

    // --- 1. Trigger ---------------------------------------------------------------------
    await prova("solo i promemoria a 24 e 3 ore finiscono nella coda push", async () => {
      const promemoria = [
        await creaNotifica(G4, "evento_promemoria_24h", EVENTI[0]),
        await creaNotifica(G4, "evento_promemoria_3h", EVENTI[0]),
      ];
      const altre = [
        await creaNotifica(G4, "admin"),
        await creaNotifica(G4, "turno_palloni", EVENTI[0]),
        await creaNotifica(G4, "sollecita_presenze", EVENTI[0]),
        await creaNotifica(G4, "sondaggio_cacche", EVENTI[0]),
      ];
      for (const id of promemoria) {
        const riga = await coda(id);
        assert.equal(riga?.stato, "in_coda");
        assert.equal(riga?.tentativi, 0);
      }
      for (const id of altre) {
        assert.equal(await coda(id), undefined, "la push di queste parte già dall'app");
      }
    });

    await prova(
      "il sondaggio è un tipo valido, e la sua mail parte dal trigger di M22",
      async () => {
        const id = await creaNotifica(G4, "sondaggio_cacche", EVENTI[1]);
        assert.equal((await codaEmail(id))?.stato, "in_coda");
        assert.equal(await coda(id), undefined);
      },
    );

    await prova("un tipo sconosciuto è ancora rifiutato dal vincolo", async () => {
      const res = await rest("notifiche_utente", SERVIZIO, {
        method: "POST",
        body: JSON.stringify({ giocatore_id: G4, tipo: "boh", titolo: "x", corpo: "y" }),
      });
      assert.ok(!res.ok);
    });

    // --- 2. prendi_push_promemoria ------------------------------------------------------
    await prova(
      "prendi restituisce testo e iscrizioni del giocatore e marca la riga in_invio",
      async () => {
        await iscrivi(G4, 1);
        await iscrivi(G4, 2);
        const id = await fresco("evento_promemoria_3h");
        const [p] = await prendi([id]);
        assert.ok(p, "la riga è stata presa");
        assert.match(p.oggetto, new RegExp(PREFISSO));
        assert.equal(p.tentativi_fatti, 0);
        assert.deepEqual(p.iscrizioni.map((i) => i.endpoint).sort(), [ENDPOINT(1), ENDPOINT(2)]);
        assert.equal(p.iscrizioni[0]?.p256dh.startsWith("k"), true);
        assert.equal((await coda(id))?.stato, "in_invio");
      },
    );

    await prova("una seconda chiamata non restituisce di nuovo la stessa riga", async () => {
      const id = await fresco();
      assert.equal((await prendi([id])).length, 1);
      assert.equal((await prendi([id])).length, 0);
    });

    await prova("due chiamate concorrenti si dividono le righe senza doppioni", async () => {
      const ids = await Promise.all(Array.from({ length: 5 }, () => fresco()));
      const [a, b] = await Promise.all([prendi(ids, 3), prendi(ids, 3)]);
      const tutti = [...a, ...b].map((p) => p.id_notifica);
      assert.equal(tutti.length, new Set(tutti).size, "nessuna riga presa due volte");
      const resto = (await prendi(ids)).map((p) => p.id_notifica);
      assert.deepEqual([...tutti, ...resto].sort(), [...ids].sort());
    });

    await prova("giocatore senza dispositivi: 'saltata', mai presa", async () => {
      const id = await creaNotifica(G5, "evento_promemoria_24h", EVENTI[0]);
      assert.equal((await prendi([id])).length, 0);
      const riga = await coda(id);
      assert.equal(riga?.stato, "saltata");
      assert.equal(riga?.errore, null);
    });

    await prova("promemoria creato da più di 3 ore: 'saltata', la push non serve più", async () => {
      const id = await fresco("evento_promemoria_3h");
      const vecchia = new Date(Date.now() - 4 * 3_600_000).toISOString();
      await scrivi(`notifiche_utente?id=eq.${id}`, "PATCH", { creato_il: vecchia });
      assert.equal((await prendi([id])).length, 0);
      assert.equal((await coda(id))?.stato, "saltata");
    });

    await prova(
      "la riga rimasta in invio per un worker morto viene ripresa dopo 10 minuti",
      async () => {
        const id = await fresco();
        assert.equal((await prendi([id])).length, 1);
        assert.equal((await prendi([id])).length, 0, "ancora in invio");
        await scrivi(`notifiche_push_coda?notifica_id=eq.${id}`, "PATCH", {
          aggiornata_il: new Date(Date.now() - 11 * 60_000).toISOString(),
        });
        assert.equal((await prendi([id])).length, 1, "recuperata");
      },
    );

    // --- 3. esito_push_promemoria -------------------------------------------------------
    const nuovaInvio = async () => {
      const id = await fresco();
      await prendi([id]);
      return id;
    };

    await prova("'inviata': stato e orario, errore azzerato", async () => {
      const id = await nuovaInvio();
      await esito(id, "inviata");
      const riga = await coda(id);
      assert.equal(riga?.stato, "inviata");
      assert.ok(riga?.inviata_il);
      assert.equal(riga?.errore, null);
    });

    await prova(
      "'riprova': conta un tentativo e non viene ripresa prima dell'ora fissata",
      async () => {
        const id = await nuovaInvio();
        await esito(id, "riprova", "503", new Date(Date.now() + 3_600_000).toISOString());
        const riga = await coda(id);
        assert.equal(riga?.stato, "in_coda");
        assert.equal(riga?.tentativi, 1);
        assert.equal(riga?.errore, "503");
        assert.equal((await prendi([id])).length, 0);
        await scrivi(`notifiche_push_coda?notifica_id=eq.${id}`, "PATCH", {
          prossimo_tentativo: new Date(Date.now() - 1000).toISOString(),
        });
        const [p] = await prendi([id]);
        assert.equal(p?.tentativi_fatti, 1);
      },
    );

    await prova("'fallita' e 'saltata' sono definitive", async () => {
      const a = await nuovaInvio();
      await esito(a, "fallita", "403");
      assert.equal((await coda(a))?.stato, "fallita");
      assert.equal((await coda(a))?.tentativi, 1);
      const b = await nuovaInvio();
      await esito(b, "saltata", "410");
      assert.equal((await coda(b))?.stato, "saltata");
      assert.equal((await prendi([a, b])).length, 0);
    });

    await prova(
      "un esito su una riga non 'in_invio' non cambia nulla, uno sconosciuto è rifiutato",
      async () => {
        const id = await nuovaInvio();
        await esito(id, "inviata");
        await esito(id, "fallita", "x");
        assert.equal((await coda(id))?.stato, "inviata", "l'esito già deciso non si sovrascrive");
        const r = await rpc("esito_push_promemoria", { p_id: id, p_esito: "boh" });
        assert.ok(!r.ok);
      },
    );

    await prova("cancellare la notifica toglie anche la riga della coda push", async () => {
      const id = await fresco("evento_promemoria_3h");
      assert.ok(await coda(id));
      await scrivi(`notifiche_utente?id=eq.${id}`, "DELETE");
      assert.equal(await coda(id), undefined);
    });

    await prova(
      "il job dei promemoria accoda la push una volta sola, anche se cancelli la notifica",
      async () => {
        await scrivi(`eventi_app?id=eq.${EVENTI[2]}`, "PATCH", { convocati: [G4] });
        const args = { p_tipo: "evento_promemoria_24h", p_finestra: "24 hours" };
        await rpc("genera_promemoria_eventi", args);
        const [n] = await leggi<{ id: string }>(
          `notifiche_utente?evento_id=eq.${EVENTI[2]}&tipo=eq.evento_promemoria_24h&select=id`,
        );
        assert.ok(n, "il job ha creato il promemoria");
        assert.equal((await coda(n.id))?.stato, "in_coda");

        await scrivi(`notifiche_utente?id=eq.${n.id}`, "DELETE");
        assert.equal(await coda(n.id), undefined, "la coda sparisce con la notifica");
        await rpc("genera_promemoria_eventi", args);
        const dopo = await leggi<{ id: string }>(
          `notifiche_utente?evento_id=eq.${EVENTI[2]}&tipo=eq.evento_promemoria_24h&select=id`,
        );
        assert.equal(
          dopo.length,
          0,
          "M23: il promemoria eliminato non torna, quindi nessuna nuova push",
        );
      },
    );

    // --- 4. Permessi --------------------------------------------------------------------
    await prova("un utente autenticato non vede né scrive la coda push", async () => {
      const id = await nuovaInvio();
      const lettura = await rest("notifiche_push_coda?select=*", utente.token);
      const righe = lettura.ok ? ((await lettura.json()) as unknown[]) : [];
      assert.equal(righe.length, 0);
      const scrittura = await rest(`notifiche_push_coda?notifica_id=eq.${id}`, utente.token, {
        method: "PATCH",
        body: JSON.stringify({ stato: "in_coda" }),
      });
      assert.ok(!scrittura.ok || (await scrittura.text()) === "");
      assert.equal((await coda(id))?.stato, "in_invio");
      const anon = await rest("notifiche_push_coda?select=*", ANON);
      assert.ok(!anon.ok, "anon non può leggere la coda");
    });

    await prova("le funzioni push del worker sono chiamabili solo dalla service role", async () => {
      const id = await nuovaInvio();
      for (const token of [utente.token, ANON]) {
        const a = await rpc("prendi_push_promemoria", { p_max: 1 }, token);
        assert.ok(!a.ok, "prendi_push_promemoria");
        const b = await rpc("esito_push_promemoria", { p_id: id, p_esito: "fallita" }, token);
        assert.ok(!b.ok, "esito_push_promemoria");
      }
      assert.equal((await coda(id))?.stato, "in_invio");
    });
  } finally {
    await rest(
      `push_subscriptions?endpoint=like.${encodeURIComponent(`https://push.${PREFISSO}.example/*`)}`,
      SERVIZIO,
      {
        method: "DELETE",
      },
    );
    await rest(`notifiche_utente?titolo=like.${PREFISSO}*`, SERVIZIO, { method: "DELETE" });
    for (const id of [...EVENTI, ...eventiCreati]) {
      await rest(`eventi_app?id=eq.${id}`, SERVIZIO, { method: "DELETE" });
    }
    for (const id of idUtenti) {
      await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: { apikey: SERVIZIO, Authorization: `Bearer ${SERVIZIO}` },
      });
    }
    riepilogo("push-promemoria");
  }
}
