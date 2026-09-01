# CLAUDE.md

Le regole di progetto stanno in @AGENTS.md: valgono integralmente e non sono ripetute qui.
La documentazione tecnica è indicizzata in [docs/README.md](docs/README.md); l'architettura
in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Non aggiungere regole in questo file.** Una regola nuova va in `AGENTS.md`, che leggono
anche Codex e Cursor; scritta qui la vedrebbe solo Claude Code. Vale per qualsiasi aggiunta o
modifica: prima di dire che hai finito, esegui la checklist «Fine lavoro» di `AGENTS.md`.

## Comandi

```bash
npm run dev       # vite dev su http://localhost:8080
npm run build     # build di produzione (nitro)
npm run lint      # eslint (include prettier come regola)
npm run format    # prettier --write .
npm run test      # suite di test (test/); npm run test:all per quella completa

npx supabase start    # database locale in Docker (migration applicate + seed)
npx supabase stop     # spegne i container
npx supabase db reset # ricrea il database locale da zero
npx supabase db push  # applica le migration al progetto cloud
```

Verifica minima prima di consegnare: `npm run lint` + `npm run test`.
