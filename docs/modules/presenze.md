# Modulo — Presenze

**Stato:** implementato (v1.0)
**File principali:** `src/lib/presenze.ts`, `src/lib/presenze-mese.ts`, `src/components/crapp/RosaPresenze.tsx`,
`src/routes/api/public/sollecita-presenze.ts`

---

## Obiettivo

Permettere a ogni giocatore di confermare o rifiutare la propria partecipazione a un evento
(allenamento o partita) e mostrare a tutta la squadra chi ha risposto e come, sostituendo i
solleciti a voce o su chat esterne.

---

## Dati

Tabella `risposte_presenze` (PK composita `evento_id, giocatore_id`), letta e scritta da
`src/lib/presenze.ts`. È il modello "in uso" citato in `docs/DATABASE.md`; le tabelle
`eventi`/`presenze` previste da DD-014 non sono referenziate da nessun punto del codice
attuale.

Stati possibili (`Stato` in `src/lib/crapp-data.ts`): `presente`, `assente`, `forse`,
`ritardo`, `infortunato`. Solo `presente` e `ritardo` contano come presenza effettiva nelle
statistiche. L'assenza di una riga per `(evento, giocatore)` equivale a "non ha ancora
risposto".

---

## Implementazione

```
Giocatore tocca uno stato in RosaPresenze
      ↓
useSalvaPresenza()        → src/lib/presenze.ts   (upsert o delete su risposte_presenze,
      ↓                                             onConflict evento_id+giocatore_id)
risposte_presenze (Supabase)
      ↓  letta da
useRispostePresenze()     → src/lib/presenze.ts   (1 query per sessione, staleTime 5 min,
      ↓                                             legge tutta la tabella)
RosaPresenze               → src/components/crapp/RosaPresenze.tsx
      ↑ montato da           (riepilogo, bottoni di risposta, gruppi per stato)
allenamento.$id.tsx / partita.$id.tsx

--- statistiche ---
contaPresenzeGiocatore() / totaliEventiGiocatore()  → src/lib/presenze.ts
usePresenzeUltimoMese()                             → src/lib/presenze-mese.ts
                                                       (percentuale ultimi 30gg, da cache già in memoria)

--- sollecito (solo admin) ---
Bottone "Sollecita" (RosaPresenze.tsx) → POST /api/public/sollecita-presenze
      ↓
src/routes/api/public/sollecita-presenze.ts
      ├─ legge l'evento (eventi_app) e le risposte già date
      ├─ destinatariSollecito()  → src/lib/presenze.ts
      │  (attivi senza risposta o con "forse"; funzione pura, testata in unit)
      ├─ per ciascuno invia una push col testo cifrato nel payload
      │  (src/lib/webpush.server.ts)
      └─ elimina le iscrizioni push scadute (404/410)
```

Un evento conta ai fini delle statistiche di presenza solo se è di tipo `partita` o
`allenamento` e il giocatore è tra i convocati (o non ci sono convocati specificati, cioè
vale per tutta la rosa) — `eventiContanoPresenze()` in `presenze.ts`.

---

## Regole rispettate

- Aggiornamento ottimistico della cache locale dopo ogni salvataggio: nessuna rilettura dal
  server, la UI risponde subito.
- Il sollecito è **manuale**: nessun cron nel repository lo richiama automaticamente, parte
  solo dal bottone admin, e la route verifica il ruolo lato server con `richiediAdmin`
  (DD-024).
- Ognuno risponde **solo per sé**, e non è più una regola della sola interfaccia: dalla
  migration `m11_scritture_per_ruolo` la policy di `risposte_presenze` lega la riga allo slot
  `giocatori_squadra` collegato all'account, con gli amministratori come sola deroga
  (DD-023). Verificato da `test/integration/permessi.test.ts`.

---

## Limiti noti

- Nessuna finestra temporale per rispondere: si può cambiare risposta anche a evento passato.
- La risposta di un evento passato resta modificabile: `risposte_presenze` non ha una
  finestra di chiusura, né in UI né in RLS.
- `useRispostePresenze()` legge sempre l'intera tabella, non filtrata per evento: adeguato per
  una singola squadra, da rivedere se il volume cresce molto.

---

## Evoluzioni possibili

- Filtrare la lettura delle presenze per evento invece di caricare tutta la tabella.
