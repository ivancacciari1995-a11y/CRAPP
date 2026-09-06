# Modulo — Notifiche

**Stato:** implementato — un unico opt-in dispositivo abilita tutto il canale push
**File principali:** `src/lib/notifiche-smart.ts`, `src/lib/push-client.ts`,
`src/lib/webpush.server.ts`, `src/routes/api/public/push-config.ts`,
`src/routes/api/public/push-subscribe.ts`, `src/routes/api/public/push-prova.ts`,
`public/push-sw.js`

---

## Obiettivo

Tenere aggiornati i giocatori senza che debbano aprire l'app, con due meccanismi
indipendenti:

- **Push VAPID** — arrivano anche ad app chiusa (turno palloni, sollecito presenze).
- **Notifiche smart** — notifiche locali mostrate solo ad app aperta, generate da badge,
  serie e obiettivi appena raggiunti; non è un canale push separato.

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
- **`push-prova`** — manda una push al dispositivo che la chiede e riporta stato e corpo
  della risposta del servizio push, più se l'endpoint risulta in `push_subscriptions`. Serve
  a rendere osservabile un "non arriva": senza, ogni prova richiede un admin, un evento nello
  stato giusto e una seconda persona. Il pulsante sta in Profilo → Opzioni, sotto
  l'interruttore, e compare solo a notifiche attive. L'invio parte dopo 10 secondi
  (`ritardoMs`, max 25): premendo il pulsante l'app è per forza aperta, e senza attesa si
  proverebbe solo il caso che già funziona.
- **`apri-sondaggio`** — premuto da un admin dalla pagina partita: manda a **tutti** i
  dispositivi iscritti l'avviso di apertura del sondaggio pre-partita (vedi
  [Scout Live](scout-live.md)).

L'invio effettivo (`src/lib/webpush.server.ts`, funzione `inviaPush`) firma un JWT VAPID
(ECDSA P-256), cifra `{title, body}` per il dispositivo destinatario e fa una POST
all'endpoint push del browser; è riusato identico da `sollecita-presenze.ts`,
`promemoria-palloni.ts` e `apri-sondaggio.ts`.

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

| Route                                                        | Controllo                                                                          | Chi la chiama                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apri-sondaggio`, `sollecita-presenze`, `promemoria-palloni` | `richiediAdmin` — token della sessione Supabase, poi ruolo `admin` in `user_roles` | l'app, da un pulsante riservato agli admin                      |
| `csi`, `push-config`, `push-subscribe`, `push-prova`         | nessuno                                                                            | il browser prima del login, che una sessione non ce l'ha ancora |

---

## Notifiche smart

`calcolaNotifiche()` (`notifiche-smart.ts`) genera un evento solo quando "c'è qualcosa di
reale": badge appena sbloccato, "sei a un passo" da un traguardo, serie che raggiunge un
traguardo esatto, obiettivo di squadra tra il 90 e il 100%, badge social vinto. Ogni notifica
ha un id deterministico; quelli già mostrati sono salvati in `localStorage` per non
ripetersi — deduplica puramente locale al dispositivo, non sincronizzata.

---

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
