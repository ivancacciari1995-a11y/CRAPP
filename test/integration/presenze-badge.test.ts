/**
 * Badge Presenza fissa end-to-end contro il database locale:
 * `bun test/integration/presenze-badge.test.ts`.
 *
 * I test unitari (`test/unit/presenze.test.ts`, `test/unit/badges.test.ts`) verificano
 * `contaPresenzeGiocatore()` e `statoBadge()` come funzioni pure, con eventi e risposte
 * costruiti a mano. Qui invece si scrivono eventi e risposte veri su `eventi_app`/
 * `risposte_presenze`, si rileggono via REST con la stessa forma di `fetchPresenze()`/
 * `daRiga()`, e si passa il risultato attraverso `contaPresenzeGiocatore()` fino a
 * `statoBadge()` sul badge `presenze`: se una colonna cambia nome o la mappatura si rompe, qui
 * il grado del badge torna sbagliato anche se i test unitari restano verdi, perché quelli non
 * toccano mai il database.
 *
 * Copre anche un punto verificato nell'analisi ma non ovvio: **non serve nessun controllo a
 * database sui convocati** per questo badge (a differenza di MVP/pagelle/badge social, vedi
 * M13 in `docs/modules/badge.md`) perché `contaPresenzeGiocatore()` filtra già gli eventi per
 * `convocati` lato applicazione — una risposta scritta per un evento a cui non si era
 * convocati non conta comunque, anche se la riga esiste nel database.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-presenze-badge`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { badgeDefs, statoBadge } from "@/lib/badges";
import { contaPresenzeGiocatore } from "@/lib/presenze";
import { daRiga, type RigaEvento, type Evento } from "@/lib/eventi";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("badge presenze sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("presenze-badge");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`badge presenze su ${URL_BASE}`);

  const PREFISSO = "test-presenze-badge";
  const presenzeDef = badgeDefs.find((b) => b.id === "presenze")!;
  // "Oggi" fissato nel futuro: gli eventi scritti sotto sono datati nel passato remoto, così
  // restano "passati" (quindi contati) a prescindere da quando gira il test.
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

  /** `2020-01-01` per i=1, avanzando di un giorno per ogni evento: niente collisioni di data. */
  const dataEvento = (i: number) => {
    const d = new Date(Date.UTC(2020, 0, 1));
    d.setUTCDate(d.getUTCDate() + i - 1);
    return d.toISOString().slice(0, 10);
  };

  async function creaEvento(id: string, i: number, convocati?: string[]) {
    const res = await rest("eventi_app", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id,
        tipo: "allenamento",
        titolo: `Allenamento ${id}`,
        data: dataEvento(i),
        ...(convocati ? { convocati } : {}),
      }),
    });
    if (!res.ok) throw new Error(`creazione evento ${id}: ${res.status} ${await res.text()}`);
  }

  async function rispondi(eventoId: string, giocatoreId: string, stato: string) {
    const res = await rest("risposte_presenze?on_conflict=evento_id,giocatore_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ evento_id: eventoId, giocatore_id: giocatoreId, stato }),
    });
    if (!res.ok) throw new Error(`upsert su risposte_presenze: ${res.status} ${await res.text()}`);
  }

  /** Rilegge esattamente come fa l'app: `daRiga()` per gli eventi. */
  async function leggiEventi(): Promise<Evento[]> {
    const res = await rest(
      "eventi_app?id=like." +
        PREFISSO +
        "*&select=id,tipo,titolo,luogo,data,ora,note,convocati,campionato,casa,pagelle_chiuse,creato_il",
    );
    const righe = (await res.json()) as RigaEvento[];
    return righe.map(daRiga);
  }

  /** Rilegge esattamente come `fetchPresenze()`. */
  async function leggiPresenze(): Promise<Record<string, Record<string, string>>> {
    const res = await rest(
      `risposte_presenze?evento_id=like.${PREFISSO}*&select=evento_id,giocatore_id,stato`,
    );
    const righe = (await res.json()) as Array<{
      evento_id: string;
      giocatore_id: string;
      stato: string;
    }>;
    const mappa: Record<string, Record<string, string>> = {};
    for (const r of righe) (mappa[r.evento_id] ??= {})[r.giocatore_id] = r.stato;
    return mappa;
  }

  /** Un giocatore azzerato, come in `test/unit/badges.test.ts`. */
  function giocatoreAzzerato(presenze: number): Giocatore {
    return { ...giocatori[0]!, presenze, mvp: 0, mediaVoto: 0, votiPagella: 0, palloni: 0 };
  }

  try {
    await prova(
      "il badge presenze passa da bronzo a oro con presenze vere lette dal database",
      async () => {
        // 30 allenamenti passati. "pp1" risponde a tutti e 30 (i primi 5 "presente", un
        // "ritardo" nel mezzo per verificare che conti come presenza, il resto "presente"),
        // così una sola scrittura basta a verificare le tre soglie 5/15/30.
        for (let i = 1; i <= 30; i += 1) {
          await creaEvento(`${PREFISSO}-a${String(i).padStart(2, "0")}`, i);
        }
        for (let i = 1; i <= 30; i += 1) {
          const stato = i === 10 ? "ritardo" : "presente";
          await rispondi(`${PREFISSO}-a${String(i).padStart(2, "0")}`, "pp1", stato);
        }
        // "pp2" risponde solo ai primi 5: resta a bronzo, non oltre.
        for (let i = 1; i <= 5; i += 1) {
          await rispondi(`${PREFISSO}-a${String(i).padStart(2, "0")}`, "pp2", "presente");
        }
        // "pp2" risponde anche "assente" a un evento: non deve contare.
        await rispondi(`${PREFISSO}-a06`, "pp2", "assente");

        const eventi = await leggiEventi();
        assert.equal(eventi.length, 30, "tutti gli eventi scritti si rileggono");
        const presenze = await leggiPresenze();

        const contoPp1 = contaPresenzeGiocatore("pp1", eventi, presenze, OGGI);
        assert.equal(contoPp1, 30, "30 risposte, incluso un ritardo contato come presenza");
        assert.equal(
          statoBadge(presenzeDef, giocatoreAzzerato(contoPp1)).grado,
          "oro",
          "30 presenze: soglia oro raggiunta",
        );

        const contoPp2 = contaPresenzeGiocatore("pp2", eventi, presenze, OGGI);
        assert.equal(contoPp2, 5, "5 presenti, l'assente su a06 non conta");
        const badgePp2 = statoBadge(presenzeDef, giocatoreAzzerato(contoPp2));
        assert.equal(badgePp2.grado, "bronzo", "5 presenze: soglia bronzo raggiunta, non oltre");
        assert.equal(badgePp2.prossimo, "argento");
        assert.equal(badgePp2.prossimaSoglia, 15);

        // Un pp2 a metà strada (15 presenze) sblocca l'argento.
        for (let i = 7; i <= 16; i += 1) {
          await rispondi(`${PREFISSO}-a${String(i).padStart(2, "0")}`, "pp2", "presente");
        }
        const eventiDopo = await leggiEventi();
        const presenzeDopo = await leggiPresenze();
        const contoPp2Dopo = contaPresenzeGiocatore("pp2", eventiDopo, presenzeDopo, OGGI);
        assert.equal(contoPp2Dopo, 15, "5 + 10 nuove presenze");
        assert.equal(
          statoBadge(presenzeDef, giocatoreAzzerato(contoPp2Dopo)).grado,
          "argento",
          "15 presenze: soglia argento raggiunta",
        );
      },
    );

    await prova(
      "una risposta a un evento senza convocazione non conta per il badge, anche se la riga esiste",
      async () => {
        // "pp3" non è tra i convocati di questo evento (lista esplicita che lo esclude), ma
        // scrive comunque una risposta "presente" — bypassando l'interfaccia, come farebbe
        // chi parla direttamente con PostgREST. Deve restare a zero: la difesa è nella
        // funzione pura, non in una policy RLS (a differenza di MVP/pagelle/badge social).
        await creaEvento(`${PREFISSO}-ristretto`, 40, ["pp1"]);
        await rispondi(`${PREFISSO}-ristretto`, "pp3", "presente");

        const eventi = await leggiEventi();
        const presenze = await leggiPresenze();
        const conto = contaPresenzeGiocatore("pp3", eventi, presenze, OGGI);
        assert.equal(conto, 0, "pp3 non era convocato: la risposta non conta");
      },
    );
  } finally {
    await rest(`risposte_presenze?evento_id=like.${PREFISSO}*`, { method: "DELETE" });
    await rest(`eventi_app?id=like.${PREFISSO}*`, { method: "DELETE" });
  }

  riepilogo("presenze-badge");
}
