# Database CrAPP

Struttura del database Supabase (PostgreSQL) e ruolo di ogni tabella. Lo schema autoritativo
sono le migration in `supabase/migrations/`: **una tabella nuova va documentata qui nella
stessa modifica che la crea**. Le funzionalità future stanno in [ROADMAP.md](ROADMAP.md),
non in questo file.

## Anagrafica e utenti

| Tabella | Scopo | Note |
|---|---|---|
| `giocatori_squadra` | Anagrafica operativa della squadra, con ID testuali (`g1`…`gN`), dati gestiti dagli admin (nome, cognome, numero, ruolo), collegamento all'account (`auth_user_id`) ed email registrata (`email`). | Introdotta dalla migration `m1_giocatori_squadra`, già popolata (17 giocatori) ma **non ancora letta dal codice**: la rosa arriva tuttora da `src/lib/crapp-data.ts`, che resta il fallback anche dopo il passaggio. Destinata a diventare la source of truth. Vedi DD-015 e DD-016. La colonna `email` (migration `m5_email_giocatori_squadra`) è la chiave del collegamento automatico account↔giocatore al primo accesso (DD-018): NULL finché non nota, oggi impostata solo per 2 dei 17 giocatori. |
| `giocatori` | Anagrafica giocatori con UUID. | Presente ma **non usata** dal codice attuale: la convergenza è rinviata (DD-012, DD-014). |
| `profili_giocatore` | Dati personali, metadati del documento d'identità, certificato medico e path dei file, in relazione 1:1 con `giocatori_squadra`. | Creata dalla migration `m2_profili_giocatore` (DD-016). Letta da `src/lib/profili.ts`; le policy mostrano al giocatore solo il proprio profilo e all'admin tutti. I file non stanno qui: la tabella conserva i path nel bucket. |
| `user_roles` | Ruoli applicativi (es. amministratore, giocatore). | Fonte dei permessi di amministrazione, letta da `src/lib/ruoli.ts` (DD-011). Il primo admin va inserito a mano; vedi [PROJECT_STATE.md](../PROJECT_STATE.md). |

`giocatori_squadra` / `giocatori` sono usate da: Squadra, Profili, Presenze, Scout, Badge, Pagelle.

## Storage

| Bucket | Scopo | Note |
|---|---|---|
| `profili-giocatore` | Documento d'identità, certificato medico e foto tessera, in cartelle per giocatore (`<giocatore_id>/<sezione>.<est>`). | **Privato** e destinato a restare tale: contiene documenti e dati sanitari, che non devono mai avere URL pubblici (DD-016 regola 4). Il giocatore gestisce solo la propria cartella, l'admin può scaricare tutto tramite signed URL a scadenza breve. Creato dalla migration `m3_bucket_profili`. |

## Eventi e presenze

| Tabella | Scopo | Note |
|---|---|---|
| `eventi_app` | Eventi gestionali utilizzati dall'app. | Modello in uso dal codice attuale. |
| `risposte_presenze` | Risposte dei giocatori agli eventi. | Modello in uso dal codice attuale. |
| `eventi` | Calendario generale: allenamenti, partite, eventi della squadra. | Modello "nuovo" con autenticazione e vincoli, non ancora adottato (DD-014). |
| `presenze` | Presenze agli eventi. | Come sopra (DD-014). |

## Scout

| Tabella | Scopo | Note |
|---|---|---|
| `scout_sessioni` | Sessioni di Scout Live: una sessione corrisponde a una partita. | **Non ancora usata dal codice**: oggi lo stato della sessione vive in `localStorage` (`src/lib/scout-live.ts`, `scout-store.ts`) e sul database finiscono solo le azioni in `scout_live`. |
| `scout_live` | Eventi registrati durante lo Scout Live. | Serve esclusivamente per statistiche di squadra, mai per classifiche individuali (DD-008). |

## Votazioni

| Tabella | Scopo | Note |
|---|---|---|
| `mvp_voti` | Voti MVP assegnati a fine partita. | |
| `pagelle_voti` | Voti anonimi assegnati ai giocatori. | Usati per il voto medio. |
| `badge_social_voti` | Voti social per i badge. | |

## Turni e notifiche

| Tabella | Scopo | Note |
|---|---|---|
| `turni_palloni` | Gestione dei turni palloni. | |
| `push_subscriptions` | Dispositivi registrati per le notifiche Push. | |
| `promemoria_push` | Storico dei promemoria inviati. | |

## Funzioni speciali

| Tabella | Scopo | Note |
|---|---|---|
| `cacche_partita` | Sondaggio prepartita. | Usato per statistiche e badge segreti. |

## Badge

Non esiste una tabella dedicata: i badge vengono **calcolati a runtime** dall'applicazione a
partire dai dati esistenti (DD-007).
