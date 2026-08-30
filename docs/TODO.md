# TODO

Solo il lavoro in corso o imminente. L'elenco completo delle funzionalità previste sta in
[ROADMAP.md](ROADMAP.md); le idee non ancora valutate pure.

## In corso

- Documentazione tecnica del progetto.
- Autenticazione Google e dashboard amministratore: implementate su `develop`. Restano da
  fare, in quest'ordine: configurazione del provider Google in Supabase, applicazione delle
  migration M2/M3, inserimento del primo admin in `user_roles`, collegamento dei 17 account,
  e solo alla fine `VITE_AUTH_OBBLIGATORIA=true` + rimozione delle policy `anon`.
  Stato di dettaglio in [PROJECT_STATE.md](../PROJECT_STATE.md).

## Prossimo

- Profilo giocatore lato giocatore: senza le schermate di caricamento di documento,
  certificato e foto, la dashboard amministratore resta a zero dati.
- Certificati medici (roadmap v1.1).
- Gestione tesseramenti CSI (roadmap v1.1).

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
