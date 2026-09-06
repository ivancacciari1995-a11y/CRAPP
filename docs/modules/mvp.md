# Modulo — Votazione MVP

**Stato:** implementato (v1.0)
**File principali:** `src/lib/mvp-voti.ts`, `src/components/crapp/VotazioneMvp.tsx`

---

## Obiettivo

Eleggere il MVP di una partita tramite voto tra compagni, un voto a testa, con vincitore
calcolato a runtime.

---

## Dati

Tabella `mvp_voti`, vincolo `UNIQUE (match_id, votante_id)` — un solo voto per giocatore per
partita, sovrascrivibile.

---

## Implementazione

- Il pannello compare in `partita.$id.tsx` solo se esiste un risultato (Scout Live salvato)
  per la partita, altrimenti mostra "la partita non è ancora stata disputata".
- `useVotaMvp()` fa upsert `onConflict: match_id, votante_id`: il voto è modificabile senza
  limiti, senza storico.
- Nessuno vota sé stesso: `VotazioneMvp.tsx` toglie il votante dall'elenco e il vincolo
  `mvp_no_autovoto` (migration `m12_niente_autovoto`) rifiuta la riga anche a chi scrive
  direttamente su PostgREST, come già faceva `pagelle_no_autovoto` per le pagelle.
- `conteggioPartita()`/`vincitoriMvp()` richiedono un margine netto: in caso di parità,
  nessun vincitore viene assegnato per quella partita finché non arrivano altri voti.
- `mvpVintiPerGiocatore()` conta una vittoria per ogni partita "vinta" con margine netto; il
  risultato alimenta il campo `mvp` del `Giocatore` in `useRosa()`, mostrato come StatTile
  nel profilo e in home.

---

## Limiti noti

- Nessuna scadenza o chiusura della votazione: resta aperta indefinitamente.
- Il voto è legato a chi lo scrive: da `m11_scritture_per_ruolo` la policy impone che
  `votante_id` sia lo slot collegato all'account (DD-023). Su chi viene votato l'unico
  vincolo è che non sia il votante stesso (`mvp_no_autovoto`): che sia un convocato di
  quella partita resta un filtro solo applicativo.
- In caso di parità, nessun MVP viene assegnato per quella partita.

---

## Evoluzioni possibili

- Introdurre una scadenza (es. la votazione si chiude N giorni dopo la partita).
