# Portabilità di CrAPP

Regola di progetto: l'app deve poter girare su un **normale server Node.js + PostgreSQL**,
senza dipendere da servizi esclusivi di Lovable Cloud.

## Stato attuale

| Componente | Portabile? | Note |
|---|---|---|
| Frontend (React + TanStack Start/Router) | Sì | Build Vite standard, deploy su qualsiasi host Node. |
| Server functions / route API (`src/routes/api/*`) | Sì | API HTTP standard, nessuna edge function proprietaria. |
| Database | Sì | PostgreSQL puro; lo schema sta nelle migrazioni SQL. |
| Client dati (`@supabase/supabase-js`) | Sì | Supabase è open source e self-hostable; in alternativa si sostituisce il solo livello dati (`src/lib/*.ts`). |
| Web Push (`src/lib/webpush.server.ts`) | Sì | VAPID implementato con Web Crypto, disponibile in Node 18+. |
| Auth | Sì | GoTrue self-hosted oppure qualsiasi provider OIDC. |
| `src/integrations/lovable/*` | Opzionale | Login social gestito da Lovable: **non importato da nessuna schermata**, rimovibile senza impatti. |
| `@lovable.dev/vite-tanstack-config` | Solo build | Preset Vite; sostituibile con una config Vite/TanStack esplicita. |

## Regole da rispettare nelle prossime modifiche

1. Nessun accesso al database dai componenti: solo attraverso i moduli in `src/lib/*.ts`
   (`palloni.ts`, `mvp-voti.ts`, ...), così il backend è sostituibile in un solo punto.
2. Nessun uso di funzionalità proprietarie (edge functions Lovable, auth Lovable
   come unico metodo di login, storage proprietario).
3. Configurazione solo via variabili d'ambiente standard
   (`DATABASE_URL` / `SUPABASE_URL` + chiavi, `VAPID_*`), mai valori hardcoded.
4. SQL standard PostgreSQL nelle migrazioni: niente estensioni esclusive del provider.
5. Job pianificati richiamabili via semplice HTTP POST (es. `/api/public/promemoria-palloni`),
   così funzionano con cron di sistema, pg_cron o qualsiasi scheduler.

## Migrazione su server proprio (sintesi)

1. `bun run build` (o `npm run build`) → avvio del server Node generato.
2. PostgreSQL proprio + applicazione delle migrazioni in `supabase/migrations`.
3. Impostare le variabili d'ambiente (database, chiavi API, `VAPID_*`).
4. Se non si usa Supabase self-hosted: riscrivere solo i moduli dati in `src/lib/`
   con un client Postgres (es. `postgres`/`pg`) dentro server functions.
