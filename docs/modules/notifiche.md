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

- **Push VAPID** — arrivano anche ad app chiusa (turno palloni, sollecito presenze).
- **Notifiche smart** — notifiche locali mostrate solo ad app aperta, generate da badge,
  serie e obiettivi appena raggiunti; non è un canale push separato.

Gli avvisi fissi in Home (turno palloni, certificati in scadenza) non passano da nessuno dei
due: sono card calcolate dai dati, che spariscono da sole quando la condizione finisce. In
particolare il certificato in scadenza **non** genera push né voci nel centro notifiche
(DD-035, specifica in [profilo-giocatore.md](profilo-giocatore.md#avviso-certificati)).

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

| Route                                                                                                       | Controllo                                                                          | Chi la chiama                                                   |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apri-sondaggio`, `sollecita-presenze`, `promemoria-palloni`, `notifiche-attive`, `notifica-personalizzata` | `richiediAdmin` — token della sessione Supabase, poi ruolo `admin` in `user_roles` | l'app, da un pulsante o una vista riservati agli admin          |
| `csi`, `push-config`, `push-subscribe`                                                                      | nessuno                                                                            | il browser prima del login, che una sessione non ce l'ha ancora |

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

Quattro sorgenti scrivono in `notifiche_utente`, mai il client:

1. **Messaggio admin** — `notifica-personalizzata.ts` inserisce una riga per destinatario
   in parallelo all'invio push esistente (a tutta la rosa attiva se `giocatoreId` è omesso).
2. **Promemoria evento** — due job `pg_cron` (ogni ora per la finestra delle 24h, ogni 15
   minuti per quella delle 3h) generano una notifica per evento imminente, per i convocati
   (o tutta la rosa attiva se l'evento non ne specifica), deduplicata da un vincolo
   `UNIQUE (giocatore_id, evento_id, tipo)` così un cron che gira più volte non manda
   doppioni. Volutamente non c'è una notifica sulla sola creazione dell'evento: conta
   l'avvicinarsi della data, non il momento in cui è stato messo in calendario.
3. **Turno palloni** — `promemoria-palloni.ts` (bottone riservato agli admin sulla pagina
   evento, vedi [Turno palloni](palloni.md)) inserisce una riga per ciascun avviso calcolato
   da `avvisiPalloniEvento()`, in parallelo alla push.
4. **Sollecito presenze** — `sollecita-presenze.ts` (stesso innesco manuale) inserisce una
   riga per ciascun giocatore che non ha ancora risposto, in parallelo alla push.

Turno palloni e sollecito presenze usano un `upsert` su `(giocatore_id, evento_id, tipo)`
invece di un semplice insert: se l'admin preme di nuovo il pulsante per lo stesso evento, la
notifica esistente viene aggiornata (testo e `creato_il` freschi, `letta` riportata a false)
invece di duplicarsi o fallire per il vincolo `UNIQUE`.

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
