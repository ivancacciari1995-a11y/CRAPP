# Modulo — Squadra

**Stato:** implementato
**File principali:** `src/lib/giocatori-squadra.ts`, `src/lib/giocatori-squadra.server.ts`,
`src/lib/rosa.ts`, `src/routes/squadra.tsx`, `src/routes/admin.tsx` (sezione rosa)
**Test:** `test/unit/giocatori-squadra.test.ts`, `test/unit/rosa.test.ts`

---

## Obiettivo

Tenere l'anagrafica della rosa (nome, numero di maglia, ruolo, chi è collegato a quale
account) in un unico posto — `giocatori_squadra` — e farla usare a tutte le schermate che
hanno bisogno di sapere "chi c'è in squadra", invece di ciascuna avere la propria copia.
Prima di [DD-015](../DESIGN_DECISIONS.md#dd-015--rosa-anagrafica-da-codice-hardcoded-a-database)
la lista viveva hardcoded in `src/lib/crapp-data.ts`: aggiungere o disattivare un
giocatore dalla dashboard admin non aveva alcun effetto sul resto dell'app.

---

## Due letture diverse, per non pagare due volte lo stesso costo

- **`useAnagraficaRosa()`** (`rosa.ts`) — solo id, nome, ruolo, numero, data di nascita dei
  giocatori `attivo`. Serve dove basta sapere chi c'è, es. i compleanni nel Calendario o le
  liste presenze: non monta gli hook di MVP/pagelle/palloni/infortuni.
- **`useRosa()`** (`rosa.ts`) — la stessa anagrafica arricchita con tutte le statistiche
  personali calcolate a runtime: presenze, partite giocate, serie (presenze, allenamenti,
  partite, conferme, palloni), MVP vinti, media voto pagelle, palloni, cacche, infortuni,
  ritardi. Non fa query aggiuntive: combina in un `useMemo` le cache già in memoria di
  `mvp-voti.ts`, `pagelle.ts`, `cacche.ts`, `palloni.ts`, `infortuni.ts`, `presenze.ts`,
  `eventi.ts` — la spec di ciascuna di queste statistiche sta nel modulo relativo
  (`mvp.md`, `pagelle.md`, `palloni.md`, `infortuni.md`, `presenze.md`). `useRosa()` è anche
  la base di `useIo()` (il giocatore sul dispositivo corrente) e `useObiettivi()`
  (`obiettivi-squadra.md`).

Entrambe filtrano solo i giocatori `attivo`: chi ha lasciato la squadra resta nel database
(presenze, voti, pagelle e badge della stagione restano agganciati al suo id) ma sparisce
dagli elenchi correnti.

## Gestione dati squadra (solo amministratore)

Da `/admin` un amministratore può ([DD-017](../DESIGN_DECISIONS.md#dd-017--lamministratore-può-compilare-i-dati-al-posto-del-giocatore)):

| Azione                | Hook                    | Effetto                                                        |
| ---------------------- | ------------------------ | ------------------------------------------------------------- |
| Modificare dati squadra | `useSalvaDatiSquadra()` | Nome, cognome, numero, ruolo, email (usata per il collegamento automatico, non il dato personale del profilo) |
| Aggiungere un giocatore | `useAggiungiGiocatore()` | Nuova riga con id progressivo `g<N>` (`prossimoIdGiocatore()`), non generato dal database |
| Attivare/disattivare    | `useImpostaAttivo()`     | Non elimina la riga: la storia della stagione resta intatta    |
| Scollegare un account   | `useScollegaAccount()`   | Libera uno slot collegato per errore ([DD-016](../DESIGN_DECISIONS.md#dd-016--schema-dati-profilo-giocatore-f0) regola 2); il giocatore si ricollega al primo accesso successivo |
| Registrare il tesseramento CSI | `useSalvaTesseramento()` | Numero e data tessera, note solo dopo il tesseramento effettivo (vedi `profilo-giocatore.md`) |

Il collegamento giocatore↔account, invece, non è manuale: avviene in automatico al primo
accesso con Google, per corrispondenza email
([DD-018](../DESIGN_DECISIONS.md#dd-018--collegamento-automatico-giocatoreaccount-per-email)).
`useCollegaGiocatore()` esiste per completare quel flusso, non per una scelta libera
dell'admin.

Le regole di validazione (`validaDatiSquadra()`, `numeroGiaUsato()`) rispecchiano i vincoli
della tabella (numero maglia univoco tra gli attivi, campi obbligatori): l'obiettivo è
mostrare un messaggio leggibile invece di far arrivare un errore Postgres grezzo
all'amministratore.

## Classifica interna di Squadra

La tab "Stats" di `/squadra` mostra una classifica interna ordinabile per 5 criteri
(`CriterioClassifica` in `rosa.ts`): presenze, media voto, MVP, palloni, cacche/partita.
`classificaRank()` calcola un "dense rank" (a parità di valore stessa posizione, il
successivo non salta — 1, 1, 2, non 1, 1, 3); `dettaglioClassifica()` sceglie quale
sottostatistica mostrare sotto il nome, coerente col criterio selezionato (es. "voti
pagella" per il criterio media voto, non sempre "presenze consecutive").

Le altre tab di `/squadra` (Rosa, Obiettivi, Badge) sono viste diverse sugli stessi dati di
`useRosa()`/`useObiettivi()`/`badges.ts`: non introducono altra logica di dominio, solo
presentazione — le rispettive specifiche stanno in `badge.md` e `obiettivi-squadra.md`.

---

## Limiti noti

1. **`giocatori_squadra` non ha ancora una colonna per la data di nascita.** Per i
   giocatori storici (seed iniziale) la nascita viene letta da `crapp-data.ts`
   (`nascitaPerId`, lookup per id); un giocatore aggiunto dopo la migrazione non ha nascita
   nota finché la colonna non esiste (DD-015). Effetto visibile: niente compleanno nel
   Calendario per quei giocatori.
2. **`src/lib/crapp-data.ts` resta come fallback**, non più come fonte viva: se il database
   non risponde o non è ancora popolato, `rosaFallback()` genera una rosa di riserva dai
   dati statici storici. Un ambiente nuovo senza dati in `giocatori_squadra` mostra quindi
   comunque una squadra, non una schermata vuota — ma è la rosa 2025/26 hardcoded, non
   quella reale.
