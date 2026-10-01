# Database CrAPP

Struttura del database Supabase (PostgreSQL) e ruolo di ogni tabella. Lo schema autoritativo
sono le migration in `supabase/migrations/`: **una tabella nuova va documentata qui nella
stessa modifica che la crea**. Le funzionalità future stanno in [ROADMAP.md](ROADMAP.md),
non in questo file.

## Permessi di scrittura

Chi può scrivere cosa, dopo la migration `m11_scritture_per_ruolo` (DD-023) e il ruolo
allenatore di `m21_ruolo_allenatore` (DD-034). La **lettura**
resta aperta a tutti gli autenticati su ogni tabella di questo elenco, con le eccezioni della
sezione «Lettura» qui sotto; `anon` non arriva a nessuna di esse da M4 (DD-011).

| Tabella                                                          | Chi può scrivere                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `eventi_app`                                                     | admin e allenatori (nell'app li gestisce la rotta `/eventi`, riservata a loro)                                                                                                                                                 |
| `risposte_presenze`, `cacche_partita`                            | il giocatore sulla propria riga (`giocatore_id`), mai l'allenatore (M21), più gli admin                                                                                                                                        |
| `pagelle_voti`, `mvp_voti`, `badge_social_voti`                  | il votante sui propri voti (`votante_id`), se votante e votato sono convocati all'evento (`m13`) e nessuno dei due è un allenatore (`m21`); solo per le pagelle anche `pagelle_chiuse = false`; gli admin senza questi vincoli |
| `turni_palloni`, `scout_sessioni`, `scout_live`, `scout_partite` | qualsiasi autenticato: nell'interfaccia non hanno gate                                                                                                                                                                         |
| `notifiche_utente`                                               | nessuno scrive da client: le righe nascono da trigger/funzioni `SECURITY DEFINER` o dalla service role (M17); il giocatore può solo segnare come lette le proprie                                                              |
| `notifiche_email_coda`                                           | nessuno da client, né in lettura né in scrittura: la riempie il trigger `accoda_notifica_email` e la gestisce solo il worker email con la service role (M22)                                                                   |
| `preferenze_utente`                                              | l'utente sulla propria riga (`auth_user_id = auth.uid()`), in lettura e scrittura (M22)                                                                                                                                        |
| `promemoria_eventi_generati`                                     | nessuno da client, né in lettura né in scrittura: la scrive solo la funzione `genera_promemoria_eventi()` dei cron (M23)                                                                                                       |
| `notifiche_push_coda`                                            | nessuno da client, né in lettura né in scrittura: la riempie il trigger `accoda_push_promemoria` e la gestisce solo il worker con la service role (M24)                                                                        |
| `profili_giocatore`                                              | il giocatore sul proprio profilo, admin su tutti (DD-016, DD-017)                                                                                                                                                              |
| `giocatori_squadra`                                              | admin; il giocatore può solo reclamare uno slot libero (DD-016); l'allenatore anche cambiare nome e cognome del proprio slot (M21)                                                                                             |
| `user_roles`                                                     | solo admin; la riga `allenatore` la scrive il trigger `sincronizza_ruolo_allenatore` (M21)                                                                                                                                     |

L'identità del giocatore è lo slot di `giocatori_squadra` con `auth_user_id = auth.uid()`.
La tabella è verificata da `test/integration/permessi.test.ts` contro il database locale.

## Lettura

Regola generale: ogni autenticato legge. Le eccezioni sono tutte dati personali o code interne:

| Tabella / bucket                                                            | Chi legge                                                                                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `profili_giocatore`                                                         | il titolare e gli admin (contiene documento d'identità e certificato medico, DD-016)                        |
| `bucket profili-giocatore`                                                  | privato: il titolare la propria cartella, l'admin tutto via signed URL a scadenza breve                     |
| `notifiche_utente`                                                          | il destinatario, solo le proprie righe (RLS, DD-030)                                                        |
| `preferenze_utente`                                                         | l'utente, solo la propria riga                                                                              |
| `notifiche_email_coda`, `notifiche_push_coda`, `promemoria_eventi_generati` | nessuno da client: RLS attiva senza policy, solo service role                                               |
| `giocatori_squadra.nascita`                                                 | tutta la rosa attiva: è una colonna pubblica sincronizzata, non una lettura di `profili_giocatore` (DD-031) |

## Anagrafica e utenti

| Tabella             | Scopo                                                                                                    | Note                                                                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `giocatori_squadra` | Anagrafica operativa della squadra: source of truth della rosa (DD-015).                                 | ID testuali (`g1`…`gN`). Dettaglio colonne qui sotto. Letta con `useGiocatoriSquadra()` (client) o `leggiGiocatoriSquadra()` (server), filtrando `attivo`; `src/lib/crapp-data.ts` resta solo come seed e fallback (`rosaFallback()`).                      |
| `giocatori`         | Anagrafica giocatori con UUID.                                                                           | Presente ma **non usata** dal codice: la convergenza è rinviata (DD-012, DD-014).                                                                                                                                                                           |
| `profili_giocatore` | Dati personali, metadati del documento, certificato medico e path dei file; 1:1 con `giocatori_squadra`. | Letta da `src/lib/profili.ts` (DD-016). I file non stanno qui: la tabella conserva i path nel bucket.                                                                                                                                                       |
| `user_roles`        | Ruoli applicativi (`admin`, `allenatore`, giocatore).                                                    | Fonte dei permessi di amministrazione, letta da `src/lib/ruoli.ts` (DD-011). Il primo admin va inserito a mano (vedi [OPERATIONS.md](OPERATIONS.md)). `allenatore` non si inserisce a mano: lo gestisce il trigger `sincronizza_ruolo_allenatore` (DD-034). |

Colonne di `giocatori_squadra` che meritano una nota:

| Colonna                          | Significato                                                                                                                                                                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`                          | Chiave del collegamento automatico account↔giocatore al primo accesso (DD-018). Impostabile da `/admin`.                                                                                                                                                    |
| `auth_user_id`                   | Collega lo slot all'account; NULL finché nessuno lo reclama.                                                                                                                                                                                                |
| `numero_tessera`, `data_tessera` | Chi è già tesserato al CSI. Come `numero` e `ruolo` le scrive solo un admin: il trigger le include tra i campi bloccati per chi reclama il proprio slot.                                                                                                    |
| `nascita`                        | Pubblica a tutta la rosa (DD-031). Non si scrive mai da qui: il trigger `sincronizza_nascita_pubblica` su `profili_giocatore` la tiene allineata a `data_nascita` (impostata, aggiornata o azzerata).                                                       |
| `tipo`                           | `giocatore` o `allenatore` (DD-034). L'allenatore ha uno slot per collegarsi e per i dati personali ma è fuori dalla rosa di gioco (`inRosa()`), con `numero` NULL (vincolo `giocatori_squadra_numero_giocatori`) e `ruolo` vuoto. Lo scrive solo un admin. |

`giocatori_squadra` è usata da: Squadra, Profili, Presenze, Scout, Badge, Pagelle.

## Storage

| Bucket              | Scopo                                                                                                                  | Note                                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profili-giocatore` | Documento d'identità, certificato medico e foto tessera, in cartelle per giocatore (`<giocatore_id>/<sezione>.<est>`). | **Privato e destinato a restare tale**: documenti e dati sanitari non devono mai avere URL pubblici (DD-016 regola 4). Il giocatore gestisce solo la propria cartella; l'admin scarica tutto con signed URL a scadenza breve.                  |
| `avatar-giocatori`  | Foto profilo (`<giocatore_id>/avatar.jpg`).                                                                            | **Pubblico**: foto informali. Qualsiasi autenticato può caricare, sostituire o eliminare un file (nessun controllo per proprietario: la maggior parte dei giocatori non ha ancora `auth_user_id`, DD-018). Letto da `src/lib/avatar-store.ts`. |

## Eventi e presenze

| Tabella             | Scopo                                                            | Note                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eventi_app`        | Eventi gestionali usati dall'app.                                | Modello in uso. Cancellare un evento pulisce a cascata, via trigger, tutte le tabelle collegate: `risposte_presenze`, `cacche_partita`, `mvp_voti`, `pagelle_voti`, `badge_social_voti`, `turni_palloni`, `scout_sessioni`, `scout_live`, `scout_partite` (DD-029). `bonifica_dati_evento_orfani()` (solo service role) ripulisce eventuali righe orfane. |
| `risposte_presenze` | Risposte dei giocatori agli eventi.                              | `risposto_il` è l'istante della **prima** risposta e un trigger lo rende immutabile: confrontato con `eventi_app.creato_il` dà la serie «Conferme 24h». `aggiornato_il` è l'ultima modifica.                                                                                                                                                              |
| `cacche_partita`    | Sondaggio prepartita.                                            | Usato per statistiche e badge segreti.                                                                                                                                                                                                                                                                                                                    |
| `eventi`            | Calendario generale: allenamenti, partite, eventi della squadra. | Modello «nuovo» con autenticazione e vincoli, non adottato (DD-014).                                                                                                                                                                                                                                                                                      |
| `presenze`          | Presenze agli eventi.                                            | Come sopra (DD-014).                                                                                                                                                                                                                                                                                                                                      |

## Scout

| Tabella          | Scopo                                                                                         | Note                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `scout_sessioni` | Chi ha il controllo dello Scout Live per una partita (blocco condiviso), una riga per evento. | Letta/scritta da `src/lib/scout-live.ts`.                                                        |
| `scout_live`     | Stato in corso (azioni non ancora concluse) di una sessione.                                  | Solo per statistiche di squadra, mai classifiche individuali (DD-008). `src/lib/scout-stato.ts`. |
| `scout_partite`  | Archivio delle partite scoutate concluse (risultato, parziali, azioni).                       | Letta/scritta da `src/lib/scout-store.ts`.                                                       |

## Votazioni

Per tutte: un voto per votante e partita (per categoria nei badge social), auto-voto rifiutato,
votante e votato convocati all'evento (RLS, `evento_permette_voto()`, DD-027).

| Tabella             | Scopo                              | Note                                                                  |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `mvp_voti`          | Voti MVP assegnati a fine partita. | Vincolo `mvp_no_autovoto`.                                            |
| `pagelle_voti`      | Voti anonimi ai giocatori (1-10).  | Usati per il voto medio. Si scrive solo con `pagelle_chiuse = false`. |
| `badge_social_voti` | Voti social per i badge.           | Vincolo `badge_social_no_autovoto`.                                   |

## Turni e notifiche

| Tabella                      | Scopo                                                               | Note                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turni_palloni`              | Turni palloni **confermati**.                                       | Gli allenamenti non ricevono proposta automatica (vedi [palloni.md](modules/palloni.md)).                                                                                                                               |
| `push_subscriptions`         | Dispositivi registrati per le notifiche push.                       |                                                                                                                                                                                                                         |
| `promemoria_push`            | **Non più usata.**                                                  | Serviva da coda del testo quando la push partiva vuota (DD-026). Da eliminare con una migration.                                                                                                                        |
| `notifiche_utente`           | Centro notifiche in-app, con stato letto/non letto.                 | Vedi sotto. Letta e segnata come letta dal client con `useNotificheMie()`/`useSegnaLette()` (`src/lib/notifiche-utente.ts`), solo via RLS.                                                                              |
| `notifiche_email_coda`       | Coda delle email: una riga per notifica, con stato d'invio.         | Vedi sotto. Specifica in [notifiche-email.md](modules/notifiche-email.md).                                                                                                                                              |
| `notifiche_push_coda`        | Coda delle push dei promemoria: una riga per notifica, con stato.   | Vedi sotto.                                                                                                                                                                                                             |
| `preferenze_utente`          | Preferenze del singolo account (non dello slot giocatore).          | Chiave `auth_user_id`. Oggi una colonna, `email_notifiche` (default `true`). **Nessuna riga = email attive**: la riga nasce solo quando il giocatore tocca l'interruttore in Profilo → Opzioni (`useEmailNotifiche()`). |
| `promemoria_eventi_generati` | Registro dei promemoria già generati, per giocatore, evento e tipo. | Chiave `(giocatore_id, evento_id, tipo)`, `ON DELETE CASCADE` verso giocatore ed evento (DD-029, DD-037). Eliminare la notifica non fa rigenerare il promemoria. È anche la memoria che permette la revoca (DD-040).    |

### `notifiche_utente`

- Sorgenti: messaggio libero dell'admin, promemoria evento automatici, turno palloni, sollecito
  presenze e sondaggio pre-partita (`sondaggio_cacche`). Dettaglio e testi in
  [modules/notifiche.md](modules/notifiche.md).
- Non c'è una notifica alla sola creazione di un evento: conta l'avvicinarsi della data.
- Destinatari di un evento (`giocatori_destinatari_evento()`): giocatori attivi, i convocati o tutta
  la rosa se `convocati` è vuoto; mai gli allenatori (DD-039).
- Il `CHECK` sul tipo ammette anche `turno_palloni_12h`, `_6h`, `_3h`, `turno_palloni_revocato` e
  `sollecita_presenze_24h`, `_12h`, `_6h`, scritti dai job (DD-040). `turno_palloni` e
  `sollecita_presenze` restano i tipi dei pulsanti manuali.
- Il trigger delle email salta tutti i tipi `turno_palloni*`; quello delle push accoda i tipi
  automatici ma non quelli dei pulsanti.

### Code di invio (`notifiche_email_coda`, `notifiche_push_coda`)

Stessa struttura: chiave `notifica_id` → `notifiche_utente(id)` con `ON DELETE CASCADE`; stati
`in_coda`, `in_invio`, `inviata`, `fallita`, `saltata`; colonne `tentativi`, `prossimo_tentativo`
(backoff), `errore` (solo codici SMTP per l'email, HTTP per la push), `inviata_il`, `aggiornata_il`.

- Sono riempite da trigger su `notifiche_utente` (`accoda_notifica_email`, `accoda_push_promemoria`)
  per le notifiche create dopo le rispettive migration, senza backfill.
- Le usa solo il worker `mailer/` con la service role, tramite funzioni `SECURITY DEFINER`
  riservate a `service_role`: `prendi_notifiche_email(p_max)`, `esito_notifica_email(...)`,
  `email_inviate_ultime_24h()`, `prendi_push_promemoria(p_max)`, `esito_push_promemoria(...)`.
  I lotti usano `FOR UPDATE SKIP LOCKED` e recuperano le righe ferme in `in_invio` da più di 10 minuti.
- RLS attiva **senza policy** e permessi tolti a `anon`/`authenticated`.
- Sono tabelle separate da `notifiche_utente` perché la policy `UPDATE` del giocatore su quella riga
  gli permetterebbe di riportare a `in_coda` una mail già partita (DD-036).
- Il worker salta gli slot senza account o email, o con le email spente; per le push salta chi non
  ha dispositivi e i promemoria creati da oltre 3 ore.

### Funzioni SQL e job delle notifiche

Le notifiche automatiche nascono nel database, da job `pg_cron` che chiamano funzioni `SECURITY DEFINER`
riservate alla service role (anon e utenti autenticati non possono chiamarle). Testi e regole sono in
[modules/notifiche.md](modules/notifiche.md); le decisioni in DD-037, DD-038 e DD-040.

| Funzione (migration)                                                  | Cosa fa                                                                                                                           | Job `pg_cron`                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `genera_promemoria_eventi(tipo, finestra)` (M17, M23, M26)            | Promemoria a 24 e 3 ore, con «oggi/domani», data, ora e luogo.                                                                    | `promemoria-eventi-24h` (ogni ora), `-3h` (15 min) |
| `genera_avvisi_palloni()` (M26), con `genera_avvisi_palloni_fascia()` | Avvisi del turno palloni a 12, 6 e 3 ore per gli eventi con un incaricato confermato; poi chiama `genera_revoche_palloni()`.      | `avvisi-palloni-automatici` (15 min)               |
| `genera_revoche_palloni()` (M26)                                      | Una revoca per chi aveva un avviso automatico e non è più destinatario, per eventi non ancora iniziati; guarda il registro.       | (dentro `genera_avvisi_palloni()`)                 |
| `genera_solleciti_presenze()` (M26), con `..._fascia()`               | Solleciti a 24, 12 e 6 ore ai destinatari dell'evento senza risposta o con «forse».                                               | `solleciti-presenze-automatici` (15 min)           |
| `inizio_evento(data, ora)` (M26)                                      | Istante d'inizio di un evento in fuso `Europe/Rome`; `NULL` se l'ora non è valida, e l'evento viene solo escluso.                 | —                                                  |
| `giocatori_destinatari_evento(evento)` (M17, M21, M25)                | Giocatori attivi destinatari: i convocati, o tutta la rosa se `convocati` è vuoto; mai gli allenatori.                            | —                                                  |
| `accoda_notifica_email()`, `accoda_push_promemoria()` (M22, M24, M26) | Trigger su `notifiche_utente`: la mail salta i tipi `turno_palloni*`; la push accoda i tipi automatici (non quelli dei pulsanti). | —                                                  |

## Badge

Non esiste una tabella dedicata: i badge vengono **calcolati a runtime** dall'applicazione a
partire dai dati esistenti (DD-007).
