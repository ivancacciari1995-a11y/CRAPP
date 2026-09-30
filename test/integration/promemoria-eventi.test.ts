/**
 * Promemoria evento che non ricompaiono (M23, DD-037): `bun test/integration/promemoria-eventi.test.ts`.
 *
 * Prima di M23 l'unica traccia che un promemoria fosse già stato generato era la riga in
 * `notifiche_utente`: eliminarla dal centro notifiche faceva rigenerare il promemoria (e
 * riaccodare la mail) al giro successivo del job. Qui si verifica che il registro
 * `promemoria_eventi_generati` lo eviti, senza rompere la generazione normale.
 *
 * Gira solo sullo stack locale (`npx supabase start`). Usa eventi con il prefisso
 * `test-promemoria-eventi` e gli slot `g4`, `g5`, `g6` della rosa seed come convocati; non
 * serve un account collegato perché le notifiche si eliminano con la service role.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("promemoria eventi", "stack locale non attivo (npx supabase start)");
  riepilogo("promemoria-eventi");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;
  console.log(`promemoria eventi su ${URL_BASE}`);

  const PREFISSO = "test-promemoria-eventi";
  const EVENTO = `${PREFISSO}-a`;
  const EVENTO_LONTANO = `${PREFISSO}-lontano`;
  const EVENTO_CASCATA = `${PREFISSO}-cascata`;
  const EVENTO_DOMANI = `${PREFISSO}-domani`;
  const EVENTO_OGGI = `${PREFISSO}-oggi`;
  const EVENTO_SENZA_LUOGO = `${PREFISSO}-senza-luogo`;
  const G4 = "g4";
  const G5 = "g5";
  const G6 = "g6";

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

  async function scrivi(percorso: string, metodo: string, corpo?: unknown) {
    const res = await rest(percorso, SERVIZIO, {
      method: metodo,
      body: corpo === undefined ? null : JSON.stringify(corpo),
    });
    if (!res.ok) throw new Error(`${metodo} su ${percorso}: ${res.status} ${await res.text()}`);
  }

  async function cron(tipo: "evento_promemoria_24h" | "evento_promemoria_3h") {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/genera_promemoria_eventi`, {
      method: "POST",
      headers: {
        apikey: SERVIZIO,
        Authorization: `Bearer ${SERVIZIO}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_tipo: tipo,
        p_finestra: tipo === "evento_promemoria_24h" ? "24 hours" : "3 hours",
      }),
    });
    if (!res.ok) throw new Error(`genera_promemoria_eventi: ${res.status} ${await res.text()}`);
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

  const notifiche = (evento: string, tipo: string) =>
    leggi<{ id: string; giocatore_id: string; letta: boolean }>(
      `notifiche_utente?evento_id=eq.${evento}&tipo=eq.${tipo}&select=id,giocatore_id,letta&order=giocatore_id`,
    );
  const registro = (evento: string, tipo?: string) =>
    leggi<{ giocatore_id: string; tipo: string }>(
      `promemoria_eventi_generati?evento_id=eq.${evento}${tipo ? `&tipo=eq.${tipo}` : ""}&select=giocatore_id,tipo`,
    );
  const inCoda = async (ids: string[]) =>
    ids.length === 0
      ? []
      : leggi<{ notifica_id: string }>(
          `notifiche_email_coda?notifica_id=in.(${ids.join(",")})&select=notifica_id`,
        );

  try {
    await scrivi("eventi_app", "POST", {
      id: EVENTO,
      tipo: "allenamento",
      titolo: `${PREFISSO} evento`,
      ...tra(2),
      convocati: [G4, G5],
    });
    await scrivi("eventi_app", "POST", {
      id: EVENTO_LONTANO,
      tipo: "allenamento",
      titolo: `${PREFISSO} lontano`,
      ...tra(72),
      convocati: [G4],
    });

    await prova("il job genera il promemoria per i convocati e lo registra", async () => {
      await cron("evento_promemoria_24h");
      const n = await notifiche(EVENTO, "evento_promemoria_24h");
      assert.deepEqual(
        n.map((r) => r.giocatore_id),
        [G4, G5],
      );
      assert.equal((await registro(EVENTO, "evento_promemoria_24h")).length, 2);
    });

    await prova("un secondo giro del job non duplica né riaccoda", async () => {
      const prima = await notifiche(EVENTO, "evento_promemoria_24h");
      const codaPrima = await inCoda(prima.map((r) => r.id));
      await cron("evento_promemoria_24h");
      const dopo = await notifiche(EVENTO, "evento_promemoria_24h");
      assert.deepEqual(
        dopo.map((r) => r.id),
        prima.map((r) => r.id),
      );
      assert.equal((await inCoda(dopo.map((r) => r.id))).length, codaPrima.length);
    });

    await prova(
      "eliminata la notifica, il promemoria NON ricompare al giro successivo",
      async () => {
        const [mia] = await notifiche(EVENTO, "evento_promemoria_24h");
        assert.ok(mia);
        await scrivi(`notifiche_utente?id=eq.${mia.id}`, "DELETE");
        assert.equal((await notifiche(EVENTO, "evento_promemoria_24h")).length, 1);

        await cron("evento_promemoria_24h");
        await cron("evento_promemoria_24h");
        const dopo = await notifiche(EVENTO, "evento_promemoria_24h");
        assert.equal(dopo.length, 1, "solo la notifica dell'altro convocato, non quella eliminata");
        assert.ok(!dopo.some((r) => r.giocatore_id === mia.giocatore_id));
      },
    );

    await prova("nessuna nuova mail in coda per il promemoria eliminato", async () => {
      const righe = await leggi<{ id: string; giocatore_id: string }>(
        `notifiche_utente?evento_id=eq.${EVENTO}&tipo=eq.evento_promemoria_24h&select=id,giocatore_id`,
      );
      const coda = await inCoda(righe.map((r) => r.id));
      assert.equal(coda.length, righe.length, "una sola riga in coda per notifica rimasta");
    });

    await prova("il promemoria a 3 ore è indipendente da quello a 24 ore", async () => {
      await cron("evento_promemoria_3h");
      const n = await notifiche(EVENTO, "evento_promemoria_3h");
      assert.equal(n.length, 2, "l'evento parte tra 2 ore: rientra nella finestra di 3");
      const [mia] = n;
      assert.ok(mia);
      await scrivi(`notifiche_utente?id=eq.${mia.id}`, "DELETE");
      await cron("evento_promemoria_3h");
      assert.equal((await notifiche(EVENTO, "evento_promemoria_3h")).length, 1);
    });

    await prova("un convocato aggiunto dopo riceve comunque il suo promemoria", async () => {
      await scrivi(`eventi_app?id=eq.${EVENTO}`, "PATCH", { convocati: [G4, G5, G6] });
      await cron("evento_promemoria_24h");
      const n = await notifiche(EVENTO, "evento_promemoria_24h");
      assert.ok(
        n.some((r) => r.giocatore_id === G6),
        "g6 ha ricevuto il promemoria",
      );
      assert.equal(n.filter((r) => r.giocatore_id === G6).length, 1);
    });

    await prova("un evento fuori dalla finestra non genera né registra nulla", async () => {
      await cron("evento_promemoria_24h");
      await cron("evento_promemoria_3h");
      assert.equal((await notifiche(EVENTO_LONTANO, "evento_promemoria_24h")).length, 0);
      assert.equal((await registro(EVENTO_LONTANO)).length, 0);
    });

    await prova("il registro non si vede né si scrive da un client", async () => {
      const lettura = await rest("promemoria_eventi_generati?select=*", ANON);
      assert.ok(!lettura.ok, "anon non può leggere il registro");
      const inserimento = await rest("promemoria_eventi_generati", ANON, {
        method: "POST",
        body: JSON.stringify({ giocatore_id: G4, evento_id: EVENTO, tipo: "evento_promemoria_3h" }),
      });
      assert.ok(!inserimento.ok, "anon non può scrivere nel registro");
    });

    // --- Testo (DD-040) ------------------------------------------------------------------
    // «domani» se la data dell'evento è quella di domani a Roma, «oggi» altrimenti. Per non
    // dipendere dall'ora in cui gira il test: un evento domani a mezzanotte cade sempre nella
    // finestra delle 24 ore, uno oggi alle 23:59 pure.
    const oggiRoma = tra(0).data;
    const domaniRoma = new Date(new Date(`${oggiRoma}T12:00:00Z`).getTime() + 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const gg = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
    const testoDi = async (evento: string, tipo: string) => {
      const [n] = await leggi<{ titolo: string; corpo: string }>(
        `notifiche_utente?evento_id=eq.${evento}&tipo=eq.${tipo}&giocatore_id=eq.${G4}&select=titolo,corpo`,
      );
      assert.ok(n, `promemoria ${tipo} di ${evento} non generato`);
      return n;
    };

    await prova("evento di domani: titolo e data dicono «domani», con ora e luogo", async () => {
      await scrivi("eventi_app", "POST", {
        id: EVENTO_DOMANI,
        tipo: "partita",
        titolo: `${PREFISSO} cena`,
        data: domaniRoma,
        ora: "00:00",
        luogo: "  PalaCRAP  ",
        convocati: [G4],
      });
      await cron("evento_promemoria_24h");
      const n = await testoDi(EVENTO_DOMANI, "evento_promemoria_24h");
      assert.equal(n.titolo, `Promemoria evento di domani: ${PREFISSO} cena`);
      assert.equal(
        n.corpo,
        `Data: domani, ${gg(domaniRoma)}\nOra: 00:00\nLuogo: PalaCRAP`,
        "il luogo è ripulito dagli spazi",
      );
    });

    await prova("evento di oggi: titolo e data dicono «oggi»", async () => {
      await scrivi("eventi_app", "POST", {
        id: EVENTO_OGGI,
        tipo: "allenamento",
        titolo: `${PREFISSO} oggi`,
        data: oggiRoma,
        ora: "23:59",
        luogo: "Palestra",
        convocati: [G4],
      });
      await cron("evento_promemoria_24h");
      const n = await testoDi(EVENTO_OGGI, "evento_promemoria_24h");
      assert.equal(n.titolo, `Promemoria evento di oggi: ${PREFISSO} oggi`);
      assert.equal(n.corpo, `Data: oggi, ${gg(oggiRoma)}\nOra: 23:59\nLuogo: Palestra`);
    });

    await prova("lo stesso testo vale per il promemoria a 3 ore", async () => {
      const { data, ora } = tra(2);
      await scrivi("eventi_app", "POST", {
        id: EVENTO_SENZA_LUOGO,
        tipo: "evento",
        titolo: `${PREFISSO} senza luogo`,
        data,
        ora,
        convocati: [G4],
      });
      await cron("evento_promemoria_3h");
      const n = await testoDi(EVENTO_SENZA_LUOGO, "evento_promemoria_3h");
      const parola = data === domaniRoma ? "domani" : "oggi";
      assert.equal(
        n.titolo,
        `Promemoria evento di ${parola}: ${PREFISSO} senza luogo`,
        "anche il promemoria a 3 ore di un evento dopo mezzanotte dice «domani»",
      );
      assert.equal(
        n.corpo,
        `Data: ${parola}, ${gg(data)}\nOra: ${ora}`,
        "senza luogo la riga «Luogo» manca",
      );
    });

    await prova(
      "il promemoria nuovo parte come push e come email, con lo stesso testo",
      async () => {
        const [n] = await leggi<{ id: string }>(
          `notifiche_utente?evento_id=eq.${EVENTO_DOMANI}&tipo=eq.evento_promemoria_24h&giocatore_id=eq.${G4}&select=id`,
        );
        assert.ok(n);
        assert.equal((await inCoda([n.id])).length, 1, "email in coda");
        const push = await leggi<{ notifica_id: string }>(
          `notifiche_push_coda?notifica_id=eq.${n.id}&select=notifica_id`,
        );
        assert.equal(push.length, 1, "push in coda");
      },
    );

    await prova("cancellare l'evento toglie anche il registro", async () => {
      const { data, ora } = { data: tra(2).data, ora: tra(2).ora };
      await scrivi("eventi_app", "POST", {
        id: EVENTO_CASCATA,
        tipo: "partita",
        titolo: `${PREFISSO} cascata`,
        data,
        ora,
        convocati: [G4],
      });
      await cron("evento_promemoria_24h");
      assert.equal((await registro(EVENTO_CASCATA)).length, 1);
      await scrivi(`eventi_app?id=eq.${EVENTO_CASCATA}`, "DELETE");
      assert.equal((await registro(EVENTO_CASCATA)).length, 0);
    });
  } finally {
    for (const id of [
      EVENTO,
      EVENTO_LONTANO,
      EVENTO_CASCATA,
      EVENTO_DOMANI,
      EVENTO_OGGI,
      EVENTO_SENZA_LUOGO,
    ]) {
      await rest(`eventi_app?id=eq.${id}`, SERVIZIO, { method: "DELETE" });
    }
    riepilogo("promemoria-eventi");
  }
}
