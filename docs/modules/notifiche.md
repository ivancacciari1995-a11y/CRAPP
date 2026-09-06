# Modulo — Notifiche

**Stato:** implementato — un unico opt-in dispositivo abilita tutto il canale push
**File principali:** `src/lib/notifiche-smart.ts`, `src/lib/push-client.ts`,
`src/lib/webpush.server.ts`, `src/routes/api/public/push-config.ts`,
`src/routes/api/public/push-messaggio.ts`, `src/routes/api/public/push-subscribe.ts`,
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

`push_subscriptions` (un dispositivo per riga, chiave `endpoint`), `promemoria_push` (coda
"consuma e cancella" del testo da mostrare — nonostante il nome, **non** è uno storico
persistente: la riga viene eliminata non appena letta dal service worker).

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

---

## Ruolo delle tre route pubbliche

- **`push-config`** — espone la sola chiave pubblica VAPID.
- **`push-subscribe`** — registra o rimuove l'iscrizione di un dispositivo.
- **`apri-sondaggio`** — premuto da un admin dalla pagina partita: mette in coda su
  `promemoria_push` l'avviso di apertura del sondaggio pre-partita per **tutti** i dispositivi
  iscritti e manda la push (vedi [Scout Live](scout-live.md)).
- **`push-messaggio`** — non invia nulla: il service worker la interroga **al momento della
  ricezione** di una push (che arriva sempre "vuota", senza testo, per compatibilità) per
  sapere quale messaggio mostrare. Priorità: un messaggio in coda su `promemoria_push`
  (scritto da `sollecita-presenze`, vedi [Presenze](presenze.md)), altrimenti il messaggio
  calcolato al volo sul turno palloni (vedi [Palloni](palloni.md)).

L'invio effettivo (`src/lib/webpush.server.ts`, funzione `inviaPush`) firma un JWT VAPID
(ECDSA P-256) e fa una POST senza corpo all'endpoint push del browser; è riusato identico da
`sollecita-presenze.ts` e `promemoria-palloni.ts`.

### Chi può farle partire (DD-024)

Queste route usano la service role e saltano la RLS, quindi il permesso deve stare nella
route. `src/lib/auth-route.server.ts` fornisce i due controlli:

| Route                                                    | Controllo                                                                              | Chi la chiama                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `apri-sondaggio`, `sollecita-presenze`                   | `richiediAdmin` — token della sessione Supabase, poi ruolo `admin` in `user_roles`     | l'app, dal pulsante riservato agli admin                                        |
| `promemoria-palloni`                                     | `richiediSegreto` — intestazione `x-cron-segreto` uguale alla variabile `CRON_SEGRETO` | un cron, senza sessione                                                         |
| `csi`, `push-config`, `push-subscribe`, `push-messaggio` | nessuno                                                                                | il browser prima del login e il service worker, che una sessione non ce l'hanno |

**`CRON_SEGRETO` va configurata negli ambienti**: se manca, `promemoria-palloni` risponde
503 e il promemoria non parte. È voluto — una porta che si riapre da sola quando manca una
configurazione non se ne accorge nessuno.

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
- `promemoria_push` è descritta altrove come "storico" ma nel codice è una coda che si
  autocancella alla lettura: non conserva nulla.
- Nessuna verifica di autenticazione su `push-messaggio`: chiunque conosca un endpoint push
  valido può leggerne il messaggio. Non è chiudibile con un segreto, perché a chiamarla è il
  service worker, dove qualsiasi segreto sarebbe pubblico; di fatto la protegge il dover
  conoscere l'endpoint, che è un URL segreto per dispositivo. `promemoria-palloni` invece è
  chiusa da DD-024.
- Compatibilità iOS/Safari non gestita esplicitamente nel codice (nessun branch dedicato):
  serve l'installazione da schermata Home per funzionare, ma l'app non lo segnala
  esplicitamente.
- Le notifiche smart dipendono da un service worker già registrato: se il giocatore non ha
  mai attivato le push, `notificaSistema()` non ha un `reg` a cui appoggiarsi e la notifica
  locale non viene mai mostrata, anche con permesso concesso.
- Payload push sempre vuoto: ogni notifica richiede una fetch aggiuntiva (`push-messaggio`)
  per ottenere il testo, quindi serve rete disponibile anche solo per mostrare il messaggio.

---

## Evoluzioni possibili

- Preferenze per canale (palloni, solleciti, smart), se servono davvero alla squadra.
- Aggiungere autenticazione alle route pubbliche coinvolte.
- Gestire esplicitamente il caso iOS (messaggio se l'app non è installata da Home).
