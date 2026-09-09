# Modulo — Votazione MVP

**Stato:** implementato
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
- `vincitoriMvp()`/`mvpVintiPerGiocatore()` richiedono anche un quorum minimo di voti totali
  sulla partita (`VOTI_MINIMI_MVP = 2`, `mvp-voti.ts`, DD-028): un solo voto non basta a
  incoronare nessuno, nemmeno senza concorrenza.
- `mvpVintiPerGiocatore()` conta una vittoria per ogni partita "vinta" con margine netto; il
  risultato alimenta il campo `mvp` del `Giocatore` in `useRosa()`, mostrato come StatTile
  nel profilo e in home.

---

## Limiti noti

- Nessuna scadenza o chiusura della votazione: una volta aperta resta aperta indefinitamente.
- Il voto è legato a chi lo scrive: da `m11_scritture_per_ruolo` la policy impone che
  `votante_id` sia lo slot collegato all'account (DD-023). Su chi viene votato l'unico
  vincolo diretto è che non sia il votante stesso (`mvp_no_autovoto`).
  Da `m13_convocati_e_pagelle_chiuse` la stessa policy verifica anche che **sia il votante sia
  il votato** siano tra i **convocati** dell'evento (`evento_permette_voto()`, convocati vuoto
  = tutta la rosa): prima era un filtro solo applicativo, ora un giocatore non convocato non
  può più votare né essere votato scrivendo direttamente su PostgREST. Restano invece solo
  applicativi, non controllati da nessuna policy: che votante e votato fossero **presenti**
  (non solo convocati: `presente`/`ritardo` in `usePresenzeEvento`, un controllo più stretto
  della sola convocazione) a quella partita, e le due ore d'attesa dall'inizio evento
  (`votoMvpAperto()`) — un amministratore, o chiunque scriva su PostgREST, passa comunque.
- In caso di parità, o sotto il quorum minimo di voti, nessun MVP viene assegnato per quella
  partita.

---

## Evoluzioni possibili

- Introdurre una scadenza (es. la votazione si chiude N giorni dopo la partita).
