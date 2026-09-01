# Obiettivi di squadra: sezione in Squadra + widget in home

## Stato attuale

Al momento c'è un solo "obiettivo di squadra" ed è hardcoded nella home (`src/routes/index.tsx`, riga 136): **"90% di presenze ad agosto"** con una barra finta all'82%. Non esiste uno schema dati né una sezione dedicata, e non è collegato a calendario, presenze o statistiche. Le voci "obiettivi" nelle descrizioni di Squadra e Profilo si riferiscono ai badge individuali, non a obiettivi di squadra.

## Cosa faccio

1. **Modello dati locale** in `src/lib/crapp-data.ts`

- Nuovo tipo `ObiettivoSquadra`: id, titolo, descrizione, target, valore attuale, unità, scadenza (opzionale), icona.
- Array `obiettiviSquadra` con gli obiettivi demo della stagione.

2. **Sezione "Obiettivi di squadra" dentro la scheda Squadra** (`src/routes/squadra.tsx`)

- Nuova sezione con la lista completa degli obiettivi: barra di progresso, percentuale, stato (in corso / completato).
- Ordinati con gli obiettivi in corso in cima e i completati in fondo.
- Nessuna nuova rotta e nessuna modifica al bottom nav.

3. **Widget home dinamico** (`src/routes/index.tsx`)

- Sostituisce l'obiettivo hardcoded: mostra sempre il primo obiettivo in corso preso dalla lista.
- Progresso calcolato dai dati reali dove possibile (es. presenze derivate dagli eventi).

4. **Obiettivi demo iniziali**

- 90% di presenze ad agosto (collegato agli eventi di agosto).
- 70% di risposte entro 24h nel prossimo mese.
- Prima vittoria del campionato (collegato allo storico match).
- 5 vittorie in campionato (collegato allo storico match).
- 10 vittorie in campionato (collegato allo storico match).
- 1 evento di squadra al mese (pizzata, ecc.).

## Cosa non cambia

- Resta un prototipo offline: i dati restano in `src/lib/crapp-data.ts`.
- I badge individuali restano come sono in `src/lib/badges.ts` e nella rosa di `src/routes/squadra.tsx`.
- Bottom nav e rotte invariate.
