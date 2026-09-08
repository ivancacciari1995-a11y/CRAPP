/**
 * Badge MVP end-to-end contro il database locale: `bun test/integration/mvp-badge.test.ts`.
 *
 * I test unitari (`test/unit/mvp-voti.test.ts`, `test/unit/badges.test.ts`) verificano
 * `mvpVintiPerGiocatore()` e `statoBadge()` come funzioni pure, con voti costruiti a mano. Qui
 * invece si scrivono voti veri su `mvp_voti`, si rileggono via REST con la stessa selezione di
 * `useVotiMvp()`, e si passa il risultato attraverso `mvpVintiPerGiocatore()` fino a
 * `statoBadge()` sul badge `mvp`: se una colonna cambia nome o la mappatura si rompe, qui il
 * grado del badge torna sbagliato anche se i test unitari restano verdi, perché quelli non
 * toccano mai il database.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-mvp-badge`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { badgeDefs, statoBadge } from "@/lib/badges";
import { mvpVintiPerGiocatore, type VotoMvp } from "@/lib/mvp-voti";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("badge MVP sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("mvp-badge");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`badge MVP su ${URL_BASE}`);

  const PREFISSO = "test-mvp-badge";
  const mvpDef = badgeDefs.find((b) => b.id === "mvp")!;

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

  async function upsert(riga: VotoMvp) {
    const res = await rest("mvp_voti?on_conflict=match_id,votante_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(riga),
    });
    if (!res.ok) throw new Error(`upsert su mvp_voti: ${res.status} ${await res.text()}`);
  }

  /** Rilegge esattamente come `useVotiMvp()`. */
  async function leggiVoti(): Promise<VotoMvp[]> {
    const res = await rest(
      `mvp_voti?match_id=like.${PREFISSO}-*&select=match_id,votante_id,votato_id,votato_nome`,
    );
    return (await res.json()) as VotoMvp[];
  }

  /** Un giocatore azzerato, come in `test/unit/badges.test.ts`. */
  function giocatoreAzzerato(mvp: number): Giocatore {
    return { ...giocatori[0]!, mvp, mediaVoto: 0, palloni: 0, presenze: 0 };
  }

  try {
    await prova(
      "il badge MVP passa da bronzo ad argento con vittorie vere lette dal database",
      async () => {
        // Il votato "vg1" vince nettamente le partite m1 e m2 (2 voti contro 1), pareggia in
        // m3 (nessun vincitore) e perde in m4 (0 voti): dopo m1+m2 ha 2 vittorie -> bronzo,
        // non ancora argento (soglia 3). Il votato "vg2" non vince mai: resta senza badge.
        await upsert({
          match_id: `${PREFISSO}-m1`,
          votante_id: "va",
          votato_id: "vg1",
          votato_nome: "Uno",
        });
        await upsert({
          match_id: `${PREFISSO}-m1`,
          votante_id: "vb",
          votato_id: "vg1",
          votato_nome: "Uno",
        });
        await upsert({
          match_id: `${PREFISSO}-m1`,
          votante_id: "vc",
          votato_id: "vg2",
          votato_nome: "Due",
        });
        await upsert({
          match_id: `${PREFISSO}-m2`,
          votante_id: "va",
          votato_id: "vg1",
          votato_nome: "Uno",
        });
        await upsert({
          match_id: `${PREFISSO}-m2`,
          votante_id: "vb",
          votato_id: "vg1",
          votato_nome: "Uno",
        });
        await upsert({
          match_id: `${PREFISSO}-m3`,
          votante_id: "va",
          votato_id: "vg1",
          votato_nome: "Uno",
        });
        await upsert({
          match_id: `${PREFISSO}-m3`,
          votante_id: "vb",
          votato_id: "vg2",
          votato_nome: "Due",
        });

        const voti = await leggiVoti();
        const vinti = mvpVintiPerGiocatore(voti);
        assert.equal(vinti["vg1"], 2, "vg1 vince m1 e m2, pareggia in m3 (non conta)");
        assert.equal(vinti["vg2"] ?? 0, 0, "vg2 non vince mai nettamente");

        const badgeVg1 = statoBadge(mvpDef, giocatoreAzzerato(vinti["vg1"] ?? 0));
        assert.equal(badgeVg1.grado, "bronzo", "2 vittorie: soglia bronzo (1) raggiunta");
        assert.equal(badgeVg1.prossimo, "argento");
        assert.equal(badgeVg1.prossimaSoglia, 3, "manca 1 vittoria all'argento");

        const badgeVg2 = statoBadge(mvpDef, giocatoreAzzerato(vinti["vg2"] ?? 0));
        assert.equal(badgeVg2.grado, null, "zero vittorie nette: nessun badge sbloccato");

        // Una terza vittoria netta porta vg1 da bronzo ad argento (soglia 3).
        await upsert({
          match_id: `${PREFISSO}-m4`,
          votante_id: "va",
          votato_id: "vg1",
          votato_nome: "Uno",
        });
        const vintiDopo = mvpVintiPerGiocatore(await leggiVoti());
        assert.equal(vintiDopo["vg1"], 3);
        assert.equal(
          statoBadge(mvpDef, giocatoreAzzerato(vintiDopo["vg1"]!)).grado,
          "argento",
          "3 vittorie: soglia argento raggiunta",
        );
      },
    );
  } finally {
    await rest(`mvp_voti?match_id=like.${PREFISSO}-*`, { method: "DELETE" });
  }

  riepilogo("mvp-badge");
}
