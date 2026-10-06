/**
 * Notifica di compleanno (M31, DD-047, issue #11): `bun test/integration/notifiche-compleanno.test.ts`.
 *
 * Esegue il job vero del database (`genera_avvisi_compleanno`) simulando date diverse con il
 * parametro `p_adesso`, e verifica:
 *
 * - l'ora: prima delle 8:00 (fuso Europe/Rome, anche con l'ora legale) non parte nulla;
 * - un compleanno: auguri al festeggiato, avviso con il solo nome a tutti gli altri membri attivi
 *   (allenatore compreso), niente a chi non è attivo;
 * - più compleanni lo stesso giorno: un solo messaggio per destinatario, con i nomi in ordine
 *   alfabetico («A e B», «A, B e C»); ogni festeggiato riceve solo i propri auguri;
 * - una sola generazione per destinatario e giorno, anche se la notifica viene eliminata;
 * - il canale: push ed email in coda;
 * - il 29 febbraio: avvisato solo negli anni bisestili (limite noto, DD-047);
 * - che il job sia pianificato ogni ora.
 *
 * Gira solo sullo stack locale (`npx supabase start`). Usa gli slot `g4`, `g5`, `g6`, `g9` (inattivo) e
 * `g10` (allenatore) della rosa seed, ripristinati alla fine, e date simulate nel 2027/2028 in cui
 * nessun altro slot compie gli anni (lo verifica il test stesso).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("notifiche di compleanno", "stack locale non attivo (npx supabase start)");
  riepilogo("notifiche-compleanno");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`notifiche di compleanno su ${URL_BASE}`);

  const PASSWORD = "prova-notifiche-compleanno-123";
  const G4 = "g4";
  const G5 = "g5";
  const G6 = "g6";
  const INATTIVO = "g9";
  const ALLENATORE = "g10";
  const TIPI = "compleanno,compleanno_auguri";

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

  async function scrivi(percorso: string, metodo: string, corpo?: unknown, token = SERVIZIO) {
    const res = await rest(percorso, token, {
      method: metodo,
      body: corpo === undefined ? null : JSON.stringify(corpo),
    });
    if (!res.ok) throw new Error(`${metodo} su ${percorso}: ${res.status} ${await res.text()}`);
  }

  /** Il job, come se «adesso» fosse `quando` (istante UTC). */
  async function gira(quando: string) {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/genera_avvisi_compleanno`, {
      method: "POST",
      headers: {
        apikey: SERVIZIO,
        Authorization: `Bearer ${SERVIZIO}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_adesso: quando }),
    });
    if (!res.ok) throw new Error(`genera_avvisi_compleanno: ${res.status} ${await res.text()}`);
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

  type Slot = { id: string; nome: string; nascita: string | null; attivo: boolean };
  type Riga = { id: string; giocatore_id: string; tipo: string; titolo: string; corpo: string };

  const slot = () => leggi<Slot>("giocatori_squadra?select=id,nome,nascita,attivo&order=id");
  const notifiche = () =>
    leggi<Riga>(
      `notifiche_utente?tipo=in.(${TIPI})&select=id,giocatore_id,tipo,titolo,corpo&order=giocatore_id`,
    );
  const registro = (giorno: string) =>
    leggi<{ giocatore_id: string }>(
      `compleanni_notificati?giorno=eq.${giorno}&select=giocatore_id&order=giocatore_id`,
    );
  const impostaNascita = (id: string, nascita: string | null) =>
    scrivi(`giocatori_squadra?id=eq.${id}`, "PATCH", { nascita }, tokenAdmin);
  const svuota = async () => {
    await rest(`notifiche_utente?tipo=in.(${TIPI})`, SERVIZIO, { method: "DELETE" });
    await rest("compleanni_notificati?giorno=gte.2000-01-01", SERVIZIO, { method: "DELETE" });
  };

  /** Chi compie gli anni nel giorno `iso` secondo il database: attivo e con lo stesso giorno e mese. */
  const festeggiatiDi = async (iso: string) =>
    (await slot())
      .filter((s) => s.attivo && s.nascita?.slice(5) === iso.slice(5))
      .map((s) => s.id)
      .sort();
  const attivi = async () =>
    (await slot())
      .filter((s) => s.attivo)
      .map((s) => s.id)
      .sort();

  let tokenAdmin = "";
  const idUtenti: string[] = [];
  const originali = new Map<string, Record<string, unknown>>();

  // Orari UTC corrispondenti a 07:30 e 08:30 a Roma: l'inverno è UTC+1, l'estate UTC+2.
  const INVERNO = { prima: "T06:30:00Z", dopo: "T07:30:00Z" };
  const ESTATE = { prima: "T05:30:00Z", dopo: "T06:30:00Z" };

  try {
    const admin = await creaUtente(`test-compleanno-admin-${Date.now()}@example.test`);
    const allenatore = await creaUtente(`test-compleanno-allenatore-${Date.now()}@example.test`);
    idUtenti.push(admin.id, allenatore.id);
    await scrivi("user_roles", "POST", { user_id: admin.id, role: "admin" });
    tokenAdmin = admin.token;
    for (const id of [G4, G5, G6, INATTIVO, ALLENATORE]) {
      const [riga] = await leggi<Record<string, unknown>>(
        `giocatori_squadra?id=eq.${id}&select=nascita,tipo,attivo,auth_user_id`,
      );
      originali.set(id, riga ?? { nascita: null, tipo: "giocatore", attivo: true });
    }
    // Il trigger di `giocatori_squadra` rifiuta la service key: serve il JWT dell'admin.
    await scrivi(
      `giocatori_squadra?id=eq.${ALLENATORE}`,
      "PATCH",
      { tipo: "allenatore", auth_user_id: allenatore.id },
      tokenAdmin,
    );
    await scrivi(`giocatori_squadra?id=eq.${INATTIVO}`, "PATCH", { attivo: false }, tokenAdmin);
    // Nessuno dei cinque slot di prova parte con una nascita che possa confondere i casi.
    for (const id of [G4, G5, G6, INATTIVO]) await impostaNascita(id, null);
    await svuota();

    const tutti = await slot();
    const nome = (id: string) => tutti.find((s) => s.id === id)!.nome;
    const attiviIds = await attivi();
    assert.ok(attiviIds.includes(ALLENATORE), "l'allenatore è attivo");
    assert.ok(!attiviIds.includes(INATTIVO), "g9 è inattivo");

    // --- Un compleanno ---------------------------------------------------------------------
    // 15 marzo 2027, orario invernale: 07:30 a Roma è prima, 08:30 è dopo.
    const GIORNO1 = "2027-03-15";
    await impostaNascita(G4, "1995-03-15");

    await prova("prima delle 8:00 a Roma non parte nulla, il registro resta vuoto", async () => {
      assert.deepEqual(await festeggiatiDi(GIORNO1), [G4], "solo g4 compie gli anni quel giorno");
      await gira(`${GIORNO1}${INVERNO.prima}`);
      assert.equal((await notifiche()).length, 0);
      assert.equal((await registro(GIORNO1)).length, 0);
    });

    await prova(
      "dalle 8:00: auguri al festeggiato, avviso con il solo nome a tutti gli altri",
      async () => {
        await gira(`${GIORNO1}${INVERNO.dopo}`);
        const righe = await notifiche();
        const mie = righe.filter((r) => r.giocatore_id === G4);
        assert.equal(mie.length, 1);
        assert.equal(mie[0]!.tipo, "compleanno_auguri");
        assert.equal(mie[0]!.titolo, `Buon compleanno, ${nome(G4)}! 🎂`);
        assert.equal(mie[0]!.corpo, "", "solo il titolo");

        const altri = righe.filter((r) => r.giocatore_id !== G4);
        assert.deepEqual(
          altri.map((r) => r.giocatore_id).sort(),
          attiviIds.filter((id) => id !== G4),
          "tutti gli altri membri attivi, allenatore compreso, e nessun inattivo",
        );
        for (const r of altri) {
          assert.equal(r.tipo, "compleanno");
          assert.equal(r.titolo, `Oggi è il compleanno di ${nome(G4)}`);
          assert.equal(r.corpo, "", "solo il titolo, niente età");
        }
        assert.equal(righe.length, attiviIds.length, "una notifica a testa");
        assert.deepEqual(
          (await registro(GIORNO1)).map((r) => r.giocatore_id),
          attiviIds,
        );
      },
    );

    await prova("l'allenatore riceve l'avviso, l'inattivo niente", async () => {
      const righe = await notifiche();
      assert.equal(righe.filter((r) => r.giocatore_id === ALLENATORE).length, 1);
      assert.equal(righe.filter((r) => r.giocatore_id === INATTIVO).length, 0);
    });

    await prova("push ed email vanno in coda per ogni notifica", async () => {
      const ids = (await notifiche()).map((r) => r.id);
      const mail = await leggi<{ notifica_id: string }>(
        `notifiche_email_coda?notifica_id=in.(${ids.join(",")})&select=notifica_id`,
      );
      const push = await leggi<{ notifica_id: string }>(
        `notifiche_push_coda?notifica_id=in.(${ids.join(",")})&select=notifica_id`,
      );
      assert.equal(mail.length, ids.length, "una mail per notifica");
      assert.equal(push.length, ids.length, "una push per notifica");
    });

    await prova("un secondo giro lo stesso giorno non genera doppioni", async () => {
      await gira(`${GIORNO1}T09:30:00Z`);
      assert.equal((await notifiche()).length, attiviIds.length);
    });

    await prova("eliminare la notifica non la fa tornare", async () => {
      const [prima] = await notifiche();
      await scrivi(`notifiche_utente?id=eq.${prima!.id}`, "DELETE");
      await gira(`${GIORNO1}T10:30:00Z`);
      assert.equal((await notifiche()).length, attiviIds.length - 1);
    });

    await prova("un giorno senza compleanni non genera nulla, né registro", async () => {
      await svuota();
      const giorno = "2027-03-20";
      assert.deepEqual(await festeggiatiDi(giorno), [], "nessuno compie gli anni il 20 marzo");
      await gira(`${giorno}${INVERNO.dopo}`);
      assert.equal((await notifiche()).length, 0);
      assert.equal((await registro(giorno)).length, 0);
    });

    // --- Ora legale ------------------------------------------------------------------------
    await prova("con l'ora legale le 8:00 di Roma sono le 6:00 UTC", async () => {
      await svuota();
      const giorno = "2027-07-15";
      await impostaNascita(G4, "1995-07-15");
      assert.deepEqual(await festeggiatiDi(giorno), [G4]);
      await gira(`${giorno}${ESTATE.prima}`); // 07:30 a Roma
      assert.equal((await notifiche()).length, 0, "alle 7:30 a Roma non parte ancora");
      await gira(`${giorno}${ESTATE.dopo}`); // 08:30 a Roma
      assert.equal((await notifiche()).length, attiviIds.length);
    });

    // --- Più compleanni lo stesso giorno ---------------------------------------------------
    await prova(
      "due compleanni: un solo messaggio a testa, nomi in ordine alfabetico",
      async () => {
        await svuota();
        const giorno = "2027-03-16";
        await impostaNascita(G4, "1995-03-16");
        await impostaNascita(G5, "1990-03-16");
        assert.deepEqual(await festeggiatiDi(giorno), [G4, G5]);
        await gira(`${giorno}${INVERNO.dopo}`);

        const righe = await notifiche();
        assert.equal(righe.length, attiviIds.length, "un solo messaggio per destinatario");
        const nomi = [nome(G4), nome(G5)].sort((a, b) => a.localeCompare(b, "it"));
        for (const id of [G4, G5]) {
          const r = righe.find((x) => x.giocatore_id === id)!;
          assert.equal(r.tipo, "compleanno_auguri");
          assert.equal(r.titolo, `Buon compleanno, ${nome(id)}! 🎂`);
          assert.equal(r.corpo, "", "solo il titolo");
          assert.ok(!r.titolo.includes(nome(id === G4 ? G5 : G4)), "niente nomi degli altri");
        }
        const altri = righe.filter((r) => ![G4, G5].includes(r.giocatore_id));
        assert.equal(altri.length, attiviIds.length - 2);
        for (const r of altri) {
          assert.equal(r.tipo, "compleanno");
          assert.equal(r.titolo, `Oggi è il compleanno di ${nomi[0]} e ${nomi[1]}`);
          assert.equal(r.corpo, "", "solo il titolo");
        }
      },
    );

    await prova("tre compleanni: «A, B e C»", async () => {
      await svuota();
      const giorno = "2027-03-17";
      await impostaNascita(G4, "1995-03-17");
      await impostaNascita(G5, "1990-03-17");
      await impostaNascita(G6, "2000-03-17");
      assert.deepEqual(await festeggiatiDi(giorno), [G4, G5, G6]);
      await gira(`${giorno}${INVERNO.dopo}`);
      const nomi = [nome(G4), nome(G5), nome(G6)].sort((a, b) => a.localeCompare(b, "it"));
      const altro = (await notifiche()).find((r) => ![G4, G5, G6].includes(r.giocatore_id))!;
      assert.equal(altro.titolo, `Oggi è il compleanno di ${nomi[0]}, ${nomi[1]} e ${nomi[2]}`);
      assert.equal(altro.corpo, "", "solo il titolo");
    });

    await prova("un festeggiato inattivo non conta: né avviso né auguri", async () => {
      await svuota();
      const giorno = "2027-03-18";
      for (const id of [G4, G5, G6]) await impostaNascita(id, null);
      await impostaNascita(INATTIVO, "2003-03-18");
      assert.deepEqual(await festeggiatiDi(giorno), [], "g9 è inattivo");
      await gira(`${giorno}${INVERNO.dopo}`);
      assert.equal((await notifiche()).length, 0);
    });

    // --- 29 febbraio: limite noto (DD-047) -------------------------------------------------
    await prova("chi è nato il 29 febbraio è avvisato solo negli anni bisestili", async () => {
      await svuota();
      await impostaNascita(INATTIVO, null);
      await impostaNascita(G4, "2000-02-29");
      // 2027 non è bisestile: né il 28 febbraio né il 1° marzo.
      await gira(`2027-02-28${INVERNO.dopo}`);
      await gira(`2027-03-01${INVERNO.dopo}`);
      assert.equal((await notifiche()).length, 0, "negli anni normali non parte nulla");
      // 2028 è bisestile: il 29 febbraio sì.
      assert.deepEqual(await festeggiatiDi("2028-02-29"), [G4]);
      await gira(`2028-02-29${INVERNO.dopo}`);
      const righe = await notifiche();
      assert.equal(righe.length, attiviIds.length);
      assert.equal(righe.find((r) => r.giocatore_id === G4)!.tipo, "compleanno_auguri");
    });

    // --- Pianificazione --------------------------------------------------------------------
    await prova("il job è pianificato ogni ora", async () => {
      const contenitore = spawnSync(
        "docker",
        ["ps", "--filter", "name=supabase_db", "--format", "{{.Names}}"],
        { encoding: "utf8" },
      )
        .stdout.trim()
        .split("\n")[0];
      assert.ok(contenitore, "container del database locale non trovato");
      const esito = spawnSync(
        "docker",
        [
          "exec",
          contenitore,
          "psql",
          "-U",
          "postgres",
          "-At",
          "-c",
          "select schedule from cron.job where jobname = 'avvisi-compleanno'",
        ],
        { encoding: "utf8" },
      );
      assert.equal(esito.status, 0, esito.stderr);
      assert.equal(esito.stdout.trim(), "0 * * * *");
    });

    await prova("il job non è chiamabile dai client", async () => {
      for (const token of [ANON, admin.token]) {
        const res = await fetch(`${URL_BASE}/rest/v1/rpc/genera_avvisi_compleanno`, {
          method: "POST",
          headers: {
            apikey: ANON,
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: "{}",
        });
        assert.ok(!res.ok, `risposta ${res.status}: un client non deve poterlo eseguire`);
      }
    });
  } finally {
    await svuota();
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
    riepilogo("notifiche-compleanno");
  }
}
