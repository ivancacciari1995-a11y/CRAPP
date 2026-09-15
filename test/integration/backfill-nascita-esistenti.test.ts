/**
 * Backfill di M19 (`m19_backfill_nascita_da_profili_esistenti`):
 * `bun test/integration/backfill-nascita-esistenti.test.ts`.
 *
 * M18 ha aggiunto `giocatori_squadra.nascita`, sincronizzata da un trigger su
 * `profili_giocatore` — ma solo per le scritture *future*. In produzione questo ha lasciato
 * scoperti i profili già compilati **prima** di M18: la nascita restava vuota finché
 * `m19_backfill_nascita_da_profili_esistenti` non ha rieseguito una tantum lo stesso
 * allineamento (vedi DD-031, aggiornamento del 15/09/2026).
 *
 * A differenza della bonifica eventi orfani (M15→M16, `bonifica_dati_evento_orfani()`),
 * questo backfill non è stato reso una funzione richiamabile: qui si verifica lo stesso
 * pattern SQL (`UPDATE giocatori_squadra ... FROM profili_giocatore`, con
 * `enforce_giocatori_squadra_update` temporaneamente disattivato) eseguendolo via `psql`
 * dentro il container Postgres locale — PostgREST non espone un update multi-tabella come
 * RPC, quindi qui serve accesso diretto al database, non solo alla REST.
 *
 * Simula un profilo "storico" (inserito con il trigger di sync disattivato, come se
 * esistesse da prima di M18) e verifica che il backfill lo recuperi. Gira solo sullo stack
 * locale con Docker attivo: usa lo slot `g9` della rosa seed, ripristinato alla fine.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta("backfill nascita profili esistenti", "stack locale non attivo (npx supabase start)");
  riepilogo("backfill-nascita-esistenti");
} else {
  const { url: URL_BASE, anon: ANON, servizio: SERVIZIO } = locale;

  const projectId = /project_id\s*=\s*"([^"]+)"/.exec(
    readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8"),
  )?.[1];
  const container = projectId ? `supabase_db_${projectId}` : null;
  const dockerDisponibile =
    !!container && spawnSync("docker", ["inspect", container], { stdio: "ignore" }).status === 0;

  if (!dockerDisponibile) {
    salta("backfill nascita profili esistenti", "container Postgres locale non trovato");
    riepilogo("backfill-nascita-esistenti");
  } else {
    console.log(`backfill nascita profili esistenti su ${URL_BASE} (container ${container})`);

    function eseguiSql(sql: string): string {
      const esito = spawnSync(
        "docker",
        ["exec", "-i", container!, "psql", "-U", "postgres", "-d", "postgres"],
        {
          input: sql,
          encoding: "utf8",
        },
      );
      if (esito.status !== 0) throw new Error(`psql fallito: ${esito.stderr || esito.stdout}`);
      return esito.stdout;
    }

    const rest = (percorso: string, token: string, init?: RequestInit) =>
      fetch(`${URL_BASE}/rest/v1/${percorso}`, {
        ...init,
        headers: {
          apikey: token === SERVIZIO ? SERVIZIO : ANON,
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...(init?.headers ?? {}),
        },
      });

    async function leggiNascita(): Promise<string | null> {
      const res = await rest("giocatori_squadra?id=eq.g9&select=nascita", SERVIZIO);
      const righe = (await res.json()) as Array<{ nascita: string | null }>;
      return righe[0]?.nascita ?? null;
    }

    try {
      await prova(
        "il backfill recupera la nascita di un profilo compilato prima di M18",
        async () => {
          // g9 è uno dei 17 storici: il backfill hardcoded di M18 le ha già dato una nascita
          // pubblica. Per simulare lo stato "prima di M19" — un profilo compilato ma non
          // ancora sincronizzato — va prima azzerata, poi inserito il profilo con il trigger
          // di sync disattivato (come se esistesse da prima che M18 lo introducesse).
          eseguiSql(`
            ALTER TABLE public.giocatori_squadra DISABLE TRIGGER enforce_giocatori_squadra_update;
            UPDATE public.giocatori_squadra SET nascita = NULL WHERE id = 'g9';
            ALTER TABLE public.giocatori_squadra ENABLE TRIGGER enforce_giocatori_squadra_update;

            ALTER TABLE public.profili_giocatore DISABLE TRIGGER sincronizza_nascita_pubblica;
            INSERT INTO public.profili_giocatore (giocatore_id, data_nascita)
              VALUES ('g9', '1988-07-21');
            ALTER TABLE public.profili_giocatore ENABLE TRIGGER sincronizza_nascita_pubblica;
          `);

          assert.equal(
            await leggiNascita(),
            null,
            "prima del backfill la nascita pubblica è ancora vuota",
          );

          // Stesso corpo esatto di m19_backfill_nascita_da_profili_esistenti.sql.
          eseguiSql(`
            ALTER TABLE public.giocatori_squadra DISABLE TRIGGER enforce_giocatori_squadra_update;
            UPDATE public.giocatori_squadra gs
            SET nascita = pg.data_nascita
            FROM public.profili_giocatore pg
            WHERE pg.giocatore_id = gs.id;
            ALTER TABLE public.giocatori_squadra ENABLE TRIGGER enforce_giocatori_squadra_update;
          `);

          assert.equal(
            await leggiNascita(),
            "1988-07-21",
            "dopo il backfill la nascita del profilo preesistente è recuperata",
          );
        },
      );
    } finally {
      // g9 (Camilla Esposito) è uno dei 17 storici: il backfill di M18 le aveva già dato
      // '2003-04-04' (src/lib/crapp-data.ts) prima che questo test la sovrascrivesse — va
      // ripristinato quel valore, non svuotato, per non alterare lo stato del seed.
      eseguiSql(`
        ALTER TABLE public.giocatori_squadra DISABLE TRIGGER enforce_giocatori_squadra_update;
        DELETE FROM public.profili_giocatore WHERE giocatore_id = 'g9';
        UPDATE public.giocatori_squadra SET nascita = '2003-04-04' WHERE id = 'g9';
        ALTER TABLE public.giocatori_squadra ENABLE TRIGGER enforce_giocatori_squadra_update;
      `);
      riepilogo("backfill-nascita-esistenti");
    }
  }
}
