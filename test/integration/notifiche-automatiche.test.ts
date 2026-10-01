/**
 * Notifiche automatiche di turno palloni e sollecito presenze (M26, DD-040):
 * `bun test/integration/notifiche-automatiche.test.ts`.
 *
 * Esegue i job veri del database (`genera_avvisi_palloni`, `genera_solleciti_presenze`) su eventi
 * creati con orari relativi a «adesso» e verifica:
 *
 * - che il promemoria a 24 e 3 ore non sia più pianificato (M28, DD-043);
 * - le finestre (palloni: un solo avviso nelle 3 ore prima; solleciti: un solo avviso nelle 24 ore prima, DD-045);
 * - i destinatari (incaricato e turno precedente; convocati senza risposta o con «forse»; mai
 *   l'allenatore né chi non è più attivo);
 * - una sola generazione per giocatore, evento e tipo, anche se la notifica viene eliminata;
 * - la revoca dell'incarico, una sola volta, guardando il registro e non le notifiche;
 * - il canale: push in coda, nessuna email per i palloni, email per i solleciti;
 * - che il testo generato in SQL sia identico a quello del codice TypeScript (`avvisiPalloniEvento`,
 *   `testoSollecito`) e che «evento precedente/successivo» seguano lo stesso ordine di
 *   `palloni-core.ts`.
 *
 * Gira solo sullo stack locale (`npx supabase start`). Usa eventi con il prefisso
 * `test-notifiche-automatiche` e gli slot `g4`, `g5`, `g7`, `g8`, `g9` (inattivo) e `g10`
 * (allenatore) della rosa seed, ripristinati alla fine.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import type { Evento } from "@/lib/eventi";
import { avvisiPalloniEvento, eventoPrecedente, eventoSuccessivo } from "@/lib/palloni-core";
import { destinatariSollecito, testoSollecito } from "@/lib/presenze";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("notifiche automatiche", "stack locale non attivo (npx supabase start)");
  riepilogo("notifiche-automatiche");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`notifiche automatiche su ${URL_BASE}`);

  const PREFISSO = "test-notifiche-automatiche";
  const PASSWORD = "prova-notifiche-automatiche-123";
  const G4 = "g4";
  const G5 = "g5";
  const G6 = "g6";
  const G7 = "g7";
  const G8 = "g8";
  const INATTIVO = "g9";
  const ALLENATORE = "g10";

  // Palloni: in ordine cronologico PASSATO < PREC < MAIN < SECONDO < TERZO < FUORI4 < FUORI9 < LONTANO.
  const PASSATO = `${PREFISSO}-passato`;
  const PREC = `${PREFISSO}-prec`;
  const MAIN = `${PREFISSO}-main`;
  const SECONDO = `${PREFISSO}-secondo`;
  const TERZO = `${PREFISSO}-terzo`;
  const FUORI4 = `${PREFISSO}-fuori4`;
  const FUORI9 = `${PREFISSO}-fuori9`;
  const LONTANO = `${PREFISSO}-lontano`;
  const GENERICO = `${PREFISSO}-generico`;
  const COPPIA_A = `${PREFISSO}-coppia-a`;
  const COPPIA_B = `${PREFISSO}-coppia-b`;
  const ORA_ROTTA = `${PREFISSO}-ora-rotta`;
  // Solleciti: eventi extra-campo, così non entrano nell'ordine dei palloni.
  const S24 = `${PREFISSO}-s24`;
  const S12 = `${PREFISSO}-s12`;
  const S6 = `${PREFISSO}-s6`;
  const S_TARDI = `${PREFISSO}-s-tardi`;
  const S_FORSE = `${PREFISSO}-s-forse`;
  const S_FUORI = `${PREFISSO}-s-fuori`;
  const TUTTI = [
    PASSATO,
    PREC,
    MAIN,
    SECONDO,
    TERZO,
    FUORI4,
    FUORI9,
    LONTANO,
    GENERICO,
    COPPIA_A,
    COPPIA_B,
    ORA_ROTTA,
    S24,
    S12,
    S6,
    S_TARDI,
    S_FORSE,
    S_FUORI,
  ];

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

  async function rpc(nome: string, corpo: unknown = {}, token = SERVIZIO) {
    return fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
      method: "POST",
      headers: {
        apikey: token === SERVIZIO ? SERVIZIO : ANON,
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(corpo),
    });
  }

  async function esegui(nome: string, corpo: unknown = {}) {
    const res = await rpc(nome, corpo);
    if (!res.ok) throw new Error(`${nome}: ${res.status} ${await res.text()}`);
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

  /** Data e ora dell'inizio tra `ore` ore, nel fuso Europe/Rome (convenzione di `eventi_app`). */
  function tra(ore: number): { data: string; ora: string } {
    const quando = new Date(Date.now() + ore * 60 * 60 * 1000);
    const data = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(quando);
    const ora = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(quando);
    return { data, ora };
  }
  const gg = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

  type Riga = { id: string; giocatore_id: string; tipo: string; titolo: string; corpo: string };
  const notifiche = (evento: string, tipo?: string) =>
    leggi<Riga>(
      `notifiche_utente?evento_id=eq.${evento}${tipo ? `&tipo=eq.${tipo}` : ""}` +
        `&select=id,giocatore_id,tipo,titolo,corpo&order=giocatore_id,tipo`,
    );
  const destinatari = async (evento: string, tipo: string) =>
    (await notifiche(evento, tipo)).map((r) => r.giocatore_id).sort();
  const registro = (evento: string, tipo?: string) =>
    leggi<{ giocatore_id: string; tipo: string }>(
      `promemoria_eventi_generati?evento_id=eq.${evento}${tipo ? `&tipo=eq.${tipo}` : ""}` +
        `&select=giocatore_id,tipo&order=giocatore_id`,
    );
  const inCodaEmail = async (ids: string[]) =>
    ids.length === 0
      ? []
      : leggi<{ notifica_id: string }>(
          `notifiche_email_coda?notifica_id=in.(${ids.join(",")})&select=notifica_id`,
        );
  const inCodaPush = async (ids: string[]) =>
    ids.length === 0
      ? []
      : leggi<{ notifica_id: string; stato: string }>(
          `notifiche_push_coda?notifica_id=in.(${ids.join(",")})&select=notifica_id,stato`,
        );

  type RigaEvento = {
    id: string;
    tipo: Evento["tipo"];
    titolo: string;
    luogo: string;
    data: string;
    ora: string;
    convocati: string[];
  };
  /** Gli eventi del database come li vedrebbe il codice dell'app (solo i campi che servono). */
  const eventiDelDatabase = async (): Promise<Evento[]> =>
    (await leggi<RigaEvento>("eventi_app?select=id,tipo,titolo,luogo,data,ora,convocati")).map(
      (e) => ({ ...e, note: "", campionato: false, casa: true, pagelleChiuse: false }),
    );
  const turniDelDatabase = async (): Promise<Record<string, string>> =>
    Object.fromEntries(
      (await leggi<{ evento_id: string; giocatore_id: string }>("turni_palloni?select=*")).map(
        (t) => [t.evento_id, t.giocatore_id],
      ),
    );

  const creaEvento = (
    id: string,
    tipo: string,
    quando: { data: string; ora: string },
    extra: Record<string, unknown> = {},
  ) =>
    scrivi("eventi_app", "POST", {
      id,
      tipo,
      titolo: `${PREFISSO} ${id.slice(PREFISSO.length + 1)}`,
      luogo: "PalaCRAP",
      ...quando,
      convocati: [],
      ...extra,
    });
  const spostaEvento = (id: string, ore: number) =>
    scrivi(`eventi_app?id=eq.${id}`, "PATCH", tra(ore));
  const assegna = (evento: string, giocatore: string) =>
    scrivi("turni_palloni", "POST", { evento_id: evento, giocatore_id: giocatore });
  const cambiaTurno = (evento: string, giocatore: string) =>
    scrivi(`turni_palloni?evento_id=eq.${evento}`, "PATCH", { giocatore_id: giocatore });
  const rispondi = (evento: string, giocatore: string, stato: string) =>
    scrivi("risposte_presenze?on_conflict=evento_id,giocatore_id", "POST", {
      evento_id: evento,
      giocatore_id: giocatore,
      stato,
    }).catch(async () =>
      scrivi(`risposte_presenze?evento_id=eq.${evento}&giocatore_id=eq.${giocatore}`, "PATCH", {
        stato,
      }),
    );

  const idUtenti: string[] = [];
  let tokenAdmin = "";
  const originali = new Map<string, Record<string, unknown>>();

  try {
    // --- Preparazione: un admin per toccare gli slot, un allenatore e un giocatore inattivo ---
    const admin = await creaUtente(`${PREFISSO}-admin-${Date.now()}@example.test`);
    const allenatore = await creaUtente(`${PREFISSO}-allenatore-${Date.now()}@example.test`);
    idUtenti.push(admin.id, allenatore.id);
    await scrivi("user_roles", "POST", { user_id: admin.id, role: "admin" });
    tokenAdmin = admin.token;
    for (const id of [ALLENATORE, INATTIVO]) {
      const [riga] = await leggi<Record<string, unknown>>(
        `giocatori_squadra?id=eq.${id}&select=tipo,attivo,auth_user_id`,
      );
      originali.set(id, riga ?? { tipo: "giocatore", attivo: true, auth_user_id: null });
    }
    // Il trigger di `giocatori_squadra` rifiuta la service key: serve il JWT dell'admin.
    await scrivi(
      `giocatori_squadra?id=eq.${ALLENATORE}`,
      "PATCH",
      { tipo: "allenatore", auth_user_id: allenatore.id },
      tokenAdmin,
    );
    await scrivi(`giocatori_squadra?id=eq.${INATTIVO}`, "PATCH", { attivo: false }, tokenAdmin);

    // Palloni (DD-042): un solo avviso, nelle 3 ore prima. MAIN, SECONDO e TERZO sono dentro la
    // finestra; FUORI4 e FUORI9 hanno un incaricato ma sono ancora fuori (tra 4,5 e 9 ore).
    // Le ore scelte stanno a più di mezz'ora dai confini della finestra.
    await creaEvento(PASSATO, "partita", tra(-60));
    await creaEvento(PREC, "allenamento", tra(-30));
    await creaEvento(MAIN, "allenamento", tra(0.8));
    await creaEvento(SECONDO, "partita", tra(1.5));
    await creaEvento(TERZO, "allenamento", tra(2.2));
    await creaEvento(FUORI4, "allenamento", tra(4.5));
    await creaEvento(FUORI9, "allenamento", tra(9));
    await creaEvento(LONTANO, "allenamento", tra(40));
    await creaEvento(GENERICO, "evento", tra(1.9));
    await assegna(PREC, G5);
    await assegna(MAIN, G4);
    await assegna(SECONDO, G7);
    await assegna(TERZO, G8);
    await assegna(FUORI4, G7);
    await assegna(FUORI9, G8);
    await assegna(GENERICO, G4); // extra-campo: il turno non conta

    // --- Turno palloni: finestre e destinatari ---------------------------------------------
    await prova(
      "un solo avviso, 3 ore prima, a chi porta i palloni e a chi li prende",
      async () => {
        await esegui("genera_avvisi_palloni");
        assert.deepEqual(await destinatari(MAIN, "turno_palloni_3h"), [G4, G5]);
        assert.deepEqual(await destinatari(SECONDO, "turno_palloni_3h"), [G4, G7]);
        assert.deepEqual(await destinatari(TERZO, "turno_palloni_3h"), [G7, G8]);
        for (const evento of [MAIN, SECONDO, TERZO]) {
          for (const tipo of ["turno_palloni_12h", "turno_palloni_6h"]) {
            assert.equal((await notifiche(evento, tipo)).length, 0, `${evento} non ha ${tipo}`);
          }
        }
      },
    );

    await prova(
      "a 4,5 e 9 ore dall'inizio non parte nessun avviso, anche con l'incaricato",
      async () => {
        assert.equal((await notifiche(FUORI4)).length, 0, "tra 4,5 ore: prima era la fascia 6 ore");
        assert.equal((await notifiche(FUORI9)).length, 0, "tra 9 ore: prima era la fascia 12 ore");
        assert.equal((await registro(FUORI4)).length, 0);
        assert.equal((await registro(FUORI9)).length, 0);
      },
    );

    await prova(
      "nessun avviso per eventi lontani, passati, extra-campo o senza incaricato",
      async () => {
        assert.equal((await notifiche(LONTANO)).length, 0, "tra 40 ore: fuori da ogni fascia");
        assert.equal((await notifiche(PREC)).length, 0, "già iniziato");
        assert.equal((await notifiche(GENERICO)).length, 0, "un evento extra-campo non ha palloni");
        assert.equal((await registro(GENERICO)).length, 0);
      },
    );

    await prova(
      "il testo è quello di «incarico assegnato» e «riconsegna», identico al codice",
      async () => {
        const eventi = await eventiDelDatabase();
        const turni = await turniDelDatabase();
        for (const [evento, tipo] of [
          [MAIN, "turno_palloni_3h"],
          [SECONDO, "turno_palloni_3h"],
          [TERZO, "turno_palloni_3h"],
        ] as const) {
          const attesi = avvisiPalloniEvento(turni, eventi, evento);
          assert.equal(attesi.length, 2, evento);
          const righe = await notifiche(evento, tipo);
          for (const atteso of attesi) {
            const r = righe.find((x) => x.giocatore_id === atteso.giocatoreId);
            assert.ok(r, `${evento}: manca l'avviso a ${atteso.giocatoreId}`);
            assert.equal(r.titolo, atteso.titolo, `${evento} titolo`);
            assert.equal(r.corpo, atteso.testo, `${evento} corpo`);
          }
        }
        const [incarico] = (await notifiche(MAIN, "turno_palloni_3h")).filter(
          (r) => r.giocatore_id === G4,
        );
        const eventoSecondo = eventi.find((e) => e.id === SECONDO)!;
        const main = eventi.find((e) => e.id === MAIN)!;
        assert.equal(
          incarico?.corpo,
          [
            `Evento: ${PREFISSO} main`,
            `Data: ${gg(main.data)}, ore ${main.ora}`,
            "Incarico: custodia dei palloni al termine dell'evento",
            `Riconsegna: ${gg(eventoSecondo.data)}`,
          ].join("\n"),
          "la riconsegna è la data dell'evento successivo",
        );
      },
    );

    await prova("registro e canali: push in coda, nessuna email", async () => {
      assert.equal((await registro(MAIN, "turno_palloni_3h")).length, 2);
      const righe = [
        ...(await notifiche(MAIN, "turno_palloni_3h")),
        ...(await notifiche(SECONDO, "turno_palloni_3h")),
        ...(await notifiche(TERZO, "turno_palloni_3h")),
      ];
      const ids = righe.map((r) => r.id);
      assert.equal(ids.length, 6);
      assert.equal((await inCodaPush(ids)).length, 6, "la push la manda il worker");
      assert.equal((await inCodaEmail(ids)).length, 0, "i palloni non mandano email (DD-040)");
    });

    await prova("un secondo giro non duplica nulla; eliminata, l'avviso non torna", async () => {
      const prima = await notifiche(MAIN, "turno_palloni_3h");
      await esegui("genera_avvisi_palloni");
      assert.deepEqual(
        (await notifiche(MAIN, "turno_palloni_3h")).map((r) => r.id),
        prima.map((r) => r.id),
      );
      const mia = prima.find((r) => r.giocatore_id === G5)!;
      await scrivi(`notifiche_utente?id=eq.${mia.id}`, "DELETE");
      await esegui("genera_avvisi_palloni");
      await esegui("genera_avvisi_palloni");
      assert.deepEqual(await destinatari(MAIN, "turno_palloni_3h"), [G4], "g5 non la riavrà");
      assert.equal((await registro(MAIN, "turno_palloni_3h")).length, 2, "il registro la ricorda");
    });

    await prova(
      "un incaricato non più attivo o un evento con ora illeggibile non avvisano",
      async () => {
        await creaEvento(ORA_ROTTA, "allenamento", { data: tra(24 * 60).data, ora: "boh" });
        await assegna(ORA_ROTTA, G4);
        await esegui("genera_avvisi_palloni");
        assert.equal(
          (await notifiche(ORA_ROTTA)).length,
          0,
          "ora non valida: escluso, senza errori",
        );

        await scrivi(`turni_palloni?evento_id=eq.${TERZO}`, "PATCH", { giocatore_id: INATTIVO });
        await esegui("genera_avvisi_palloni");
        assert.ok(
          !(await destinatari(TERZO, "turno_palloni_3h")).includes(INATTIVO),
          "chi non è più attivo non riceve nulla",
        );
        await cambiaTurno(TERZO, G8);
      },
    );

    // --- Revoca dell'incarico ---------------------------------------------------------------
    await prova(
      "incaricato cambiato: il nuovo riceve l'avviso, il vecchio una sola revoca",
      async () => {
        await cambiaTurno(MAIN, G6);
        await esegui("genera_avvisi_palloni");
        assert.deepEqual(
          await destinatari(MAIN, "turno_palloni_3h"),
          [G4, G6],
          "g4 aveva già il suo; g6 è nuovo; g5 aveva eliminato il proprio e non lo riavrà",
        );
        const revoche = await notifiche(MAIN, "turno_palloni_revocato");
        assert.deepEqual(
          revoche.map((r) => r.giocatore_id),
          [G4],
          "solo chi aveva l'incarico e non ce l'ha più; g5 è ancora il turno precedente",
        );
        assert.equal(revoche[0]!.titolo, "Turno palloni: incarico revocato");
        const main = (await eventiDelDatabase()).find((e) => e.id === MAIN)!;
        assert.equal(
          revoche[0]!.corpo,
          [
            `Evento: ${PREFISSO} main`,
            `Data: ${gg(main.data)}, ore ${main.ora}`,
            "Incarico: non più a tuo carico per questo evento",
          ].join("\n"),
        );
        await esegui("genera_avvisi_palloni");
        assert.equal(
          (await notifiche(MAIN, "turno_palloni_revocato")).length,
          1,
          "la revoca parte una volta sola",
        );
      },
    );

    await prova("la revoca ha push in coda e nessuna email", async () => {
      const [revoca] = await notifiche(MAIN, "turno_palloni_revocato");
      assert.equal((await inCodaPush([revoca!.id])).length, 1);
      assert.equal((await inCodaEmail([revoca!.id])).length, 0);
    });

    await prova("riassegnato al vecchio incaricato: nessun secondo avviso", async () => {
      await cambiaTurno(MAIN, G4);
      await esegui("genera_avvisi_palloni");
      assert.deepEqual(
        (await notifiche(MAIN)).filter((r) => r.giocatore_id === G4).map((r) => r.tipo),
        ["turno_palloni_3h", "turno_palloni_revocato"],
        "il registro ha già generato l'avviso di quella fascia: resta la revoca come ultima",
      );
      await cambiaTurno(MAIN, G4);
    });

    await prova(
      "turno tolto: chi era stato avvisato, incaricato o riconsegna, viene revocato",
      async () => {
        // La notifica dell'avviso può essere stata eliminata: conta il registro.
        const [avvisoG7] = (await notifiche(SECONDO, "turno_palloni_3h")).filter(
          (r) => r.giocatore_id === G7,
        );
        await scrivi(`notifiche_utente?id=eq.${avvisoG7!.id}`, "DELETE");
        await scrivi(`turni_palloni?evento_id=eq.${SECONDO}`, "DELETE");
        await esegui("genera_avvisi_palloni");
        const revocati = await destinatari(SECONDO, "turno_palloni_revocato");
        assert.ok(revocati.includes(G7), "g7 aveva eliminato l'avviso: conta il registro");
        assert.ok(!revocati.includes(G8), "g8 non c'entra con questo evento");
        // Senza incaricato non parte nulla di nuovo: restano g4 e g6, avvisati prima come
        // «riconsegna» quando il turno di MAIN è passato a g6 e poi tornato a g4.
        assert.deepEqual(await destinatari(SECONDO, "turno_palloni_3h"), [G4, G6]);
        await assegna(SECONDO, G7);
      },
    );

    await prova("gli avvisi del pulsante (`turno_palloni`) non provocano revoche", async () => {
      await scrivi("notifiche_utente", "POST", {
        giocatore_id: G8,
        tipo: "turno_palloni",
        titolo: "manuale",
        corpo: "proposta non confermata",
        evento_id: MAIN,
      });
      await esegui("genera_avvisi_palloni");
      assert.ok(
        !(await destinatari(MAIN, "turno_palloni_revocato")).includes(G8),
        "la proposta del pulsante può non essere un turno confermato",
      );
    });

    await prova("un evento già iniziato non genera la revoca", async () => {
      await scrivi("promemoria_eventi_generati", "POST", {
        giocatore_id: G4,
        evento_id: PREC,
        tipo: "turno_palloni_3h",
      });
      await esegui("genera_avvisi_palloni");
      assert.equal((await notifiche(PREC, "turno_palloni_revocato")).length, 0);
    });

    // --- Stesso ordine del codice: precedente e successivo ---------------------------------
    await prova("precedente e successivo seguono lo stesso ordine di palloni-core.ts", async () => {
      const ora = "20:00";
      const data = tra(24 * 8).data;
      await creaEvento(COPPIA_B, "partita", { data, ora });
      await creaEvento(COPPIA_A, "allenamento", { data, ora });
      await assegna(COPPIA_A, G4);
      await assegna(COPPIA_B, G5);
      const eventi = await eventiDelDatabase();
      const turni = await turniDelDatabase();
      assert.equal(
        eventoPrecedente(eventi, COPPIA_B)?.id,
        COPPIA_A,
        "a parità di data e ora: per id",
      );
      assert.equal(eventoSuccessivo(eventi, COPPIA_A)?.id, COPPIA_B);

      // Solo i due eventi della coppia cadono nella fascia: 8 giorni ± un giorno.
      await esegui("genera_avvisi_palloni_fascia", {
        p_tipo: "turno_palloni_3h",
        p_da: `${24 * 7} hours`,
        p_a: `${24 * 9} hours`,
      });
      for (const evento of [COPPIA_A, COPPIA_B]) {
        const righe = await notifiche(evento, "turno_palloni_3h");
        const attesi = avvisiPalloniEvento(turni, eventi, evento);
        assert.equal(righe.length, attesi.length, evento);
        for (const a of attesi) {
          const r = righe.find((x) => x.giocatore_id === a.giocatoreId);
          assert.ok(r, `${evento}: ${a.giocatoreId}`);
          assert.equal(r.titolo, a.titolo);
          assert.equal(r.corpo, a.testo);
        }
      }
    });

    // --- Solleciti presenze -----------------------------------------------------------------
    await creaEvento(S24, "evento", tra(18), { convocati: [G4, G5, G7, INATTIVO, ALLENATORE] });
    await creaEvento(S12, "evento", tra(9));
    await creaEvento(S6, "evento", tra(4));
    await creaEvento(S_FUORI, "evento", tra(30));
    await rispondi(S24, G7, "presente");
    await rispondi(S24, G5, "forse");
    await rispondi(S12, G4, "assente");
    await rispondi(S12, G5, "forse");
    await rispondi(S6, G4, "ritardo");

    const tuttiGiocatoriAttivi = async () =>
      (await leggi<{ id: string }>("giocatori_squadra?attivo=eq.true&tipo=eq.giocatore&select=id"))
        .map((g) => g.id)
        .sort();

    await prova(
      "un solo sollecito, entro 24 ore dall'inizio, a chi deve rispondere (DD-045)",
      async () => {
        await esegui("genera_solleciti_presenze");
        assert.deepEqual(
          await destinatari(S24, "sollecita_presenze_24h"),
          [G4, G5],
          "convocati senza risposta (g4) o «forse» (g5): g7 ha risposto, inattivo e allenatore esclusi",
        );
        const senzaRisposta = (await tuttiGiocatoriAttivi()).filter((g) => g !== G4);
        assert.deepEqual(
          await destinatari(S12, "sollecita_presenze_24h"),
          senzaRisposta,
          "convocati vuoto: tutta la rosa attiva, meno chi ha risposto; g5 («forse») resta",
        );
        assert.deepEqual(
          await destinatari(S6, "sollecita_presenze_24h"),
          (await tuttiGiocatoriAttivi()).filter((g) => g !== G4),
          "anche a 4 ore dall'inizio: il sollecito è uno solo, non uno per fascia",
        );
        assert.equal((await notifiche(S_FUORI)).length, 0, "tra 30 ore: non ancora");
        for (const evento of [S24, S12, S6]) {
          for (const tipo of ["sollecita_presenze_12h", "sollecita_presenze_6h"]) {
            assert.equal((await notifiche(evento, tipo)).length, 0, `${evento} non ha ${tipo}`);
          }
        }
      },
    );

    await prova("mai all'allenatore né a chi non è attivo", async () => {
      for (const evento of [S24, S12, S6]) {
        const tutti = (await notifiche(evento)).map((r) => r.giocatore_id);
        assert.ok(!tutti.includes(ALLENATORE), `${evento}: allenatore`);
        assert.ok(!tutti.includes(INATTIVO), `${evento}: inattivo`);
      }
    });

    await prova("il testo è quello del sollecito, identico al codice", async () => {
      const eventi = await eventiDelDatabase();
      const squadra = await leggi<{
        id: string;
        attivo: boolean;
        tipo: "giocatore" | "allenatore";
      }>("giocatori_squadra?select=id,attivo,tipo");
      for (const [id, tipo] of [
        [S24, "sollecita_presenze_24h"],
        [S12, "sollecita_presenze_24h"],
        [S6, "sollecita_presenze_24h"],
      ] as const) {
        const evento = eventi.find((e) => e.id === id)!;
        const risposte = await leggi<{ giocatore_id: string; stato: string }>(
          `risposte_presenze?evento_id=eq.${id}&select=giocatore_id,stato`,
        );
        const attesi = destinatariSollecito(squadra, risposte, evento.convocati);
        assert.deepEqual(await destinatari(id, tipo), [...attesi].sort(), `${id}: destinatari`);
        for (const r of await notifiche(id, tipo)) {
          const { titolo, testo } = testoSollecito(
            evento,
            risposte.find((x) => x.giocatore_id === r.giocatore_id)?.stato,
          );
          assert.equal(r.titolo, titolo, `${id} titolo`);
          assert.equal(r.corpo, testo, `${id} corpo di ${r.giocatore_id}`);
        }
      }
      const [g5] = (await notifiche(S24, "sollecita_presenze_24h")).filter(
        (r) => r.giocatore_id === G5,
      );
      assert.match(g5!.corpo, /Risposta attuale: forse/);
      assert.ok(!g5!.corpo.includes("Richiesta di"), "l'automatico non ha un mittente");
    });

    await prova("il sollecito ha push in coda ed email", async () => {
      const ids = (await notifiche(S24, "sollecita_presenze_24h")).map((r) => r.id);
      assert.equal((await inCodaPush(ids)).length, ids.length);
      assert.equal((await inCodaEmail(ids)).length, ids.length);
    });

    await prova("un secondo giro non duplica; eliminato, il sollecito non torna", async () => {
      const prima = await notifiche(S24, "sollecita_presenze_24h");
      await esegui("genera_solleciti_presenze");
      assert.equal((await notifiche(S24, "sollecita_presenze_24h")).length, prima.length);
      await scrivi(`notifiche_utente?id=eq.${prima[0]!.id}`, "DELETE");
      await esegui("genera_solleciti_presenze");
      assert.equal((await notifiche(S24, "sollecita_presenze_24h")).length, prima.length - 1);
    });

    await prova(
      "chi resta su «forse» riceve il sollecito una sola volta, non a ogni fascia",
      async () => {
        await creaEvento(S_FORSE, "evento", tra(18), { convocati: [G4, G5, G8] });
        await rispondi(S_FORSE, G5, "forse");
        await esegui("genera_solleciti_presenze");
        assert.deepEqual(await destinatari(S_FORSE, "sollecita_presenze_24h"), [G4, G5, G8]);

        await rispondi(S_FORSE, G4, "presente");
        await spostaEvento(S_FORSE, 9);
        await esegui("genera_solleciti_presenze");
        await spostaEvento(S_FORSE, 4);
        await esegui("genera_solleciti_presenze");
        assert.deepEqual(
          (await notifiche(S_FORSE)).map((r) => r.tipo),
          ["sollecita_presenze_24h", "sollecita_presenze_24h", "sollecita_presenze_24h"],
          "nessun secondo sollecito avvicinandosi all'evento, nemmeno a g5 («forse»)",
        );
      },
    );

    await prova("un evento creato tardi riceve comunque un solo sollecito", async () => {
      await creaEvento(S_TARDI, "evento", tra(5), { convocati: [G4] });
      await esegui("genera_solleciti_presenze");
      await esegui("genera_solleciti_presenze");
      assert.deepEqual(
        (await notifiche(S_TARDI)).map((r) => r.tipo),
        ["sollecita_presenze_24h"],
      );
    });

    await prova("il sollecito del pulsante e quello automatico convivono", async () => {
      await scrivi("notifiche_utente", "POST", {
        giocatore_id: G5,
        tipo: "sollecita_presenze",
        titolo: "manuale",
        corpo: "manuale",
        evento_id: S24,
      });
      assert.deepEqual(
        (await notifiche(S24)).filter((r) => r.giocatore_id === G5).map((r) => r.tipo),
        ["sollecita_presenze", "sollecita_presenze_24h"],
      );
    });

    // --- Schema, permessi, pianificazione ---------------------------------------------------
    await prova("le funzioni dei job sono riservate alla service role", async () => {
      for (const nome of [
        "genera_avvisi_palloni",
        "genera_solleciti_presenze",
        "genera_revoche_palloni",
      ]) {
        assert.ok(!(await rpc(nome, {}, ANON)).ok, `${nome}: anon`);
        assert.ok(!(await rpc(nome, {}, admin.token)).ok, `${nome}: utente autenticato`);
      }
      for (const nome of ["genera_avvisi_palloni_fascia", "genera_solleciti_presenze_fascia"]) {
        const corpo = { p_tipo: "turno_palloni_3h", p_da: "0", p_a: "1 hour" };
        assert.ok(!(await rpc(nome, corpo, ANON)).ok, `${nome}: anon`);
        assert.ok(!(await rpc(nome, corpo, admin.token)).ok, `${nome}: utente autenticato`);
      }
    });

    await prova("il registro accetta solo i tipi automatici", async () => {
      const res = await rest("promemoria_eventi_generati", SERVIZIO, {
        method: "POST",
        body: JSON.stringify({ giocatore_id: G4, evento_id: MAIN, tipo: "turno_palloni" }),
      });
      assert.ok(!res.ok, "`turno_palloni` è il tipo del pulsante: non entra nel registro");
    });

    await prova("ogni tipo nuovo è accettato da notifiche_utente", async () => {
      for (const tipo of [
        "turno_palloni_12h",
        "turno_palloni_6h",
        "turno_palloni_3h",
        "turno_palloni_revocato",
        "sollecita_presenze_24h",
        "sollecita_presenze_12h",
        "sollecita_presenze_6h",
      ]) {
        const res = await rest("notifiche_utente", SERVIZIO, {
          method: "POST",
          body: JSON.stringify({
            giocatore_id: G4,
            tipo,
            titolo: "x",
            corpo: "y",
            evento_id: LONTANO,
          }),
        });
        assert.ok(res.ok, `${tipo}: ${res.status}`);
      }
    });

    await prova("i due job sono pianificati ogni 15 minuti", async () => {
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
          "-F",
          "|",
          "-c",
          "select jobname, schedule, command from cron.job where jobname in " +
            "('avvisi-palloni-automatici','solleciti-presenze-automatici') order by jobname",
        ],
        { encoding: "utf8" },
      );
      assert.equal(esito.status, 0, esito.stderr);
      const righe = esito.stdout.trim().split("\n");
      assert.equal(righe.length, 2);
      assert.match(
        righe[0]!,
        /^avvisi-palloni-automatici\|\*\/15 \* \* \* \*\|.*genera_avvisi_palloni\(\)/,
      );
      assert.match(
        righe[1]!,
        /^solleciti-presenze-automatici\|\*\/15 \* \* \* \*\|.*genera_solleciti_presenze\(\)/,
      );
    });

    await prova("il promemoria a 24 e 3 ore non è più pianificato (M28, DD-043)", async () => {
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
          "select count(*) from cron.job where jobname like 'promemoria-eventi-%'",
        ],
        { encoding: "utf8" },
      );
      assert.equal(esito.status, 0, esito.stderr);
      assert.equal(esito.stdout.trim(), "0", "nessun job di promemoria evento");
    });

    await prova("cancellare l'evento toglie registro e notifiche collegate", async () => {
      assert.ok((await registro(MAIN)).length > 0);
      await scrivi(`eventi_app?id=eq.${MAIN}`, "DELETE");
      assert.equal((await registro(MAIN)).length, 0);
      assert.equal((await notifiche(MAIN)).length, 0);
    });
  } finally {
    for (const id of TUTTI) {
      await rest(`notifiche_utente?evento_id=eq.${id}`, SERVIZIO, { method: "DELETE" });
      await rest(`promemoria_eventi_generati?evento_id=eq.${id}`, SERVIZIO, { method: "DELETE" });
      await rest(`turni_palloni?evento_id=eq.${id}`, SERVIZIO, { method: "DELETE" });
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
    riepilogo("notifiche-automatiche");
  }
}
