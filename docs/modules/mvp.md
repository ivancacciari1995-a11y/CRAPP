# Modulo — Votazione MVP

**Stato:** implementato
**File principali:** `src/lib/mvp-voti.ts`, `src/components/crapp/VotazioneMvp.tsx`
**Test:** `test/unit/mvp-voti.test.ts`, `test/integration/permessi.test.ts` (regole del voto), `mvp-badge`, `s-tiebreak-badge`

---

## Obiettivo

Eleggere il MVP di una partita tramite voto tra compagni, un voto a testa, con vincitore
calcolato a runtime.

---

## Dati

Tabella `mvp_voti`, vincolo `UNIQUE (match_id, votante_id)` — un solo voto per giocatore per
partita, **definitivo** (DD-051) e **segreto** (DD-052): la tabella la legge solo chi ha votato (il
proprio voto) e gli admin; la squadra legge i conteggi dalla vista `mvp_voti_anonimi` (`match_id`,
`votato_id`, `votato_nome`, senza `votante_id`). `votato_nome` lo riempie un trigger dalla rosa a
partire da `votato_id`: il nome inviato dal client è ignorato.

`match_id` è l'**id dell'evento CrAPP**, non quello del referto CSI né dello Scout: la
votazione non dipende più da nessuna delle due fonti (i voti scritti prima con l'id scout/CSI
restano nel database ma non vengono più letti da nessuna schermata).

---

## Implementazione

- Il pannello sta in `partita.$id.tsx` in una sezione sua, sempre presente: `votoMvpAperto()`
  lo apre `ORE_ATTESA_MVP` (2) ore dopo `data`+`ora` dell'evento, prima di allora mostra solo
  quando aprirà; `votoMvpChiuso()` lo chiude `DURATA_VOTO_MVP_ORE` (24) ore dopo l'apertura
  (DD-052). A votazione chiusa il pannello mostra «Votazione chiusa» e i risultati, senza il
  pulsante «Vota». Nessun legame con il risultato caricato.
- Votano e sono votabili solo i **presenti** di quell'evento (`presente` o `ritardo` in
  `usePresenzeEvento`): chi non c'era ha il bottone disabilitato e non compare nell'elenco.
- `useVotiMvp()` legge i conteggi dalla vista `mvp_voti_anonimi`; `useMieiVotiMvp()` legge dalla
  tabella solo i voti dell'utente (gli unici che la policy gli lascia), per «Hai votato X».
- `useVotaMvp()` fa un `INSERT`: il voto è definitivo. Il pannello chiede di scegliere un nome e di
  confermarlo, poi mostra «Hai votato X: il voto non si può cambiare». A database (`m35`, DD-051) il
  giocatore ha solo la policy di `INSERT`: modificare o cancellare un voto è possibile solo agli admin.
- Nessuno vota sé stesso: `VotazioneMvp.tsx` toglie il votante dall'elenco e il vincolo
  `mvp_no_autovoto` (migration `m12_niente_autovoto`) rifiuta la riga anche a chi scrive
  direttamente su PostgREST, come già faceva `pagelle_no_autovoto` per le pagelle.
- `mvpPartita()` restituisce i più votati: **in caso di parità in testa sono tutti MVP a pari merito**
  (DD-051). `vincitoriMvp()` ne unisce i nomi («Anna e Bruno») per Home e Classifica.
- `mvpPartita()` (quindi anche `vincitoriMvp()` e `mvpVintiPerGiocatore()`) richiede un quorum minimo di voti totali
  sulla partita (`VOTI_MINIMI_MVP = 2`, `mvp-voti.ts`, DD-028): un solo voto non basta a
  incoronare nessuno, nemmeno senza concorrenza.
- `mvpVintiPerGiocatore()` conta una vittoria per ogni partita in cui il giocatore è tra i più votati
  (anche a pari merito); il risultato alimenta il campo `mvp` del `Giocatore` in `useRosa()`, mostrato come StatTile
  nel profilo e in home.

---

## Limiti noti

- Il voto si chiude 24 ore dopo l'apertura (DD-052). Le partite più vecchie sono quindi chiuse:
  chi non aveva votato non può più farlo. Gli admin possono ancora scrivere un voto dal database.
- Gli admin leggono la tabella `mvp_voti` (gli serve per correggere un voto), quindi a livello di
  database vedono chi ha votato chi; l'app non lo mostra a nessuno.
- I conteggi sono visibili anche durante la votazione. Nascondere i risultati fino alla chiusura è una
  possibile evoluzione.
- Il voto è legato a chi lo scrive: da `m11_scritture_per_ruolo` la policy impone che
  `votante_id` sia lo slot collegato all'account (DD-023). Su chi viene votato l'unico
  vincolo diretto è che non sia il votante stesso (`mvp_no_autovoto`).
  Da `m13_convocati_e_pagelle_chiuse` la stessa policy verifica anche che **sia il votante sia
  il votato** siano tra i **convocati** dell'evento (`evento_permette_voto()`, convocati vuoto
  = tutta la rosa). Da `m36` (DD-051) la policy usa `voto_mvp_consentito()`, che aggiunge a quei
  controlli: l'evento è una **partita**, votante e votato hanno risposto `presente` o `ritardo` e
  sono passate **2 ore** dall'inizio e **non ancora altre 24** (`Europe/Rome`; un `ora` vuoto
  vale mezzanotte). Sono le stesse
  regole del pannello, ora imposte anche a chi scrive direttamente su PostgREST; l'attesa di 2 ore
  e la chiusura stanno in `ORE_ATTESA_MVP`/`DURATA_VOTO_MVP_ORE` e negli intervalli della funzione
  (`m37`); un test unitario li tiene allineati. Gli
  admin restano fuori da questi vincoli (possono correggere un voto). La presenza si controlla solo
  al momento del voto: se qualcuno cambia risposta dopo, il voto già dato resta.
- Sotto il quorum minimo di voti nessun MVP viene assegnato per quella partita. Una parità in testa,
  invece, assegna l'MVP a tutti i pari merito.
- Un voto sbagliato si corregge solo da un admin (dal database): non c'è un'interfaccia per farlo.

---

## Evoluzioni possibili

- Nascondere i risultati finché la votazione non è chiusa.
- Una schermata per gli admin per correggere un voto (oggi solo dal database).
