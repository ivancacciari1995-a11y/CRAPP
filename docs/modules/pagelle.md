# Modulo — Pagelle

**Stato:** implementato (v1.0)
**File principali:** `src/lib/pagelle.ts`, `src/components/crapp/Pagelle.tsx`

---

## Obiettivo

Voto tra compagni (1-10) a fine partita per ciascun convocato, usato per calcolare una media
personale mostrata nel profilo e una media di squadra.

---

## Dati

Tabella `pagelle_voti`, con vincoli imposti a livello database: `CHECK voto BETWEEN 1 AND 10`,
`CHECK votante_id <> votato_id` (anti auto-voto imposto anche dal database, non solo dalla
UI), `UNIQUE (match_id, votante_id, votato_id)`.

---

## Implementazione

- Il pannello `Pagelle` compare in `partita.$id.tsx` solo se esiste un risultato per la
  partita (scout salvato o dato CSI).
- Ogni convocato può votare tutti gli altri convocati, mai se stesso — escluso sia in UI sia
  dal vincolo DB.
- `useVotaPagella()` fa un upsert su `(match_id, votante_id, votato_id)`: si può votare più
  volte, l'ultimo voto sovrascrive il precedente.
- `mediePagelle()` calcola la media aritmetica (arrotondata a un decimale) per giocatore su
  **tutti i voti mai ricevuti** — l'app non ha un concetto di stagione/reset, quindi non è
  "la media di questa stagione" ma lo storico completo; `pagellePartita()` la calcola per
  singola partita; `mediaSquadra()` su tutti i voti di tutti — mostrata come StatTile in
  `squadra.tsx`.
- `useRosa()` inietta questa media storica nel campo `mediaVoto` di ogni giocatore, insieme al
  numero di voti ricevuti (`votiPagella`) — usato dal badge Pagellone (vedi
  [badge.md](badge.md)) per richiedere un minimo di voti prima che la media conti.

---

## Regole rispettate

- Anti auto-voto imposto anche a livello database (constraint, non solo filtro UI).
- L'admin può marcare un evento come `pagelleChiuse` (`eventi.ts`), che nasconde i bottoni di
  voto in UI **e**, da M13, rifiuta anche a database un voto scritto dopo la chiusura (RLS
  `evento_permette_voto()`, `pagelle_voti`).
- Da M13 anche il votante e il votato devono essere convocati all'evento: verificato a
  database, non solo in UI (stessa RLS di sopra).

---

## Limiti noti

- **L'anonimato è solo applicativo, non tecnico**: la riga salvata contiene sia `votante_id`
  sia `votato_id`, leggibili da chiunque sia autenticato (policy SELECT aperta). La UI non
  mostra mai il votante, ma il dato non è né aggregato né mascherato lato server.
- La media mostrata nel profilo non richiede un numero minimo di voti: con un solo voto
  ricevuto, la media coincide con quel voto. Il badge Pagellone (`badge.md`) applica invece un
  minimo di voti prima di considerarla — la StatTile del profilo no.
- Le due regole di M13 (convocazione, `pagelle_chiuse`) valgono solo per la policy "Ognuno
  gestisce i propri voti pagella": un amministratore può ancora correggere un voto fuori
  convocazione o dopo la chiusura, di proposito (deve poter sistemare un errore).

---

## Evoluzioni possibili

- Una RPC o vista che nasconda `votante_id` per un anonimato garantito anche lato dati.
