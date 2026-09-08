/**
 * Badge Sherpa dei palloni end-to-end contro il database locale:
 * `bun test/integration/palloni-badge.test.ts`.
 *
 * I test unitari (`test/unit/palloni-core.test.ts`, `test/unit/badges.test.ts`) verificano
 * `conteggioTurni()` e `statoBadge()` come funzioni pure, con eventi e turni costruiti a mano.
 * Qui invece si scrivono eventi e turni veri su `eventi_app`/`turni_palloni`, si rileggono via
 * REST con la stessa forma di `fetchTurni()`/`daRiga()`, e si passa il risultato attraverso
 * `conteggioTurni()` fino a `statoBadge()` sul badge `palloni`: se una colonna cambia nome o la
 * mappatura si rompe, qui il grado del badge torna sbagliato anche se i test unitari restano
 * verdi, perché quelli non toccano mai il database.
 *
 * Verifica in particolare che il badge conti **solo i turni confermati**
 * (`Giocatore.palloni` in `rosa.ts` usa `turniSalvati`, non l'output di `completaTurni()`):
 * un evento passato senza turno confermato non deve avanzare il badge di nessuno, anche se
 * `completaTurni()` (usato altrove, per la UI di rotazione) lo proporrebbe automaticamente a
 * qualcuno. Prima di questo fix il badge includeva anche le proposte non confermate — vedi
 * `docs/modules/badge.md` § Limiti noti (risolto) per il dettaglio del bug e della correzione.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-palloni-badge`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { badgeDefs, statoBadge } from "@/lib/badges";
import { conteggioTurni } from "@/lib/palloni-core";
import { daRiga, type RigaEvento, type Evento } from "@/lib/eventi";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("badge palloni sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("palloni-badge");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`badge palloni su ${URL_BASE}`);

  const PREFISSO = "test-palloni-badge";
  const palloniDef = badgeDefs.find((b) => b.id === "palloni")!;
  // "Oggi" fissato nel futuro: gli eventi scritti sotto sono tutti datati nel passato remoto,
  // così restano "passati" (e quindi contati) a prescindere da quando gira il test.
  const OGGI = "2099-01-01";

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

  async function creaEvento(id: string, data: string) {
    const res = await rest("eventi_app", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ id, tipo: "partita", titolo: `Partita ${id}`, data }),
    });
    if (!res.ok) throw new Error(`creazione evento ${id}: ${res.status} ${await res.text()}`);
  }

  async function confermaTurno(eventoId: string, giocatoreId: string) {
    const res = await rest("turni_palloni?on_conflict=evento_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ evento_id: eventoId, giocatore_id: giocatoreId }),
    });
    if (!res.ok) throw new Error(`upsert su turni_palloni: ${res.status} ${await res.text()}`);
  }

  /** Rilegge esattamente come fa l'app: `daRiga()` per gli eventi, una mappa per i turni. */
  async function leggiEventi(): Promise<Evento[]> {
    const res = await rest(
      "eventi_app?id=like." +
        PREFISSO +
        "*&select=id,tipo,titolo,luogo,data,ora,note,convocati,campionato,casa,pagelle_chiuse,creato_il",
    );
    const righe = (await res.json()) as RigaEvento[];
    return righe.map(daRiga);
  }

  /** Rilegge esattamente come `fetchTurni()`: solo i turni confermati, nessuna proposta. */
  async function leggiTurniSalvati(): Promise<Record<string, string>> {
    const res = await rest(
      `turni_palloni?evento_id=like.${PREFISSO}*&select=evento_id,giocatore_id`,
    );
    const righe = (await res.json()) as Array<{ evento_id: string; giocatore_id: string }>;
    const mappa: Record<string, string> = {};
    for (const r of righe) mappa[r.evento_id] = r.giocatore_id;
    return mappa;
  }

  /** Un giocatore azzerato, come in `test/unit/badges.test.ts`. */
  function giocatoreAzzerato(palloni: number): Giocatore {
    return { ...giocatori[0]!, palloni, mvp: 0, mediaVoto: 0, votiPagella: 0, presenze: 0 };
  }

  try {
    await prova(
      "il badge palloni passa da bronzo ad argento con turni reali, ignorando gli eventi mai confermati",
      async () => {
        // m1-m3: turno confermato esplicitamente a pv1 (3 turni -> soglia bronzo).
        // m4: NESSUN turno confermato -> non deve contare per nessuno, anche se un algoritmo
        //     di rotazione (usato altrove per la UI) proporrebbe qualcuno in automatico.
        // m5-m7: confermati di nuovo a pv1 (6 turni totali -> soglia argento).
        const eventi = [
          [`${PREFISSO}-m1`, "2020-01-01", "pv1"],
          [`${PREFISSO}-m2`, "2020-01-02", "pv1"],
          [`${PREFISSO}-m3`, "2020-01-03", "pv1"],
          [`${PREFISSO}-m4`, "2020-01-04", null],
          [`${PREFISSO}-m5`, "2020-01-05", "pv1"],
          [`${PREFISSO}-m6`, "2020-01-06", "pv1"],
          [`${PREFISSO}-m7`, "2020-01-07", "pv1"],
        ] as const;

        for (const [id, data] of eventi.slice(0, 3)) await creaEvento(id, data);
        for (const [id, , giocatore] of eventi.slice(0, 3))
          if (giocatore) await confermaTurno(id, giocatore);

        const eventiA3 = await leggiEventi();
        const salvatiA3 = await leggiTurniSalvati();
        const conteggioA3 = conteggioTurni(salvatiA3, eventiA3, OGGI);
        assert.equal(conteggioA3["pv1"], 3, "3 turni confermati: soglia bronzo appena raggiunta");
        assert.equal(
          statoBadge(palloniDef, giocatoreAzzerato(conteggioA3["pv1"]!)).grado,
          "bronzo",
          "3 turni: bronzo, non oltre (soglia argento è 6)",
        );

        for (const [id, data] of eventi.slice(3)) await creaEvento(id, data);
        for (const [id, , giocatore] of eventi.slice(3))
          if (giocatore) await confermaTurno(id, giocatore);

        const eventiLetti = await leggiEventi();
        assert.equal(eventiLetti.length, 7, "tutti gli eventi scritti si rileggono");

        const salvati = await leggiTurniSalvati();
        assert.equal(Object.keys(salvati).length, 6, "6 turni confermati esplicitamente, m4 no");

        const conteggio = conteggioTurni(salvati, eventiLetti, OGGI);
        assert.equal(conteggio["pv1"], 6, "6 turni confermati per pv1");
        assert.equal(
          conteggio["pv2"] ?? 0,
          0,
          "pv2 non ha mai confermato nulla: m4 senza conferma non conta per nessuno",
        );

        const badgePv1 = statoBadge(palloniDef, giocatoreAzzerato(conteggio["pv1"]!));
        assert.equal(badgePv1.grado, "argento", "6 turni: soglia argento raggiunta");

        const badgePv2 = statoBadge(palloniDef, giocatoreAzzerato(conteggio["pv2"] ?? 0));
        assert.equal(badgePv2.grado, null, "zero turni confermati: nessun badge");
      },
    );

    await prova("un evento futuro non riceve conteggio, anche se già confermato", async () => {
      // Stesso scenario di sopra ma con "oggi" prima di tutti gli eventi: nessun turno
      // confermato deve ancora contare per il badge.
      const eventiLetti = await leggiEventi();
      const salvati = await leggiTurniSalvati();
      const conteggio = conteggioTurni(salvati, eventiLetti, "2019-01-01");
      assert.deepEqual(conteggio, {}, "tutti gli eventi sono nel futuro rispetto a 'oggi'");
    });
  } finally {
    await rest(`turni_palloni?evento_id=like.${PREFISSO}*`, { method: "DELETE" });
    await rest(`eventi_app?id=like.${PREFISSO}*`, { method: "DELETE" });
  }

  riepilogo("palloni-badge");
}
