/**
 * Data di nascita pubblica a tutta la squadra (M18): `bun test/integration/nascita-pubblica.test.ts`.
 *
 * Prima di questa migration `giocatori_squadra` non aveva una colonna `nascita`: la Squadra
 * mostrava "Invalid Date" per chi l'aveva inserita da solo dal Profilo, perché quel valore
 * finiva solo in `profili_giocatore.data_nascita`, tabella con RLS "solo il proprio profilo
 * o admin" — mai letta dall'anagrafica pubblica. Qui si verifica che il trigger di sync
 * (`sincronizza_nascita_pubblica`) propaghi il valore a `giocatori_squadra.nascita`, visibile
 * a **qualsiasi** giocatore (non solo l'interessato o un admin), che lo azzeri quando il
 * profilo viene cancellato, e che il client non possa scriverlo direttamente.
 *
 * Gira solo sullo stack locale (`npx supabase start`): usa lo slot `g6` della rosa seed,
 * ripristinato alla fine.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("nascita pubblica", "stack locale non attivo (npx supabase start)");
  riepilogo("nascita-pubblica");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`nascita pubblica su ${URL_BASE}`);

  const GIOCATORE = "g6";
  const PASSWORD = "prova-nascita-pubblica-123";
  const idUtenti: string[] = [];
  let tokenAdmin = "";

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

  async function leggiNascita(token: string): Promise<string | null> {
    const res = await rest(`giocatori_squadra?id=eq.${GIOCATORE}&select=nascita`, token);
    const righe = (await res.json()) as Array<{ nascita: string | null }>;
    return righe[0]?.nascita ?? null;
  }

  try {
    const emailAdmin = `test-nascita-admin-${Date.now()}@example.test`;
    const emailGiocatore = `test-nascita-giocatore-${Date.now()}@example.test`;
    const emailAltro = `test-nascita-altro-${Date.now()}@example.test`;
    const idAdmin = await creaUtente(emailAdmin);
    const idGiocatore = await creaUtente(emailGiocatore);
    const idAltro = await creaUtente(emailAltro);
    idUtenti.push(idAdmin, idGiocatore, idAltro);

    await rest("user_roles", SERVIZIO, {
      method: "POST",
      body: JSON.stringify({ user_id: idAdmin, role: "admin" }),
    });

    tokenAdmin = await accedi(emailAdmin);
    const tokenGiocatore = await accedi(emailGiocatore);
    const tokenAltro = await accedi(emailAltro);

    const collega = (utente: string | null) =>
      rest(`giocatori_squadra?id=eq.${GIOCATORE}`, tokenAdmin, {
        method: "PATCH",
        body: JSON.stringify({ auth_user_id: utente }),
      });
    await collega(idGiocatore);

    await prova(
      "il giocatore salva la propria nascita e diventa visibile a un altro giocatore",
      async () => {
        const res = await rest("profili_giocatore", tokenGiocatore, {
          method: "POST",
          body: JSON.stringify({ giocatore_id: GIOCATORE, data_nascita: "2002-06-15" }),
        });
        assert.ok(res.ok, `salvataggio profilo: ${res.status} ${await res.text()}`);

        assert.equal(await leggiNascita(tokenAltro), "2002-06-15", "visibile a un altro giocatore");
        assert.equal(await leggiNascita(tokenAdmin), "2002-06-15", "visibile all'admin");
      },
    );

    await prova("il client non può scrivere direttamente la nascita pubblica", async () => {
      await rest(`giocatori_squadra?id=eq.${GIOCATORE}`, tokenGiocatore, {
        method: "PATCH",
        body: JSON.stringify({ nascita: "1900-01-01" }),
      });
      assert.equal(
        await leggiNascita(tokenAdmin),
        "2002-06-15",
        "il valore resta quello scritto dalla sync, non quello del tentativo diretto",
      );
    });

    await prova("cancellare il profilo azzera la nascita pubblica", async () => {
      const res = await rest(`profili_giocatore?giocatore_id=eq.${GIOCATORE}`, tokenAdmin, {
        method: "DELETE",
      });
      assert.ok(res.ok, `cancellazione profilo: ${res.status} ${await res.text()}`);
      assert.equal(await leggiNascita(tokenAdmin), null, "torna NULL");
    });

    await prova("un admin può impostare la nascita per conto del giocatore", async () => {
      const res = await rest("profili_giocatore", tokenAdmin, {
        method: "POST",
        body: JSON.stringify({ giocatore_id: GIOCATORE, data_nascita: "1999-01-01" }),
      });
      assert.ok(res.ok, `salvataggio profilo da admin: ${res.status} ${await res.text()}`);
      assert.equal(await leggiNascita(tokenGiocatore), "1999-01-01");
    });
  } finally {
    // Con la service role questa DELETE fallirebbe: fa scattare il trigger di sync, che
    // tenta un UPDATE su giocatori_squadra ancora collegato, e `enforce_giocatori_squadra_update`
    // rifiuta la service role quanto un utente qualsiasi (auth.uid() NULL, nessun ramo passa).
    // Serve il JWT vero dell'admin, come per la cancellazione dentro il test.
    if (tokenAdmin) {
      await rest(`profili_giocatore?giocatore_id=eq.${GIOCATORE}`, tokenAdmin, {
        method: "DELETE",
      });
    } else {
      await rest(`profili_giocatore?giocatore_id=eq.${GIOCATORE}`, SERVIZIO, { method: "DELETE" });
    }
    if (tokenAdmin) {
      await rest(`giocatori_squadra?id=eq.${GIOCATORE}`, tokenAdmin, {
        method: "PATCH",
        body: JSON.stringify({ auth_user_id: null }),
      });
    }
    for (const id of idUtenti) {
      await rest(`user_roles?user_id=eq.${id}`, SERVIZIO, { method: "DELETE" });
      await eliminaUtente(id);
    }
    riepilogo("nascita-pubblica");
  }
}
