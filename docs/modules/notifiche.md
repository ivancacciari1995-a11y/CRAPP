# Modulo — Notifiche

**Stato:** implementato parzialmente — solo il canale "turno palloni" è realmente collegato
(vedi Limiti noti)
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

1. Il giocatore attiva "Notifiche turno palloni" in `/profilo` → richiesta permesso browser.
2. `GET /api/public/push-config` restituisce solo la chiave pubblica VAPID.
3. Registrazione del service worker `public/push-sw.js` e `pushManager.subscribe()`.
4. `POST /api/public/push-subscribe` registra endpoint e chiavi in `push_subscriptions`
   (upsert).

---

## Ruolo delle tre route pubbliche

- **`push-config`** — espone la sola chiave pubblica VAPID.
- **`push-subscribe`** — registra o rimuove l'iscrizione di un dispositivo.
- **`push-messaggio`** — non invia nulla: il service worker la interroga **al momento della
  ricezione** di una push (che arriva sempre "vuota", senza testo, per compatibilità) per
  sapere quale messaggio mostrare. Priorità: un messaggio in coda su `promemoria_push`
  (scritto da `sollecita-presenze`, vedi [Presenze](presenze.md)), altrimenti il messaggio
  calcolato al volo sul turno palloni (vedi [Palloni](palloni.md)).

L'invio effettivo (`src/lib/webpush.server.ts`, funzione `inviaPush`) firma un JWT VAPID
(ECDSA P-256) e fa una POST senza corpo all'endpoint push del browser; è riusato identico da
`sollecita-presenze.ts` e `promemoria-palloni.ts`.

---

## Notifiche smart

`calcolaNotifiche()` (`notifiche-smart.ts`) genera un evento solo quando "c'è qualcosa di
reale": badge appena sbloccato, "sei a un passo" da un traguardo, serie che raggiunge un
traguardo esatto, obiettivo di squadra tra il 90 e il 100%, badge social vinto. Ogni notifica
ha un id deterministico; quelli già mostrati sono salvati in `localStorage` per non
ripetersi — deduplica puramente locale al dispositivo, non sincronizzata.

---

## Limiti noti

- **Le 4 voci "Notifiche convocazioni", "Promemoria allenamenti", "Cambi orario", "Bacheca
  squadra" in `/profilo` sono placeholder statici**: checkbox non controllati
  (`defaultChecked`, nessun `onChange`), non collegati a nessuno stato, nessuna colonna DB
  per queste preferenze. L'unica preferenza realmente funzionante è "Notifiche turno
  palloni".
- `promemoria_push` è descritta altrove come "storico" ma nel codice è una coda che si
  autocancella alla lettura: non conserva nulla.
- Nessuna verifica di autenticazione su `push-messaggio` (chiunque conosca un endpoint push
  valido può leggerne il messaggio) né su `promemoria-palloni`.
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

- Collegare (o rimuovere) le 4 preferenze placeholder in `/profilo`.
- Aggiungere autenticazione alle route pubbliche coinvolte.
- Gestire esplicitamente il caso iOS (messaggio se l'app non è installata da Home).
