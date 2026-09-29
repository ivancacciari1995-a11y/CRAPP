# Modulo — Notifiche email

**Stato:** progettato, non implementato (DD-036, in valutazione)
**File previsti:** `mailer/` (worker Node + `Dockerfile` + `docker-compose.yml`), una migration
`m22_…` per la coda e la preferenza, `src/lib/notifiche-email-core.ts` (logica pura, testata)

## Obiettivo

Far arrivare le notifiche di CrAPP anche per email, all'indirizzo Gmail con cui il giocatore
si è registrato, **a costo zero** e senza affidarsi a un servizio a pagamento. È un terzo
canale accanto alla push e al centro notifiche in-app ([notifiche.md](notifiche.md)): non li
sostituisce, e non introduce nuovi eventi. Manda per email ciò che già finisce in
`notifiche_utente`.

## Architettura

```
App su Vercel ──scrive──▶ notifiche_utente ──trigger──▶ notifiche_email_coda   (Supabase)
                                                              ▲
                                            polling in uscita │ service role
                                                              │
                                     Container Docker sul tuo host  (mailer)
                                                              │ SMTP 587 (STARTTLS)
                                                              ▼
                                       smtp.gmail.com ──▶ casella Gmail del giocatore
```

- **Vercel non ospita Docker**, quindi il worker gira sull'host di casa. Sta **solo in
  uscita**: interroga Supabase e parla con Gmail. Nessuna porta aperta sul router, nessun IP
  pubblico, nessun DNS dinamico, nessun tunnel.
- **L'app non invia mai email direttamente.** Continua a scrivere `notifiche_utente` come oggi
  (le quattro sorgenti di M17 restano invariate). Se l'host è spento le mail restano in coda
  e partono alla ripartenza: la consegna è in ritardo, mai persa.
- **Tutta la logica di accodamento sta nel database**, così vale per ogni sorgente, cron
  `pg_cron` compresi, senza toccare le route esistenti.

## Mittente: Gmail con password per app

Il worker invia con un **account Gmail dedicato** (es. `crapp.notifiche@gmail.com`, non
quello personale) tramite `smtp.gmail.com:587`, autenticandosi con una **password per app**.

| Requisito                | Dettaglio                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Verifica in due passaggi | Obbligatoria sull'account: senza, Google non permette di creare le password per app.                                                |
| Password per app         | Da myaccount.google.com → Sicurezza → Password per le app. 16 caratteri, revocabile senza cambiare la password dell'account.        |
| Limite di invio          | Circa 500 destinatari al giorno per un account gratuito (verificare il valore corrente). Una squadra ne usa poche decine al giorno. |
| Intestazione `From`      | Gmail la riscrive con l'indirizzo dell'account: il nome visibile può essere «CrAPP», l'indirizzo no.                                |
| Porta                    | 587 in uscita. La 25 è bloccata dai provider residenziali e non serve.                                                              |

Perché Gmail e non un relay come Brevo o Resend: i destinatari sono già su Gmail, quindi la
mail parte e arriva dentro la stessa infrastruttura, con SPF e DKIM già a posto e senza dover
comprare né configurare un dominio. Un relay dedicato ha senso solo se un giorno si vorrà un
mittente col dominio della squadra (vedi Riesame in DD-036). **Non si invia mai direttamente
dal proprio IP di casa**: gli IP residenziali sono nelle blocklist e senza reverse DNS le mail
finiscono in spam o vengono rifiutate.

## Dati (bozza, non ancora in `DATABASE.md`)

Lo schema si documenta in [DATABASE.md](../DATABASE.md) nella stessa modifica che crea la
migration. La bozza:

**`notifiche_email_coda`** — una riga per notifica da mandare.

| Colonna              | Tipo                | Note                                                                  |
| -------------------- | ------------------- | --------------------------------------------------------------------- |
| `notifica_id`        | uuid PK, FK cascade | `notifiche_utente(id)`: cancellata la notifica sparisce anche la riga |
| `stato`              | text                | `in_coda` · `in_invio` · `inviata` · `fallita` · `saltata`            |
| `tentativi`          | int                 | incrementato a ogni invio fallito                                     |
| `prossimo_tentativo` | timestamptz         | il worker la prende solo se `<= now()` (backoff)                      |
| `errore`             | text                | ultimo messaggio d'errore SMTP                                        |
| `inviata_il`         | timestamptz         | valorizzato a invio riuscito                                          |

Perché una tabella a parte e non colonne su `notifiche_utente`: quella tabella ha una policy
`UPDATE` per il giocatore su tutta la riga, quindi un client potrebbe riportare a `in_coda` una
mail già partita. La coda invece ha RLS attiva **senza nessuna policy**: la vede e la scrive
solo la service role (il worker), mai un client.

**`preferenze_utente`** — tabella nuova, una riga per **account** (`auth_user_id` PK, FK su
`auth.users` con cascade), non per slot giocatore. Per ora ha una sola colonna,
`email_notifiche boolean NOT NULL DEFAULT true`. RLS: ognuno legge e scrive solo la propria
riga (`auth_user_id = auth.uid()`), il worker la legge con la service role. **Nessuna riga
significa acceso**: la riga nasce solo quando il giocatore tocca l'interruttore (upsert), e
la funzione `prendi_notifiche_email` tratta l'assenza come `true`. Non va su
`giocatori_squadra`, che ha una riga per slot e il giocatore può modificare solo in parte
(DD-016).

**Indirizzo destinatario** — `giocatori_squadra.email`, già usata per il collegamento
automatico account↔giocatore (DD-018). Niente lettura di `auth.users`.

## Flusso

1. Una sorgente M17 inserisce (o aggiorna via `upsert`) una riga in `notifiche_utente`.
2. Un trigger `AFTER INSERT OR UPDATE OF creato_il` la accoda in `notifiche_email_coda`,
   L'`upsert` di turno palloni e sollecito
   presenze aggiorna `creato_il`: è un rinvio voluto, e rimette in coda anche la mail.
3. Il worker ogni ~30 secondi chiama la funzione RPC `prendi_notifiche_email(n)`, riservata
   alla service role. Seleziona fino a `n` righe `in_coda` con `FOR UPDATE SKIP LOCKED`, le
   marca `in_invio` e restituisce titolo, corpo, `evento_id` e indirizzo, già filtrate per
   preferenza attiva e slot con `auth_user_id` valorizzato. Con `SKIP LOCKED` due worker
   avviati per errore non mandano la stessa mail due volte.
4. Il worker invia con `nodemailer`, poi segna `inviata` o `fallita`.
5. Riga senza destinatario (slot non ancora collegato a un account, preferenza spenta,
   email assente): `saltata`, senza errore.

**Ogni notifica presente in `notifiche_utente` genera una mail**, di qualunque tipo:
`admin`, `evento_promemoria_24h`, `evento_promemoria_3h`, `turno_palloni`,
`sollecita_presenze`. Il modulo non aggiunge sorgenti né cambia la logica di M17: un tipo
nuovo che in futuro finisse in `notifiche_utente` viaggerebbe per email senza altro lavoro.

**Chi le riceve.** Con la stessa logica delle notifiche in-app: la mail va a chi ha la riga in
`notifiche_utente`, admin e allenatori compresi. Non c'è un percorso separato per gli admin: un
admin riceve ciò che riceverebbe come giocatore (i destinatari di ogni sorgente restano quelli
già definiti in M17 e DD-034).

Il certificato in scadenza **non genera mail**: non è una notifica ma una card calcolata in
Home (DD-035), e questo modulo non la trasforma in una. Se un giorno la si volesse anche per
email, sarebbe una sorgente nuova di `notifiche_utente` da decidere a parte.

## Affidabilità

| Situazione                            | Comportamento                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Errore temporaneo (rete, 4xx SMTP)    | Backoff 1 · 5 · 30 · 120 min, poi `fallita` dopo 5 tentativi.                                                          |
| Errore permanente (5xx, indirizzo KO) | `fallita` subito, senza altri tentativi.                                                                               |
| Worker fermo o host spento            | Le mail restano `in_coda`; partono alla ripartenza.                                                                    |
| Crash tra l'invio e l'aggiornamento   | Possibile un doppione: la consegna è _almeno una volta_. Il `Message-ID` è deterministico (derivato da `notifica_id`). |
| Righe `in_invio` orfane               | All'avvio il worker riporta a `in_coda` quelle ferme da più di 10 minuti.                                              |
| Limite giornaliero Gmail raggiunto    | Il worker si ferma fino a mezzanotte (fuso Europe/Rome) e riprende; nessuna riga viene scartata.                       |

## Worker (`mailer/`)

Servizio Node piccolo: `@supabase/supabase-js` e `nodemailer`. Le dipendenze passano dal
controllo `minimumReleaseAge` di `bunfig.toml` come per il resto del progetto.

```yaml
# mailer/docker-compose.yml (bozza)
services:
  mailer:
    build: .
    restart: unless-stopped
    env_file: .env
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 60s
      retries: 3
```

Variabili d'ambiente, mai committate (il `.env` sta nel `.gitignore`):

| Variabile                   | Contenuto                                                        |
| --------------------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`              | URL del progetto                                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | chiave service role: salta la RLS, va trattata come una password |
| `SMTP_USER`, `SMTP_PASS`    | account Gmail dedicato e relativa password per app               |
| `MAIL_FROM_NAME`            | nome visibile, es. «CrAPP»                                       |
| `POLL_SECONDI`              | intervallo di polling, default 30                                |
| `APP_URL`                   | base dei link nelle mail (es. `/evento/<id>`)                    |

`healthcheck.js` segnala non sano il container se l'ultimo ciclo di polling riuscito è più
vecchio di qualche minuto. Il log dice solo id, tipo e esito: **mai indirizzi o testi**.

## Contenuto delle mail

Sobrio, testo semplice più una versione HTML minima, leggibile da smartphone: oggetto = titolo
della notifica, corpo = corpo della notifica, un pulsante «Apri CrAPP» verso l'evento quando
`evento_id` c'è. In fondo una riga che spiega come disattivare le email (Profilo → Opzioni).
Nessuna immagine remota, nessun tracciamento delle aperture.

## Privacy e sicurezza

- Le email personali dei giocatori non lasciano Supabase se non verso Gmail, che è già dove
  stanno. Il worker legge solo l'indirizzo dei destinatari del lotto, non l'intera rosa.
- La service role sta solo sull'host, in un `.env` con permessi `600`; non passa da Vercel.
- La password per app si può revocare da Google senza toccare l'account.
- Il canale è **opt-out**: acceso di default, spegnibile dal giocatore. Un interruttore
  unico, come per la push (nessuna preferenza per tipo).

## Interfaccia

Un solo cambio: in Profilo → Opzioni, sotto «Notifiche», un interruttore «Email» che scrive la
preferenza per account. Nessuna schermata nuova. Nella tab «Notifiche» della dashboard admin
si può aggiungere in un secondo momento uno stato per giocatore (email attive o no), come già
fa la campana per la push.

## Limiti noti

- Il canale email dipende da un host di casa acceso: non c'è alta disponibilità.
- Un 250 da Gmail vuol dire «accettata», non «letta»: non c'è conferma di lettura e non se ne
  vuole una.
- Gmail può finire in spam se il testo è promozionale o se l'account nuovo invia subito
  molti messaggi: si parte con pochi invii e si tiene il tono di servizio.
- Un account collegato a più slot giocatore (`auth_user_id` ripetuto) riceve una mail per
  slot, dato che `notifiche_utente` ha una riga per `giocatore_id`.
- Cambiare l'indirizzo in `giocatori_squadra.email` cambia dove vanno le mail future; le
  righe già `inviata` non si toccano.

## Test previsti

Come da [AGENTS.md](../../AGENTS.md), le funzioni si scrivono con il loro test.

- **Unit** (`test/unit/`, su `notifiche-email-core.ts`): calcolo
  del backoff, classificazione errore temporaneo/permanente, composizione di oggetto e corpo,
  `Message-ID` deterministico.
- **Integrazione** (`test/integration/`, contro il database locale): il trigger accoda ogni
  nuova notifica; `upsert` rimette in coda; RLS senza policy (un client non legge né scrive
  la coda); `prendi_notifiche_email` non restituisce due volte la stessa riga con due chiamate
  concorrenti, salta chi ha la preferenza spenta o non ha un account collegato.
- Il transport SMTP si sostituisce con un finto nei test: nessun invio reale in CI.

## Piano di realizzazione

1. Migration `m22_…`: coda, preferenza, trigger, funzione RPC, RLS (poi `DATABASE.md`).
2. `notifiche-email-core.ts` con i test unitari.
3. Worker `mailer/` con `Dockerfile`, compose, healthcheck.
4. Interruttore in Profilo → Opzioni.
5. Prova end-to-end su `npx supabase start` con un server SMTP di prova (es. Mailpit in
   Docker), poi con l'account Gmail vero.
6. `CHANGELOG.md`, `ROADMAP.md` (spunta), `PROJECT_STATE.md`, `notifiche.md` (rimando qui).

## Evoluzioni possibili

- Un relay con dominio proprio (Brevo, Resend) se serve un mittente della squadra o si supera
  il tetto di Gmail.
- Riepilogo settimanale unico al posto di una mail per notifica.
- Preferenze per tipo di notifica, insieme a quelle della push.
