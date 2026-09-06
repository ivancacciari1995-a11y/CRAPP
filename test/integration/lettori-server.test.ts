/**
 * I due lettori lato server contro il database locale:
 * `bun test/integration/lettori-server.test.ts`.
 *
 * `leggiEventi()` e `leggiGiocatoriSquadra()` sono le uniche letture delle tre route che
 * mandano push: se una colonna elencata nelle costanti `COLONNE`/`COLONNE_SQUADRA` sparisse
 * o cambiasse nome, PostgREST risponderebbe con un errore, `data` sarebbe `null` e le route
 * manderebbero le notifiche a zero destinatari — senza che niente si accorga di niente,
 * perché nessuna delle due controlla l'errore. Qui si esegue la query vera e si verifica che
 * le righe arrivino mappate.
 *
 * Gira solo sullo stack locale (`npx supabase start`): le credenziali arrivano da
 * `supabase status` e vengono messe in `process.env` **prima** della prima chiamata, perché
 * `client.server.ts` costruisce il client pigramente leggendo l'ambiente. Così il test non
 * può parlare con il progetto cloud nemmeno per sbaglio.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("lettori server", "stack locale non attivo (npx supabase start)");
  riepilogo("lettori server");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`lettori server su ${URL_BASE}`);

  // Prima di qualsiasi import dei moduli server: è da qui che nasce `supabaseAdmin`.
  process.env["SUPABASE_URL"] = URL_BASE;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVIZIO;

  const { leggiEventi } = await import("@/lib/eventi.server");
  const { leggiGiocatoriSquadra } = await import("@/lib/giocatori-squadra.server");

  const PREFISSO = "test-lettori";
  const EVENTO = `${PREFISSO}-e1`;

  const rest = (percorso: string, init?: RequestInit) =>
    fetch(`${URL_BASE}/rest/v1/${percorso}`, {
      ...init,
      headers: {
        apikey: SERVIZIO,
        Authorization: `Bearer ${SERVIZIO}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

  try {
    const inserito = await rest("eventi_app", {
      method: "POST",
      body: JSON.stringify({
        id: EVENTO,
        tipo: "partita",
        titolo: "Lettori server",
        luogo: "Palestra",
        data: "2026-01-02",
        ora: "21:00",
        note: "",
        convocati: ["g1", "g2"],
        campionato: true,
        casa: false,
      }),
    });
    if (!inserito.ok) throw new Error(`preparazione fallita: ${await inserito.text()}`);

    await prova("leggiEventi() mappa le colonne che le route si aspettano", async () => {
      const eventi = await leggiEventi();
      const evento = eventi.find((e) => e.id === EVENTO);
      assert.ok(evento, "l'evento appena inserito arriva fino al chiamante");
      assert.equal(evento.titolo, "Lettori server");
      assert.equal(evento.tipo, "partita");
      assert.equal(evento.ora, "21:00");
      assert.equal(evento.casa, false, "la trasferta resta una trasferta");
      assert.equal(evento.campionato, true);
      assert.deepEqual(evento.convocati, ["g1", "g2"], "i convocati servono al sollecito");
      assert.equal(evento.note, "", "le note vuote restano stringa vuota");
      assert.equal(evento.pagelleChiuse, false);
    });

    await prova("leggiGiocatoriSquadra() torna la rosa con i campi usati dalle route", async () => {
      const squadra = await leggiGiocatoriSquadra();
      assert.ok(squadra.length > 0, "la rosa del seed non è vuota");
      const g1 = squadra.find((g) => g.id === "g1");
      assert.ok(g1, "g1 esiste nel seed locale");
      assert.equal(typeof g1.nome, "string");
      assert.equal(typeof g1.cognome, "string");
      assert.equal(typeof g1.numero, "number");
      assert.equal(typeof g1.attivo, "boolean", "`attivo` filtra i destinatari delle push");
      // Le colonne di M8: fanno parte di COLONNE_SQUADRA, quindi se mancassero la query
      // fallirebbe per tutti, non solo per la dashboard tesseramenti.
      assert.ok("numeroTessera" in g1 && "dataTessera" in g1, "le colonne di M8 sono lette");
    });

    await prova("l'ordine è quello dichiarato: cognome, poi nome", async () => {
      const squadra = await leggiGiocatoriSquadra();
      const chiavi = squadra.map((g) => `${g.cognome} ${g.nome}`);
      assert.deepEqual(
        chiavi,
        [...chiavi].sort((a, b) => a.localeCompare(b)),
        "gli elenchi mostrati alla squadra dipendono da questo ordinamento",
      );
    });
  } finally {
    await rest(`eventi_app?id=like.${PREFISSO}*`, { method: "DELETE" });
    riepilogo("lettori server");
  }
}
