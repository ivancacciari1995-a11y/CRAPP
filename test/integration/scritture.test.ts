/**
 * Le scritture dell'app contro il database locale: `bun test/integration/scritture.test.ts`.
 *
 * Ogni salvataggio di CrAPP è un `upsert` con un `onConflict` scritto a mano nei hook di
 * `src/lib/`. Se quella chiave non corrisponde al vincolo UNIQUE della tabella non arriva
 * nessun errore: il database sovrascrive la riga sbagliata, e il bug si vede solo settimane
 * dopo in una media che non torna. Qui si ripetono le stesse chiamate dei hook e si conta
 * cosa resta nella tabella.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-scritture`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("scritture sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("scritture");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`scritture su ${URL_BASE}`);

  const PREFISSO = "test-scritture";
  const TABELLE = [
    "pagelle_voti",
    "mvp_voti",
    "cacche_partita",
    "badge_social_voti",
    "turni_palloni",
    "risposte_presenze",
    "scout_live",
  ] as const;

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

  /**
   * Lo stesso `upsert` che fa supabase-js: `onConflict` diventa `on_conflict` nella query
   * e `resolution=merge-duplicates` nell'header.
   */
  async function upsert(tabella: string, onConflict: string, riga: Record<string, unknown>) {
    const res = await rest(`${tabella}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(riga),
    });
    if (!res.ok) throw new Error(`upsert su ${tabella}: ${res.status} ${await res.text()}`);
    return (await res.json()) as Array<Record<string, unknown>>;
  }

  const leggi = async (tabella: string, filtro: string) =>
    (await (await rest(`${tabella}?${filtro}`)).json()) as Array<Record<string, unknown>>;

  try {
    // --- pagelle: la chiave più facile da sbagliare -------------------------------
    // Un votante dà un voto a ogni compagno nella stessa partita: se il conflitto
    // fosse su (match, votante) ogni voto cancellerebbe il precedente.
    await prova("le pagelle tengono un voto per ogni votato, non uno per votante", async () => {
      const match = `${PREFISSO}-m1`;
      const chiave = "match_id,votante_id,votato_id";
      await upsert("pagelle_voti", chiave, {
        match_id: match,
        votante_id: "g1",
        votato_id: "g2",
        voto: 6,
      });
      await upsert("pagelle_voti", chiave, {
        match_id: match,
        votante_id: "g1",
        votato_id: "g3",
        voto: 8,
      });
      const righe = await leggi("pagelle_voti", `match_id=eq.${match}&select=votato_id,voto`);
      assert.equal(righe.length, 2, "due votati, due righe");

      await upsert("pagelle_voti", chiave, {
        match_id: match,
        votante_id: "g1",
        votato_id: "g2",
        voto: 9,
      });
      const dopo = await leggi("pagelle_voti", `match_id=eq.${match}&votato_id=eq.g2&select=voto`);
      assert.equal(dopo.length, 1, "cambiare voto non crea una riga nuova");
      assert.equal(dopo[0]?.["voto"], 9, "il voto è quello aggiornato");
    });

    await prova("le pagelle rifiutano l'autovoto e i voti fuori scala", async () => {
      const match = `${PREFISSO}-m2`;
      const chiave = "match_id,votante_id,votato_id";
      await assert.rejects(
        () =>
          upsert("pagelle_voti", chiave, {
            match_id: match,
            votante_id: "g1",
            votato_id: "g1",
            voto: 10,
          }),
        "nessuno si vota da solo (pagelle_no_autovoto)",
      );
      await assert.rejects(
        () =>
          upsert("pagelle_voti", chiave, {
            match_id: match,
            votante_id: "g1",
            votato_id: "g2",
            voto: 11,
          }),
        "il voto sta fra 1 e 10 (pagelle_voto_range)",
      );
    });

    // --- MVP: qui la regola è l'opposta -------------------------------------------
    await prova("l'MVP e i badge social rifiutano l'autovoto", async () => {
      // M12: `pagelle_no_autovoto` esisteva dalla v1.0, queste due tabelle no. Il vincolo sta
      // a database perché l'interfaccia non è l'unica strada per scrivere una riga.
      await assert.rejects(
        () =>
          upsert("mvp_voti", "match_id,votante_id", {
            match_id: `${PREFISSO}-m3`,
            votante_id: "g1",
            votato_id: "g1",
            votato_nome: "Uno",
          }),
        "nessuno si elegge MVP da solo (mvp_no_autovoto)",
      );
      await assert.rejects(
        () =>
          upsert("badge_social_voti", "match_id,categoria,votante_id", {
            match_id: `${PREFISSO}-m3`,
            categoria: "cuore",
            votante_id: "g1",
            votato_id: "g1",
            votato_nome: "Uno",
          }),
        "né si assegna un badge social (badge_social_no_autovoto)",
      );
    });

    await prova("l'MVP tiene un solo voto per votante e partita", async () => {
      const match = `${PREFISSO}-m3`;
      const chiave = "match_id,votante_id";
      await upsert("mvp_voti", chiave, {
        match_id: match,
        votante_id: "g1",
        votato_id: "g2",
        votato_nome: "Due",
      });
      await upsert("mvp_voti", chiave, {
        match_id: match,
        votante_id: "g1",
        votato_id: "g3",
        votato_nome: "Tre",
      });
      const righe = await leggi("mvp_voti", `match_id=eq.${match}&select=votato_id`);
      assert.equal(righe.length, 1, "cambiare idea sostituisce il voto, non lo aggiunge");
      assert.equal(righe[0]?.["votato_id"], "g3", "vale l'ultimo votato");
    });

    // --- badge social: una preferenza per categoria --------------------------------
    await prova("i badge social tengono un voto per categoria", async () => {
      const match = `${PREFISSO}-m4`;
      const chiave = "match_id,categoria,votante_id";
      await upsert("badge_social_voti", chiave, {
        match_id: match,
        categoria: "sorriso",
        votante_id: "g1",
        votato_id: "g2",
        votato_nome: "Due",
      });
      await upsert("badge_social_voti", chiave, {
        match_id: match,
        categoria: "urlo",
        votante_id: "g1",
        votato_id: "g2",
        votato_nome: "Due",
      });
      const righe = await leggi("badge_social_voti", `match_id=eq.${match}&select=categoria`);
      assert.equal(righe.length, 2, "categorie diverse, righe diverse");

      await upsert("badge_social_voti", chiave, {
        match_id: match,
        categoria: "urlo",
        votante_id: "g1",
        votato_id: "g4",
        votato_nome: "Quattro",
      });
      const urlo = await leggi(
        "badge_social_voti",
        `match_id=eq.${match}&categoria=eq.urlo&select=votato_id`,
      );
      assert.equal(urlo.length, 1, "nella stessa categoria si sostituisce");
      assert.equal(urlo[0]?.["votato_id"], "g4");
    });

    // --- cacche: una dichiarazione per giocatore e partita --------------------------
    await prova("le cacche tengono una quantità per giocatore e partita", async () => {
      const evento = `${PREFISSO}-e1`;
      const chiave = "evento_id,giocatore_id";
      await upsert("cacche_partita", chiave, {
        evento_id: evento,
        giocatore_id: "g1",
        quantita: 2,
      });
      await upsert("cacche_partita", chiave, {
        evento_id: evento,
        giocatore_id: "g1",
        quantita: 3,
      });
      await upsert("cacche_partita", chiave, {
        evento_id: evento,
        giocatore_id: "g2",
        quantita: 1,
      });
      const righe = await leggi(
        "cacche_partita",
        `evento_id=eq.${evento}&select=giocatore_id,quantita&order=giocatore_id`,
      );
      assert.equal(righe.length, 2, "un giocatore una riga");
      assert.equal(righe[0]?.["quantita"], 3, "la seconda dichiarazione sostituisce la prima");
    });

    // --- turni palloni: un solo incaricato per evento ------------------------------
    await prova("il turno palloni resta uno per evento", async () => {
      const evento = `${PREFISSO}-e2`;
      await upsert("turni_palloni", "evento_id", {
        evento_id: evento,
        giocatore_id: "g1",
        aggiornato_da: "g1",
      });
      await upsert("turni_palloni", "evento_id", {
        evento_id: evento,
        giocatore_id: "g5",
        aggiornato_da: "g9",
      });
      const righe = await leggi(
        "turni_palloni",
        `evento_id=eq.${evento}&select=giocatore_id,aggiornato_da`,
      );
      assert.equal(righe.length, 1, "riassegnare non aggiunge un secondo incaricato");
      assert.equal(righe[0]?.["giocatore_id"], "g5", "vale l'ultima assegnazione");
      assert.equal(righe[0]?.["aggiornato_da"], "g9", "e si sa chi l'ha fatta");
    });

    // --- presenze: la risposta si cambia, il cronometro no --------------------------
    // Due colonne che sembrano la stessa cosa e non lo sono: `risposto_il` è la PRIMA
    // risposta e alimenta la serie "Conferme 24h", `aggiornato_il` è l'ultima modifica e non
    // alimenta niente. Il trigger `risposte_presenze_risposto_il_immutabile` (M9) tiene ferma
    // la prima: senza, chi risponde subito e ci ripensa una settimana dopo risulterebbe lento.
    await prova(
      "la risposta di presenza si aggiorna senza far ripartire il cronometro",
      async () => {
        const evento = `${PREFISSO}-e3`;
        const chiave = "evento_id,giocatore_id";
        const prima = await upsert("risposte_presenze", chiave, {
          evento_id: evento,
          giocatore_id: "g1",
          stato: "presente",
          aggiornato_il: new Date("2026-01-01T18:00:00Z").toISOString(),
        });
        await upsert("risposte_presenze", chiave, {
          evento_id: evento,
          giocatore_id: "g1",
          stato: "assente",
          aggiornato_il: new Date("2026-01-01T19:00:00Z").toISOString(),
          // Il ripensamento prova anche a riscrivere l'istante della prima risposta: è
          // esattamente la mossa che il trigger deve annullare.
          risposto_il: new Date("2026-01-08T19:00:00Z").toISOString(),
        });
        const righe = await leggi(
          "risposte_presenze",
          `evento_id=eq.${evento}&select=stato,aggiornato_il,risposto_il`,
        );
        assert.equal(righe.length, 1, "una risposta per giocatore");
        assert.equal(righe[0]?.["stato"], "assente", "vale l'ultima risposta");
        assert.notEqual(
          righe[0]?.["aggiornato_il"],
          prima[0]?.["aggiornato_il"],
          "l'ultima modifica si muove",
        );
        assert.equal(
          righe[0]?.["risposto_il"],
          prima[0]?.["risposto_il"],
          "la prima risposta resta quella: il trigger di M9 la congela",
        );
      },
    );

    // --- scout live: lo stato viene sostituito, non fuso ----------------------------
    await prova("lo scout live sostituisce lo stato invece di fonderlo", async () => {
      const evento = `${PREFISSO}-e4`;
      await upsert("scout_live", "evento_id", {
        evento_id: evento,
        stato: { set: 1, punti: 10 },
      });
      await upsert("scout_live", "evento_id", { evento_id: evento, stato: { set: 2 } });
      const righe = await leggi("scout_live", `evento_id=eq.${evento}&select=stato`);
      assert.equal(righe.length, 1);
      assert.deepEqual(
        righe[0]?.["stato"],
        { set: 2 },
        "il jsonb viene rimpiazzato: i campi del set precedente non restano appesi",
      );
    });
  } finally {
    for (const tabella of TABELLE) {
      const colonna = tabella.endsWith("_voti") ? "match_id" : "evento_id";
      await rest(`${tabella}?${colonna}=like.${PREFISSO}*`, { method: "DELETE" });
    }
    riepilogo("scritture");
  }
}
