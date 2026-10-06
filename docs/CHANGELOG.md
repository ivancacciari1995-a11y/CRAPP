# Changelog

Le modifiche rilevanti di CrAPP sono documentate qui, in ordine di rilascio. Il formato
segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/): ogni versione ha una data
e le voci sono divise per categoria (Aggiunto, Modificato, Sicurezza...). L'elenco
completo delle funzionalità, fatte e previste, sta in [ROADMAP.md](ROADMAP.md); qui si
registra solo _quando_ una voce è stata rilasciata e con quale versione.

Le versioni sono sempre a tre cifre (`x.y.z`, mai `x.y`). Dalla `1.0.0` si segue il
[versionamento semantico](https://semver.org/lang/it/): `x` cresce con i cambi non
compatibili all'indietro, `y` con le funzionalità nuove, `z` con le sole correzioni. Le
versioni `0.y.z` erano pre-release.

## [Non rilasciato]

### Aggiunto

- **Notifica di compleanno** — ogni giorno, dalle 8:00, il festeggiato riceve un messaggio di auguri e tutti gli altri membri
  attivi, allenatori compresi, il solo avviso «Oggi è il compleanno di …»; con più compleanni lo stesso giorno un solo
  messaggio a testa. Push, centro notifiche ed email. Il 29 febbraio non è gestito (DD-047, issue #11). Migration
  `m31_notifica_compleanno`, da applicare in produzione.

### Modificato

- **Obiettivo «1 evento di squadra al mese»** — si completa quando arriva l'ora dell'evento, non appena viene
  creato. Un evento futuro non conta finché la sua data e ora non sono passate. Nessuna migration.
- **Obiettivo «Presenze collettive»** — sostituisce «250 presenze complessive»: è la percentuale di presenze di tutta la
  rosa su allenamenti e partite definiti in stagione (passati e futuri, posti = convocati), con target 90%. Nessuna migration.

## [1.2.3] - 2026-10-04

Nella Home si vede anche chi non ha caricato il certificato medico, e le dipendenze sono aggiornate perché Vercel bloccava il deploy. Nessuna migration.

### Modificato

- **Avviso certificati mancanti** — nella Home chi non ha caricato il certificato medico compare in una card rossa:
  il giocatore vede il proprio avviso, l'admin l'elenco di chi manca, sopra scaduti e in scadenza (DD-046).

### Sicurezza

- **Dipendenze aggiornate** — `@tanstack/react-start` dalla 1.168.34 alla 1.168.60 (con `react-router`, `router-plugin` e `react-query`): Vercel bloccava il deploy per la versione precedente. `npm audit fix` chiude anche le tre vulnerabilità alte di `brace-expansion` e `nanoid`; `npm audit` segnala 0 vulnerabilità.

## [1.2.2] - 2026-10-01

Meno notifiche automatiche e un profilo più snello: gli avvisi dei palloni e delle presenze partono una sola volta, il
promemoria degli eventi non c'è più, la foto tessera è stata tolta e l'avviso del certificato medico arriva al
giocatore un mese prima. Le migration `m27`–`m30` sono applicate in produzione dal 01/10/2026; questa versione porta il
codice dell'app che le accompagna, da rilasciare subito: la `m29` ha tolto la colonna `foto_path` che la versione
precedente ancora legge.

### Rimosso

- **Foto tessera del profilo** — il giocatore non la carica più e l'admin non la vede nella scheda; il
  completamento del profilo si calcola su dati personali (34%), documento (33%) e certificato (33%). Migration
  `m29_senza_foto_tessera` (elimina la colonna `foto_path`); i file già caricati sono stati cancellati dal
  bucket `profili-giocatore` (DD-044). Applicata in produzione il 01/10/2026, con la cancellazione dei 4 file già caricati.

- **Promemoria evento a 24 e 3 ore** — non partono più per nessun evento (allenamenti, partite, extra-campo):
  niente notifica, push né email. Migration `m28_niente_promemoria_evento` (tolti i due job `pg_cron`;
  funzione, tipi e notifiche già generate restano). Applicata in produzione il 01/10/2026 (DD-043).

### Modificato

- **Sollecito presenze: un solo avviso automatico, 24 ore prima** — a chi non ha risposto o ha risposto
  «forse»; prima ne partivano tre (24, 12 e 6 ore). Il pulsante «Sollecita» non cambia. Migration
  `m30_sollecito_solo_24h`, applicata in produzione il 01/10/2026 (DD-045).

- **Turno palloni: un solo avviso, 3 ore prima** — a chi deve portare i palloni e a chi li deve
  prendere; prima ne partivano tre (12, 6 e 3 ore). Migration `m27_palloni_solo_3h`, applicata in
  produzione il 01/10/2026 (DD-042).

- **Avviso certificati: giocatore a 30 giorni** — il giocatore vede l'avviso giallo sul proprio
  certificato medico da un mese prima della scadenza (prima 7 giorni). Per gli admin non cambia
  nulla: 7 giorni prima in giallo, nero dopo la scadenza (DD-041).

## [1.2.1] - 2026-09-30

Turno palloni e sollecito presenze partono anche da soli, a orari fissi prima dell'evento, e i testi di
tutte le notifiche legate agli eventi sono più formali e completi (DD-040). La migration `m26` è applicata in
produzione dal 30/09/2026; questa versione porta il codice dell'app che la accompagna.

### Aggiunto

- **Turno palloni automatico** — 12, 6 e 3 ore prima di allenamenti e partite con un incaricato confermato,
  all'incaricato («incarico assegnato») e a chi aveva i palloni all'evento precedente («riconsegna»), se è
  un'altra persona. Se l'incaricato cambia, chi era stato avvisato riceve una sola volta «Turno palloni:
  incarico revocato». Arriva come push e nel centro notifiche, non per email. Il pulsante «Avvisa chi è di
  turno» resta.
- **Sollecito presenze automatico** — 24, 12 e 6 ore prima dell'evento, ai convocati (o a tutta la rosa
  attiva se non ce ne sono) che in quel momento non hanno risposto o hanno risposto «forse», mai
  all'allenatore; chi risponde smette di riceverlo. Un evento creato tardi riceve solo il sollecito della sua
  fascia. Push, notifica in app ed email. Il pulsante «Sollecita» resta.
- **Migration `m26_notifiche_automatiche`** — tipi di notifica nuovi (`turno_palloni_12h`, `_6h`, `_3h`,
  `turno_palloni_revocato`, `sollecita_presenze_24h`, `_12h`, `_6h`), funzioni SQL dei job e due job
  `pg_cron` ogni 15 minuti (`avvisi-palloni-automatici`, `solleciti-presenze-automatici`), riservati alla
  service role. Ogni notifica automatica si genera una sola volta per giocatore, evento e tipo, anche se
  viene eliminata (registro `promemoria_eventi_generati`). Le fasce sono contigue: un evento creato tardi
  non riceve tutte le notifiche insieme.
- **Test** — nuovo test di integrazione `notifiche-automatiche` (26 prove) sui job veri del database:
  finestre, destinatari, doppioni, revoca, code push ed email, permessi, pianificazione, e confronto con i
  testi e l'ordine del codice TypeScript. Nuovi test unitari di testi, destinatari, date e a capo delle
  notifiche; aggiornati i test di promemoria, code push ed email, worker e route dei pulsanti.
- **Documentazione** — DD-040 in `decisions/`; sezione «Testi delle notifiche» nel catalogo di
  `modules/notifiche.md`; tabella delle funzioni SQL e dei job in `DATABASE.md`.

### Modificato

- **Testi delle notifiche** — i promemoria a 24 e 3 ore dicono «domani» se l'evento è domani, «oggi»
  altrimenti, con data, ora e luogo. Turno palloni e sollecito hanno righe etichettate (Evento, Data, Ora,
  Luogo, Incarico, Azione). Stessi testi per i pulsanti e per i job. I promemoria già generati non cambiano.
- **Sollecito manuale** — il pulsante «Sollecita» ora segue i convocati dell'evento, come l'automatico,
  invece di tutti i giocatori attivi; il testo dice la risposta attuale e chi lo ha chiesto. Il turno
  palloni manuale non parte più per email.
- **Turno palloni manuale** — senza un incaricato per l'evento non parte più nessun avviso, nemmeno quello
  di riconsegna, come già descritto nel catalogo.
- **Ordine degli eventi dei palloni** — data, poi ora, poi id (prima solo la data): «evento precedente» e
  «successivo» coincidono con quelli dei job del database.
- **Centro notifiche** — le righe del corpo di una notifica vanno a capo.
- Il sollecito e il turno palloni non sono più descritti come «solo manuali» nel catalogo delle notifiche.

### Corretto

- `PROJECT_STATE.md` dava `m23`–`m25` come non applicate in produzione: lo sono dal 29/09/2026.

## [1.2.0] - 2026-09-29

Le notifiche arrivano su tre canali (push, centro notifiche in-app ed email) e non si ripetono più.
Le migration `m22`–`m25` sono già in produzione dal 29/09/2026 e il worker delle email è in funzione;
questa versione porta il codice dell'app che le usa.

### Aggiunto

- **Notifiche email** — ogni notifica del centro notifiche in-app (messaggi dello staff, promemoria
  a 24 e 3 ore, turno palloni, sollecito presenze, sondaggio pre-partita) arriva anche per email
  all'indirizzo Gmail con cui il giocatore si è registrato, gratis e senza aprire porte sul
  router: un worker Docker (`mailer/`) sull'host di casa legge una coda su Supabase (migration
  `m22_notifiche_email`) e invia tramite un account Gmail dedicato, con nuovi tentativi in caso di
  errore e un tetto giornaliero sotto il limite di Gmail. In Profilo → Opzioni c'è l'interruttore
  «Email», acceso di default, per account (tabella `preferenze_utente`; DD-036).
- **Push dei promemoria** — i promemoria a 24 e 3 ore, che arrivavano solo in-app e per email,
  partono ora anche come push a tutti i dispositivi iscritti del giocatore. Nascono nel database,
  che non può firmare una push, quindi la manda lo stesso worker con lo stesso modulo dell'app
  (migration `m24_push_promemoria_e_sondaggio`, DD-038). Le iscrizioni scadute vengono eliminate e
  una push rimasta in coda oltre 3 ore si scarta. Il worker va ricostruito e configurato con le chiavi
  VAPID dell'app (vedi [WORKER_EMAIL.md](WORKER_EMAIL.md)); senza, manda solo le email.
- **Sondaggio pre-partita nel centro notifiche e per email** — prima era solo una push. Ora compare
  anche tra le notifiche in-app e arriva per email ai giocatori attivi, allenatori esclusi (DD-038).
- **Documentazione e test** — nuovo [WORKER_EMAIL.md](WORKER_EMAIL.md) (installazione, gestione,
  diagnosi, prova in locale, spostamento su un altro host); catalogo delle notifiche in
  [notifiche.md](modules/notifiche.md), con cosa le fa partire, a chi arrivano e su quali canali;
  tabella delle notifiche dell'allenatore in [allenatore.md](modules/allenatore.md); decisioni
  DD-036, DD-037, DD-038 e DD-039. Nuovi test di integrazione per la coda delle email, il registro
  dei promemoria, la coda push, il sondaggio e i destinatari per ruolo (promemoria, messaggio dello
  staff, sondaggio, sollecito e turno palloni con allenatore e giocatore), più i test unitari del
  worker.

### Modificato

- **L'allenatore non riceve più i promemoria degli eventi** (24 e 3 ore prima, DD-039): per lui non
  c'è nulla da confermare, dato che non risponde alle presenze e non è convocabile, e per una cena di
  squadra il promemoria non aveva senso. Riceve ancora i messaggi dello staff. Migration
  `m25_promemoria_solo_giocatori`.
- **Messaggio del pulsante «Sondaggio»** — se nessun dispositivo ha le notifiche attive dice che
  l'avviso è stato inviato in app e per email, invece di «Nessun dispositivo con le notifiche
  attive».
- **`ops/` fuori da git** — il playbook Ansible locale per il backup cifrato non è più tracciato.

### Corretto

- **I promemoria dell'evento non ricompaiono più se li elimini** — il promemoria a 24 e a 3 ore
  eliminato dal centro notifiche veniva rigenerato dal job automatico al giro successivo, come non
  letto e, con le email, con una nuova mail a ogni giro fino all'inizio dell'evento. Ora il job
  ricorda ciò che ha già generato (migration `m23_promemoria_gia_generati`, DD-037). Il difetto
  esisteva dal centro notifiche (`m17`) e si è notato con l'arrivo delle email.

## [1.1.1] - 2026-09-28

### Aggiunto

- **Keepalive giornaliero** — un Vercel Cron Job chiama `/api/public/keepalive` una volta
  al giorno con una lettura minima, per evitare che il progetto Supabase free tier vada in
  pausa dopo 7 giorni senza richieste API.
- **Scheda evento** — gli eventi extra-campo (es. cena di squadra) hanno ora una pagina di
  dettaglio propria, come allenamenti e partite, con l'elenco nominativo di chi ha risposto
  presente/assente/forse invece del solo conteggio in card. "Infortunato" non compare più
  tra le opzioni né nei badge/riepiloghi per questi eventi, dato che non è una risposta
  pertinente.

### Modificato

- **Backup completo** — la cifratura (gpg, `tar.gz.gpg`) è ora il comportamento di default
  invece che opt-in con `--encrypt`, dato che i dump contengono dati sensibili (hash
  password, documenti d'identità); si disattiva con `--no-encrypt`. Aggiunte le istruzioni
  di decompressione nel README.

### Corretto

- **Squadra** — la card dell'allenatore nella Rosa è collassata come quella dei giocatori
  (nome e ruolo in riga chiusa, data di nascita solo aprendo il dettaglio) invece di
  mostrare subito tutto.
- **Squadra** — uno scroll verticale veloce nella tab Stats non fa più scattare per errore
  il cambio tab verso Obiettivi.
- **Turno palloni** — gli eventi generici (es. cena di squadra) non entrano più nel turno
  palloni: niente più proposta automatica, promemoria push o conteggio per eventi che non
  sono allenamenti o partite.

## [1.1.0] - 2026-09-27

### Aggiunto

- **Avviso certificati in scadenza** — in Home, giallo nei 7 giorni prima e nero dopo la
  scadenza del certificato medico. Gli admin vedono i nomi di tutta la rosa (non
  cliccabile); il giocatore interessato vede solo il proprio e il tap apre
  `/profilo?tab=documenti`. Calcolato al volo da `certificato_scadenza`: nessuna migration,
  nessuna push (DD-035).

## [1.0.0] - 2026-09-24

Prima versione stabile. Oltre al ruolo allenatore riunisce il lavoro fatto dalla 0.9.2:
centro notifiche in-app, messaggi dell'admin e la nuova Gestione eventi a calendario.

### Aggiunto

- **Ruolo allenatore** — l'admin registra un allenatore da `/admin` (tipo «Allenatore», con
  l'email Gmail) e lui si collega al primo accesso come i giocatori. Gestisce gli eventi e
  sollecita le presenze; ha un profilo ridotto (dati personali e foto, senza stagione e
  badge), compare in Squadra con la dicitura «Allenatore» e non vede badge né cacche.
  Migration `m20_ruolo_allenatore_enum` e `m21_ruolo_allenatore` (DD-034).
- **Centro notifiche in-app** — lo storico delle notifiche dentro l'app, indipendente dalla
  push: messaggi dell'admin, promemoria automatici 24 ore e 3 ore prima di un evento, turno
  palloni e sollecito presenze. Ogni notifica si toglie con uno swipe o con la ×. Migration
  `m17_notifiche_utente` (DD-030).
- **Messaggi dell'admin** — dalla tab Notifiche della dashboard l'admin manda un messaggio
  libero a tutta la squadra o a un solo giocatore; la tab elenca anche chi non ha le
  notifiche attive.
- **Gestione eventi a calendario** — `/eventi` è una griglia mensile: si tocca un giorno per
  vederne gli eventi e crearne, modificarne o eliminarne uno. Prima di salvare la modifica
  di un evento esistente compare una conferma, come per l'eliminazione.
- **Backup completo** — uno script scarica schema e dati del database e i file dello
  storage, per poter ripartire se si perde Supabase o Vercel (vedi `PORTABILITA.md`).

### Modificato

- **Notifiche in-app** — il numero delle non lette è un pallino rosso sull'avatar del
  profilo, al posto della campanella in alto a destra. Toccando il pallino si apre l'elenco
  (leggi ed elimina), toccando l'avatar si va al profilo come prima.
- **Campionato** — l'header riporta la stagione delle gare CSI (es. «Stagione 2025/26») e lo
  storico partite è diviso per stagione.
- **Gestione eventi** — tolta la lista "Eventi in calendario": resta solo il calendario
  mensile, che si scorre anche con lo swipe come quello della squadra.
- **Gestione eventi** — nel form il giorno toccato sul calendario è già fissato: resta da
  scegliere solo l'ora («Cambia» per spostare l'evento in un altro giorno). Il campo
  «Luogo» di un nuovo evento parte vuoto invece che con «Palestra Comunale».

### Corretto

- **Squadra** — la data di nascita inserita dal proprio Profilo compare a tutta la squadra
  (e nei compleanni del Calendario) invece di «Invalid Date»; allineati anche i profili
  compilati prima della correzione. Migration `m18_nascita_pubblica_giocatori_squadra` e
  `m19_backfill_nascita_da_profili_esistenti` (DD-031).
- **Squadra** — la rosa non si ricalcola più a ogni render mentre i voti MVP si caricano.

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
