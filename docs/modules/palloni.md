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

- `completaTurni()` (`palloni-core.ts`) propone, per ogni evento senza turno già salvato, il
  candidato con meno turni fatti, poi quello che non lo fa da più tempo, poi per ordine
  alfabetico — un algoritmo greedy, non un ordine fisso né solo per data.
- `useAssegnaTurno()` (`palloni.ts`) conferma una proposta o riassegna manualmente, con
  upsert su `evento_id`.
- Il conteggio "quante volte hai portato i palloni" mostrato nel profilo e nei badge è
  ricalcolato a runtime da `conteggioTurni()` su turni salvati **più proposte non ancora
  confermate** — non è uno storico in tabella dedicata.
- `TurnoPalloni.tsx` mostra/assegna il turno sulla card di un evento; `PromemoriaPalloni.tsx`
  è il banner in Home per il giocatore di turno.

---

## Route API pubblica `/api/public/promemoria-palloni`

Pensata per essere chiamata quotidianamente da uno scheduler esterno (pg_cron o simile,
secondo `docs/PORTABILITA.md`), non da nessun componente client. Calcola i destinatari del
giorno — chi deve **prendere** i palloni oggi e chi deve **riportarli** (l'incaricato
dell'evento precedente) — e invia loro una push "vuota" (`src/lib/webpush.server.ts`); il
testo effettivo viene calcolato al volo dal service worker interrogando
`/api/public/push-messaggio` (vedi [Notifiche](notifiche.md)).

---

## Limiti noti

- **Nessuna verifica di autenticazione/secret** sulla route `promemoria-palloni`: chiunque
  può invocarla via POST diretto, nonostante il piano originale prevedesse una protezione
  con secret.
- **Nessun cron nel repository**: lo scheduling effettivo (se esiste) è configurato fuori dal
  codice versionato — da verificare lato Supabase/hosting.
- Il conteggio dei turni include anche le proposte non confermate: badge e statistiche
  possono contare turni mai effettivamente convalidati da nessuno.
- La rotazione non considera le assenze dichiarate: può proporre il turno a chi ha risposto
  "assente" o "infortunato" per quell'evento.

---

## Evoluzioni possibili

- Aggiungere un secret/header di autorizzazione alla route pubblica.
- Versionare il cron (es. una migration con `cron.schedule`) invece di configurarlo solo
  lato dashboard.
- Escludere dalla rotazione chi ha già dichiarato assenza per l'evento.
