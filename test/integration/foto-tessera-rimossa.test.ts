/**
 * Via la foto tessera dal profilo (M29, DD-044): `bun test/integration/foto-tessera-rimossa.test.ts`.
 *
 * Gira solo sullo stack locale (`npx supabase start`): verifica che la colonna `foto_path` non ci
 * sia più e che le colonne lette dall'app (`COLONNE_PROFILO`) esistano tutte. Non guarda il
 * database di `.env`, che può essere ancora quello di produzione prima di applicare la M29.
 */
import assert from "node:assert/strict";
import { COLONNE_PROFILO } from "@/lib/profili-core";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("foto tessera rimossa", "stack locale non attivo (npx supabase start)");
  riepilogo("foto-tessera-rimossa");
} else {
  const leggi = (colonne: string) =>
    fetch(`${locale.url}/rest/v1/profili_giocatore?select=${encodeURIComponent(colonne)}&limit=1`, {
      headers: { apikey: locale.servizio, Authorization: `Bearer ${locale.servizio}` },
    });

  await prova("la colonna foto_path non esiste più", async () => {
    const res = await leggi("foto_path");
    assert.equal(res.status, 400, "PostgREST rifiuta una colonna che non c'è");
    assert.match(await res.text(), /foto_path/);
  });

  await prova("le colonne lette dall'app esistono tutte", async () => {
    assert.ok(!COLONNE_PROFILO.includes("foto"), "COLONNE_PROFILO non nomina la foto");
    const res = await leggi(COLONNE_PROFILO);
    assert.equal(res.status, 200, await res.text());
  });

  riepilogo("foto-tessera-rimossa");
}
