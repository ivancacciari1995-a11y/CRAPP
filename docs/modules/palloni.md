# Modulo — Palloni

**Stato:** implementato (v1.0)
**File principali:** `src/lib/palloni.ts`, `src/lib/palloni-core.ts`,
`src/components/crapp/TurnoPalloni.tsx`, `src/components/crapp/PromemoriaPalloni.tsx`,
`src/routes/api/public/promemoria-palloni.ts`

---

## Obiettivo

Gestire un turno a rotazione condiviso per chi porta e riporta i palloni ad allenamenti e
partite, con proposta automatica, possibilità di modifica manuale e promemoria push il
giorno stesso.

---

## Dati

Tabella `turni_palloni` (`evento_id`, `giocatore_id`, `aggiornato_da`, `aggiornato_il`) —
contiene solo i turni **confermati manualmente**; le proposte automatiche non salvate non vi
compaiono.

---

## Implementazione

- `completaTurni()` (`palloni-core.ts`) propone, per ogni **partita** o evento extra senza
  turno già salvato, il candidato con meno turni fatti, poi quello che non lo fa da più
  tempo, poi per ordine alfabetico — un algoritmo greedy, non un ordine fisso né solo per
  data. Gli **allenamenti** non ricevono proposta automatica: restano «da assegnare» finché
  qualcuno non sceglie un incaricato in `TurnoPalloni` (scelta della squadra).
- `useAssegnaTurno()` (`palloni.ts`) conferma una proposta o riassegna manualmente, con
  upsert su `evento_id`.
- Il conteggio "quante volte hai portato i palloni" mostrato nel profilo e nei badge è
  ricalcolato a runtime da `conteggioTurni()` su turni salvati **più proposte non ancora
  confermate** (partite/eventi) — non è uno storico in tabella dedicata.
- `TurnoPalloni.tsx` mostra/assegna il turno sulla card di un evento; `PromemoriaPalloni.tsx`
  è il banner in Home per il giocatore di turno.

---

## Route API pubblica `/api/public/promemoria-palloni`

La fa partire un **amministratore** dal pulsante «Avvisa chi è di turno» dentro il riquadro
palloni dell'evento (`TurnoPalloni.tsx`), riservato agli admin (DD-025). Riceve l'`eventoId`,
e `avvisiPalloniEvento()` calcola i due destinatari di _quell'evento_: chi deve **prendere** i
palloni e chi deve **riportarli** (l'incaricato dell'evento precedente), con un testo diverso
per ciascuno.

Il testo va messo in coda su `promemoria_push` prima di inviare la push, perché la push parte
"vuota" e il service worker chiede a `/api/public/push-messaggio` cosa mostrare — e quella
route da sola sa raccontare solo la giornata corrente, quindi un avviso mandato con giorni di
anticipo arriverebbe con il testo generico. Stesso meccanismo di `apri-sondaggio` (vedi
[Notifiche](notifiche.md)).

---

## Limiti noti

- **L'invio è manuale**: nessun cron manda il promemoria da solo, se l'admin non preme il
  pulsante non parte niente (DD-025). `destinatariPromemoriaPalloni()` — la versione "chi è di
  turno oggi" — resta in `palloni-core.ts` perché la usa `push-messaggio` per il testo
  calcolato al volo, ma nessuno scheduler la interroga.
- Il conteggio dei turni include anche le proposte non confermate: badge e statistiche
  possono contare turni mai effettivamente convalidati da nessuno.
- La rotazione non considera le assenze dichiarate: può proporre il turno a chi ha risposto
  "assente" o "infortunato" per quell'evento.

---

## Evoluzioni possibili

- Versionare il cron (es. una migration con `cron.schedule`) invece di configurarlo solo
  lato dashboard.
- Escludere dalla rotazione chi ha già dichiarato assenza per l'evento.
