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
- `conteggioPartita()`/`vincitoriMvp()` richiedono un margine netto: in caso di parità,
  nessun vincitore viene assegnato per quella partita finché non arrivano altri voti.
- `mvpVintiPerGiocatore()` conta una vittoria per ogni partita "vinta" con margine netto; il
  risultato alimenta il campo `mvp` del `Giocatore` in `useRosa()`, mostrato come StatTile
  nel profilo e in home.

---

## Limiti noti

- **Nessun controllo che impedisca di votare se stessi** — a differenza dei
  [Badge social](badge.md), che escludono esplicitamente l'auto-voto. È una lacuna, non un
  limite di design dichiarato altrove.
- Nessuna scadenza o chiusura della votazione: resta aperta indefinitamente.
- RLS permissiva: `votante_id`/`votato_id` sono testo libero inviato dal client (l'id
  giocatore proviene da `localStorage`, non da un claim di sessione verificato server-side);
  nessun trigger lega il voto all'utente autenticato.
- In caso di parità, nessun MVP viene assegnato per quella partita.

---

## Evoluzioni possibili

- Impedire l'auto-voto come già avviene nei Badge social.
- Introdurre una scadenza (es. la votazione si chiude N giorni dopo la partita).
