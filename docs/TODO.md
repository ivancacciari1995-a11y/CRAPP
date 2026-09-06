# TODO

Solo il lavoro in corso o imminente. L'elenco completo delle funzionalità previste sta in
[ROADMAP.md](ROADMAP.md); le idee non ancora valutate pure.

## In corso

- Correzione push Android pronta in locale: aggiornamento del worker nelle sessioni della
  webapp e test del canale cifrato verificati. Resta la verifica su Motorola installato,
  ad app chiusa e schermo bloccato; procedura e limiti in [Notifiche](modules/notifiche.md).
- Documentazione tecnica del progetto.
- Autenticazione Google e dashboard amministratore: il codice è in produzione su `main` e il
  login è l'unica via d'accesso. La migration M4, che chiude gli accessi `anon` alle
  tabelle v1.0, è stata applicata in produzione (03/09/2026). Resta il collegamento dei
  singoli account: ogni giocatore si aggancia al proprio profilo al primo login (DD-018), un
  processo continuo — vale anche per chi viene aggiunto a stagione in corso da `/admin`.
  Stato di dettaglio in [PROJECT_STATE.md](../PROJECT_STATE.md).

## Prossimo

- Niente di assegnato. Le voci ancora aperte in [ROADMAP.md](ROADMAP.md) sono «Calendario
  ufficiale» (v2.0, i dati delle gare future arrivano già dal feed CSI) e la v1.2.

La gestione tesseramenti CSI della v1.1 è completa: raccolta dati, export CSV e tracciamento
di chi è già tesserato (numero e data di tessera, migration `m8_tesseramento_csi`, registrabili
da `/admin`).

Il profilo giocatore lato giocatore e i certificati medici sono fatti: `ProfiloAmministrativo`
in `src/routes/profilo.tsx` carica documento, certificato e foto con le date di scadenza, e
la dashboard amministratore legge quei dati.

## Manutenzione ricorrente

- Collegamento CSI: aggiornare `project_id` e `team_id` a inizio stagione 2026/27
  (vedi [modules/collegamento-csi.md](modules/collegamento-csi.md)).

## Backlog

- AI Allenamenti (roadmap v1.2).
- Backup automatici (roadmap, idee future).
