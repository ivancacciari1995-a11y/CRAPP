# Changelog

Le modifiche rilevanti di CrAPP sono documentate qui, in ordine di rilascio. Il formato
segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/): ogni versione ha una data
e le voci sono divise per categoria (Aggiunto, Modificato, Sicurezza...). L'elenco
completo delle funzionalità, fatte e previste, sta in [ROADMAP.md](ROADMAP.md); qui si
registra solo _quando_ una voce è stata rilasciata e con quale versione.

Le versioni sono sempre a tre cifre (`x.y.z`, mai `x.y`). Il progetto è pre-1.0 (`0.y.z`):
finché resta sotto `1.0.0` un aumento di `y` può includere anche cambi non compatibili
all'indietro.

## [Non rilasciato]

## [0.9.2] - 2026-09-10

### Aggiunto

- **Dashboard amministratore** — nuova tab "Notifiche" che mostra quanti giocatori hanno
  le notifiche push attive e chi sono.

### Modificato

- **Dashboard amministratore** — le sezioni impilate diventano un menu di tab scorrevole a
  pillole (come Squadra e Campionato); nell'elenco Profili resta aperta una sola scheda
  alla volta.
- **Profilo** — testi dei campi amministrativi semplificati (label email, rimossa la nota
  su chi vede quei dati).

### Rimosso

- Le dipendenze e il codice legati all'editor Lovable (login social e reporting errori
  verso l'editor): l'app non ci gira più.

## [0.9.1] - 2026-09-10

### Modificato

- **Storico partite** — ogni scheda mostra il logo accanto al nome di entrambe le squadre
  (CRAP e avversario), risultato e parziali in ordine casa–ospite (verde/rosso restano
  vittoria/sconfitta CRAP) e un chevron a destra per chiarire che la riga apre il dettaglio.

## [0.9.0] - 2026-09-09

Prima versione pre-release: lo sviluppo precedente non era versionato a parte, quindi
questa release riunisce tutto ciò che l'app fa oggi in produzione.

### Aggiunto

- **Gestione squadra** — rosa dei giocatori con ruoli e dati anagrafici di base.
- **Profilo Giocatore** — dati personali e amministrativi, documento d'identità,
  certificato medico (caricamento, scadenza, stato, download) e foto tessera in
  un'unica schermata, sia lato giocatore sia lato amministratore; lo storico dei
  certificati resta un'estensione futura.
- **Gestione tesseramenti CSI** — raccolta dei dati richiesti dal CSI, tracciamento di chi
  è già tesserato (numero e data tessera) ed export CSV per il tesseramento.
- **Calendario** — eventi di allenamento e partita, con schermata di dettaglio dedicata.
- **Presenze** — conferma o rifiuto della partecipazione a un evento, visibile a tutta la
  squadra al posto di chat e fogli condivisi.
- **Serie di presenze** — tre serie (presenze, conferme, allenamenti) calcolate sui dati
  reali della rosa.
- **Scout Live** — un solo referente alla volta registra in tempo reale le azioni di gioco
  durante la partita.
- **Badge** — gamification con gradi bronzo/argento/oro, badge segreti e badge social
  votati tra compagni.
- **Pagelle** — voto tra compagni (1-10) a fine partita, con media personale e di squadra.
- **Votazione MVP** — elezione del migliore in campo della partita tramite voto tra
  compagni, un voto a testa.
- **Obiettivi di squadra** — traguardi collettivi che avanzano con presenze, risposte alle
  convocazioni, pagelle e risultati di campionato.
- **Turno palloni** — rotazione condivisa e promemoria di chi porta e riporta i palloni ad
  allenamenti e partite.
- **Notifiche push** — promemoria intelligenti su un unico opt-in per dispositivo.
- **Dashboard amministratore** — vista aggregata su tesseramenti, certificati, presenze e
  dati della rosa, con download CSV.
- **Collegamento CSI** — classifica di campionato e Coppa, storico partite e dettaglio di
  ogni gara (formazioni, storico scontri diretti, probabilità di vittoria calcolata dal
  CSI) letti in tempo reale dal portale ufficiale Livescore CSI Bologna, senza inserimento
  manuale da parte degli amministratori.
- **Infortuni** — conteggio degli eventi saltati per infortunio, riusando lo stato di
  presenza già registrato per le convocazioni.

### Sicurezza

- Autenticazione tramite Google via Supabase Auth, unico metodo di accesso; permessi
  differenziati per ruolo (giocatore/amministratore) su tabelle e route.
