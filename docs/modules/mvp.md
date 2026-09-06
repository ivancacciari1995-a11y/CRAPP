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

`match_id` è l'**id dell'evento CrAPP**, non quello del referto CSI né dello Scout: la
votazione non dipende più da nessuna delle due fonti (i voti scritti prima con l'id scout/CSI
restano nel database ma non vengono più letti da nessuna schermata).

---

## Implementazione

- Il pannello sta in `partita.$id.tsx` in una sezione sua, sempre presente: `votoMvpAperto()`
  lo apre `ORE_ATTESA_MVP` (2) ore dopo `data`+`ora` dell'evento, prima di allora mostra solo
  quando aprirà. Nessun legame con il risultato caricato.
- Votano e sono votabili solo i **presenti** di quell'evento (`presente` o `ritardo` in
  `usePresenzeEvento`): chi non c'era ha il bottone disabilitato e non compare nell'elenco.
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

- Nessuna scadenza o chiusura della votazione: una volta aperta resta aperta indefinitamente.
- Il voto è legato a chi lo scrive: da `m11_scritture_per_ruolo` la policy impone che
  `votante_id` sia lo slot collegato all'account (DD-023). Su chi viene votato l'unico
  vincolo è che non sia il votante stesso (`mvp_no_autovoto`): che votante e votato fossero
  presenti a quella partita, e che siano passate due ore dall'inizio, restano filtri solo
  applicativi — chi scrive su PostgREST li aggira.
- In caso di parità, nessun MVP viene assegnato per quella partita.

---

## Evoluzioni possibili

- Introdurre una scadenza (es. la votazione si chiude N giorni dopo la partita).
