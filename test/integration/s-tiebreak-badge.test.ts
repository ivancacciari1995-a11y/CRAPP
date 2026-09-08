/**
 * Badge segreto Uomo tie-break end-to-end contro il database locale:
 * `bun test/integration/s-tiebreak-badge.test.ts`.
 *
 * I test unitari (`test/unit/mvp-voti.test.ts`, `test/unit/pagelle.test.ts`,
 * `test/unit/badges.test.ts`) verificano `mvpVintiPerGiocatore()`, `mediePagelle()` e
 * `statoBadge()` come funzioni pure. Qui invece si scrivono voti veri su `mvp_voti` e
 * `pagelle_voti`, si rileggono via REST e si passa il risultato attraverso
 * `mvpVintiPerGiocatore()`/`mediePagelle()` fino a `statoBadge()` sul badge segreto
 * `s-tiebreak`.
 *
 * Copre in particolare il fix di questa sessione: prima `s-tiebreak` usava `g.mediaVoto` senza
 * applicare `VOTI_MINIMI_PAGELLA`, a differenza del badge normale Pagellone che usa lo stesso
 * campo — un solo voto pagella altissimo poteva sbloccare il segreto insieme a 2 MVP, senza
 * significatività statistica. Qui si dimostra con dati reali che ora serve lo stesso minimo di
 * voti di Pagellone anche per questo segreto.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-s-tiebreak-badge`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { badgeSegreti, statoBadge, VOTI_MINIMI_PAGELLA } from "@/lib/badges";
import { mvpVintiPerGiocatore, type VotoMvp } from "@/lib/mvp-voti";
import { mediePagelle, type VotoPagella } from "@/lib/pagelle";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("badge Uomo tie-break sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("s-tiebreak-badge");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`badge Uomo tie-break su ${URL_BASE}`);

  const PREFISSO = "test-s-tiebreak-badge";
  const def = badgeSegreti.find((b) => b.id === "s-tiebreak")!;

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

  async function votaMvp(riga: VotoMvp) {
    const res = await rest("mvp_voti?on_conflict=match_id,votante_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(riga),
    });
    if (!res.ok) throw new Error(`upsert su mvp_voti: ${res.status} ${await res.text()}`);
  }

  async function votaPagella(riga: VotoPagella) {
    const res = await rest("pagelle_voti?on_conflict=match_id,votante_id,votato_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(riga),
    });
    if (!res.ok) throw new Error(`upsert su pagelle_voti: ${res.status} ${await res.text()}`);
  }

  async function leggiMvp(): Promise<VotoMvp[]> {
    const res = await rest(
      `mvp_voti?match_id=like.${PREFISSO}-*&select=match_id,votante_id,votato_id,votato_nome`,
    );
    return (await res.json()) as VotoMvp[];
  }

  async function leggiPagelle(): Promise<VotoPagella[]> {
    const res = await rest(
      `pagelle_voti?match_id=like.${PREFISSO}-*&select=match_id,votante_id,votato_id,voto`,
    );
    return (await res.json()) as VotoPagella[];
  }

  function giocatoreAzzerato(mvp: number, mediaVoto: number, votiPagella: number): Giocatore {
    return { ...giocatori[0]!, mvp, mediaVoto, votiPagella, palloni: 0, presenze: 0 };
  }

  try {
    await prova(
      "sotto la soglia minima di voti pagella, 2 MVP e media alta non bastano",
      async () => {
        // "tb1" vince nettamente m1 e m2 (2 MVP), e riceve un solo voto pagella da 9 (media
        // alta ma su un campione troppo piccolo): il segreto deve restare bloccato.
        await votaMvp({
          match_id: `${PREFISSO}-m1`,
          votante_id: "va",
          votato_id: "tb1",
          votato_nome: "Uno",
        });
        await votaMvp({
          match_id: `${PREFISSO}-m2`,
          votante_id: "va",
          votato_id: "tb1",
          votato_nome: "Uno",
        });
        await votaPagella({
          match_id: `${PREFISSO}-m1`,
          votante_id: "va",
          votato_id: "tb1",
          voto: 9,
        });

        const vinti = mvpVintiPerGiocatore(await leggiMvp());
        const medie = mediePagelle(await leggiPagelle());
        assert.equal(vinti["tb1"], 2, "2 MVP netti");
        assert.equal(medie["tb1"]?.voti, 1, "un solo voto pagella");
        assert.equal(medie["tb1"]?.media, 9);

        const badge = statoBadge(
          def,
          giocatoreAzzerato(vinti["tb1"]!, medie["tb1"]!.media, medie["tb1"]!.voti),
        );
        assert.equal(
          badge.grado,
          null,
          `sotto ${VOTI_MINIMI_PAGELLA} voti: il segreto resta bloccato`,
        );
      },
    );

    await prova(`al ${VOTI_MINIMI_PAGELLA}° voto pagella il segreto si sblocca`, async () => {
      // Altri 4 voti pagella allo stesso "tb1", sempre alti: raggiunta la soglia minima, con
      // 2 MVP e media alta il segreto si sblocca.
      for (const [i, votante] of ["vb", "vc", "vd", "ve"].entries()) {
        await votaPagella({
          match_id: `${PREFISSO}-n${i + 1}`,
          votante_id: votante,
          votato_id: "tb1",
          voto: 9,
        });
      }

      const vinti = mvpVintiPerGiocatore(await leggiMvp());
      const medie = mediePagelle(await leggiPagelle());
      assert.equal(medie["tb1"]?.voti, 5);
      assert.equal(medie["tb1"]?.media, 9);

      const badge = statoBadge(
        def,
        giocatoreAzzerato(vinti["tb1"]!, medie["tb1"]!.media, medie["tb1"]!.voti),
      );
      assert.equal(badge.grado, "oro", "2 MVP, 5 voti, media 9: il segreto si sblocca");
    });
  } finally {
    await rest(`mvp_voti?match_id=like.${PREFISSO}-*`, { method: "DELETE" });
    await rest(`pagelle_voti?match_id=like.${PREFISSO}-*`, { method: "DELETE" });
  }

  riepilogo("s-tiebreak-badge");
}
