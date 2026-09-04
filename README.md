# CrAPP 🏐

CrAPP è una Progressive Web App sviluppata per digitalizzare completamente la gestione di una squadra di pallavolo.

## Funzionalità principali

- Gestione squadra
- Gestione presenze
- Calendario allenamenti e partite
- Scout Live
- Badge e gamification
- Statistiche
- Notifiche intelligenti
- Gestione amministrativa
- AI per la pianificazione degli allenamenti (in sviluppo)

## Stack tecnologico

React 19, TypeScript, TanStack Start (SSR), Vite 8, Tailwind CSS 4, Radix UI / shadcn,
Supabase (PostgreSQL, Auth, Storage), Vercel, GitHub. Dettagli in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Avvio locale

Le dipendenze si installano con **bun** (`bun.lock`):

```bash
bun install
npm run dev     # http://localhost:8080
```

## Comandi

```bash
npm run build   # build di produzione
npm run lint    # eslint (include prettier)
npm run test    # test unit; npm run test:all per la suite completa
```

Chi aggiunge o modifica una funzione scrive anche il test e lo lascia verde
([test/README.md](test/README.md)).

## Deploy

Deploy automatico su Vercel a ogni push su `main`, che è anche il branch di lavoro corrente.
`develop` pubblica un Preview Deployment, ma oggi è indietro rispetto a `main`. Su quale branch
committare lo decide chi sviluppa (DD-019).

## Variabili d'ambiente

Il progetto richiede le seguenti variabili:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Documentazione

Indice in [docs/README.md](docs/README.md). Le regole per gli assistenti AI stanno in
[AGENTS.md](AGENTS.md), lo stato corrente del lavoro in [PROJECT_STATE.md](PROJECT_STATE.md).
