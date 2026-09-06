import { spawnSync } from "node:child_process";

/**
 * Credenziali dello stack Supabase locale (`npx supabase start`), lette da
 * `supabase status` e non da `.env`.
 *
 * I test che scrivono usano questo helper e non le variabili d'ambiente: un `.env`
 * puntato alla produzione non deve poter trasformare un test in una scrittura sul
 * database vero. Torna `null` — e il test si salta — se lo stack non è attivo o se
 * per qualsiasi motivo l'URL non è locale.
 */
export type StackLocale = { url: string; anon: string; servizio: string };

export function statoLocale(): StackLocale | null {
  const esito = spawnSync("npx", ["supabase", "status", "-o", "env"], {
    encoding: "utf8",
    timeout: 60_000,
  });
  if (esito.status !== 0) return null;
  const leggi = (nome: string) =>
    new RegExp(`^${nome}="?([^"\\n]+)"?$`, "m").exec(esito.stdout)?.[1] ?? "";
  const url = leggi("API_URL");
  const anon = leggi("ANON_KEY");
  const servizio = leggi("SERVICE_ROLE_KEY");
  if (!url || !anon || !servizio) return null;
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return null;
  return { url, anon, servizio };
}
