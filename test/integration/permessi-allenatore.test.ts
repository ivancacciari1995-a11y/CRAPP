/**
 * Permessi del ruolo allenatore (DD-034, migration M21): `bun test/integration/permessi-allenatore.test.ts`.
 *
 * Stesso impianto di `permessi.test.ts`: utenti veri, database interrogato *come loro*,
 * solo contro lo stack locale. L'allenatore è uno slot di `giocatori_squadra` con
 * `tipo = 'allenatore'`, creato dall'admin e reclamato per email al primo accesso.
 *
 * Stato toccato e ripristinato alla fine: gli utenti creati, lo slot allenatore (cancellato),
 * lo slot g3 reclamato dal giocatore di prova e le righe con il prefisso `test-allenatore`.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("permessi allenatore", "stack locale non attivo (npx supabase start)");
  riepilogo("permessi-allenatore");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`permessi allenatore su ${URL_BASE}`);

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

  const ruoliDi = async (idUtente: string): Promise<string[]> => {
    const res = await rest(`user_roles?user_id=eq.${idUtente}&select=role`, SERVIZIO);
    return ((await res.json()) as Array<{ role: string }>).map((r) => r.role);
  };

  const PASSWORD = "prova-allenatore-123";
  const PREFISSO = "test-allenatore";
  const SLOT = "g9001";
  const GIOCATORE = "g3";
  const EVENTO = `${PREFISSO}-evento`;
  const idUtenti: string[] = [];
  let tokenAdmin = "";

  try {
    const oggi = Date.now();
    const emailAllenatore = `test-allenatore-${oggi}@example.test`;
    const emailAdmin = `test-admin-all-${oggi}@example.test`;
    const emailGiocatore = `test-giocatore-all-${oggi}@example.test`;
    const idAllenatore = await creaUtente(emailAllenatore, PASSWORD);
    const idAdmin = await creaUtente(emailAdmin, PASSWORD);
    const idGiocatore = await creaUtente(emailGiocatore, PASSWORD);
    idUtenti.push(idAllenatore, idAdmin, idGiocatore);

    await rest("user_roles", SERVIZIO, {
      method: "POST",
      body: JSON.stringify({ user_id: idAdmin, role: "admin" }),
    });
    tokenAdmin = await accedi(emailAdmin, PASSWORD);
    const tokenAllenatore = await accedi(emailAllenatore, PASSWORD);
    const tokenGiocatore = await accedi(emailGiocatore, PASSWORD);

    const collegaGiocatore = await rest(`giocatori_squadra?id=eq.${GIOCATORE}`, tokenAdmin, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ auth_user_id: idGiocatore }),
    });
    assert.equal(await righeToccate(collegaGiocatore), 1, `${GIOCATORE} collegato al test`);

    await prova("l'admin registra un allenatore senza numero né ruolo", async () => {
      const res = await rest("giocatori_squadra", tokenAdmin, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: SLOT,
          nome: "Carla",
          cognome: "Neri",
          numero: null,
          ruolo: "",
          email: emailAllenatore,
          tipo: "allenatore",
        }),
      });
      assert.equal(await righeToccate(res), 1, `slot allenatore creato (${res.status})`);
    });

    await prova("un giocatore senza numero resta rifiutato", async () => {
      const res = await rest("giocatori_squadra", tokenAdmin, {
        method: "POST",
        body: JSON.stringify({ id: "g9002", nome: "X", cognome: "Y", numero: null, ruolo: "" }),
      });
      assert.ok(!res.ok, `il numero è obbligatorio per chi gioca (${res.status})`);
    });

    await prova("il collegamento per email dà il ruolo allenatore", async () => {
      assert.deepEqual(await ruoliDi(idAllenatore), [], "prima del collegamento nessun ruolo");
      const res = await rest(
        `giocatori_squadra?id=eq.${SLOT}&auth_user_id=is.null`,
        tokenAllenatore,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ auth_user_id: idAllenatore }),
        },
      );
      assert.equal(await righeToccate(res), 1, `slot reclamato (${res.status})`);
      assert.deepEqual(await ruoliDi(idAllenatore), ["allenatore"]);
    });

    await prova("l'allenatore crea, modifica ed elimina gli eventi", async () => {
      const crea = await rest("eventi_app", tokenAllenatore, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: EVENTO,
          tipo: "partita",
          titolo: "Partita di prova",
          data: "2026-01-01",
          ora: "20:00",
          luogo: "Palestra",
          convocati: [GIOCATORE],
        }),
      });
      assert.equal(await righeToccate(crea), 1, `evento creato (${crea.status})`);

      const modifica = await rest(`eventi_app?id=eq.${EVENTO}`, tokenAllenatore, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ luogo: "Altra palestra" }),
      });
      assert.equal(await righeToccate(modifica), 1, "evento modificato");

      const altro = await rest("eventi_app", tokenAllenatore, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: `${PREFISSO}-da-cancellare`,
          tipo: "allenamento",
          titolo: "Da cancellare",
          data: "2026-01-02",
          ora: "20:00",
          luogo: "",
        }),
      });
      assert.equal(await righeToccate(altro), 1);
      const cancella = await rest(`eventi_app?id=eq.${PREFISSO}-da-cancellare`, tokenAllenatore, {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      });
      assert.equal(await righeToccate(cancella), 1, "evento eliminato");
    });

    await prova("il giocatore continua a non gestire gli eventi", async () => {
      const res = await rest(`eventi_app?id=eq.${EVENTO}`, tokenGiocatore, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ luogo: "Abusivo" }),
      });
      assert.equal(await righeToccate(res), 0);
    });

    await prova("l'allenatore cambia il proprio nome e cognome", async () => {
      const res = await rest(`giocatori_squadra?id=eq.${SLOT}`, tokenAllenatore, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ nome: "Carlotta", cognome: "Neri Bianchi" }),
      });
      assert.equal(await righeToccate(res), 1, `nome aggiornato (${res.status})`);
    });

    await prova("l'allenatore non cambia il proprio tipo né gli altri campi admin", async () => {
      for (const campi of [{ tipo: "giocatore" }, { numero: 5 }, { email: "altra@example.test" }]) {
        const res = await rest(`giocatori_squadra?id=eq.${SLOT}`, tokenAllenatore, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(campi),
        });
        assert.equal(await righeToccate(res), 0, `rifiutato: ${JSON.stringify(campi)}`);
      }
      assert.deepEqual(await ruoliDi(idAllenatore), ["allenatore"], "il ruolo resta");
    });

    await prova("l'allenatore non scrive lo slot di un giocatore", async () => {
      const res = await rest(`giocatori_squadra?id=eq.${GIOCATORE}`, tokenAllenatore, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ nome: "Abusivo" }),
      });
      assert.equal(await righeToccate(res), 0);
    });

    await prova("il giocatore non cambia il proprio nome", async () => {
      const res = await rest(`giocatori_squadra?id=eq.${GIOCATORE}`, tokenGiocatore, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ nome: "Abusivo" }),
      });
      assert.equal(await righeToccate(res), 0, "per chi gioca nome e cognome restano all'admin");
    });

    await prova("l'allenatore non risponde alle presenze né dichiara cacche", async () => {
      const presenza = await rest("risposte_presenze", tokenAllenatore, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ evento_id: EVENTO, giocatore_id: SLOT, stato: "presente" }),
      });
      assert.ok(!presenza.ok, `presenza rifiutata (${presenza.status})`);

      const cacche = await rest("cacche_partita", tokenAllenatore, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ evento_id: EVENTO, giocatore_id: SLOT, quantita: 1 }),
      });
      assert.ok(!cacche.ok, `cacche rifiutate (${cacche.status})`);
    });

    await prova("l'allenatore non vota e non viene votato", async () => {
      // Evento con `convocati` vuoto: tutta la rosa, ma l'allenatore resta fuori comunque.
      await rest(`eventi_app?id=eq.${EVENTO}`, tokenAdmin, {
        method: "PATCH",
        body: JSON.stringify({ convocati: [] }),
      });
      const vota = await rest("mvp_voti", tokenAllenatore, {
        method: "POST",
        body: JSON.stringify({
          match_id: EVENTO,
          votante_id: SLOT,
          votato_id: GIOCATORE,
          votato_nome: "Tre",
        }),
      });
      assert.ok(!vota.ok, `voto dell'allenatore rifiutato (${vota.status})`);

      const votato = await rest("mvp_voti", tokenGiocatore, {
        method: "POST",
        body: JSON.stringify({
          match_id: EVENTO,
          votante_id: GIOCATORE,
          votato_id: SLOT,
          votato_nome: "Allenatore",
        }),
      });
      assert.ok(!votato.ok, `l'allenatore non si vota (${votato.status})`);
    });

    await prova("i promemoria evento arrivano anche all'allenatore non convocato", async () => {
      await rest(`eventi_app?id=eq.${EVENTO}`, tokenAdmin, {
        method: "PATCH",
        body: JSON.stringify({ convocati: [GIOCATORE] }),
      });
      const res = await rest("rpc/giocatori_destinatari_evento", SERVIZIO, {
        method: "POST",
        body: JSON.stringify({ p_evento_id: EVENTO }),
      });
      assert.equal(res.status, 200);
      const destinatari = ((await res.json()) as Array<string | Record<string, string>>).map((d) =>
        typeof d === "string" ? d : Object.values(d)[0],
      );
      assert.deepEqual([...destinatari].sort(), [GIOCATORE, SLOT].sort());
    });

    await prova("scollegare l'account toglie il ruolo", async () => {
      const res = await rest(`giocatori_squadra?id=eq.${SLOT}`, tokenAdmin, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ auth_user_id: null }),
      });
      assert.equal(await righeToccate(res), 1);
      assert.deepEqual(await ruoliDi(idAllenatore), []);
      const crea = await rest("eventi_app", tokenAllenatore, {
        method: "POST",
        body: JSON.stringify({
          id: `${PREFISSO}-dopo`,
          tipo: "allenamento",
          titolo: "Non deve esistere",
          data: "2026-01-03",
          ora: "20:00",
          luogo: "",
        }),
      });
      assert.ok(!crea.ok, `senza ruolo niente eventi (${crea.status})`);
    });
  } finally {
    await rest(`mvp_voti?match_id=like.${PREFISSO}*`, SERVIZIO, { method: "DELETE" });
    await rest(`eventi_app?id=like.${PREFISSO}*`, SERVIZIO, { method: "DELETE" });
    await rest(`giocatori_squadra?id=in.(${SLOT},g9002)`, SERVIZIO, { method: "DELETE" });
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
    riepilogo("permessi-allenatore");
  }
}
