# CrAPP — regole per gli assistenti AI

Regole vincolanti per qualsiasi assistente AI (Claude Code, Codex, Cursor, ChatGPT) che lavora
su questo repository. Valgono integralmente; `CLAUDE.md` le richiama e non le ripete.

CrAPP è una PWA per la gestione di una squadra di pallavolo. Deve ridurre il lavoro degli
amministratori, aumentare il coinvolgimento dei giocatori, centralizzare le informazioni della
squadra e usare l'AI solo quando porta un beneficio reale. Il perché sta in
[docs/VISION.md](docs/VISION.md).

## Prima di modificare il codice

1. Leggi l'indice [docs/README.md](docs/README.md) e segui l'ordine di lettura che indica; poi
   il documento del modulo interessato in [docs/modules/](docs/modules/).
2. Verifica lo stato attuale del repository: commit recenti, modifiche non committate, lavoro
   introdotto da altri collaboratori o da altri assistenti.
3. Non presumere che il progetto sia come l'hai lasciato nell'ultima sessione: la fonte di
   verità è il repository, non la cronologia della conversazione.

Non implementare funzionalità non documentate: prima si documenta
([DD-002](docs/DESIGN_DECISIONS.md#dd-002--sviluppo-document-first)), poi si scrive il codice.

## Comandi

Le dipendenze si installano con **bun** (`bun.lock`). `bunfig.toml` impone
`minimumReleaseAge = 24h` come guardia supply-chain: aggiungere un pacchetto a
`minimumReleaseAgeExcludes` richiede conferma esplicita dell'utente.

```bash
npm run dev       # vite dev su http://localhost:8080
npm run build     # build di produzione (nitro)
npm run lint      # eslint (include prettier come regola)
npm run format    # prettier --write .
npm run test      # suite di test (test/); npm run test:all per quella completa

npx supabase start    # database locale in Docker (migration applicate + seed)
npx supabase db reset # ricrea il database locale da zero
npx supabase db push  # applica le migration al progetto cloud
```

## Test

**Chi aggiunge o modifica una funzione scrive anche il test.** Non è opzionale e non si
rimanda: una funzione nuova senza test non è finita, una funzione modificata il cui test non
copre più il comportamento nuovo va aggiornata nello stesso lavoro.

- I test devono **risultare verdi**: non si consegna con test rossi, non si commenta un test
  che fallisce e non si indebolisce un'asserzione per farla passare. Se un test rosso segnala
  un comportamento voluto che è cambiato, si aggiorna il test spiegando perché.
- La logica di dominio pura sta in `src/lib/` ed è quella da coprire in `test/unit/`: se una
  funzione è difficile da testare perché mischia calcolo e hook, separala (`*-core.ts`) come
  già fatto per palloni e pagelle.
- Convenzioni, struttura delle cartelle e comandi in [test/README.md](test/README.md).
- Se il comportamento cambia, cambia anche la documentazione: modulo in
  [docs/modules/](docs/modules/), più i file elencati in Tracciabilità.

## Fine lavoro

Prima di dire che hai finito:

1. i test delle funzioni aggiunte o modificate esistono e sono verdi;
2. `npm run lint` e `npm run test` passano (`test:all` se hai toccato database o flussi e2e);
3. la documentazione toccata dalla modifica è aggiornata (vedi Test e Tracciabilità);
4. hai detto all'utente cosa hai cambiato, cosa hai lasciato fuori e quali rischi vedi.

## Git

`main` è la versione in produzione: qualsiasi commit deve lasciare l'app funzionante.
`develop` pubblica una preview Vercel, ma oggi è fermo indietro rispetto a `main` e non
rappresenta lo stato attuale (DD-019). I branch `feature/…`, `fix/…`, `refactor/…` servono per
lavori paralleli o rischiosi.

**È l'utente a decidere su quale branch va un commit.** L'assistente può consigliare un branch
dedicato quando la modifica è rischiosa o parallela ad altro lavoro, ma non cambia branch né
apre PR di propria iniziativa. In assenza di indicazioni si lavora dove si trova il repository.

Non committare, non fare push e non aprire PR senza che l'utente lo abbia chiesto.

## Tracciabilità

Ogni modifica significativa deve lasciare una traccia leggibile senza la cronologia delle
conversazioni: commit con messaggio descrittivo, più il documento giusto tra
[docs/CHANGELOG.md](docs/CHANGELOG.md) (cosa è stato rilasciato e quando),
[PROJECT_STATE.md](PROJECT_STATE.md) (stato generale del progetto),
[docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md) (decisioni architetturali, voci `DD-XXX`),
[docs/ROADMAP.md](docs/ROADMAP.md), [docs/TODO.md](docs/TODO.md),
[docs/DATABASE.md](docs/DATABASE.md) (se cambia lo schema).

Quali contenuti vanno in quale file, e le convenzioni di scrittura, stanno nelle regole di
manutenzione di [docs/README.md](docs/README.md): ogni informazione ha una sola casa, non
duplicarla altrove.

## Database

Il database è Supabase; lo schema documentato sta in [docs/DATABASE.md](docs/DATABASE.md),
allineato alle migration in `supabase/migrations/`.

- Ogni modifica allo schema è una **nuova** migration: le migration già applicate sono storia
  e non si riscrivono.
- Non eliminare tabelle esistenti, non modificare lo schema senza motivazione.
- Ordine: progetta → documenta → crea la migration → testala in locale (`npx supabase db reset`)
  → verifica l'assenza di regressioni → solo dopo applicala in produzione.
- Preferisci strutture scalabili, evita duplicazione dei dati.

## Codice e interfaccia

L'architettura tecnica (stack, struttura delle cartelle, punti fermi da non rompere) sta in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): leggila prima di toccare routing, `vite.config.ts`,
client Supabase o autenticazione.

Componenti piccoli, riutilizzabili, a responsabilità singola. Prima di crearne uno nuovo,
verifica se esiste già in `src/components/`. L'interfaccia resta semplice, moderna, veloce,
ottimizzata per smartphone: poche schermate, pochi click, stile coerente con l'esistente.

## Regola anti-regressione

Le nuove versioni aggiungono funzionalità. Non riscrivere moduli già funzionanti senza una
motivazione esplicita, e non fare refactoring trasversali mentre sviluppi altro. Prima di
modificare un modulo esistente verifica quali altre parti dell'app lo usano.

## L'AI non deve

- introdurre librerie senza necessità, né aggirare `minimumReleaseAge`;
- modificare il database o il comportamento dell'app senza richiesta esplicita;
- eliminare funzionalità esistenti;
- sovrascrivere modifiche di altri collaboratori senza averne compreso lo scopo;
- riscrivere migration già applicate;
- committare, pushare o cambiare branch di propria iniziativa.

## L'AI deve

- spiegare le modifiche importanti e segnalare rischi, conflitti e possibili regressioni
  **prima** di toccare parti sensibili;
- mantenere la compatibilità con il codice esistente e riutilizzare i componenti;
- privilegiare la semplicità;
- tenere aggiornata la documentazione quando serve.

## Filosofia

Prima di scrivere codice: questa modifica rende CrAPP più semplice? Riduce il lavoro degli
amministratori? Migliora l'esperienza dei giocatori? È coerente con la documentazione? Riduce
o aumenta la complessità futura? Se almeno una risposta è negativa, rivaluta la soluzione.
