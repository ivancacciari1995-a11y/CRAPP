/**
 * Chi può leggere l'elenco dei giocatori con notifiche push attive:
 * `bun test/integration/notifiche-attive-route.test.ts`.
 *
 * `/api/public/notifiche-attive` legge `push_subscriptions` con la service role e
 * salta la RLS (come le route che mandano notifiche, DD-024): il permesso deve stare
 * nella route. Serve un database vero per provare token di un giocatore normale e di
 * un amministratore, quindi solo stack locale.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { avviaServer, json } from "../helpers/server";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("notifiche attive: permessi route", "stack locale non attivo (npx supabase start)");
  riepilogo("notifiche-attive-route");
} else {
  const { url: SUPABASE, anon: ANON, servizio: SERVIZIO } = locale;

  // Il server di sviluppo eredita queste: le route leggono i nomi senza prefisso.
  process.env["SUPABASE_URL"] = SUPABASE;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVIZIO;

  const PASSWORD = "prova-notifiche-123";
  const idUtenti: string[] = [];

  const authAdmin = { apikey: SERVIZIO, Authorization: `Bearer ${SERVIZIO}` };

  async function creaUtente(email: string): Promise<string> {
    const res = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
      method: "POST",
      headers: { ...authAdmin, "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
    });
    const corpo = (await res.json()) as { id?: string };
    if (!corpo.id) throw new Error(`creazione utente fallita: ${JSON.stringify(corpo)}`);
    idUtenti.push(corpo.id);
    return corpo.id;
  }

  async function accedi(email: string): Promise<string> {
    const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    const corpo = (await res.json()) as { access_token?: string };
    if (!corpo.access_token) throw new Error(`accesso fallito: ${JSON.stringify(corpo)}`);
    return corpo.access_token;
  }

  const emailGiocatore = `test-notifiche-giocatore-${Date.now()}@example.test`;
  const emailAdmin = `test-notifiche-admin-${Date.now()}@example.test`;
  await creaUtente(emailGiocatore);
  const idAdmin = await creaUtente(emailAdmin);
  await fetch(`${SUPABASE}/rest/v1/user_roles`, {
    method: "POST",
    headers: { ...authAdmin, "content-type": "application/json" },
    body: JSON.stringify({ user_id: idAdmin, role: "admin" }),
  });

  const tokenGiocatore = await accedi(emailGiocatore);
  const tokenAdmin = await accedi(emailAdmin);

  const server = await avviaServer();
  console.log(`notifiche-attive-route su ${server.baseUrl} (database ${SUPABASE})`);

  const PERCORSO = "/api/public/notifiche-attive";
  const chiama = (intestazioni: Record<string, string> = {}) =>
    fetch(`${server.baseUrl}${PERCORSO}`, { headers: intestazioni });

  try {
    await prova("senza token la route non risponde", async () => {
      assert.equal((await chiama()).status, 401);
    });

    await prova("un giocatore autenticato non è admin", async () => {
      const res = await chiama({ authorization: `Bearer ${tokenGiocatore}` });
      assert.equal(res.status, 403);
    });

    await prova("un amministratore riceve l'elenco degli id", async () => {
      const res = await chiama({ authorization: `Bearer ${tokenAdmin}` });
      assert.equal(res.status, 200);
      const corpo = (await json(res)) as { giocatoreIds: unknown };
      assert.ok(Array.isArray(corpo.giocatoreIds), "giocatoreIds è un array");
    });
  } finally {
    server.stop();
    for (const id of idUtenti) {
      await fetch(`${SUPABASE}/rest/v1/user_roles?user_id=eq.${id}`, {
        method: "DELETE",
        headers: authAdmin,
      });
      await fetch(`${SUPABASE}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: authAdmin,
      });
    }
    riepilogo("notifiche-attive-route");
  }
}
