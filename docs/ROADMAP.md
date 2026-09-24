# Roadmap

Elenco unico delle funzionalità di CrAPP, fatte e previste. È la fonte di riferimento per
il _cosa_: `CHANGELOG.md` registra _quando_ una voce è stata rilasciata e con quale versione,
[PROJECT_STATE.md](../PROJECT_STATE.md) cosa si sta facendo adesso.

## Fatto

Tutto quello che è rilasciato, fino alla versione 1.0.0 (vedi `CHANGELOG.md`).

- [x] Gestione squadra
- [x] Calendario
- [x] Presenze
- [x] Serie di presenze
- [x] Scout Live
- [x] Badge
- [x] Badge social
- [x] Pagelle
- [x] Votazione MVP
- [x] Obiettivi di squadra
- [x] Turno palloni
- [x] Infortuni — conteggio eventi saltati, in forma minima
- [x] Notifiche Push (promemoria intelligenti)
- [x] Centro notifiche in-app — pallino con il numero delle non lette sull'avatar del
      profilo (il tap sul pallino apre l'elenco), indipendente dalla push (messaggi admin, promemoria evento, turno palloni,
      sollecito presenze)
- [x] Dashboard amministratore
- [x] Download CSV dati
- [x] Profilo Giocatore — dati personali, documento d'identità, certificato medico
      (caricamento, scadenza, stato, download) e foto tessera; lo storico dei certificati
      resta un'estensione futura
- [x] Gestione tesseramenti CSI — raccolta dati, export CSV e tracciamento di chi è già
      tesserato (numero e data di tessera)
- [x] Collegamento CSI (stagione 2025/26)
- [x] Classifica automatica (campionato e Coppa)
- [x] Risultati campionato
- [x] Dettaglio partita — formazioni, storico scontri diretti e probabilità di vittoria
      calcolata dal CSI
- [x] Ruolo allenatore — gestisce gli eventi e sollecita le presenze, profilo ridotto senza
      stagione e badge ([specifica](modules/allenatore.md), DD-034)

## Prossimo

- [ ] Avviso certificati in scadenza — in Home, giallo nei 7 giorni prima e nero dopo la
      scadenza: agli admin con i nomi dei giocatori, al giocatore solo per il proprio
      ([specifica](modules/profilo-giocatore.md#avviso-certificati))

- [ ] Calendario ufficiale — i dati delle gare future arrivano già dal feed CSI, la pagina
      Campionato usa solo quelle giocate
- [ ] Database esercizi
- [ ] AI Allenamenti
- [ ] Archivio allenamenti

## Idee future

- [ ] Gestione quote
- [ ] Calendario Google
- [ ] Backup automatici
- [ ] Analisi statistiche avanzate
- [ ] Widget meteo
- [ ] Analisi Scout con AI
