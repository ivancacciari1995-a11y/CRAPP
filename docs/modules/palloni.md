# Modulo — Palloni

**Stato:** implementato
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
  ricalcolato a runtime da `conteggioTurni()` sui **soli turni confermati** (`turniSalvati`
  in `rosa.ts`) — non è uno storico in tabella dedicata, ma non include le proposte
  automatiche di `completaTurni()` (quelle restano solo per la UI di rotazione,
  `TurnoPalloni.tsx`/`PromemoriaPalloni.tsx`). Conta solo gli eventi già passati (`e.data <
oggi`, stesso criterio delle presenze): un turno assegnato in anticipo per un allenamento
  futuro non è ancora "portato", quindi non sale finché quel giorno non arriva.
- `TurnoPalloni.tsx` mostra/assegna il turno sulla card di un evento; `PromemoriaPalloni.tsx`
  è il banner in Home per il giocatore di turno.

---

## Route API pubblica `/api/public/promemoria-palloni`

La fa partire un **amministratore** dal pulsante «Avvisa chi è di turno» dentro il riquadro
palloni dell'evento (`TurnoPalloni.tsx`), riservato agli admin (DD-025). Riceve l'`eventoId`,
e `avvisiPalloniEvento()` calcola i due destinatari di _quell'evento_: chi deve **prendere** i
palloni e chi deve **riportarli** (l'incaricato dell'evento precedente), con un testo diverso
per ciascuno.

Titolo e testo viaggiano cifrati dentro la push, quindi il service worker li mostra senza
nessuna chiamata di rete. Stesso meccanismo di `apri-sondaggio` (vedi
[Notifiche](notifiche.md)).

---

## Limiti noti

- **L'invio è manuale**: nessun cron manda il promemoria da solo, se l'admin non preme il
  pulsante non parte niente (DD-025). `destinatariPromemoriaPalloni()` — la versione "chi è di
  turno oggi" — resta in `palloni-core.ts` ma non la chiama più nessuno.
- La rotazione non considera le assenze dichiarate: può proporre il turno a chi ha risposto
  "assente" o "infortunato" per quell'evento.
- **`conteggioTurni()` non filtra per tipo evento** (a differenza di `eventiPalloni()`, che
  scarta i compleanni): guarda solo `e.data < oggi`. Un turno registrato per errore su un
  evento fuori dal dominio "richiede i palloni" conterebbe comunque per il badge Sherpa dei
  palloni (`badge.md` § Problemi noti). Rischio basso — l'UI non offre questa combinazione — ma
  il comportamento attuale è pinnato da un test dedicato in `palloni-core.test.ts`.

---

## Evoluzioni possibili

- Versionare il cron (es. una migration con `cron.schedule`) invece di configurarlo solo
  lato dashboard.
- Escludere dalla rotazione chi ha già dichiarato assenza per l'evento.
