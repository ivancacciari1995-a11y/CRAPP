# Modulo — Notifiche email

**Stato:** implementato e in produzione dal 29/09/2026 (migration `m22`, worker in `mailer/`)
**File principali:** `supabase/migrations/20260929120000_m22_notifiche_email.sql`,
`mailer/mailer.mjs`, `mailer/mailer-core.ts`, `mailer/healthcheck.mjs`, `mailer/Dockerfile`,
`mailer/docker-compose.yml`, `src/lib/preferenze-utente.ts`, `src/routes/profilo.tsx`
(interruttore «Email»)

Questo documento descrive **cosa fa** il canale email. Come si installa, si configura e si
diagnostica il worker sta in [WORKER_EMAIL.md](../WORKER_EMAIL.md); le motivazioni delle scelte in
[DD-036](../decisions/DD-036.md).

## Obiettivo

Far arrivare le notifiche di CrAPP anche per email, all'indirizzo Gmail con cui il giocatore si è
registrato, **a costo zero**. È un terzo canale accanto alla push e al centro notifiche in-app
([notifiche.md](notifiche.md)): non li sostituisce e non introduce eventi nuovi. Manda per email
**ogni notifica che finisce già in `notifiche_utente`**, di qualunque tipo e per qualunque
destinatario.

## Architettura

```
App su Vercel ──scrive──▶ notifiche_utente ──trigger──▶ notifiche_email_coda   (Supabase)
                                                              ▲
                                            polling in uscita │ RPC con service role
                                                              │
                                     Container Docker sull'host di casa  (mailer)
                                                              │ SMTP 587 (STARTTLS)
                                                              ▼
                                       smtp.gmail.com ──▶ casella Gmail del giocatore
```

- **Vercel non ospita Docker**, quindi il worker gira su un host proprio e sta **solo in uscita**:
  interroga Supabase e parla con Gmail. Nessuna porta aperta sul router, nessun IP pubblico,
  nessun tunnel.
- **L'app non invia mai email direttamente.** Continua a scrivere `notifiche_utente` come prima:
  le route e i cron di M17 non sono stati toccati. Se l'host è spento le mail restano in coda e
  partono alla ripartenza: consegna in ritardo, mai persa.
- **L'accodamento sta nel database** (un trigger), quindi vale per ogni sorgente, cron `pg_cron`
  compresi.
- Il worker gira con **bun** (immagine `oven/bun:1-alpine`, come il resto del progetto) e ha una
  sola dipendenza, `nodemailer`. Parla con Supabase via `fetch` sulle funzioni RPC di PostgREST,
  senza `@supabase/supabase-js`. Ha un proprio `package.json` e `bun.lock`, separati da quelli
  dell'app, che non guadagna nessuna dipendenza.
- La chiave con cui il worker si autentica può essere sia una chiave JWT sia una chiave nel formato
  nuovo `sb_secret_…`: viene inviata in `apikey` e in `Authorization: Bearer` e Supabase accetta
  entrambe (verificato sul progetto di produzione).

## Quali notifiche e a chi

**Ogni riga nuova di `notifiche_utente` genera una mail**: messaggio admin, sollecito presenze, sondaggio pre-partita, compleanno (DD-047: solo il titolo, senza corpo; la mail ha oggetto, link e avviso di disattivazione). **Fa eccezione il turno palloni** (DD-040, dalla
`m26`): per i tipi `turno_palloni`, `turno_palloni_12h`, `_6h`, `_3h` e `turno_palloni_revocato` il
trigger non accoda nulla, restano push e centro notifiche. Un tipo nuovo che in futuro finisse in quella tabella
viaggerebbe per email senza altro lavoro. Le notifiche già presenti quando si applica la migration
**non** vengono inviate: il trigger non ha backfill.

Il [catalogo delle notifiche](notifiche.md#catalogo-delle-notifiche) elenca cosa fa partire ciascuna
e i suoi canali: tutte le notifiche generate dal server passano da `notifiche_utente` e quindi
arrivano anche per email (DD-038).

**Chi le riceve:** chi ha la riga in `notifiche_utente`, con la stessa logica delle notifiche
in-app. Gli admin non hanno un percorso a parte: ricevono ciò che riceverebbero secondo il proprio
slot. L'allenatore riceve solo i messaggi dello staff, non i promemoria degli eventi (DD-039), né il
sollecito, il turno palloni e il sondaggio (DD-034, DD-038).

Il certificato in scadenza **non genera mail**: non è una notifica ma una card calcolata in Home
(DD-035). Se un giorno lo si volesse anche per email sarebbe una sorgente nuova di
`notifiche_utente`, da decidere a parte.

**Indirizzo:** `giocatori_squadra.email`, la stessa colonna che collega account e giocatore
(DD-018). Uno slot senza `auth_user_id` (giocatore non ancora registrato), senza email o il cui
account ha spento le email non riceve nulla: la riga in coda passa a `saltata`, senza errore.

## Mittente

Il worker invia con un **account Gmail dedicato**, tramite `smtp.gmail.com:587`, autenticandosi con
una **password per app**. Come crearla e i problemi noti stanno in
[WORKER_EMAIL.md](../WORKER_EMAIL.md#account-gmail-e-password-per-app).

Perché Gmail e non un relay come Brevo o Resend: i destinatari sono già su Gmail, quindi la mail
parte e arriva dentro la stessa infrastruttura, con SPF e DKIM già a posto e senza comprare né
configurare un dominio. Gmail riscrive l'intestazione `From` con l'indirizzo dell'account: il nome
visibile è «CrAPP», l'indirizzo no. Il tetto è di circa 500 destinatari al giorno per un account
gratuito (valore da verificare); il worker si ferma a `MAIL_LIMITE_GIORNO`. **Non si invia mai
direttamente dal proprio IP di casa**: gli IP residenziali sono nelle blocklist e senza reverse DNS
le mail finiscono in spam o vengono rifiutate.

## Dati

Lo schema completo, con permessi e note, sta in [DATABASE.md](../DATABASE.md); qui il quadro
funzionale.

**`notifiche_email_coda`** — una riga per notifica da mandare (`notifica_id` è chiave primaria e
chiave esterna con `ON DELETE CASCADE`: cancellare la notifica, per esempio con lo swipe, toglie
anche la mail non ancora partita).

| Colonna              | Note                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `stato`              | `in_coda` · `in_invio` · `inviata` · `fallita` · `saltata`              |
| `tentativi`          | invii falliti finora; non cresce per i rinvii «differiti» (vedi sotto)  |
| `prossimo_tentativo` | il worker prende la riga solo se `<= now()` (backoff)                   |
| `errore`             | solo i codici SMTP dell'ultimo errore, mai il testo delle mail          |
| `inviata_il`         | valorizzato a invio riuscito; alimenta il conteggio delle ultime 24 ore |
| `aggiornata_il`      | serve a riconoscere le righe rimaste `in_invio` per un worker morto     |

È una tabella a parte e non colonne su `notifiche_utente` perché quella ha una policy `UPDATE` per
il giocatore su tutta la riga: un client potrebbe riportare a `in_coda` una mail già partita. La
coda ha la RLS attiva **senza alcuna policy** e i permessi tolti a `anon` e `authenticated`: la
legge e la scrive solo la service role, cioè il worker.

**`preferenze_utente`** — una riga per **account** (`auth_user_id`, non lo slot giocatore), per ora
con la sola colonna `email_notifiche` (default `true`). **Nessuna riga significa email attive**: la
riga nasce solo quando il giocatore tocca l'interruttore, con un upsert; ognuno legge e scrive solo
la propria, per RLS. Non sta su `giocatori_squadra`, che ha una riga per slot e il giocatore può
modificare solo in parte (DD-016).

**Funzioni RPC** — tutte `SECURITY DEFINER` e con `EXECUTE` solo alla service role:

| Funzione                                       | Cosa fa                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prendi_notifiche_email(p_max)`                | Prende fino a `p_max` righe `in_coda` scadute con `FOR UPDATE SKIP LOCKED`, le marca `in_invio` e restituisce indirizzo, oggetto, testo, evento, tipo. |
| `esito_notifica_email(id, esito, errore, ora)` | Registra `inviata`, `riprova`, `differita` o `fallita`; agisce solo su righe `in_invio`, così un esito in ritardo non ne sovrascrive uno già deciso.   |
| `email_inviate_ultime_24h()`                   | Conta le mail inviate nelle ultime 24 ore, per restare sotto il tetto.                                                                                 |

## Flusso

1. Una sorgente M17 inserisce (o aggiorna con `upsert`) una riga in `notifiche_utente`.
2. Il trigger `notifiche_utente_accoda_email` (`AFTER INSERT OR UPDATE OF creato_il`) la mette in
   `notifiche_email_coda`. L'`upsert` di turno palloni, sollecito presenze e sondaggio riscrive `creato_il`: è
   un rinvio voluto e rimette in coda anche la mail. Segnare come letta e l'`ON CONFLICT DO NOTHING`
   dei cron non toccano quella colonna e non accodano nulla.
3. Ogni `POLL_SECONDI` (30) il worker conta le mail delle ultime 24 ore, ne chiede al massimo quante
   ne restano sotto il tetto (al più `MAIL_LOTTO`) a `prendi_notifiche_email` e le invia una a una.
   Prima di prendere il lotto la funzione SQL fa due pulizie: riporta a `in_coda` le righe ferme
   `in_invio` da più di 10 minuti (worker morto a metà) e segna `saltata` quelle senza destinatario
   o con le email spente.
4. Ogni invio registra l'esito con `esito_notifica_email`.

La preferenza è valutata **al momento dell'invio**, non dell'accodamento: spegnere l'interruttore
ferma anche le mail già in coda.

## Affidabilità

Il worker classifica l'errore SMTP (`classificaErroreSmtp`):

| Tipo             | Esempi                                                     | Cosa succede                                                                              |
| ---------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `temporaneo`     | 4xx, timeout, connessione caduta                           | Riprova con backoff 1 · 5 · 30 · 120 min; al quinto invio fallito passa a `fallita`.      |
| `permanente`     | 5xx sul destinatario o sul messaggio, indirizzo non valido | `fallita` subito, senza altri tentativi.                                                  |
| `limite`         | `550 5.4.5 Daily user sending quota exceeded`              | Tutto il lotto torna in coda tra un'ora **senza consumare tentativi**; il ciclo si ferma. |
| `configurazione` | credenziali SMTP rifiutate (535, 534, 530, `EAUTH`)        | Come sopra ma tra 15 minuti, e il container **non** risulta più sano (vedi sotto).        |

Altre situazioni:

| Situazione                            | Comportamento                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worker fermo o host spento            | Le mail restano `in_coda` e partono alla ripartenza.                                                                                             |
| Crash tra l'invio e la registrazione  | Consegna _almeno una volta_: la riga resta `in_invio`, dopo 10 minuti torna in coda e la mail può arrivare due volte. Mai una perdita.           |
| Errore nella registrazione dell'esito | Non si tratta come errore SMTP (non parte un secondo invio): il ciclo si interrompe e la riga viene recuperata come sopra.                       |
| Tetto giornaliero raggiunto           | Finestra mobile di 24 ore su `inviata_il`, non «fino a mezzanotte»: il worker riprende da solo quando le mail più vecchie escono dalla finestra. |

`MAIL_LIMITE_GIORNO` vale 400 di default, sotto i circa 500 di Gmail, per lasciare margine ai
messaggi che l'account dedicato potesse mandare per altre vie.

**Salute del container.** `mailer.mjs` scrive un timestamp in `/tmp/mailer-ok` a ogni ciclo
riuscito; `healthcheck.mjs` (eseguito da Docker ogni minuto, con 30 secondi di tolleranza
all'avvio) segnala non sano il container se l'ultimo è più vecchio di 5 minuti. Un ciclo fermato
dalle credenziali SMTP rifiutate **non** aggiorna il file, così dopo qualche minuto `docker ps`
mostra `unhealthy` invece di far credere che tutto funzioni. Un ciclo fermato dal solo tetto
giornaliero è normale e resta sano.

## Contenuto delle mail

Sobrio, in testo semplice più una versione HTML minima leggibile da smartphone: oggetto = titolo
della notifica (su una riga sola, massimo 200 caratteri), corpo = corpo della notifica, un pulsante
«Apri CrAPP» verso `<APP_URL>/evento/<id>` quando la notifica riguarda un evento e verso la home
altrimenti. In fondo una riga che spiega come disattivare le email (Profilo → Opzioni → Email).
Nessuna immagine remota, nessun tracciamento delle aperture. Il testo scritto dall'admin viene
sempre escapato nell'HTML. Il `Message-ID` è derivato dall'id della notifica.

## Interfaccia

Un solo cambio: in Profilo → Opzioni, sotto «Notifiche», un interruttore **«Email»** (icona busta)
che scrive `preferenze_utente` per l'account, con lo stesso stile dell'interruttore «Notifiche»
(`useEmailNotifiche()` in `src/lib/preferenze-utente.ts`). Vale per tutti gli slot dell'account.
Nessuna schermata nuova.

## Privacy e sicurezza

- Le email personali dei giocatori non lasciano Supabase se non verso Gmail. Il worker legge solo
  l'indirizzo dei destinatari del lotto che sta spedendo, non l'intera rosa.
- La service role sta solo sull'host del worker, in un `.env` con permessi `600`; non passa da
  Vercel.
- La password per app si può revocare da Google senza toccare l'account.
- I log del worker riportano solo id notifica, tipo ed esito: **mai indirizzi né testi**, e degli
  errori SMTP solo i codici. Il log del container è limitato a 3 file da 5 MB.
- Il canale è **opt-out**: acceso di default, spegnibile dal giocatore. Un interruttore unico, come
  per la push (nessuna preferenza per tipo).

## Test

- **Unit** — [test/unit/mailer-core.test.ts](../../test/unit/mailer-core.test.ts): configurazione,
  classificazione degli errori SMTP, backoff, tetto giornaliero, composizione della mail (escape,
  oggetto, link, `Message-ID`), salute, e il ciclo di invio con dipendenze finte (esiti, fermata su
  tetto e credenziali, registrazione dell'esito che fallisce, log senza dati personali).
  [test/unit/preferenze-utente.test.ts](../../test/unit/preferenze-utente.test.ts): il default
  «acceso» senza riga.
- **Integrazione** — [test/integration/notifiche-email.test.ts](../../test/integration/notifiche-email.test.ts),
  sul database locale: trigger su ogni tipo, rinvio da `upsert`, cron che non accoda due volte,
  cascata alla cancellazione, `prendi_notifiche_email` (destinatario, una sola volta, chiamate
  concorrenti senza doppioni, slot senza account o senza email, righe orfane recuperate),
  preferenza (default, spenta, riaccesa, RLS sulle righe altrui), tutti gli esiti, e i permessi (un
  giocatore o un admin non vedono la coda né chiamano le funzioni del worker).
- Nessun test spedisce mail vere: il trasporto SMTP è sostituito da un finto nei test unitari.
  L'invio reale a Gmail è stato verificato a mano il 29/09/2026 (vedi Limiti noti).

## Limiti noti

- Il canale email dipende da un host acceso: non c'è alta disponibilità.
- Un 250 da Gmail vuol dire «accettata», non «letta»: non c'è conferma di lettura e non se ne vuole
  una.
- **Le prime mail possono finire in spam.** Verificato il 29/09/2026: la mail di prova, da un
  account nuovo e senza reputazione, è arrivata ma nella cartella spam. Non dipende dalla
  configurazione (Gmail accetta e consegna) ma dalla reputazione del mittente. Si migliora
  segnando i messaggi «Non è spam» e aggiungendo il mittente ai contatti; chi riceve la prima mail
  va avvisato. Se resta un problema serve un mittente con dominio proprio (vedi Evoluzioni).
- Un account collegato a più slot giocatore (`auth_user_id` ripetuto) riceve una mail per slot, dato
  che `notifiche_utente` ha una riga per `giocatore_id`.
- Cambiare l'indirizzo in `giocatori_squadra.email` cambia dove vanno le mail future; le righe già
  `inviata` non si toccano.
- `notifiche_email_coda` non ha pulizia automatica, come `notifiche_utente` (DD-030): le righe
  spariscono quando la notifica viene eliminata.
- L'interruttore «Email» compare solo con il codice che lo contiene: finché una versione più vecchia
  dell'app è in produzione, le mail partono ma non si possono spegnere dall'app.

## Evoluzioni possibili

- Un relay con dominio proprio (Brevo, Resend) se serve un mittente della squadra, se le mail
  restano in spam o si supera il tetto di Gmail.
- Riepilogo settimanale unico al posto di una mail per notifica.
- Preferenze per tipo di notifica, nella stessa `preferenze_utente`, insieme a quelle della push.
- Rendere il certificato in scadenza una notifica vera (sorgente nuova di `notifiche_utente`).
