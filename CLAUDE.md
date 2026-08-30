# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

CrAPP — PWA per la gestione di una squadra di pallavolo amatoriale (CRAP Volley). Codice, commenti, nomi di variabili e documentazione sono **in italiano**: mantieni questa convenzione.

## Regole di progetto

[AGENTS.md](AGENTS.md) contiene le regole vincolanti per gli assistenti AI. In sintesi:

- **Document-first**: nessuna funzionalità va implementata se non è già documentata in [docs/](docs/) (in particolare `docs/modules/<modulo>.md`). Leggi il documento del modulo prima di scrivere codice.
- Lavora sul branch `develop`, mai direttamente su `main` (`main` = produzione, deploy automatico Vercel).
- Dopo una modifica aggiorna, quando pertinente: `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/TODO.md`, `docs/DATABASE.md` (se cambia lo schema), `docs/DESIGN_DECISIONS.md` (decisioni architetturali, formato DD-XXX con indice in fondo al file), `PROJECT_STATE.md`.
- Nessuna nuova dipendenza senza reale necessità; riusa i componenti esistenti.
- Il DB si modifica solo con una nuova migration in `supabase/migrations/`; non eliminare tabelle.
- [docs/PORTABILITA.md](docs/PORTABILITA.md) / DD-001 / DD-013: l'app deve poter girare su Node.js + PostgreSQL standard. Evita servizi esclusivi Lovable/Vercel.

## Comandi

```bash
npm run dev      # vite dev su http://localhost:8080
npm run build    # build di produzione (nitro)
npm run lint     # eslint (include prettier come regola)
npm run format   # prettier --write .
```

Non esiste una suite di test automatici: la verifica è manuale via `npm run dev` + `npm run lint`.

Le dipendenze sono installate con **bun** (`bun.lock`, `bunfig.toml`). `bunfig.toml` impone `minimumReleaseAge = 24h` come guardia supply-chain: aggiungere un pacchetto a `minimumReleaseAgeExcludes` richiede conferma esplicita dell'utente.

## Architettura

**Stack**: React 19 + TanStack Start (SSR) + Vite 8 + Tailwind 4 + Radix/shadcn, Supabase come backend, Vercel per l'hosting.

- **Routing**: file-based in [src/routes/](src/routes/); `src/routeTree.gen.ts` è generato — non modificarlo a mano.
- **Configurazione Vite**: [vite.config.ts](vite.config.ts) usa `@lovable.dev/vite-tanstack-config`, che include già devtools, tanstackStart, viteReact, tailwind, tsconfig-paths, nitro e l'alias `@` → `src/`. **Non ri-aggiungere questi plugin** o l'app si rompe.
- **Entry point server**: [src/server.ts](src/server.ts) avvolge l'entry di TanStack Start per intercettare gli errori SSR che h3 trasforma silenziosamente in un 500 JSON, e renderizza `renderErrorPage()`. [src/start.ts](src/start.ts) registra i middleware globali (error handler, CSRF sui server functions, `attachSupabaseAuth`).
- **Supabase**: `src/integrations/supabase/client.ts` (browser/SSR, chiave publishable — file generato) e `client.server.ts` (`supabaseAdmin`, solo server). `types.ts` è generato dallo schema.

**Livello dati** — tutta la logica di dominio sta in [src/lib/](src/lib/), un file per modulo (`presenze`, `eventi`, `pagelle`, `mvp-voti`, `palloni`, `cacche`, `badges`, `scout-*`, `infortuni`, …). Il pattern ricorrente:

- ogni modulo esporta hook TanStack Query (`useX`) con `staleTime` lungo e mutation che invalidano la propria chiave;
- le funzioni pure di calcolo sono separate dagli hook (es. `palloni-core.ts` vs `palloni.ts`, `mediePagelle()` vs `usePagelle()`);
- [src/lib/rosa.ts](src/lib/rosa.ts) è l'aggregatore: compone tutti gli hook e restituisce la rosa completa con le statistiche derivate, **senza query aggiuntive** rispetto a quelle già in cache. Le route consumano `useRosa()`, non i singoli moduli.

Vincoli di efficienza cloud (vedi `mem/`): niente polling, cache lunga, aggregati precalcolati.

**Badge e statistiche** sono calcolati a runtime dai dati, non persistiti (DD-007). La gamification deve restare equa tra ruoli (DD-008): niente metriche che favoriscano attaccanti o liberi.

La rosa è tuttora **hardcoded** in `src/lib/crapp-data.ts` (`rosaCSI`); la migrazione verso la tabella `giocatori_squadra` (migration `20260828170400_m1_giocatori_squadra.sql`) è in corso — vedi DD-015 e DD-016.

## UI

Componenti condivisi in [src/components/crapp/](src/components/crapp/) (`ui-bits.tsx` per `PageHeader`, `Section`, `StatTile`), primitive shadcn in `src/components/ui/`, animazioni in `src/components/motion/`. Mobile-first (DD-005): poche schermate, pochi click.
