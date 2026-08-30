# Architettura del progetto

Come è fatta CrAPP: stack, organizzazione del codice, flusso di sviluppo. È il documento di
riferimento tecnico — `CLAUDE.md` non ripete questi contenuti, li richiama.

## Stack

| Livello | Tecnologie |
|---|---|
| Frontend | React 19, TypeScript, TanStack Start (SSR), Vite 8, Tailwind CSS 4, Radix UI / shadcn |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Hosting | Vercel |
| Versionamento | Git, GitHub |

Le dipendenze sono installate con **bun** (`bun.lock`, `bunfig.toml`). `bunfig.toml` impone
`minimumReleaseAge = 24h` come guardia supply-chain: aggiungere un pacchetto a
`minimumReleaseAgeExcludes` richiede conferma esplicita.

## Struttura del progetto

```
src/
  components/   componenti condivisi (crapp/, ui/, motion/)
  routes/       routing file-based
  lib/          logica di dominio, un file per modulo
  integrations/ client Supabase e integrazioni esterne
  hooks/
  assets/
supabase/       migration SQL
test/           suite di test (unit, integration, end-to-end)
docs/           documentazione ufficiale
```

## Punti fermi

- **Routing**: file-based in `src/routes/`. `src/routeTree.gen.ts` è **generato**, non si
  modifica a mano.
- **Configurazione Vite**: `vite.config.ts` usa `@lovable.dev/vite-tanstack-config`, che
  include già devtools, tanstackStart, viteReact, tailwind, tsconfig-paths, nitro e l'alias
  `@` → `src/`. **Non ri-aggiungere questi plugin**: l'app si rompe.
- **Entry point server**: `src/server.ts` avvolge l'entry di TanStack Start per intercettare
  gli errori SSR che h3 trasformerebbe in un 500 JSON silenzioso, e renderizza
  `renderErrorPage()`. `src/start.ts` registra i middleware globali (error handler, CSRF sui
  server functions, `attachSupabaseAuth`).
- **Supabase**: `src/integrations/supabase/client.ts` (browser/SSR, chiave publishable — file
  generato) e `client.server.ts` (`supabaseAdmin`, solo server). `types.ts` è generato dallo
  schema; finché non viene rigenerato, le tabelle introdotte da M1/M2 si usano tramite
  `client-nuove-tabelle.ts`, con i tipi di riga dichiarati nei moduli di `src/lib/`.
- **Autenticazione**: login Google via Supabase Auth (`src/lib/auth.ts`, DD-011); i permessi
  di amministrazione arrivano da `user_roles` (`src/lib/ruoli.ts`). La variabile
  `VITE_AUTH_OBBLIGATORIA` decide se `/benvenuto` accetta ancora la selezione libera del
  giocatore: finché è spenta, login e vecchio accesso convivono.

## Livello dati

Tutta la logica di dominio sta in `src/lib/`, un file per modulo (`presenze`, `eventi`,
`pagelle`, `mvp-voti`, `palloni`, `cacche`, `badges`, `scout-*`, `infortuni`, …). Il pattern
ricorrente:

- ogni modulo esporta hook TanStack Query (`useX`); i default globali stanno in
  `src/router.tsx` (`staleTime` 5 min, `gcTime` 30 min, `refetchOnWindowFocus/Mount/Reconnect`
  disattivati, `retry: 1`);
- dopo una mutazione la cache si aggiorna con `setQueryData`, **non** con
  `invalidateQueries`: invalidare provoca una rilettura e costa una query in più (unica
  eccezione oggi: `scout-live.ts`);
- le funzioni pure di calcolo sono separate dagli hook (es. `palloni-core.ts` vs
  `palloni.ts`, `mediePagelle()` vs `usePagelle()`);
- `src/lib/rosa.ts` è l'aggregatore: compone tutti gli hook e restituisce la rosa completa
  con le statistiche derivate, **senza query aggiuntive** rispetto a quelle già in cache. Le
  route consumano `useRosa()`, non i singoli moduli.

Nessun accesso al database dai componenti: solo attraverso i moduli in `src/lib/`, così il
backend resta sostituibile in un solo punto (DD-013, [PORTABILITA.md](PORTABILITA.md)).

Vincoli di efficienza cloud — niente polling, cache lunga, `setQueryData` invece di
`invalidateQueries` — in [EFFICIENZA_CLOUD.md](EFFICIENZA_CLOUD.md).

Badge e statistiche sono calcolati a runtime dai dati, non persistiti (DD-007). La
gamification deve restare equa tra ruoli (DD-008).

La rosa è tuttora **hardcoded** in `src/lib/crapp-data.ts` (`rosaCSI`); la migrazione verso
la tabella `giocatori_squadra` è in corso — vedi DD-015 e DD-016.

## UI

Componenti condivisi in `src/components/crapp/` (`ui-bits.tsx` per `PageHeader`, `Section`,
`StatTile`), primitive shadcn in `src/components/ui/`, animazioni in
`src/components/motion/`. Mobile-first (DD-005): poche schermate, pochi click.

## Comandi

```bash
npm run dev       # vite dev su http://localhost:8080
npm run build     # build di produzione (nitro)
npm run lint      # eslint (include prettier come regola)
npm run format    # prettier --write .
npm run test      # test unit (veloci, senza rete né database)
npm run test:integration  # route server vere
npm run test:e2e          # percorsi sull'app servita
npm run test:all          # tutto
```

Database di sviluppo in locale (Docker), alternativo al progetto Supabase cloud:

```bash
npx supabase start   # avvia lo stack locale e applica tutte le migration
npx supabase stop    # spegne i container
npx supabase db reset # ricrea il database da zero: migration + supabase/seed.sql
npx supabase db push  # applica le migration al progetto cloud
```

`supabase/seed.sql` popola qualche profilo di prova e gira **solo in locale**. Serve perché
il progetto cloud è uno solo, condiviso tra sviluppo e produzione: lo stack locale è il posto
dove provare le migration distruttive senza toccare i dati veri.

## Branch e flusso di sviluppo

- `main` → produzione, deploy automatico su Vercel.
- `develop` → sviluppo; si lavora qui, mai direttamente su `main` (DD-003).

```
develop → test → merge su main → deploy automatico su Vercel
```
