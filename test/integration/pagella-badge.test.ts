/**
 * Badge Pagellone end-to-end contro il database locale: `bun test/integration/pagella-badge.test.ts`.
 *
 * I test unitari (`test/unit/pagelle.test.ts`, `test/unit/badges.test.ts`) verificano
 * `mediePagelle()` e `statoBadge()` come funzioni pure, con voti costruiti a mano. Qui invece
 * si scrivono voti veri su `pagelle_voti`, si rileggono via REST con la stessa selezione di
 * `usePagelle()`, e si passa il risultato attraverso `mediePagelle()` fino a `statoBadge()` sul
 * badge `pagella`: se una colonna cambia nome o la mappatura si rompe, qui il grado del badge
 * torna sbagliato anche se i test unitari restano verdi, perché quelli non toccano mai il
 * database.
 *
 * Copre in particolare la soglia minima di voti (`VOTI_MINIMI_PAGELLA`, aggiunta per il gap
 * "un solo voto sblocca/toglie il badge" segnalato in `docs/modules/badge.md`): con voti reali
 * letti dal database, non solo con numeri scelti a mano.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-pagella-badge`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { badgeDefs, statoBadge, VOTI_MINIMI_PAGELLA } from "@/lib/badges";
import { mediePagelle, type VotoPagella } from "@/lib/pagelle";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("badge Pagellone sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("pagella-badge");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`badge Pagellone su ${URL_BASE}`);

  const PREFISSO = "test-pagella-badge";
  const pagellaDef = badgeDefs.find((b) => b.id === "pagella")!;

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

  async function upsert(riga: VotoPagella) {
    const res = await rest("pagelle_voti?on_conflict=match_id,votante_id,votato_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(riga),
    });
    if (!res.ok) throw new Error(`upsert su pagelle_voti: ${res.status} ${await res.text()}`);
  }

  /** Rilegge esattamente come `usePagelle()`. */
  async function leggiVoti(): Promise<VotoPagella[]> {
    const res = await rest(
      `pagelle_voti?match_id=like.${PREFISSO}-*&select=match_id,votante_id,votato_id,voto`,
    );
    return (await res.json()) as VotoPagella[];
  }

  /** Un giocatore azzerato, come in `test/unit/badges.test.ts`. */
  function giocatoreAzzerato(mediaVoto: number, votiPagella: number): Giocatore {
    return { ...giocatori[0]!, mediaVoto, votiPagella, mvp: 0, palloni: 0, presenze: 0 };
  }

  try {
    await prova(
      `sotto ${VOTI_MINIMI_PAGELLA} voti il badge resta bloccato anche con media alta`,
      async () => {
        // "pg1" riceve 4 voti da 9-10 (media altissima) ma sotto la soglia minima di voti:
        // il badge non deve sbloccarsi nonostante la media sarebbe oro.
        for (const [i, votante] of ["va", "vb", "vc", "vd"].entries()) {
          await upsert({
            match_id: `${PREFISSO}-m${i + 1}`,
            votante_id: votante,
            votato_id: "pg1",
            voto: 9,
          });
        }

        const voti = await leggiVoti();
        const medie = mediePagelle(voti);
        assert.equal(medie["pg1"]?.voti, 4, "4 voti scritti, 4 riletti");
        assert.equal(medie["pg1"]?.media, 9, "media alta");

        const badgePg1 = statoBadge(
          pagellaDef,
          giocatoreAzzerato(medie["pg1"]!.media, medie["pg1"]!.voti),
        );
        assert.equal(badgePg1.grado, null, "4 voti < 5: il badge resta bloccato");
      },
    );

    await prova(
      `al ${VOTI_MINIMI_PAGELLA}° voto il badge Pagellone si sblocca con il grado giusto`,
      async () => {
        // Un quinto voto a "pg1" (stesso giocatore del test precedente) fa scattare la
        // soglia minima: la media (9) sblocca subito l'oro (soglia 8.5).
        await upsert({
          match_id: `${PREFISSO}-m5`,
          votante_id: "ve",
          votato_id: "pg1",
          voto: 9,
        });

        const medie = mediePagelle(await leggiVoti());
        assert.equal(medie["pg1"]?.voti, 5);
        const badgePg1 = statoBadge(
          pagellaDef,
          giocatoreAzzerato(medie["pg1"]!.media, medie["pg1"]!.voti),
        );
        assert.equal(badgePg1.grado, "oro", "5 voti raggiunti: la media conta, è oro");
      },
    );

    await prova("le soglie di grado normali si applicano sopra il minimo di voti", async () => {
      // "pg2" riceve 5 voti che fanno una media di bronzo (6.5), non oro: verifica che sopra
      // la soglia minima il grado dipenda ancora dalla media, non solo dal numero di voti.
      for (const [i, votante] of ["va", "vb", "vc", "vd", "ve"].entries()) {
        await upsert({
          match_id: `${PREFISSO}-n${i + 1}`,
          votante_id: votante,
          votato_id: "pg2",
          voto: i < 4 ? 6 : 9, // (6*4+9)/5 = 6.6 -> arrotondato 6.6, sopra 6.5
        });
      }
      const medie = mediePagelle(await leggiVoti());
      assert.equal(medie["pg2"]?.voti, 5);
      assert.equal(medie["pg2"]?.media, 6.6);
      const badgePg2 = statoBadge(
        pagellaDef,
        giocatoreAzzerato(medie["pg2"]!.media, medie["pg2"]!.voti),
      );
      assert.equal(badgePg2.grado, "bronzo", "media 6.6: bronzo, non oro");
    });
  } finally {
    await rest(`pagelle_voti?match_id=like.${PREFISSO}-*`, { method: "DELETE" });
  }

  riepilogo("pagella-badge");
}
