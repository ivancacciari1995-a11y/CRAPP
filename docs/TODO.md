# TODO

Solo il lavoro in corso o imminente. L'elenco completo delle funzionalità previste sta in
[ROADMAP.md](ROADMAP.md); le idee non ancora valutate pure.

## In corso

- Documentazione tecnica del progetto.

## Prossimo

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
- Dashboard amministratore (roadmap v1.1).
- Backup automatici (roadmap, idee future).
