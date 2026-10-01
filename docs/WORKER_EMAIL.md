# Worker email: installazione e gestione

Come si mette in funzione, si controlla e si diagnostica il worker (`mailer/`) che invia le notifiche
per email e le push delle notifiche che nascono nel database: promemoria a 24 e 3 ore, turno palloni a 3 ore con revoca, solleciti presenze a 24, 12 e 6 ore (DD-040). Cosa fa il canale email sta in
[modules/notifiche-email.md](modules/notifiche-email.md), la push dei promemoria in
[modules/notifiche.md](modules/notifiche.md#push-dei-promemoria-m24); perché è fatto così in
[DD-036](decisions/DD-036.md)
e [DD-038](decisions/DD-038.md).
Il nome del documento resta quello delle email, che sono il canale principale.

**Stato in produzione:** migration `m22` applicata e worker delle email in funzione dal 29/09/2026,
su un Raspberry Pi con Docker. La push dei promemoria (`m24`) richiede le chiavi VAPID nel `.env` del
worker e la ricostruzione del container.

## Cosa serve

| Requisito              | Note                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Un host con Docker     | Sempre acceso e con la porta 587 in uscita libera. Nessuna porta in entrata, nessun IP pubblico.   |
| Account Gmail dedicato | Con verifica in due passaggi e una password per app (vedi sotto).                                  |
| Chiave del progetto    | La service role di Supabase, oggi nel `.env` della root del repo come `SUPABASE_SERVICE_ROLE_KEY`. |
| Indirizzo dell'app     | L'https pubblico a cui puntano i link nelle mail (`APP_URL`).                                      |
| Chiavi VAPID           | Le stesse `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` dell'app su Vercel: per la push dei promemoria. |

Il container usa l'immagine `oven/bun:1-alpine`, disponibile anche per ARM (Raspberry Pi). Si
costruisce dalla **radice del repository** (`docker-compose.yml` imposta `context: ..`), perché include
anche `src/lib/webpush.server.ts`, lo stesso modulo push dell'app: `docker compose up -d --build`
va comunque lanciato dentro `mailer/`. `mailer/Dockerfile.dockerignore` ammette nel contesto solo i
file usati, quindi nemmeno il `.env` finisce nell'immagine.

## Account Gmail e password per app

Il worker non usa la password dell'account: Google la rifiuterebbe. Serve una **password per app**.

1. Meglio un account **dedicato** e non quello personale: i messaggi partono da quell'indirizzo.
2. Attiva la **verifica in due passaggi** (myaccount.google.com → Sicurezza e accesso).
3. Apri direttamente **https://myaccount.google.com/apppasswords**: la voce non compare nei menu.
4. Dai un nome (per esempio «CrAPP mailer») e crea. Google mostra **una volta sola** una password di
   16 caratteri, a gruppi di quattro: copiala.
5. Nel `.env` va scritta **senza spazi** (16 caratteri attaccati): con gli spazi il file, letto come
   script di shell, si rompe. Non va mai incollata in chat né nel repository.

Si può revocare in ogni momento dalla stessa pagina, senza cambiare la password dell'account.

**Se la pagina dice «L'impostazione che stai cercando non è disponibile per il tuo account»:**

| Causa                                                                      | Cosa fare                                                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Verifica in due passaggi non attiva, o solo passkey come secondo passaggio | Attiva la verifica e aggiungi anche un'**app di autenticazione** (myaccount.google.com/signinoptions/twosv). |
| Protezione avanzata attiva                                                 | Disattivala da myaccount.google.com/advanced-protection.                                                     |
| Account Workspace con l'impostazione disattivata dall'amministratore       | Usa un account `@gmail.com` normale.                                                                         |

Se nulla funziona, l'alternativa è un altro account Gmail creato da zero, oppure un relay con un
dominio proprio (vedi DD-036).

## Installazione

1. **Migration in produzione.** `npx supabase db push` applica `m22`. È additiva: non modifica nulla
   di esistente e non invia mail finché il worker non parte. Dal momento in cui è applicata, le
   nuove notifiche si accodano: **avvia il worker subito**, nella stessa sessione. Le notifiche
   accodate e non ancora inviate partirebbero tutte insieme al primo avvio, anche se ormai vecchie
   (il 29/09/2026 sono partiti così due messaggi di prova dell'admin).

2. **Configura il worker.** In `mailer/`: `cp .env.example .env`, `chmod 600 .env` e compila:

   | Variabile                               | Default                        | Contenuto                                                            |
   | --------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
   | `SUPABASE_URL`                          | —                              | URL del progetto                                                     |
   | `SUPABASE_SERVICE_ROLE_KEY`             | —                              | chiave service role: salta la RLS, va trattata come una password     |
   | `SMTP_USER`, `SMTP_PASS`                | —                              | account Gmail dedicato e password per app (vanno insieme)            |
   | `APP_URL`                               | —                              | base dei link nelle mail, in https e senza slash finale              |
   | `MAIL_FROM`, `MAIL_FROM_NAME`           | `SMTP_USER`, `CrAPP`           | indirizzo e nome del mittente                                        |
   | `POLL_SECONDI`                          | 30                             | intervallo di polling                                                |
   | `MAIL_LIMITE_GIORNO`                    | 400                            | tetto delle ultime 24 ore, sotto i circa 500 di Gmail                |
   | `MAIL_LOTTO`                            | 10                             | mail prese a ogni giro                                               |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | `smtp.gmail.com`, 587, `false` | server SMTP (`true` solo per la porta 465)                           |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | —                              | chiavi per la push dei promemoria (vanno insieme; senza, solo email) |
   | `VAPID_SUBJECT`                         | `mailto:crapp@crapvolley.it`   | contatto nell'intestazione VAPID, come nell'app                      |

   Le chiavi VAPID devono essere **le stesse dell'app**: le iscrizioni push dei dispositivi sono
   legate alla chiave pubblica con cui sono nate, e con chiavi diverse i servizi push rifiutano l'invio
   (403). Se mancano il worker parte lo stesso e nel log compare «push dei promemoria: DISATTIVATA».

   `SMTP_USER` e `SMTP_PASS` vanno impostati insieme o nessuno dei due (senza credenziali solo per un
   server di prova locale). Un numero non valido o una variabile obbligatoria mancante fa uscire il
   worker con l'elenco degli errori. Il `.env` è ignorato da git.

   **`APP_URL`:** usa un indirizzo stabile, cioè il dominio di produzione o l'alias del branch
   (`…-git-<branch>-….vercel.app`). L'indirizzo di un singolo deploy (`…-<codice>-….vercel.app`)
   cambia a ogni pubblicazione e mostra il codice di quel momento. Se il progetto Vercel ha la
   Deployment Protection attiva, chi apre il link di un'anteprima vede la richiesta di accesso a
   Vercel.

3. **Avvia:** `docker compose up -d --build` dentro `mailer/`. Il container ha
   `restart: unless-stopped`, quindi riparte da solo dopo un riavvio dell'host.

4. **Verifica:** `docker compose logs` deve mostrare «SMTP raggiungibile e credenziali accettate» e
   «push dei promemoria: attiva»;
   dopo circa 30 secondi `docker ps` deve mostrare `healthy`. Poi manda un messaggio a un giocatore
   dalla dashboard admin e controlla che la riga in coda passi a `inviata` e la mail arrivi.

## Gestione

| Cosa                          | Comando (dentro `mailer/`)                                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vedere il log in diretta      | `docker compose logs -f`                                                                                                                                                     |
| Ultime righe del log          | `docker compose logs --tail 50`                                                                                                                                              |
| Stato e salute                | `docker ps` (colonna STATUS: `healthy` / `unhealthy`)                                                                                                                        |
| Dopo aver cambiato `.env`     | `docker compose up -d --force-recreate` (il `.env` è riletto a ogni avvio; non serve ricostruire l'immagine)                                                                 |
| Dopo aver cambiato il codice  | `git pull`, poi `docker compose up -d --build`                                                                                                                               |
| Fermarlo                      | `docker compose down` (le mail restano in coda e partono alla ripartenza)                                                                                                    |
| Spegnere subito l'accodamento | `DROP TRIGGER notifiche_utente_accoda_email ON public.notifiche_utente;` da SQL: le notifiche tornano come prima di M22. Per riattivarlo si ricrea il trigger come in `m22`. |

Il log riporta solo id notifica, tipo ed esito (`inviata`, `da riprovare tra N min`, `fallita`,
`ciclo fermato`), mai indirizzi né testi.

## Vedere cosa è partito

- **Posta inviata dell'account Gmail:** le mail complete, come le ha ricevute il destinatario. È il
  riscontro più sicuro.
- **SQL Editor di Supabase**, per stato e contenuto:

  ```sql
  select c.stato, c.inviata_il, c.tentativi, c.errore,
         g.nome, g.cognome, n.tipo, n.titolo, n.corpo
  from notifiche_email_coda c
  join notifiche_utente n on n.id = c.notifica_id
  join giocatori_squadra g on g.id = n.giocatore_id
  order by n.creato_il desc
  limit 50;
  ```

  Per un riepilogo: `select stato, count(*) from notifiche_email_coda group by stato;`. Lo stesso per le push dei
  promemoria, con la tabella `notifiche_push_coda` (colonne `stato`, `tentativi`, `errore`, `inviata_il`).
  Il testo del messaggio sta in `titolo` (oggetto) e `corpo`.

## Spostare il worker su un altro host

Il container non conserva nulla: la coda, gli esiti e il conteggio delle ultime 24 ore stanno in
Supabase. Cambiare host non fa perdere né duplicare mail.

1. **Sul nuovo host** servono Docker con il plugin Compose e la porta 587 in uscita libera.
   L'immagine `oven/bun` esiste sia per ARM sia per x86, quindi l'architettura può cambiare.
2. **Porta il codice:** `git clone` del repository (o `git pull` se c'è già) e usa la cartella
   `mailer/`. Se la copi a mano, salta `node_modules`: l'immagine si costruisce da sola.
3. **Copia il `.env`** con un canale sicuro (per esempio `scp`), poi `chmod 600 .env`. Non passa da
   chat né da git: contiene la service role e la password per app.
4. **Spegni il vecchio:** `docker compose down` sul vecchio host.
5. **Avvia il nuovo:** `docker compose up -d --build` dentro `mailer/`. Devono comparire «SMTP
   raggiungibile e credenziali accettate» nel log e, dopo circa 30 secondi, `healthy` in `docker ps`.

Non serve riconfigurare nulla: `APP_URL`, chiave e password restano quelle del `.env`. Se per un
po' girano entrambi i worker non ci sono mail doppie, perché `prendi_notifiche_email` usa
`FOR UPDATE SKIP LOCKED`; conviene comunque spegnere il vecchio subito, per non confondere i log.
Se il passaggio richiede tempo, le notifiche restano in coda e partono tutte insieme all'avvio del
nuovo worker.

Al primo accesso da un IP nuovo Gmail può chiedere una conferma di sicurezza sull'account. La
password per app di solito continua a funzionare; se nel log del nuovo host compare `EAUTH`,
controlla la posta dell'account mittente e conferma l'accesso.

## Diagnosi

| Sintomo                                                          | Causa probabile                                                             | Cosa fare                                                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Il log dice `SMTP non verificato (EAUTH)`                        | Password per app sbagliata, con spazi, o revocata                           | Controlla la lunghezza (`awk -F= '/^SMTP_PASS=/{print length($2)}' .env` deve dare 16), rigenera se serve. |
| Container `unhealthy`                                            | Credenziali rifiutate, oppure Supabase non raggiungibile                    | `docker compose logs --tail 50`.                                                                           |
| Righe che restano `in_coda`                                      | Worker fermo, oppure tetto giornaliero raggiunto                            | `docker ps`; il tetto si libera da solo, è una finestra mobile di 24 ore.                                  |
| Righe `saltata`                                                  | Slot senza account collegato, senza email, o email spente                   | Normale: nessun destinatario utile. Verifica `giocatori_squadra.email` e `auth_user_id`.                   |
| Righe `fallita`                                                  | Errore permanente del server di posta                                       | Leggi `errore`: `550` = indirizzo inesistente o rifiutato.                                                 |
| La mail arriva ma in spam                                        | Mittente nuovo, nessuna reputazione                                         | «Non è spam» e aggiungere il mittente ai contatti; vedi i limiti noti del modulo.                          |
| Il pulsante «Apri CrAPP» porta a una pagina vecchia o di accesso | `APP_URL` è l'indirizzo di un singolo deploy o di un'anteprima protetta     | Usa un alias stabile e ricrea il container.                                                                |
| L'interruttore «Email» non compare in Profilo                    | L'app pubblicata non contiene ancora il codice del modulo                   | Pubblica una versione che lo include.                                                                      |
| Il log dice «push dei promemoria: DISATTIVATA»                   | Mancano `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` nel `.env`                 | Aggiungile (le stesse dell'app) e ricrea il container.                                                     |
| Push dei promemoria in `fallita` con errore `403`                | Chiavi VAPID diverse da quelle dell'app, o payload rifiutato                | Controlla le chiavi; la query sotto mostra l'errore.                                                       |
| Push dei promemoria `saltata`                                    | Il giocatore non ha dispositivi iscritti, o il promemoria aveva oltre 3 ore | Normale se nessuno ha attivato le notifiche o il worker è stato fermo a lungo.                             |

## Prova in locale, senza toccare la produzione

`npx supabase start` avvia lo stack locale (la migration `m22` si applica con `npx supabase db reset`),
con Mailpit su http://127.0.0.1:54324: le mail non escono dalla macchina. Il worker si può
lanciare senza Docker con `cd mailer && set -a && . ./.env && set +a && bun mailer.mjs`.

1. **`mailer/.env` per la prova.** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` si leggono con
   `npx supabase status -o env` (`API_URL`, `SERVICE_ROLE_KEY`). Per provare **con Gmail vero** si
   usano le credenziali reali e il worker gira anche senza Docker; il database resta quello locale.
   Per provare **con Mailpit** bisogna far girare il worker in un container (vedi in fondo): la
   porta SMTP di Mailpit non è esposta sull'host, solo la sua interfaccia web. In quel caso si
   omettono `SMTP_USER` e `SMTP_PASS` e si imposta `MAIL_FROM`. `POLL_SECONDI=5` accorcia l'attesa.
2. **Un giocatore con un account collegato.** Le mail vanno solo agli slot con `auth_user_id` e con
   `email`. In locale:

   ```bash
   . <(npx supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')
   UID_=$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
     -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
     -H 'content-type: application/json' \
     -d "{\"email\":\"prova-$(date +%s)@example.test\",\"password\":\"prova-12345\",\"email_confirm\":true}" \
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
   docker exec supabase_db_<project_id> psql -U postgres -c \
     "set session_replication_role = replica; update giocatori_squadra set auth_user_id='$UID_' where id='<slot>';"
   ```

   `session_replication_role = replica` serve perché il trigger di `giocatori_squadra` rifiuta la
   service key. L'email dello slot deve essere quella che si vuole ricevere; è **unica** nella
   tabella (`giocatori_squadra_email_unica`): se l'indirizzo compare già in un altro slot del seed,
   si usa quello slot invece di impostarlo su un secondo.

3. **Una notifica di prova:**

   ```bash
   docker exec supabase_db_<project_id> psql -U postgres -c \
     "insert into notifiche_utente (giocatore_id, tipo, titolo, corpo) values ('<slot>','admin','Prova CrAPP','Messaggio di prova');"
   ```

   Entro un ciclo di polling il log mostra `inviata …` e la mail compare in Mailpit (o nella casella).

4. **Fine prova:** `npx supabase db reset` riporta il database locale pulito.

Per provare anche l'immagine Docker, il container si collega alla rete di Supabase
(`--network supabase_network_<project_id>`) e usa `http://supabase_kong_<project_id>:8000` come
`SUPABASE_URL` e `supabase_inbucket_<project_id>` sulla porta 1025 come SMTP.

Per provare la **push dei promemoria** senza un telefono: si genera una coppia di chiavi VAPID di
prova, si avvia un piccolo server HTTP locale che finge di essere il servizio push (risponde 201 su un
percorso e 410 su un altro), si inseriscono in `push_subscriptions` due iscrizioni con chiavi ECDH
valide che puntano a quel server e si crea un promemoria in `notifiche_utente`. Il worker lo cifra, lo
spedisce con `Authorization: vapid …`, `Content-Encoding: aes128gcm`, `Urgency: high` e `TTL`, segna
la riga `inviata` ed elimina l'iscrizione che ha risposto 410. Il 29/09/2026 la prova è stata fatta
così.

L'app in sviluppo (`npm run dev`) richiede un Node più recente del 18: su un host con Node 18 Vite
non parte, e con lui i test di integrazione che avviano il server. Si può usare bun al posto di Node:
`bun --bun x vite dev --port 8080` (con `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` dello stack locale) e poi `BASE_URL=http://localhost:8080` davanti ai
test. I test del database e del worker non ne hanno bisogno.

## Sicurezza

- Il `.env` contiene la service role e la password per app: permessi `600`, mai in git, mai in chat.
- La service role non passa da Vercel: sta solo sull'host del worker. Anche la chiave VAPID
  **privata** sta sull'host, oltre che su Vercel: stessa attenzione, mai in git né in chat.
- Il log delle push riporta solo id notifica e numeri: mai gli endpoint, che identificano il
  dispositivo del giocatore.
- Se la password per app o la service role sono state esposte, si revocano/ruotano subito (Google e
  dashboard Supabase) e si aggiorna il `.env` con `--force-recreate`.
