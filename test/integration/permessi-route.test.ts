/**
 * Chi può far partire una notifica a tutta la squadra: `bun test/integration/permessi-route.test.ts`.
 *
 * Le route in `src/routes/api/public/` girano con la service role e saltano la RLS, quindi
 * il permesso deve stare nella route (DD-024). `api.test.ts` verifica solo i rifiuti che
 * non richiedono un utente; qui si prova il giro completo — nessun token, token di un
 * giocatore normale, token di un amministratore — e per farlo serve un database dove si
 * possano creare utenti veri.
 *
 * Quindi: solo stack locale (`npx supabase start`), e il server di sviluppo viene avviato
 * puntato lì invece che al progetto cloud di `.env`.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { avviaServer } from "../helpers/server";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("permessi delle route", "stack locale non attivo (npx supabase start)");
  riepilogo("permessi route");
} else {
  const { url: SUPABASE, anon: ANON, servizio: SERVIZIO } = locale;
  const SEGRETO = "segreto-di-prova";

  // Il server di sviluppo eredita queste: le route leggono i nomi senza prefisso.
  process.env["SUPABASE_URL"] = SUPABASE;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVIZIO;
  process.env["CRON_SEGRETO"] = SEGRETO;

  const PASSWORD = "prova-route-123";
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

  const emailGiocatore = `test-route-giocatore-${Date.now()}@example.test`;
  const emailAdmin = `test-route-admin-${Date.now()}@example.test`;
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
  console.log(`permessi route su ${server.baseUrl} (database ${SUPABASE})`);

  const chiama = (percorso: string, intestazioni: Record<string, string> = {}) =>
    fetch(`${server.baseUrl}${percorso}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...intestazioni },
      body: JSON.stringify({ eventoId: "non-esiste" }),
    });

  try {
    await prova("senza token la route non risponde nemmeno se l'evento esiste", async () => {
      assert.equal((await chiama("/api/public/sollecita-presenze")).status, 401);
      assert.equal((await chiama("/api/public/apri-sondaggio")).status, 401);
    });

    await prova("un giocatore autenticato non avvisa la squadra", async () => {
      for (const percorso of ["/api/public/sollecita-presenze", "/api/public/apri-sondaggio"]) {
        const res = await chiama(percorso, { authorization: `Bearer ${tokenGiocatore}` });
        assert.equal(res.status, 403, `${percorso}: token valido ma senza ruolo`);
      }
    });

    // Controllo positivo: l'admin deve superare il controllo di accesso e arrivare alla
    // validazione dell'input. Il 404 dice esattamente questo — è passato, e l'evento
    // inventato non esiste.
    await prova("un amministratore passa e arriva alla validazione", async () => {
      for (const percorso of ["/api/public/sollecita-presenze", "/api/public/apri-sondaggio"]) {
        const res = await chiama(percorso, { authorization: `Bearer ${tokenAdmin}` });
        assert.equal(res.status, 404, `${percorso}: superato l'accesso, evento inesistente`);
      }
    });

    await prova("il promemoria palloni chiede il segreto del cron", async () => {
      const senza = await fetch(`${server.baseUrl}/api/public/promemoria-palloni`, {
        method: "POST",
      });
      assert.equal(senza.status, 401, "senza segreto non parte");

      const sbagliato = await fetch(`${server.baseUrl}/api/public/promemoria-palloni`, {
        method: "POST",
        headers: { "x-cron-segreto": "non-e-questo" },
      });
      assert.equal(sbagliato.status, 401, "un segreto sbagliato vale come nessun segreto");

      const giusto = await fetch(`${server.baseUrl}/api/public/promemoria-palloni`, {
        method: "POST",
        headers: { "x-cron-segreto": SEGRETO },
      });
      assert.equal(giusto.status, 200, "con il segreto giusto il job parte");
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
    riepilogo("permessi route");
  }
}
