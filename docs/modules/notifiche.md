# Modulo — Notifiche

**Stato:** implementato — un unico opt-in dispositivo abilita tutto il canale push, più un
centro notifiche in-app indipendente, con un pallino sull'avatar del profilo
**File principali:** `src/lib/notifiche-smart.ts`, `src/lib/notifiche-utente.ts`,
`src/lib/push-client.ts`, `src/lib/webpush.server.ts`, `src/routes/api/public/push-config.ts`,
`src/routes/api/public/push-subscribe.ts`, `public/push-sw.js`,
`src/components/crapp/ui-bits.tsx` (`LinkProfilo`, `PallinoNotifiche`)

---

## Obiettivo

Tenere aggiornati i giocatori senza che debbano aprire l'app, con due meccanismi
indipendenti:

- **Push VAPID** — arrivano anche ad app chiusa (messaggi dello staff, turno palloni, sollecito
  presenze, compleanni, sondaggio pre-partita: elenco completo nel [catalogo](#catalogo-delle-notifiche)).
- **Notifiche smart** — notifiche locali mostrate solo ad app aperta, generate da badge,
  serie e obiettivi appena raggiunti; non è un canale push separato.

Gli avvisi fissi in Home (turno palloni, certificati in scadenza) non passano da nessuno dei
due: sono card calcolate dai dati, che spariscono da sole quando la condizione finisce. In
particolare il certificato in scadenza **non** genera push né voci nel centro notifiche
(DD-035, specifica in [profilo-giocatore.md](profilo-giocatore.md#avviso-certificati)).

---

## Catalogo delle notifiche

Cosa fa partire una notifica, a chi arriva e su quali canali. Sono i canali indipendenti descritti
più sotto: **push** (solo ai dispositivi che hanno attivato «Notifiche»), **centro notifiche
in-app** (storico in `notifiche_utente`, per tutti i giocatori) ed **email**
([notifiche-email.md](notifiche-email.md): ogni riga di `notifiche_utente` genera una mail, **tranne
quelle del turno palloni**, che restano solo push e in-app: DD-040).

| #   | Notifica                                                                                                                         | Cosa la fa partire                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Destinatari                                                                                                                                                                                                                                  | Push             | In-app | Email           |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------ | --------------- |
| 1   | ~~Promemoria a 24 ore~~ — **rimosso**                                                                                            | Non parte più: i job `pg_cron` sono stati tolti dalla migration `m28` (DD-043). Restano le notifiche già generate (tipo `evento_promemoria_24h`).                                                                                                                                                                                                                                                                                                                                                                                                                                    | —                                                                                                                                                                                                                                            | —                | —      | —               |
| 2   | ~~Promemoria a 3 ore~~ — **rimosso**                                                                                             | Come la riga 1 (tipo `evento_promemoria_3h`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                                                                                                                                                                                                            | —                | —      | —               |
| 3   | **Messaggio dello staff** — titolo fisso «Messaggio dallo staff», corpo il testo scritto (max 300 caratteri)                     | Un admin, dalla tab «Notifiche» della dashboard: «Invia messaggio a tutti» o il pulsante della riga di un giocatore. Route `notifica-personalizzata`, tipo `admin`.                                                                                                                                                                                                                                                                                                                                                                                                                  | Push: tutti i dispositivi iscritti, o quelli del giocatore scelto. In-app ed email: tutta la rosa attiva (allenatori compresi, anche senza dispositivi iscritti), o il giocatore scelto.                                                     | sì               | sì     | sì              |
| 4   | **Turno palloni** — «Turno palloni: incarico assegnato» / «Turno palloni: riconsegna»                                            | **Automatica**, **una sola volta, 3 ore prima** dell'evento (DD-040, DD-042): job `pg_cron` ogni 15 minuti, solo per allenamenti e partite con un incaricato confermato; tipo `turno_palloni_3h` (`_12h` e `_6h` esistono solo nelle notifiche generate prima di `m27`), push dal worker. Se l'incaricato cambia, chi aveva già ricevuto un avviso riceve una volta «Turno palloni: incarico revocato» (tipo `turno_palloni_revocato`). **Manuale**, in più: un admin, con il pulsante nella pagina dell'evento; route `promemoria-palloni`, tipo `turno_palloni`, push dalla route. | L'incaricato del turno di quell'evento e, se è un'altra persona, chi aveva i palloni all'evento precedente. Se per l'evento non c'è un incaricato non parte nulla.                                                                           | sì               | sì     | **no** (DD-040) |
| 5   | **Sollecito presenze** — «Conferma di partecipazione richiesta: _titolo_»                                                        | **Automatica**, **una sola volta, 24 ore prima** dell'evento (DD-040, DD-045): per gli eventi che iniziano entro 24 ore, dallo stesso job; tipo `sollecita_presenze_24h` (`_12h` e `_6h` esistono solo nelle notifiche generate prima di `m30`), push dal worker. **Manuale**, in più: un admin o un allenatore con il pulsante nella pagina dell'evento; route `sollecita-presenze`, tipo `sollecita_presenze`, push dalla route.                                                                                                                                                   | Automatica e manuale: i destinatari dell'evento (convocati, o tutta la rosa attiva se `convocati` è vuoto; mai gli allenatori) che in quel momento non hanno risposto o hanno risposto «forse».                                              | sì               | sì     | sì              |
| 6   | **Sondaggio pre-partita** — «💩 Sondaggio pre-partita aperto»                                                                    | Un admin, dalla pagina della partita. Route `apri-sondaggio` (vedi [Scout Live](scout-live.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Push: tutti i dispositivi iscritti, tranne quelli degli allenatori. In-app ed email (tipo `sondaggio_cacche`): i giocatori attivi, allenatori esclusi, anche senza dispositivi iscritti.                                                     | sì               | sì     | sì              |
| 7   | **Notifiche smart** — badge appena sbloccato, serie a un traguardo, obiettivo di squadra tra il 90 e il 100%, badge social vinto | L'app, mentre è aperta: sono calcolate in locale da `calcolaNotifiche()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Chi ha l'app aperta con uno slot giocatore in rosa selezionato; **mai l'allenatore**. Nessun invio verso altri dispositivi.                                                                                                                  | no (solo locale) | no     | no              |
| 8   | **Compleanno** — auguri al festeggiato, avviso agli altri                                                                        | **Automatica**, **una volta al giorno, dalle 8:00** (fuso `Europe/Rome`) per chi compie gli anni quel giorno (DD-047, `m31`): job `pg_cron` ogni ora, funzione `genera_avvisi_compleanno()`, registro `compleanni_notificati`; tipi `compleanno_auguri` e `compleanno`, push dal worker. Nessun pulsante manuale.                                                                                                                                                                                                                                                                    | **Tutti i membri attivi**, allenatori compresi: il festeggiato riceve gli auguri, gli altri l'avviso. Con più compleanni lo stesso giorno, un solo messaggio a testa (agli altri con tutti i nomi, a ogni festeggiato solo i propri auguri). | sì               | sì     | sì              |
| 9   | **Presenza modificata** — «Presenza modificata: _Nome Cognome_» _(proposta, DD-050: non ancora implementata)_                    | **Automatica**, a ogni cambio di una risposta in `risposte_presenze` (nuova, modificata o ritirata) quando mancano da 0 a 6 ore all'inizio di una partita o di un allenamento: trigger sul database, tipo `presenza_modificata`, una notifica per modifica, push dal worker.                                                                                                                                                                                                                                                                                                         | Gli admin e gli allenatori attivi, tranne il giocatore a cui appartiene la presenza.                                                                                                                                                         | sì               | sì     | sì              |

Le notifiche generate dal server (righe 1-6 e 8) hanno tutti e tre i canali (DD-038), tranne il turno palloni (riga 4), che non manda email (DD-040). La
differenza sta in come parte la push: quelle dei pulsanti (3 e 6) la mandano le route dell'app, quelle
automatiche (4, 5 e 8; la 1 e la 2 non esistono più) nascono nel database e la manda il worker `mailer/` (vedi «Push dei
promemoria»). Il sondaggio riscrive la notifica esistente se l'admin preme di nuovo il pulsante per
lo stesso evento (vedi «Centro notifiche in-app»).

> **Righe 1, 2, 4 e 5 (DD-040).** Implementate con la migration `m26` (job `pg_cron`, testi, revoca) e
> applicate in produzione (`m26` il 30/09/2026; `m27` il 01/10/2026, che porta il turno palloni a un solo
> avviso 3 ore prima, DD-042).

Cosa riceve l'allenatore, notifica per notifica: [allenatore.md](allenatore.md#notifiche).

### Testi delle notifiche

Il testo è lo stesso su push, centro notifiche in-app ed email: titolo e corpo si scrivono una
volta sola. Nell'email il titolo diventa l'oggetto e il corpo segue il formato di
[notifiche-email.md](notifiche-email.md#contenuto-delle-mail) (link «Apri CrAPP» e avviso di
disattivazione). Tra `<…>` i valori che cambiano a ogni invio; le date sono `GG/MM/AAAA`.

| #   | Notifica                                | Titolo                                                                                                                | Corpo                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-2 | Promemoria 24 e 3 ore (rimosso, DD-043) | `Promemoria evento di domani: <titolo evento>`, oppure `…di oggi: <titolo evento>`                                    | `Data: domani, <GG/MM/AAAA>`<br>`Ora: <ora>`<br>`Luogo: <luogo>` — «domani» se la data dell'evento è quella di domani, «oggi» altrimenti (fuso `Europe/Rome`, vale per entrambi i promemoria)                                                                               |
| 3   | Messaggio dello staff                   | `Messaggio dallo staff`                                                                                               | Il testo scritto dall'admin, max 300 caratteri.                                                                                                                                                                                                                             |
| 4a  | Turno palloni, all'incaricato           | `Turno palloni: incarico assegnato`                                                                                   | `Evento: <titolo>`<br>`Data: <GG/MM/AAAA>, ore <ora>`<br>`Incarico: custodia dei palloni al termine dell'evento`<br>`Riconsegna: <GG/MM/AAAA dell'evento successivo>` — senza evento successivo la riga «Riconsegna» manca                                                  |
| 4b  | Turno palloni, a chi li aveva           | `Turno palloni: riconsegna`                                                                                           | `Evento: <titolo>`<br>`Data: <GG/MM/AAAA>, ore <ora>`<br>`Incarico: riconsegna dei palloni in custodia dal turno precedente`                                                                                                                                                |
| 4c  | Turno palloni, revoca                   | `Turno palloni: incarico revocato`                                                                                    | `Evento: <titolo>`<br>`Data: <GG/MM/AAAA>, ore <ora>`<br>`Incarico: non più a tuo carico per questo evento` — a chi aveva ricevuto un avviso (4a o 4b) e non è più destinatario; una sola volta                                                                             |
| 5   | Sollecito presenze                      | `Conferma di partecipazione richiesta: <titolo>`                                                                      | `Data: <GG/MM/AAAA>`<br>`Ora: <ora>`<br>`Luogo: <luogo>`<br>`Richiesta di: <Nome>` (solo nel sollecito manuale, e solo se il nome c'è)<br>`Risposta attuale: nessuna` (oppure `forse`)<br>`Azione: indicare presente, assente o in ritardo` — stesso testo a 24, 12 e 6 ore |
| 6   | Sondaggio pre-partita                   | `💩 Sondaggio pre-partita aperto`                                                                                     | `<partita> · ore <ora>. Quante cacche hai fatto? Rispondi prima del fischio d'inizio.`                                                                                                                                                                                      |
| 8a  | Compleanno, auguri al festeggiato       | `Buon compleanno, <Nome>! 🎂`                                                                                         | Nessuno: solo il titolo                                                                                                                                                                                                                                                     |
| 8b  | Compleanno, avviso agli altri           | `Oggi è il compleanno di <Nome>` — con più festeggiati `<A> e <B>`, o `<A>, <B> e <C>`, in ordine alfabetico per nome | Nessuno: solo il titolo. L'età non compare né negli auguri né nell'avviso                                                                                                                                                                                                   |
| 9   | Presenza modificata (DD-050)            | `Presenza modificata: <Nome Cognome>`                                                                                 | `Evento: <titolo>`<br>`Data: <GG/MM/AAAA>, ore <ora>`<br>`Da: <stato prima>`<br>`A: <stato dopo>` — stati: presente, assente, forse, in ritardo, infortunato, nessuna risposta                                                                                              |

Le righe 4a-4c e 5 (e le 1-2, finché esistevano) nascono nelle funzioni SQL della migration `m26`
(`genera_promemoria_eventi`, `genera_avvisi_palloni_fascia`, `genera_revoche_palloni`,
`genera_solleciti_presenze_fascia`); i pulsanti usano gli stessi testi da `palloni-core.ts`
(`avvisiPalloniEvento`) e `presenze.ts` (`testoSollecito`), e `notifiche-automatiche.test.ts` verifica che siano
identici. In tutte la riga «Luogo» manca se l'evento non ha un luogo. Fino all'applicazione della `m26` in produzione valgono i testi di 1.2.0: promemoria
«Promemoria: _titolo_» con corpo «_data_ alle _ora_», turno palloni «Tocca a te prendere i palloni» / «Porta
i palloni», sollecito «Manca la tua risposta». Le righe 3 e 6 non cambiano:
`notifica-personalizzata.ts` e `cacche.ts` (`avvisoSondaggio`).

**Notifiche smart (riga 7).** Solo locali: la notifica di sistema ha il titolo preceduto
dall'emoji. Non entrano nel centro notifiche e non generano email.

| Situazione                         | Titolo                  | Corpo                                                                                              |
| ---------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| Badge sbloccato (🏅)               | `<badge> <grado>`       | `<valore> <unità>: badge sbloccato, complimenti!`                                                  |
| Badge segreto                      | `Badge segreto: <nome>` | Testo del badge (`notificaPush`, poi `celebrazione`), altrimenti «Hai scoperto un badge nascosto!» |
| A un passo da un badge (🔥)        | `Sei a un passo`        | `<N> <unità> e sblocchi <badge>.` — scatta con al massimo 2 unità mancanti                         |
| Serie a un traguardo esatto (⚡)   | `Serie di <N> <tipo>`   | `Continuità da veterano: non fermarti ora.`                                                        |
| Obiettivo di squadra tra 90% e 99% | `<obiettivo>: <pct>%`   | Microtesto di `microcopyObiettivo()`, dipende dall'obiettivo                                       |
| Badge social vinto                 | `<categoria> x<N>`      | `I tuoi compagni hanno votato per te.`                                                             |

### Cosa non genera nessuna notifica

- Creare, spostare, modificare o cancellare un evento. Dalla `m28` (DD-043) non parte nemmeno più un
  promemoria prima dell'inizio: restano solo il turno palloni e il sollecito presenze.
- L'arrivo di un risultato, di una pagella o di un voto MVP.
- Un giocatore che risponde a un evento: nessun avviso a chi gestisce gli eventi, **salvo** quando la risposta cambia a meno di 6 ore da una partita o un allenamento (riga 9, DD-050).
- Assenze e infortuni.
- La registrazione o il collegamento di un nuovo giocatore.
- Il certificato in scadenza: resta una card in Home (DD-035).
- Un compleanno non ancora arrivato: l'avviso parte solo il giorno stesso (DD-047).

### Comportamenti da conoscere

Sono l'effetto attuale della logica, non scelte documentate altrove. I punti sui **promemoria 1 e 2**
descrivono come funzionavano fino alla `m28`: la funzione esiste ancora ma nessun job la chiama
(DD-043); valgono solo se i job vengono ripianificati.

- **I promemoria (1 e 2) non distinguono il tipo di evento:** scattano per allenamenti, partite ed
  eventi extra-campo (per esempio una cena). Il turno palloni (4), invece, esiste solo per
  allenamenti e partite.
- **Un evento creato a poche ore dall'inizio riceve subito i promemoria che gli spettano:** se
  mancano meno di 24 ore parte il promemoria «24 ore» al primo giro del job orario, e se ne
  mancano meno di 3 anche quello «3 ore», a distanza di pochi minuti.
- **Ogni promemoria si genera una sola volta per giocatore, evento e tipo, anche se il giocatore
  lo elimina** (M23, DD-037): il job registra ciò che ha generato in `promemoria_eventi_generati`,
  una tabella indipendente da `notifiche_utente`. Eliminare la notifica dal centro notifiche non
  la fa tornare e non accoda una nuova mail. Prima di M23 tornava: la riga eliminata veniva
  rigenerata al giro successivo del job, con una nuova mail a ogni giro fino all'inizio
  dell'evento.
- **Il registro non segue le modifiche all'evento:** se un evento viene spostato dopo che il
  promemoria è partito, non ne parte uno nuovo per la data nuova. Chi viene aggiunto ai convocati
  dopo riceve invece il suo promemoria, perché il registro è per giocatore.
- **Le notifiche eliminate non tornano da sole:** la 3 e la 6 riappaiono solo se un admin
  rimanda il messaggio o riapre il sondaggio; quelle automatiche (1, 2, 4 e 5) non tornano affatto,
  perché il registro ricorda di averle già generate.
- **Un evento già iniziato non genera più promemoria.**
- **Due notifiche su sei dipendono solo da un gesto manuale** (3 e 6): se nessuno preme il pulsante,
  nessuno viene avvisato. Le altre quattro sono automatiche (DD-040); per turno palloni e sollecito il
  pulsante resta come aggiunta e può arrivare in più rispetto a quelle automatiche.
- **Il turno palloni parte solo se l'incaricato è confermato** (DD-040): per una partita la
  proposta automatica di `completaTurni()` non salvata non basta. Se l'incaricato cambia dopo
  un avviso, il nuovo riceve il proprio al giro successivo e il precedente riceve una sola volta
  «Turno palloni: incarico revocato»; se viene poi riassegnato, non riceve un secondo avviso.
- **Il sollecito automatico è uno solo, a 24 ore** (DD-045): parte per gli eventi che iniziano entro 24
  ore, a chi in quel momento non ha risposto o ha risposto «forse». Un evento creato a meno di 24
  ore dall'inizio lo riceve comunque, una volta. Chi risponde dopo non ne riceve altri; chi resta su
  «forse» non lo riceve una seconda volta. Altri solleciti solo col pulsante manuale.
- **Per ogni evento un giocatore riceve al massimo una mail automatica** (DD-045): il
  sollecito presenze (il promemoria è stato tolto, DD-043), più quelle dei pulsanti manuali (sollecito, sondaggio). Il turno palloni
  (avvisi automatici, revoca e pulsante) non manda email: restano la push e l'alert in app.
- **Il compleanno parte una volta al giorno, dalle 8:00 (fuso `Europe/Rome`)** (DD-047): il job gira ogni ora e
  agisce solo dalle 8; il registro `compleanni_notificati` (per destinatario e giorno) impedisce il doppione anche se
  il giocatore elimina la notifica. Chi non ha la data di nascita o non è attivo non è né festeggiato né destinatario.
  Un nuovo membro, o chi inserisce la nascita, dopo che gli avvisi del giorno sono partiti non genera un secondo giro.
- **29 febbraio: per ora non gestito** (DD-047). Chi è nato il 29 febbraio è avvisato solo negli anni bisestili: negli
  altri non parte nulla, né il 28 febbraio né il 1° marzo. Limite noto e accettato.
- **Non esistono preferenze per tipo di notifica:** un solo interruttore per la push («Notifiche»)
  e uno per le email («Email»). Il centro notifiche in-app non si può spegnere.

### Test che verificano il catalogo

| Cosa                                                                                                                                                                                                                                    | Test                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Promemoria 24 e 3 ore (funzione ancora presente ma non pianificata, M28): destinatari (convocati, tutti i giocatori attivi se `convocati` è vuoto, mai l'allenatore), deduplica, eliminazione, coda push ed email                       | `test/integration/destinatari-notifiche.test.ts`, `promemoria-eventi.test.ts`, `push-promemoria.test.ts`, `notifiche-email.test.ts`; niente job pianificati: `notifiche-automatiche.test.ts` (M28) |
| Messaggio dello staff: push a tutti i dispositivi (allenatore compreso) o a uno solo, in-app a tutta la rosa attiva, riservato agli admin                                                                                               | `destinatari-notifiche.test.ts`, `notifiche-utente.test.ts`                                                                                                                                        |
| Turno palloni: incaricato e chi li aveva prima, solo allenamenti e partite, riservato agli admin                                                                                                                                        | `destinatari-notifiche.test.ts`, `unit/palloni-core.test.ts`                                                                                                                                       |
| Sollecito presenze: chi non ha risposto o ha detto «forse», mai l'allenatore; permesso ad allenatore e admin, non ai giocatori                                                                                                          | `destinatari-notifiche.test.ts`, `unit/presenze.test.ts`                                                                                                                                           |
| Sondaggio pre-partita: push senza allenatori, avviso in-app ed email ai giocatori attivi, `upsert`, riservato agli admin                                                                                                                | `destinatari-notifiche.test.ts`, `sondaggio-notifiche.test.ts`, `unit/cacche.test.ts`                                                                                                              |
| Promemoria con «oggi/domani», turno palloni a 3 ore e revoca, solleciti a 24 ore (manuale compreso): finestre, destinatari, una sola volta, registro (DD-040, `m26`; palloni a 3 ore: DD-042, solleciti a 24 ore: DD-045, `m30`; `m27`) | `integration/notifiche-automatiche.test.ts`, `promemoria-eventi.test.ts` (testo oggi/domani), `destinatari-notifiche.test.ts` (pulsanti), `unit/palloni-core.test.ts`, `unit/presenze.test.ts`     |
| Compleanno: ora (anche con l'ora legale), festeggiato e altri, più compleanni lo stesso giorno, una sola volta anche se eliminata, push ed email in coda, 29 febbraio, job pianificato (DD-047, `m31`)                                  | `integration/notifiche-compleanno.test.ts`                                                                                                                                                         |
| Worker: esiti, backoff, tetto giornaliero, iscrizioni scadute                                                                                                                                                                           | `unit/mailer-core.test.ts`                                                                                                                                                                         |
| L'allenatore è fuori dalla rosa di gioco                                                                                                                                                                                                | `unit/giocatori-squadra.test.ts` (`inRosa`)                                                                                                                                                        |

Le push dei test vanno a un servizio push finto in locale: si verifica **a chi** arrivano, non la
consegna su un telefono. Non ha un test l'esclusione dell'allenatore dalle **notifiche smart**: la
catena `useIo()` → `useRosa()` → `useNotificheSmart()` è fatta di hook e si conosce dalla lettura del
codice; l'unico pezzo puro, `inRosa`, è coperto.

---

## Dati

`push_subscriptions` (un dispositivo per riga, chiave `endpoint`, con le chiavi `p256dh` e
`auth` con cui si cifra il payload per quel dispositivo). La tabella `promemoria_push` non è
più usata da nessuno: serviva da coda del testo quando la push partiva vuota (DD-026).

---

## Iscrizione alle notifiche push

In Profilo → Opzioni c’è **un solo interruttore** («Notifiche»). Non esistono preferenze
separate per tipo di messaggio: l’iscrizione registra il dispositivo e lo rende destinatario
di **tutte** le push (promemoria palloni, solleciti presenze) e abilita anche le notifiche
smart in app, che usano lo stesso service worker.

1. Il giocatore attiva «Notifiche» in `/profilo` → richiesta permesso browser.
2. `GET /api/public/push-config` restituisce solo la chiave pubblica VAPID.
3. Registrazione del service worker `public/push-sw.js` e `pushManager.subscribe()`.
4. `POST /api/public/push-subscribe` registra endpoint e chiavi in `push_subscriptions`
   (upsert).

All'avvio e quando l'app torna visibile viene richiesto l'aggiornamento della registrazione
push esistente con `ServiceWorkerRegistration.update()`. Non si chiede un nuovo permesso,
non si ricrea la sottoscrizione e non si cambia l'endpoint: anche chi ha già attivato le
notifiche deve ricevere le correzioni del worker senza spegnere e riaccendere l'interruttore.
Gli aggiornamenti contemporanei sono accorpati; un errore di rete non blocca l'app e si
riprova al ritorno in primo piano. Il worker attende `skipWaiting()` durante l'installazione.
Il browser controlla anche autonomamente gli aggiornamenti: questa richiesta esplicita
copre in particolare le sessioni lunghe della webapp (vedi il
[ciclo di vita del service worker](https://web.dev/articles/service-worker-lifecycle)).

---

## Ruolo delle tre route pubbliche

- **`push-config`** — espone la sola chiave pubblica VAPID.
- **`push-subscribe`** — registra o rimuove l'iscrizione di un dispositivo.
- **`apri-sondaggio`** — premuto da un admin dalla pagina partita: manda a tutti i dispositivi
  iscritti (allenatori esclusi) l'avviso di apertura del sondaggio pre-partita e lo scrive anche in
  `notifiche_utente` per i giocatori attivi, così compare nel centro notifiche e parte per email
  (DD-038; vedi [Scout Live](scout-live.md)).

L'invio effettivo (`src/lib/webpush.server.ts`, funzione `inviaPush`) firma un JWT VAPID
(ECDSA P-256), cifra `{title, body}` per il dispositivo destinatario e fa una POST
all'endpoint push del browser; è riusato identico da `sollecita-presenze.ts`,
`promemoria-palloni.ts` e `apri-sondaggio.ts` .

Il testo viaggia **dentro** la push, cifrato in `aes128gcm` (RFC 8188/8291) con le chiavi del
dispositivo: il service worker fa `event.data.json()` e mostra la notifica senza toccare la
rete. È il punto decisivo per la consegna ad app chiusa — il browser sveglia il worker per
pochi secondi, e una fetch per recuperare il testo lo faceva morire prima di
`showNotification` (DD-026).

La POST porta `Urgency: high`. Con l'urgenza predefinita ("normal") un telefono in risparmio
energetico accumula i messaggi fino al risveglio: la notifica arriva solo quando il
dispositivo è già attivo — cioè, nella pratica, solo con l'app aperta.

### Chi può farle partire (DD-024, DD-025)

Queste route usano la service role e saltano la RLS, quindi il permesso deve stare nella
route. Tutte e tre partono da un gesto di un amministratore dentro l'app, quindi il controllo
è uno solo (`richiediAdmin` in `src/lib/auth-route.server.ts`) e non serve configurare nessuna
variabile d'ambiente.

| Route                                                                                                       | Controllo                                                                          | Chi la chiama                                                   |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apri-sondaggio`, `sollecita-presenze`, `promemoria-palloni`, `notifiche-attive`, `notifica-personalizzata` | `richiediAdmin` — token della sessione Supabase, poi ruolo `admin` in `user_roles` | l'app, da un pulsante o una vista riservati agli admin          |
| `csi`, `push-config`, `push-subscribe`                                                                      | nessuno                                                                            | il browser prima del login, che una sessione non ce l'ha ancora |

Con DD-040 `promemoria-palloni` e `sollecita-presenze` restano, accanto ai job automatici (la seconda
anche per l'allenatore, `richiediGestoreEventi()`).

`notifiche-attive` è a sola lettura: non manda push, restituisce gli id giocatore con almeno
un dispositivo iscritto in `push_subscriptions` (deduplicati). Alimenta la tab "Notifiche"
della dashboard admin (vedi [Profilo giocatore](profilo-giocatore.md)), non l'invio effettivo.
La tab elenca tutti i giocatori attivi della squadra, non solo chi ha le notifiche abilitate:
l'icona (campana piena/barrata) distingue chi ha almeno un dispositivo iscritto da chi non
l'ha ancora attivata.

`notifica-personalizzata` manda un messaggio libero scritto dall'admin: senza `giocatoreId`
lo manda a tutti i dispositivi iscritti in `push_subscriptions`, con `giocatoreId` solo a
quelli di quel giocatore. Titolo fisso ("Messaggio dallo staff"), corpo il testo scritto
dall'admin (max 300 caratteri). Stessa logica di pulizia delle altre route: una sottoscrizione
che risponde 404/410 viene cancellata dalla tabella. Nella tab "Notifiche" della dashboard
admin c'è un bottone "Invia messaggio a tutti" sopra l'elenco e un bottone per riga giocatore.

---

## Notifiche smart

`calcolaNotifiche()` (`notifiche-smart.ts`) genera un evento solo quando "c'è qualcosa di
reale": badge appena sbloccato, "sei a un passo" da un traguardo, serie che raggiunge un
traguardo esatto, obiettivo di squadra tra il 90 e il 100%, badge social vinto. Ogni notifica
ha un id deterministico; quelli già mostrati sono salvati in `localStorage` per non
ripetersi — deduplica puramente locale al dispositivo, non sincronizzata.

**Chi le riceve.** Solo chi ha selezionato sul dispositivo uno slot **giocatore in rosa**:
`CelebrazioneBadge` (montato una volta in `__root.tsx`) passa a `useNotificheSmart()` il giocatore
letto da `useGiocatoreCorrente()`, cioè `useIo()`, che lo cerca in `useRosa()`. Quell'elenco esclude
gli allenatori (`inRosa`, DD-034), che non hanno statistiche: per loro `useIo()` è `null` e
`useNotificheSmart()` esce subito, senza calcolare nulla né mostrare la card celebrativa o la
notifica del sistema. Vedi [allenatore.md](allenatore.md#notifiche).

---

## Centro notifiche in-app (M17)

Pallino sull'angolo dell'avatar del profilo in alto a destra (`PallinoNotifiche` dentro
`LinkProfilo`, `src/components/crapp/ui-bits.tsx`): rosso con il numero delle non lette; se
sono tutte lette resta neutro con il totale, così le lette restano raggiungibili per
eliminarle; senza notifiche non compare. Il tap sull'avatar porta sempre a `/profilo`, solo il
tap sul pallino apre il pannello (logica in `pallinoNotifiche()`). Fino a 0.9.2 era una
campanella separata accanto all'avatar. Indipendente dal canale push sopra:
non richiede che il dispositivo abbia attivato «Notifiche», ha uno storico persistente in
`notifiche_utente` (vedi [DATABASE.md](../DATABASE.md)) con stato letto/non letto, e non è la
stessa cosa delle notifiche smart (quelle restano locali, non salvate a database).

Cinque sorgenti scrivono in `notifiche_utente`, mai il client (con DD-040 le sorgenti 3 e 4 hanno in più un
job `pg_cron` come la 2, che scrive `turno_palloni_3h`/`_revocato` (`_12h`/`_6h` solo fino a `m26`) e `sollecita_presenze_24h` (`_12h`/`_6h` solo fino a `m29`); i pulsanti restano e scrivono `turno_palloni` e `sollecita_presenze`):

1. **Messaggio admin** — `notifica-personalizzata.ts` inserisce una riga per destinatario
   in parallelo all'invio push esistente (a tutta la rosa attiva se `giocatoreId` è omesso).
2. **Promemoria evento (rimosso dalla `m28`, DD-043: i job non esistono più)** — due job `pg_cron` (ogni ora per la finestra delle 24h, ogni 15
   minuti per quella delle 3h) generano una notifica per evento imminente, per i convocati
   (o tutta la rosa attiva se l'evento non ne specifica), deduplicata dal registro
   `promemoria_eventi_generati` (M23, DD-037; il vincolo `UNIQUE (giocatore_id, evento_id, tipo)`
   di `notifiche_utente` resta come seconda difesa) così un cron che gira più volte non manda
   doppioni, nemmeno se il giocatore elimina la notifica. Volutamente non c'è una notifica sulla sola creazione dell'evento: conta
   l'avvicinarsi della data, non il momento in cui è stato messo in calendario.
3. **Turno palloni** — `promemoria-palloni.ts` (bottone riservato agli admin sulla pagina
   evento, vedi [Turno palloni](palloni.md)) inserisce una riga per ciascun avviso calcolato
   da `avvisiPalloniEvento()`, in parallelo alla push.
4. **Sollecito presenze** — `sollecita-presenze.ts` (stesso innesco manuale) inserisce una
   riga per ciascun giocatore che non ha ancora risposto, in parallelo alla push.
5. **Sondaggio pre-partita** — `apri-sondaggio.ts` (pulsante riservato agli admin sulla pagina
   della partita) inserisce una riga di tipo `sondaggio_cacche` per ciascun giocatore attivo,
   allenatori esclusi (`destinatariSondaggio()`), in parallelo alla push (M24, DD-038).

Turno palloni, sollecito presenze e sondaggio usano un `upsert` su `(giocatore_id, evento_id, tipo)`
invece di un semplice insert: se l'admin preme di nuovo il pulsante per lo stesso evento, la
notifica esistente viene aggiornata (testo e `creato_il` freschi, `letta` riportata a false)
invece di duplicarsi o fallire per il vincolo `UNIQUE`.

Il corpo delle notifiche automatiche è a righe etichettate (Data, Ora, Luogo…): `RigaNotifica` lo mostra con
`whitespace-pre-line`, e un test di `unit/notifiche-utente.test.ts` verifica che la classe ci sia.

Lettura, "segna come letta" ed eliminazione passano dal client Supabase autenticato con RLS
(`useNotificheMie()`/`useSegnaLette()`/`useEliminaNotifica()`), senza una route API dedicata
— stesso pattern di `useSalvaEvento()` in `src/lib/eventi.ts`. Aprire il pannello segna tutte
le notifiche del giocatore selezionato come lette; non c'è un pulsante "segna singola"
separato.

**Non c'è pulizia automatica delle notifiche vecchie** (DD-030): l'unico modo per farle
sparire per sempre è eliminarle una per una, con uno swipe verso sinistra sulla riga
(`RigaNotifica` in `ui-bits.tsx`, stessa fisica a molla dello swipe del calendario) o con la
× che compare sopra ogni riga per chi non è su touch. Chi non tocca mai una notifica se la
ritrova per sempre nell'elenco, solo segnata come letta.

## Push dei promemoria (M24)

I promemoria a 24 e 3 ore (rimossi con la `m28`, DD-043; la coda resta valida per i tipi già esistenti) nascevano nel database (job `pg_cron`), che non può firmare né cifrare una
push Web: la manda il worker `mailer/`, lo stesso che invia le email ([WORKER_EMAIL.md](../WORKER_EMAIL.md),
DD-038).

1. Quando il job crea un promemoria, un trigger lo accoda in `notifiche_push_coda` (solo i tipi
   `evento_promemoria_24h` e `evento_promemoria_3h`: le altre notifiche mandano già la push
   dall'app, e una seconda sarebbe un doppione).
2. Il worker, a ogni giro, chiama `prendi_push_promemoria()`, che restituisce testo e dispositivi
   iscritti del giocatore, e manda la push a **tutti** i suoi dispositivi con lo stesso modulo
   dell'app (`src/lib/webpush.server.ts`), quindi con le stesse regole di cifratura, urgenza e TTL.
3. Un solo esito per notifica: `inviata` se almeno un dispositivo accetta; `riprova` con backoff
   1 · 5 · 30 · 120 minuti sugli errori temporanei (429, 5xx, rete), poi `fallita`; `fallita`
   subito su un rifiuto permanente (400, 401, 403, 413: tipicamente chiavi VAPID sbagliate);
   `saltata` se le iscrizioni erano tutte scadute o il giocatore non ne ha.
4. Le iscrizioni che rispondono 404 o 410 vengono eliminate da `push_subscriptions`, come fanno le
   route.
5. Una push in coda da oltre 3 ore dalla creazione del promemoria si scarta (`saltata`): a evento
   ormai iniziato sarebbe solo rumore. Vale se il worker resta fermo a lungo.

La push dei promemoria dipende solo dai dispositivi iscritti, non dall'interruttore «Email». Se il
worker non ha le chiavi VAPID parte lo stesso e manda solo le email, segnalandolo nel log.

Con DD-040 il trigger accoda in `notifiche_push_coda` anche `turno_palloni_12h`, `_6h`, `_3h`, `turno_palloni_revocato` e
`sollecita_presenze_24h`, `_12h` e `_6h`, perché nascono nel database e nessuna route manda la
push (quelle dei pulsanti, `turno_palloni` e `sollecita_presenze`, restano fuori dalla coda): le regole di invio, backoff e scarto sono quelle qui sopra. Un sollecito in coda da oltre 3 ore si scarta come un
promemoria.

## Canale email (M22)

Ogni riga di `notifiche_utente` viene inviata anche per email da un worker esterno, con
un interruttore «Email» per account in Profilo → Opzioni: [notifiche-email.md](notifiche-email.md).
Non cambia nulla di quanto descritto sopra: push, notifiche smart e centro notifiche restano
indipendenti e le sorgenti scrivono `notifiche_utente` come prima. Il certificato in
scadenza resta una card in Home e non genera mail (DD-035).

## Limiti noti

- Non ci sono preferenze granulari (solo palloni / solo presenze / solo smart): un dispositivo
  è iscritto o no. Separare i canali richiederebbe schema e UI dedicati.
- La tabella `promemoria_push` è rimasta nel database ma non la usa più nessuno (DD-026): va
  eliminata con una migrazione alla prossima occasione.
- **Un 2xx dal server push non significa consegnato.** FCM accetta con 201 anche verso
  registrazioni scadute e poi butta via il messaggio, senza il 404/410 che farebbe pulire
  `push_subscriptions`. Il conteggio "inviate a N dispositivi" va letto come "accettate da N
  server push", non come "arrivate a N telefoni".
- Compatibilità iOS/Safari non gestita esplicitamente nel codice (nessun branch dedicato):
  serve l'installazione da schermata Home per funzionare, ma l'app non lo segnala
  esplicitamente. È il primo sospetto quando una notifica non arriva ad app chiusa su iPhone.
- **Su Android non riceve la webapp: riceve il browser.** Il WebAPK è solo l'identità con
  cui la notifica viene mostrata; la connessione con i server push la tiene Chrome, tramite
  Google Play Services. Se Android non può avviare Chrome, il messaggio resta in coda e
  compare tutto insieme al lancio successivo — il sintomo classico è «arriva solo quando
  riapro l'app». Un 201 dal servizio push non lo distingue in alcun modo da una consegna
  riuscita.

  Verificato sul campo (settembre 2026, Motorola): con Chrome vivo in secondo piano la push
  arriva ad app chiusa e schermo bloccato, WebAPK compreso — quindi server, cifratura,
  service worker, permesso notifiche e canale erano già corretti. L'unica condizione che
  fallisce è **Chrome non in esecuzione**. La cura sta in Impostazioni → App → **Chrome** →
  Batteria → «Senza restrizioni», più Impostazioni → Batteria → «Batteria adattiva»
  disattivata. Mettere «Senza restrizioni» solo su CrAPP non basta e depista.

  **Come misurarlo invece di indovinare:** `chrome://gcm-internals` sul telefono, sezione
  «Receive Message Log». Se la riga porta l'orario dell'invio, il messaggio era arrivato e
  non è stato mostrato (permesso o canale); se porta l'orario in cui si è riaperta l'app,
  non era stato consegnato (risveglio, quindi batteria). Attenzione: tenere quella scheda
  aperta **tiene Chrome vivo**, quindi falsa la prova stretta — per quella, nessuna scheda
  aperta e Chrome tolto dai recenti.

- Su Motorola verificare anche le restrizioni del **browser che ha installato CrAPP** e,
  dove presente, Impostazioni → Batteria → Ottimizzazione standby app. Il produttore
  documenta la limitazione dei processi in background
  ([guida Motorola](https://help.motorola.com/hc/3505/14/global/en-us/CG2007980805.html)).
  È una possibile causa del sintomo, non una diagnosi verificata sul dispositivo: il
  codice web non può rimuovere questi vincoli. La verifica richiede un invio da un altro
  dispositivo mentre CrAPP è chiusa e lo schermo del Motorola è bloccato. Il pulsante di
  prova invia subito, quindi da solo non dimostra la ricezione in background.
- Le notifiche smart dipendono da un service worker già registrato: se il giocatore non ha
  mai attivato le push, `notificaSistema()` non ha un `reg` a cui appoggiarsi e la notifica
  locale non viene mai mostrata, anche con permesso concesso.
- Il payload cifrato non può superare i ~4 KB: i testi attuali stanno larghi, ma un messaggio
  molto lungo verrebbe rifiutato dal servizio push.

---

## Evoluzioni possibili

- Preferenze per canale (palloni, solleciti, smart), se servono davvero alla squadra.
- Eliminare `promemoria_push` con una migrazione.
- Gestire esplicitamente il caso iOS (messaggio se l'app non è installata da Home).
