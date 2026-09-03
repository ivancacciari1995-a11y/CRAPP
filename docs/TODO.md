# TODO

Solo il lavoro in corso o imminente. L'elenco completo delle funzionalità previste sta in
[ROADMAP.md](ROADMAP.md); le idee non ancora valutate pure.

## In corso

- Documentazione tecnica del progetto.
- Autenticazione Google e dashboard amministratore: il codice è completo su `develop` e il
  login è ora l'unica via d'accesso. Restano i passaggi di configurazione, in quest'ordine:
  provider Google in Supabase (senza, nessuno entra), migration M2, primo admin in
  `user_roles`, collegamento dei 17 account, e infine la migration M4 che chiude gli accessi
  `anon`. Stato di dettaglio in [PROJECT_STATE.md](../PROJECT_STATE.md).

## Prossimo

- Gestione tesseramenti CSI (roadmap v1.1): la raccolta dati e l'export CSV ci sono, manca
  il tracciamento di chi è già tesserato (numero e data di tessera).

Il profilo giocatore lato giocatore e i certificati medici sono fatti: `ProfiloAmministrativo`
in `src/routes/profilo.tsx` carica documento, certificato e foto con le date di scadenza, e
la dashboard amministratore legge quei dati.

## Debito di documentazione

Moduli v1.0 in produzione senza scheda in [modules/](modules/) — DD-002 ne prevede la
retro-documentazione: Presenze, Scout Live, Badge, Pagelle, MVP, Palloni, Obiettivi di
squadra, Notifiche, Serie di presenze, Infortuni (`src/lib/infortuni.ts`, usato ma non
documentato in nessun punto).

Non documentate nemmeno le route API pubbliche in `src/routes/api/public/` (`csi`,
`promemoria-palloni`, `push-config`, `push-messaggio`, `push-subscribe`,
`sollecita-presenze`).

## Manutenzione ricorrente

- Collegamento CSI: aggiornare `project_id` e `team_id` a inizio stagione 2026/27
  (vedi [modules/collegamento-csi.md](modules/collegamento-csi.md)).

## Backlog

- AI Allenamenti (roadmap v1.2).
- Backup automatici (roadmap, idee future).
