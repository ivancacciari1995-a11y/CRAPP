/**
 * Schema e permessi del Profilo Giocatore: `bun test/integration/schema-profili.test.ts`.
 *
 * Verifica contro un database vero (locale con `npx supabase start`, oppure quello
 * configurato in `.env`) le tre cose che il codice dà per scontate: le colonne della
 * tabella, la chiusura verso l'utente anonimo e il bucket privato.
 *
 * Salta con un motivo esplicito quando mancano le credenziali o quando la migration
 * M2 non è ancora applicata a quel database: sono stati dell'ambiente, non difetti.
 */
import assert from "node:assert/strict";
import { COLONNE_PROFILO } from "@/lib/profili-core";
import { envDaFile } from "../helpers/server";
import { prova, riepilogo, salta } from "../helpers/prova";

const env = { ...envDaFile(), ...process.env };
const URL_BASE = env["SUPABASE_URL"];
const CHIAVE_SERVIZIO = env["SUPABASE_SERVICE_ROLE_KEY"];
const CHIAVE_PUBBLICA = env["SUPABASE_PUBLISHABLE_KEY"];

/** Le chiavi nuove sono opache e viaggiano solo in `apikey`; quelle legacy sono JWT. */
function intestazioni(chiave: string): Record<string, string> {
  const base: Record<string, string> = { apikey: chiave, "content-type": "application/json" };
  if (chiave.startsWith("eyJ")) base["Authorization"] = `Bearer ${chiave}`;
  return base;
}

const rest = (percorso: string, chiave: string, init?: RequestInit) =>
  fetch(`${URL_BASE}/rest/v1/${percorso}`, {
    ...init,
    headers: { ...intestazioni(chiave), ...(init?.headers ?? {}) },
  });

const bucketProfili = (chiave: string) =>
  fetch(`${URL_BASE}/storage/v1/bucket/profili-giocatore`, { headers: intestazioni(chiave) });

console.log(`schema profili su ${URL_BASE ?? "(non configurato)"}`);

if (!URL_BASE || !CHIAVE_SERVIZIO || !CHIAVE_PUBBLICA) {
  salta("schema e permessi dei profili", "credenziali Supabase non configurate");
  riepilogo("schema profili");
} else {
  try {
    // --- M1: anagrafica della squadra ------------------------------------------
    await prova("la rosa di M1 è popolata e collegabile agli account", async () => {
      const res = await rest(
        "giocatori_squadra?select=id,nome,cognome,auth_user_id,attivo",
        CHIAVE_SERVIZIO,
      );
      assert.equal(res.status, 200);
      const righe = (await res.json()) as Array<{ id: string }>;
      assert.ok(righe.length >= 17, `attesi almeno 17 giocatori, trovati ${righe.length}`);
      assert.ok(
        righe.every((r) => /^g[0-9]+$/.test(r.id)),
        "gli ID restano nel formato g1..gN (DD-012)",
      );
    });

    // Attenzione al falso verde: su un UPDATE che non tocca nessuna riga PostgREST
    // risponde comunque 2xx. Quello che conta è che il dato non cambi.
    await prova("un anonimo non si collega a uno slot della rosa", async () => {
      const res = await rest("giocatori_squadra?id=eq.g1", CHIAVE_PUBBLICA, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ auth_user_id: "00000000-0000-0000-0000-000000000000" }),
      });
      if (res.ok) {
        const aggiornate = (await res.json()) as unknown[];
        assert.equal(aggiornate.length, 0, "nessuna riga aggiornata senza sessione");
      }
      const dopo = await rest("giocatori_squadra?id=eq.g1&select=auth_user_id", CHIAVE_SERVIZIO);
      const righe = (await dopo.json()) as Array<{ auth_user_id: string | null }>;
      assert.equal(righe[0]?.auth_user_id ?? null, null, "lo slot g1 è rimasto libero");
    });

    // --- M8: tracciamento tesseramento CSI --------------------------------------
    const m8 = await rest(
      "giocatori_squadra?select=numero_tessera,data_tessera&limit=1",
      CHIAVE_SERVIZIO,
    );
    if (!m8.ok) {
      salta(
        "colonne di tesseramento in giocatori_squadra",
        "M8 non applicata (npx supabase db push)",
      );
    } else {
      await prova("giocatori_squadra espone numero e data della tessera CSI", async () => {
        assert.equal(m8.status, 200);
      });
    }

    // --- M2: tabella dei profili -----------------------------------------------
    const m2 = await rest("profili_giocatore?select=giocatore_id&limit=1", CHIAVE_SERVIZIO);
    if (!m2.ok) {
      salta("schema e permessi di profili_giocatore", "M2 non applicata (npx supabase db push)");
    } else {
      await prova("profili_giocatore espone tutte le colonne che il codice legge", async () => {
        const colonne = COLONNE_PROFILO.replace(/\s/g, "");
        const res = await rest(`profili_giocatore?select=${colonne}&limit=1`, CHIAVE_SERVIZIO);
        const corpo = await res.text();
        assert.equal(res.status, 200, corpo);
        assert.ok(Array.isArray(JSON.parse(corpo)));
      });

      await prova("il documento ha due facciate separate", async () => {
        const res = await rest(
          "profili_giocatore?select=documento_fronte_path,documento_retro_path&limit=1",
          CHIAVE_SERVIZIO,
        );
        assert.equal(res.status, 200, "fronte e retro sono colonne distinte");
      });

      // Il punto della RLS: senza sessione non si legge e non si scrive. È la garanzia su
      // cui si regge tutto il modulo, e a nessuno serve fidarsi della prosa.
      await prova("un anonimo non legge i profili", async () => {
        const res = await rest("profili_giocatore?select=giocatore_id", CHIAVE_PUBBLICA);
        if (res.ok) {
          const righe = (await res.json()) as unknown[];
          assert.equal(righe.length, 0, "nessuna riga visibile senza sessione");
        } else {
          assert.ok(res.status >= 400, `accesso negato (${res.status})`);
        }
      });

      await prova("un anonimo non scrive i profili", async () => {
        const res = await rest("profili_giocatore", CHIAVE_PUBBLICA, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ giocatore_id: "g1", telefono: "000" }),
        });
        assert.ok(!res.ok, `la scrittura anonima deve fallire, invece ha risposto ${res.status}`);
      });
    }

    // --- M2: bucket privato -------------------------------------------------------
    const bucketRes = await bucketProfili(CHIAVE_SERVIZIO);
    if (!bucketRes.ok) {
      salta("bucket dei documenti", "M2 non applicata (npx supabase db push)");
    } else {
      await prova("il bucket dei documenti è privato", async () => {
        const bucket = (await bucketRes.json()) as { public?: boolean };
        assert.equal(bucket.public, false, "documenti e certificati non sono mai pubblici");
      });

      await prova("un anonimo non scarica i file dei profili", async () => {
        const res = await fetch(
          `${URL_BASE}/storage/v1/object/profili-giocatore/g1/certificato.pdf`,
          { headers: intestazioni(CHIAVE_PUBBLICA) },
        );
        assert.ok(!res.ok, `nessun accesso anonimo allo storage (${res.status})`);
      });
    }
  } finally {
    riepilogo("schema profili");
  }
}
