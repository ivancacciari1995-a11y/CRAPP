# Modulo — Serie di presenze

**Stato:** implementato solo lato definizione/UI — **non calcola valori reali** (vedi Limiti noti)
**File principali:** `src/lib/serie.ts`, `src/components/crapp/SerieCard.tsx`

---

## Obiettivo

Motivare la costanza dei giocatori mostrando "serie" (streak) di comportamenti positivi
consecutivi — presenza agli allenamenti, presenza alle partite, risposta entro 24 ore alla
convocazione — con traguardi progressivi, sullo stile delle app fitness. È anche uno dei
requisiti di sblocco di alcuni [badge](badge.md) e di un [obiettivo di squadra](obiettivi-squadra.md).

---

## Dati

Non esiste una tabella dedicata: le serie sono campi (`serieAllenamenti`, `seriePartite`,
`serieConferme`) del tipo `Giocatore` assemblato da `useRosa()` (`src/lib/rosa.ts`).

---

## Implementazione

- `src/lib/serie.ts` — definizione dei 3 tipi di serie (`serieDefs`, con label, descrizione e
  4 traguardi crescenti ciascuna), funzione pura `aggiornaSerie(valore, onorato)` (regola: +1
  se onorato, altrimenti azzeramento **solo di quella serie**), `statoSerie()` (progresso e
  messaggio verso il prossimo traguardo), `serieGiocatore()`/`serieMigliore()` (aggregatori
  per la UI).
- `src/components/crapp/SerieCard.tsx` — `SerieGriglia` (vista completa nel profilo) e
  `SerieHome` (riepilogo compatto in home, solo la serie più alta).
- `src/routes/profilo.tsx` — monta `SerieGriglia` nella sezione "Serie di presenze".

---

## Limiti noti

**La funzione `aggiornaSerie()` non è invocata da nessun punto del codice.** I tre campi che
alimentano la UI (`serieAllenamenti`, `seriePartite`, `serieConferme`, oltre a `streak`) sono
impostati a `0` fisso in `useRosa()` (`src/lib/rosa.ts`) e nel seed storico di
`crapp-data.ts`. Di conseguenza, con i dati reali della rosa:

- le card in `SerieGriglia` mostrano sempre progresso 0;
- i badge che dipendono dalle serie ("Sempre in palestra", "Risposta lampo", il segreto "Mai
  un forfait") non possono mai sbloccarsi;
- l'obiettivo di squadra "Continuità di squadra" (≥3 allenamenti consecutivi per almeno 12
  giocatori) resta permanentemente a 0/12.

Il modulo è quindi completo lato definizione e UI, ma **funzionalmente inerte**: manca il
collegamento che calcoli le serie da `risposte_presenze` e le derivi per ogni giocatore.

---

## Evoluzioni possibili

- Calcolare le tre serie a partire da `risposte_presenze` (ordinando gli eventi per data e
  applicando `aggiornaSerie()` in sequenza), lato client in `useRosa()` o come valore
  derivato lato server.
- Una volta corretto, verificare che i badge e l'obiettivo collegati si sblocchino davvero.
