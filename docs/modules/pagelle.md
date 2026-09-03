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
  tutti i voti della stagione; `pagellePartita()` la calcola per singola partita;
  `mediaSquadra()` su tutti i voti di tutti — mostrata come StatTile in `squadra.tsx`.
- `useRosa()` inietta la media stagionale nel campo `mediaVoto` di ogni giocatore.

---

## Regole rispettate

- Anti auto-voto imposto anche a livello database (constraint, non solo filtro UI).
- L'admin può marcare un evento come `pagelleChiuse` (`eventi.ts`), che nasconde i bottoni di
  voto in UI.

---

## Limiti noti

- **`pagelleChiuse` è solo un flag UI**: nessuna policy RLS lo controlla, quindi un voto
  "fuori tempo" resta tecnicamente possibile bypassando l'interfaccia.
- **L'anonimato è solo applicativo, non tecnico**: la riga salvata contiene sia `votante_id`
  sia `votato_id`, leggibili da chiunque sia autenticato (policy SELECT aperta). La UI non
  mostra mai il votante, ma il dato non è né aggregato né mascherato lato server.
- Nessun controllo a livello database che il votante sia realmente un convocato della
  partita: solo filtro applicativo.
- La media non richiede un numero minimo di voti: con un solo voto ricevuto, la media
  coincide con quel voto.

---

## Evoluzioni possibili

- Una RPC o vista che nasconda `votante_id` per un anonimato garantito anche lato dati.
- Far rispettare `pagelleChiuse` anche via RLS.
