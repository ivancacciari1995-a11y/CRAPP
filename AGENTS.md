# AGENTS.md — CrAPP

Regole che qualsiasi assistente AI (Claude Code, Codex, Cursor, ChatGPT o altri) deve seguire
quando lavora su questo progetto. **È l'unica fonte delle regole**: `CLAUDE.md` e
`.cursor/rules/` rimandano qui, non ripetono nulla.

> **Qualsiasi cosa venga aggiunta o modificata — una regola, una funzionalità, una decisione,
> una tabella — va registrata nei file di riferimento del progetto prima di considerare il
> lavoro finito**, indipendentemente dall'assistente con cui è stata fatta. Vedi
> [Fine lavoro](#fine-lavoro-cosa-aggiornare-sempre): non è un passaggio opzionale.

CrAPP è una Progressive Web App per la gestione di una squadra di pallavolo amatoriale (CRAP
Volley). Obiettivi e principi in [docs/VISION.md](docs/VISION.md), architettura in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Codice, commenti, nomi di variabili e documentazione sono in italiano**: mantieni questa
convenzione.

## Prima di modificare il codice

Leggere sempre, nell'ordine:

1. [docs/README.md](docs/README.md) — indice della documentazione
2. [docs/VISION.md](docs/VISION.md)
3. [docs/ROADMAP.md](docs/ROADMAP.md)
4. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
5. [docs/DATABASE.md](docs/DATABASE.md)
6. [docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md)
7. [docs/TODO.md](docs/TODO.md)
8. il documento del modulo interessato in [docs/modules/](docs/modules/)

**Non implementare funzionalità non documentate** (DD-002).

## Workflow

```
idea → progettazione → documento in docs/modules/ → database → implementazione su develop
→ test → merge su main → deploy automatico Vercel
```

- `main` = produzione, sempre funzionante: **non si modifica direttamente**. Qualsiasi
  modifica deve mantenere l'app perfettamente funzionante.
- `develop` = sviluppo e preview; tutte le nuove implementazioni nascono qui.

### Commit

- **Si committa solo quando l'utente lo chiede**, mai di propria iniziativa. Lo stesso vale
  per il push, che su `develop` fa partire un deploy di preview.
- Quando l'utente lo chiede, **il messaggio lo scrive l'assistente in autonomia**, senza
  farlo approvare prima.
- **Il messaggio è in inglese**, all'imperativo presente (`Add medical certificate expiry`),
  riga di riepilogo sotto i 72 caratteri. È l'unica eccezione all'italiano: codice, commenti
  e documentazione restano in italiano. I commit precedenti sono in italiano e non vanno
  riscritti.
- Se il lavoro attua una decisione registrata, il messaggio la cita: `DD-017: ...`.
- Nel commit entrano insieme codice e documentazione: la checklist
  [Fine lavoro](#fine-lavoro-cosa-aggiornare-sempre) va eseguita prima, non in un commit a parte.

## Vincoli tecnici da non violare

- `src/routeTree.gen.ts` e `src/integrations/supabase/{client.ts,types.ts}` sono **generati**:
  non modificarli a mano.
- **Non ri-aggiungere** i plugin Vite (devtools, tanstackStart, viteReact, tailwind,
  tsconfig-paths, nitro) già inclusi da `@lovable.dev/vite-tanstack-config` in
  `vite.config.ts`: l'app si rompe.
- Nessun accesso al database dai componenti: solo tramite i moduli in `src/lib/`, così il
  backend resta sostituibile in un solo punto (DD-013).
- Efficienza cloud: niente polling, cache lunga, e dopo una mutazione `setQueryData` invece di
  `invalidateQueries`. Regole complete in [docs/EFFICIENZA_CLOUD.md](docs/EFFICIENZA_CLOUD.md).
- Badge e statistiche si calcolano a runtime, non si persistono (DD-007); la gamification
  resta equa tra ruoli (DD-008): niente metriche che favoriscano attaccanti o liberi.
- L'app deve poter girare su Node.js + PostgreSQL standard: niente servizi esclusivi
  Lovable/Vercel (DD-001, DD-013, [docs/PORTABILITA.md](docs/PORTABILITA.md)).

## Database

- Non eliminare tabelle esistenti.
- Non modificare lo schema senza creare una migration in `supabase/migrations/`.
- Preferire una nuova tabella all'aggiunta di molte colonne, quando il modulo è indipendente.
- Preferire strutture scalabili; evitare duplicazione dei dati.
- Riferimento: [docs/DATABASE.md](docs/DATABASE.md), da aggiornare nella stessa modifica che
  cambia lo schema.

## Codice e componenti

- TypeScript, funzioni piccole, nomi descrittivi.
- Componenti piccoli, riutilizzabili, a responsabilità singola.
- Nessuna duplicazione: riusare sempre i componenti e i moduli esistenti.
- Commentare solo il codice realmente complesso.
- Nessuna nuova dipendenza senza reale necessità; mantenere la struttura esistente.
- Le dipendenze si installano con **bun**; `bunfig.toml` impone `minimumReleaseAge = 24h` come
  guardia supply-chain: aggiungere un pacchetto a `minimumReleaseAgeExcludes` richiede
  conferma esplicita dell'utente.

## Interfaccia

Stile coerente con l'esistente: semplice, moderna, pulita, veloce, ottimizzata per
smartphone, poche schermate e pochi click (DD-005). Riusare i componenti in
`src/components/crapp/` (`ui-bits.tsx` per `PageHeader`, `Section`, `StatTile`) e le primitive
shadcn in `src/components/ui/`.

## Fine lavoro: cosa aggiornare sempre

Il lavoro **non è finito** finché non è registrato dove va. Vale per tutti gli assistenti allo
stesso modo: chi fa la modifica aggiorna i file, chiunque la stia facendo e da qualunque
strumento. Un cambiamento che vive solo nel codice o solo nella chat è un cambiamento perso.

| Cosa hai aggiunto o cambiato | Dove va registrato |
|---|---|
| Una **regola** per gli assistenti (convenzione, divieto, vincolo di lavoro) | **Questo file, e solo questo.** Mai in `CLAUDE.md` o `.cursor/rules/`: rimandano qui, e una regola scritta lì la vedrebbe un assistente solo |
| Una **funzionalità** | `docs/modules/<modulo>.md` (**prima** di scrivere il codice), poi `docs/ROADMAP.md` e `docs/CHANGELOG.md` |
| Una **decisione** architetturale o di prodotto | `docs/DESIGN_DECISIONS.md`, formato `DD-XXX` (copiare `docs/_template-dd.md`) e aggiungerla all'indice in cima |
| Una **modifica allo schema** del database | una migration in `supabase/migrations/` **e** `docs/DATABASE.md`, nella stessa modifica |
| Lavoro iniziato, sospeso o concluso | `docs/TODO.md` e `PROJECT_STATE.md` |
| Un **comando** o uno script nuovo | `docs/ARCHITECTURE.md` (sezione Comandi) e `CLAUDE.md` |

Quale informazione vive in quale file — e perché non va duplicata altrove — è spiegato in
[docs/README.md](docs/README.md).

## Cosa l'AI non deve fare

- introdurre librerie senza necessità;
- modificare il database senza motivazione;
- eliminare funzionalità esistenti;
- modificare il comportamento dell'app senza richiesta esplicita.

## Cosa l'AI deve fare

- spiegare le modifiche importanti;
- mantenere compatibilità con il codice esistente;
- privilegiare la semplicità;
- riutilizzare i componenti esistenti.

## Filosofia

Prima di scrivere codice, chiedersi sempre:

- questa modifica rende CrAPP più semplice?
- riduce il lavoro degli amministratori?
- migliora l'esperienza dei giocatori?
- è coerente con la documentazione?
