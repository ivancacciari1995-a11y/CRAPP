# Modulo — Infortuni

**Stato:** implementato in forma minima (solo conteggio)
**File principali:** `src/lib/infortuni.ts`

---

## Obiettivo

Tracciare quanti eventi (allenamenti o partite) un giocatore ha saltato per infortunio,
riusando lo stato di presenza `infortunato` già registrato per le convocazioni — nessun
modulo di gestione infortuni a sé stante.

---

## Dati

Nessuna tabella dedicata: il dato vive interamente dentro `risposte_presenze`, come uno dei
valori possibili dell'enum `Stato` (`presente`, `assente`, `forse`, `ritardo`, `infortunato`).

---

## Implementazione

`contaStato()`/`contaInfortuni()` (`infortuni.ts`) contano, per ciascun giocatore, quante
volte compare lo stato `infortunato` nella mappa presenze già in cache (nessuna query
aggiuntiva). Lo stesso meccanismo, con `contaRitardi()`, conta i ritardi. Il risultato
alimenta il campo `infortuni` del `Giocatore` in `useRosa()`.

Visibile in UI solo indirettamente, tramite il [badge](badge.md) segreto "Cliente VIP
dell'Infermeria" (sbloccato con almeno 3 infortuni): non esiste uno StatTile dedicato nel
profilo che mostri il numero di infortuni come statistica di superficie.

---

## Limiti noti

- Nessuna durata o periodo tracciato: è solo un conteggio di eventi con quello stato, non un
  inizio/fine infortunio.
- Il conteggio dipende dal fatto che qualcuno imposti correttamente lo stato "infortunato"
  invece di "assente": nessuna validazione o promemoria lo garantisce.
- Poco visibile per valori bassi (1-2), perché emerge solo tramite un badge a soglia 3.
- `conInfortuni()`, una funzione di merge alternativa nello stesso file, non risulta usata da
  nessuna parte del codice attuale — probabile residuo non collegato.

---

## Evoluzioni possibili

- Uno StatTile dedicato nel profilo, oltre al badge segreto.
- Se servisse un vero tracciamento (durata, tipo di infortunio), servirebbe una tabella
  dedicata: oggi il modulo copre solo il conteggio.
