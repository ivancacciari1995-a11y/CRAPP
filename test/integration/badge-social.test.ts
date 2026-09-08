/**
 * Badge social (5 categorie) end-to-end contro il database locale:
 * `bun test/integration/badge-social.test.ts`.
 *
 * I test unitari (`test/unit/badge-social.test.ts`) verificano `conteggioCategoria()`,
 * `vincitoreCategoria()` e `badgeSocialVinti()` come funzioni pure, con categorie inventate
 * ("sorriso", "urlo" in `scritture.test.ts`) o con solo 2-3 delle 5 reali. Qui invece si
 * scrivono voti veri su `badge_social_voti` con le 5 categorie effettive di `categorieSocial`
 * (`affidabile`, `spirito`, `fairplay`, `meme`, `cuore`), si rileggono via REST con la stessa
 * selezione di `useVotiSocial()`, e si passa il risultato attraverso `badgeSocialVinti()`: se
 * una colonna cambia nome o un id di categoria diverge da quello scritto dall'app, qui si vede,
 * perché non c'è nessun vincolo CHECK a database sulla colonna `categoria` (vedi
 * `docs/modules/badge.md` § Problemi noti) — l'unica difesa è l'app che manda sempre uno dei 5
 * id validi, e questo test lo dimostra con dati reali su tutte e 5, non solo su un paio.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-badge-social`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import {
  badgeSocialVinti,
  categorieSocial,
  vincitoreCategoria,
  type VotoSocial,
} from "@/lib/badge-social";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("badge social sul database", "stack locale non attivo (npx supabase start)");
  riepilogo("badge-social");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`badge social su ${URL_BASE}`);

  const PREFISSO = "test-badge-social";

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

  async function vota(voto: VotoSocial) {
    const res = await rest("badge_social_voti?on_conflict=match_id,categoria,votante_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(voto),
    });
    if (!res.ok) throw new Error(`upsert su badge_social_voti: ${res.status} ${await res.text()}`);
  }

  async function leggiVoti(): Promise<VotoSocial[]> {
    const res = await rest(
      `badge_social_voti?match_id=like.${PREFISSO}-*&select=match_id,categoria,votante_id,votato_id,votato_nome`,
    );
    return (await res.json()) as VotoSocial[];
  }

  try {
    await prova(
      "tutte e 5 le categorie reali si contano e si vincono indipendentemente",
      async () => {
        // "bs1" vince nettamente tutte e 5 le categorie reali nella partita m1 (2 voti contro
        // 1 ciascuna): dimostra che l'id di categoria non è solo una stringa di comodo nei
        // test unitari, ma funziona identico per tutte e 5 quelle vere dell'app.
        for (const cat of categorieSocial) {
          await vota({
            match_id: `${PREFISSO}-m1`,
            categoria: cat.id,
            votante_id: "va",
            votato_id: "bs1",
            votato_nome: "Uno",
          });
          await vota({
            match_id: `${PREFISSO}-m1`,
            categoria: cat.id,
            votante_id: "vb",
            votato_id: "bs1",
            votato_nome: "Uno",
          });
          await vota({
            match_id: `${PREFISSO}-m1`,
            categoria: cat.id,
            votante_id: "vc",
            votato_id: "bs2",
            votato_nome: "Due",
          });
        }

        const voti = await leggiVoti();
        assert.equal(voti.length, categorieSocial.length * 3, "tutti i voti scritti si rileggono");

        for (const cat of categorieSocial) {
          const vincitore = vincitoreCategoria(voti, `${PREFISSO}-m1`, cat.id);
          assert.equal(vincitore?.id, "bs1", `bs1 vince "${cat.id}" con vantaggio netto`);
        }

        const vinti = badgeSocialVinti(voti, "bs1");
        assert.deepEqual(
          vinti,
          Object.fromEntries(categorieSocial.map((c) => [c.id, 1])),
          "una vittoria per ciascuna delle 5 categorie reali, nessuna persa per strada",
        );
        assert.deepEqual(badgeSocialVinti(voti, "bs2"), {}, "bs2 non vince mai nettamente");
      },
    );

    await prova("una parità su una categoria reale non assegna il badge, le altre sì", async () => {
      // Nella partita m2, "affidabile" finisce in parità (nessun vincitore), le altre 4 le
      // vince ancora "bs1": la parità deve bloccare solo la categoria coinvolta.
      await vota({
        match_id: `${PREFISSO}-m2`,
        categoria: "affidabile",
        votante_id: "va",
        votato_id: "bs1",
        votato_nome: "Uno",
      });
      await vota({
        match_id: `${PREFISSO}-m2`,
        categoria: "affidabile",
        votante_id: "vb",
        votato_id: "bs2",
        votato_nome: "Due",
      });
      for (const cat of categorieSocial.filter((c) => c.id !== "affidabile")) {
        await vota({
          match_id: `${PREFISSO}-m2`,
          categoria: cat.id,
          votante_id: "va",
          votato_id: "bs1",
          votato_nome: "Uno",
        });
      }

      const voti = await leggiVoti();
      assert.equal(
        vincitoreCategoria(voti, `${PREFISSO}-m2`, "affidabile"),
        null,
        "1 voto contro 1: parità, nessun vincitore",
      );
      const vintiTotali = badgeSocialVinti(voti, "bs1");
      // m1 (tutte e 5) + m2 (le 4 non in parità): "affidabile" resta a 1 (solo m1), le altre 4 a 2.
      assert.equal(vintiTotali["affidabile"], 1, "la parità in m2 non aggiunge una vittoria");
      for (const cat of categorieSocial.filter((c) => c.id !== "affidabile")) {
        assert.equal(vintiTotali[cat.id], 2, `"${cat.id}" vinta sia in m1 sia in m2`);
      }
    });
  } finally {
    await rest(`badge_social_voti?match_id=like.${PREFISSO}-*`, { method: "DELETE" });
  }

  riepilogo("badge-social");
}
