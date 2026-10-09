/**
 * Avviso «Presenza modificata» (M32 e M33, DD-050): `bun test/integration/presenza-modificata.test.ts`.
 *
 * Scrive su `risposte_presenze` come farebbe l'app e verifica, sul database vero:
 *
 * - una risposta nuova, modificata o ritirata a meno di 6 ore da una partita o da un allenamento
 *   avvisa gli admin e gli allenatori attivi, con titolo e corpo del catalogo;
 * - riceve l'avviso chi ha il ruolo admin o allenatore con uno slot attivo (M33); non riceve nulla un giocatore semplice, e non riceve
 *   nulla l'admin a cui appartiene la presenza;
 * - nessun avviso se lo stato non cambia, se l'evento è oltre le 6 ore, già iniziato, o di un tipo che
 *   non è partita né allenamento, né quando una risposta sparisce perché l'evento è stato cancellato;
 * - ogni modifica è una notifica a sé (nessun raggruppamento) e ha la coda email e la coda push.
 *
 * Gira solo sullo stack locale (`npx supabase start`). Usa gli slot `g4` (chi risponde), `g5` (admin),
 * `g6` (giocatore), `g9` (allenatore inattivo) e `g10` (allenatore) della rosa seed, ripristinati alla fine.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("presenza modificata", "stack locale non attivo (npx supabase start)");
  riepilogo("presenza-modificata");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`presenza modificata su ${URL_BASE}`);

  const PASSWORD = "prova-presenza-modificata-123";
  const RISPONDE = "g4";
  const ADMIN = "g5";
  const GIOCATORE = "g6";
  const ALLENATORE = "g10";
  const INATTIVO = "g9";
  const PREFISSO = "test-presenza-mod-";

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

  /** Data (AAAA-MM-GG) e ora (HH:MM) a Roma, tra `ore` ore da adesso. */
  function traOre(ore: number): { data: string; ora: string } {
    const parti: Record<string, string> = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Rome",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(Date.now() + ore * 3_600_000))
        .map((p) => [p.type, p.value]),
    );
    return {
      data: `${parti["year"]}-${parti["month"]}-${parti["day"]}`,
      ora: `${parti["hour"]}:${parti["minute"]}`,
    };
  }

  type Riga = { id: string; giocatore_id: string; titolo: string; corpo: string };

  const notifiche = () =>
    leggi<Riga>(
      "notifiche_utente?tipo=eq.presenza_modificata&select=id,giocatore_id,titolo,corpo&order=creato_il",
    );
  const svuota = async () => {
    await rest("notifiche_utente?tipo=eq.presenza_modificata", SERVIZIO, { method: "DELETE" });
  };
  const risposta = (evento: string, stato: string) =>
    scrivi("risposte_presenze?on_conflict=evento_id,giocatore_id", "POST", {
      evento_id: evento,
      giocatore_id: RISPONDE,
      stato,
    });
  const aggiorna = (evento: string, stato: string, giocatore = RISPONDE) =>
    scrivi(`risposte_presenze?evento_id=eq.${evento}&giocatore_id=eq.${giocatore}`, "PATCH", {
      stato,
    });
  const ritira = (evento: string) =>
    scrivi(`risposte_presenze?evento_id=eq.${evento}&giocatore_id=eq.${RISPONDE}`, "DELETE");
  async function creaEvento(id: string, tipo: string, ore: number, titolo = `Prova ${id}`) {
    const { data, ora } = traOre(ore);
    await scrivi("eventi_app", "POST", { id, tipo, titolo, data, ora });
    return { data, ora, titolo };
  }

  let tokenAdmin = "";
  const idUtenti: string[] = [];
  const idEventi: string[] = [];
  const originali = new Map<string, Record<string, unknown>>();

  try {
    const admin = await creaUtente(`${PREFISSO}admin-${Date.now()}@example.test`);
    const allenatore = await creaUtente(`${PREFISSO}allenatore-${Date.now()}@example.test`);
    const inattivo = await creaUtente(`${PREFISSO}inattivo-${Date.now()}@example.test`);
    const senzaSlot = await creaUtente(`${PREFISSO}senza-slot-${Date.now()}@example.test`);
    idUtenti.push(admin.id, allenatore.id, inattivo.id, senzaSlot.id);
    await scrivi("user_roles", "POST", { user_id: admin.id, role: "admin" });
    tokenAdmin = admin.token;
    for (const id of [RISPONDE, ADMIN, GIOCATORE, ALLENATORE, INATTIVO]) {
      const [riga] = await leggi<Record<string, unknown>>(
        `giocatori_squadra?id=eq.${id}&select=tipo,attivo,auth_user_id`,
      );
      originali.set(id, riga ?? { tipo: "giocatore", attivo: true, auth_user_id: null });
    }
    // Il trigger di `giocatori_squadra` rifiuta la service key: serve il JWT dell'admin.
    await scrivi(
      `giocatori_squadra?id=eq.${ADMIN}`,
      "PATCH",
      { auth_user_id: admin.id },
      tokenAdmin,
    );
    await scrivi(
      `giocatori_squadra?id=eq.${ALLENATORE}`,
      "PATCH",
      { tipo: "allenatore", auth_user_id: allenatore.id },
      tokenAdmin,
    );
    // Un allenatore con slot disattivato, un admin senza nessuno slot e un admin che ha anche il
    // ruolo allenatore: nessuno dei primi due può ricevere, il terzo riceve una sola notifica.
    await scrivi(
      `giocatori_squadra?id=eq.${INATTIVO}`,
      "PATCH",
      { tipo: "allenatore", auth_user_id: inattivo.id, attivo: false },
      tokenAdmin,
    );
    await scrivi("user_roles", "POST", { user_id: senzaSlot.id, role: "admin" });
    await scrivi("user_roles", "POST", { user_id: admin.id, role: "allenatore" });
    await svuota();

    const [chi] = await leggi<{ nome: string; cognome: string }>(
      `giocatori_squadra?id=eq.${RISPONDE}&select=nome,cognome`,
    );
    const nomeCompleto = `${chi!.nome} ${chi!.cognome}`.trim();

    // Il seed può avere altri admin con uno slot attivo: l'elenco atteso lo calcola il test.
    const attesi = async () => {
      const ruoli = await leggi<{ user_id: string }>(
        "user_roles?role=in.(admin,allenatore)&select=user_id",
      );
      const slot = await leggi<{ id: string; auth_user_id: string }>(
        "giocatori_squadra?attivo=eq.true&auth_user_id=not.is.null&select=id,auth_user_id",
      );
      const idAdmin = new Set(ruoli.map((r) => r.user_id));
      return slot
        .filter((s) => idAdmin.has(s.auth_user_id) && s.id !== RISPONDE)
        .map((s) => s.id)
        .sort();
    };

    // --- Partita a 3 ore ---------------------------------------------------------------------
    const ev = await creaEvento(`${PREFISSO}partita`, "partita", 3, "Partita di prova");
    idEventi.push(`${PREFISSO}partita`);
    const dataIt = `${ev.data.slice(8, 10)}/${ev.data.slice(5, 7)}/${ev.data.slice(0, 4)}`;

    await prova(
      "risposta nuova: avvisa admin e allenatori, con il testo del catalogo",
      async () => {
        await risposta(`${PREFISSO}partita`, "presente");
        const righe = await notifiche();
        assert.deepEqual(righe.map((r) => r.giocatore_id).sort(), await attesi());
        assert.ok(
          righe.some((r) => r.giocatore_id === ADMIN),
          "l'admin di prova è tra i destinatari",
        );
        const mia = righe.find((r) => r.giocatore_id === ADMIN)!;
        assert.equal(mia.titolo, `Presenza modificata: ${nomeCompleto}`);
        assert.equal(
          mia.corpo,
          [
            `Evento: ${ev.titolo}`,
            `Data: ${dataIt}, ore ${ev.ora}`,
            "Da: nessuna risposta",
            "A: presente",
          ].join("\n"),
        );
      },
    );

    await prova("il giocatore semplice non riceve nulla, l'allenatore sì", async () => {
      const destinatari = (await notifiche()).map((r) => r.giocatore_id);
      assert.ok(!destinatari.includes(GIOCATORE));
      assert.ok(destinatari.includes(ALLENATORE), "l'allenatore attivo è tra i destinatari");
      assert.ok(!destinatari.includes(RISPONDE), "chi risponde non avvisa se stesso");
    });

    await prova("la riga ha la coda email e la coda push", async () => {
      const [mia] = (await notifiche()).filter((r) => r.giocatore_id === ADMIN);
      const email = await leggi<{ notifica_id: string }>(
        `notifiche_email_coda?notifica_id=eq.${mia!.id}&select=notifica_id`,
      );
      assert.equal(email.length, 1, "email in coda");
      const push = await leggi<{ notifica_id: string }>(
        `notifiche_push_coda?notifica_id=eq.${mia!.id}&select=notifica_id`,
      );
      assert.equal(push.length, 1, "push in coda");
    });

    await prova("modifica: ogni cambio è una notifica a sé, con Da e A giusti", async () => {
      const prima = (await notifiche()).length;
      await aggiorna(`${PREFISSO}partita`, "ritardo");
      const righe = await notifiche();
      assert.equal(righe.length, prima + (await attesi()).length);
      const ultima = righe.filter((r) => r.giocatore_id === ADMIN).at(-1)!;
      assert.match(ultima.corpo, /\nDa: presente\nA: in ritardo$/);
    });

    await prova("stesso stato di prima: nessun avviso", async () => {
      const prima = (await notifiche()).length;
      await aggiorna(`${PREFISSO}partita`, "ritardo");
      assert.equal((await notifiche()).length, prima);
    });

    await prova("ritiro della risposta: «nessuna risposta» come stato finale", async () => {
      await ritira(`${PREFISSO}partita`);
      const ultima = (await notifiche()).filter((r) => r.giocatore_id === ADMIN).at(-1)!;
      assert.match(ultima.corpo, /\nDa: in ritardo\nA: nessuna risposta$/);
    });

    await prova("la presenza dell'admin non avvisa l'admin stesso", async () => {
      await svuota();
      await scrivi("risposte_presenze", "POST", {
        evento_id: `${PREFISSO}partita`,
        giocatore_id: ADMIN,
        stato: "assente",
      });
      const destinatari = (await notifiche()).map((r) => r.giocatore_id);
      assert.ok(!destinatari.includes(ADMIN));
      await scrivi(
        `risposte_presenze?evento_id=eq.${PREFISSO}partita&giocatore_id=eq.${ADMIN}`,
        "DELETE",
      );
    });

    // --- Casi in cui non deve partire nulla --------------------------------------------------
    await prova("allenamento a 5 ore: avvisa", async () => {
      await svuota();
      await creaEvento(`${PREFISSO}allenamento`, "allenamento", 5);
      idEventi.push(`${PREFISSO}allenamento`);
      await risposta(`${PREFISSO}allenamento`, "assente");
      assert.equal((await notifiche()).length, (await attesi()).length);
    });

    for (const [nome, tipo, ore] of [
      ["oltre le 6 ore", "partita", 7],
      ["già iniziato", "partita", -1],
      ["un tipo che non è partita né allenamento", "evento", 3],
    ] as const) {
      await prova(`nessun avviso: ${nome}`, async () => {
        await svuota();
        const id = `${PREFISSO}no-${idEventi.length}`;
        await creaEvento(id, tipo, ore);
        idEventi.push(id);
        await risposta(id, "presente");
        assert.equal((await notifiche()).length, 0);
      });
    }

    await prova("cancellare l'evento elimina le risposte senza avvisare nessuno", async () => {
      await svuota();
      const id = `${PREFISSO}cancellato`;
      await creaEvento(id, "partita", 2);
      idEventi.push(id);
      await risposta(id, "presente");
      await svuota();
      await scrivi(`eventi_app?id=eq.${id}`, "DELETE");
      assert.equal((await notifiche()).length, 0);
    });

    await prova(
      "destinatari: né inattivi né senza slot, e una sola notifica a chi ha due ruoli",
      async () => {
        await svuota();
        const id = `${PREFISSO}destinatari`;
        await creaEvento(id, "partita", 4);
        idEventi.push(id);
        await risposta(id, "presente");
        const destinatari = (await notifiche()).map((r) => r.giocatore_id);
        assert.ok(!destinatari.includes(INATTIVO), "slot disattivato");
        assert.deepEqual([...destinatari].sort(), await attesi());
        assert.equal(
          destinatari.filter((d) => d === ADMIN).length,
          1,
          "chi ha sia il ruolo admin sia allenatore riceve una sola notifica",
        );
      },
    );

    await prova(
      "cambio di un giocatore: avvisati admin e allenatore, mai il giocatore stesso",
      async () => {
        await svuota();
        const id = `${PREFISSO}per-conto`;
        await creaEvento(id, "partita", 2);
        idEventi.push(id);
        await risposta(id, "presente");
        await aggiorna(id, "assente");
        const destinatari = new Set((await notifiche()).map((r) => r.giocatore_id));
        assert.ok(destinatari.has(ALLENATORE) && destinatari.has(ADMIN));
        assert.ok(!destinatari.has(RISPONDE));
      },
    );

    await prova("tutti gli stati hanno il loro nome nel testo", async () => {
      await svuota();
      const id = `${PREFISSO}stati`;
      await creaEvento(id, "allenamento", 1);
      idEventi.push(id);
      const sequenza = ["presente", "assente", "forse", "ritardo", "infortunato"];
      await risposta(id, sequenza[0]!);
      for (const stato of sequenza.slice(1)) await aggiorna(id, stato);
      const corpi = (await notifiche())
        .filter((r) => r.giocatore_id === ADMIN)
        .map((r) => r.corpo.split("\n").slice(2).join("|"));
      assert.deepEqual(corpi, [
        "Da: nessuna risposta|A: presente",
        "Da: presente|A: assente",
        "Da: assente|A: forse",
        "Da: forse|A: in ritardo",
        "Da: in ritardo|A: infortunato",
      ]);
    });

    // Confini della finestra: la soglia è di 6 ore esatte (da 0 a 6).
    for (const [nome, ore, avvisa] of [
      ["a 5 ore e 50 minuti", 5 + 50 / 60, true],
      ["a 6 ore e 10 minuti", 6 + 10 / 60, false],
      ["a 10 minuti", 10 / 60, true],
      ["iniziato da 10 minuti", -10 / 60, false],
    ] as const) {
      await prova(`finestra: evento ${nome} ${avvisa ? "avvisa" : "non avvisa"}`, async () => {
        await svuota();
        const id = `${PREFISSO}soglia-${idEventi.length}`;
        await creaEvento(id, "partita", ore);
        idEventi.push(id);
        await risposta(id, "presente");
        assert.equal((await notifiche()).length > 0, avvisa);
      });
    }

    await prova("ora dell'evento illeggibile: nessun avviso e nessun errore", async () => {
      await svuota();
      const id = `${PREFISSO}ora-illeggibile`;
      const { data } = traOre(3);
      await scrivi("eventi_app", "POST", {
        id,
        tipo: "partita",
        titolo: "Ora strana",
        data,
        ora: "boh",
      });
      idEventi.push(id);
      await risposta(id, "presente");
      assert.equal((await notifiche()).length, 0);
    });

    await prova("la funzione non è chiamabile dai client", async () => {
      for (const token of [ANON, admin.token]) {
        const res = await fetch(`${URL_BASE}/rest/v1/rpc/avvisa_presenza_modificata`, {
          method: "POST",
          headers: {
            apikey: ANON,
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: "{}",
        });
        assert.ok(!res.ok, `risposta ${res.status}: un client non deve poterla eseguire`);
      }
    });
  } finally {
    await svuota();
    for (const id of idEventi) {
      await rest(`risposte_presenze?evento_id=eq.${id}`, SERVIZIO, { method: "DELETE" });
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
    riepilogo("presenza-modificata");
  }
}
