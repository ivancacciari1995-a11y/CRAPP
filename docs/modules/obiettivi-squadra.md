# Modulo — Obiettivi di squadra

**Stato:** implementato — mesi/scadenze dinamici, target stagionali fissi da rivedere a mano,
copertura test completa (unit + integration) su tutti e 10 gli obiettivi.
**File principali:** `src/lib/obiettivi.ts`, `src/lib/rosa.ts` (`useObiettivi()`)

---

## Obiettivo

Mostrare traguardi collettivi (non individuali) che avanzano con il contributo di tutta la
rosa — presenze, risposte alle convocazioni, pagelle, risultati di campionato — per motivare
comportamenti di squadra oltre alla singola prestazione.

---

## Dati

Nessuna tabella dedicata: ogni obiettivo è una funzione pura in `obiettivi.ts`
(`obiettiviSquadra()`) che legge dati già aggregati altrove (`risposte_presenze`,
`pagelle_voti`, i risultati ufficiali CSI, le serie di presenza). `obiettiviOrdinati()` li
ordina mettendo i completati in coda e gli altri per progresso decrescente.

`obiettiviSquadra(rosa, ctx, oggi)` accetta un terzo parametro opzionale `oggi: Date` (default
`new Date()`) per iniettare una data deterministica nei test — usato dai due obiettivi con mese
corrente dinamico (vedi sotto).

---

## Obiettivi definiti

| id    | Obiettivo                          | Calcolo                                              | Target                 | Fonte                                     |
| ----- | ----------------------------------- | ----------------------------------------------------- | ----------------------- | ------------------------------------------ |
| `o1`  | 90% presenze del mese               | risposte presente/ritardo su partite+allenamenti del mese corrente (dinamico) | 90% | `risposte_presenze` |
| `o2`  | Tutti rispondono alle convocazioni  | risposte totali / eventi possibili (esclusi i compleanni) | 90%                  | `risposte_presenze`                        |
| `o7`  | 250 presenze complessive            | somma presenze di tutta la rosa, stagione intera       | 250                     | aggregato da `useRosa()`                   |
| `o12` | Media pagelle da 7.5                | media di tutti i voti, arrotondata a una cifra decimale | 7.5                   | `pagelle_voti`                             |
| `o13` | 200 pagelle compilate               | conteggio voti                                         | 200                     | `pagelle_voti`                             |
| `o11` | Continuità di squadra               | giocatori con ≥3 allenamenti consecutivi               | 12 (min. per un 6vs6)   | `serieAllenamenti`                         |
| `o3`  | Prima vittoria del campionato       | `min(vittorie, 1)`                                     | 1                       | JSON partite CSI (vedi sotto)              |
| `o4`  | 5 vittorie in campionato            | `min(vittorie, 5)`                                     | 5                       | JSON partite CSI                           |
| `o5`  | 10 vittorie in campionato           | `min(vittorie, 10)`                                    | 10                      | JSON partite CSI                           |
| `o6`  | 1 evento di squadra al mese         | eventi di tipo "evento" nel mese corrente (dinamico)   | 1                       | `eventi_app`                               |

Mostrati in `squadra.tsx` (elenco completo con barra di progresso) e in `index.tsx` (home: il
primo obiettivo non completato). Un obiettivo che supera il 90% genera anche una notifica
smart (`notifiche-smart.ts`). I target fissi (250 presenze, 200 pagelle, 7.5 di media, 1/5/10
vittorie) sono scelte editoriali da rivedere a mano a ogni stagione — nessuna configurazione o
UI per farlo, si cambia il numero in `obiettivi.ts`. Fa eccezione "Continuità di squadra"
(vedi sotto): il suo target ha un significato specifico, non va scalato come gli altri.

---

## Obiettivi mensili — mese dinamico

`o1` ("90% presenze del mese") e `o6` ("1 evento di squadra al mese") si azzerano
automaticamente a ogni cambio mese: il mese di riferimento è calcolato dalla data corrente
(fuso Europe/Rome, `meseCorrente(oggi)`), non più una costante fissa. Per `o1`, titolo
("90% di presenze ad agosto" / "a settembre" / ...) e scadenza (ultimo giorno del mese)
seguono di conseguenza.

`o2` ("Tutti rispondono alle convocazioni") non si azzera — aggrega su tutti gli eventi in
programma, non solo quelli del mese corrente — ma la sua `scadenza` mostrata in interfaccia è
anch'essa l'ultimo giorno del mese corrente (`fineMese(oggi)`), non più una data fissa.

---

## Continuità di squadra — il target 12 è il minimo per un 6vs6

Il target di 12 giocatori con almeno 3 allenamenti consecutivi (`o11`) **non è arbitrario**: è
il numero minimo di giocatori per schierare due sestetti (6 contro 6) in allenamento. A
differenza degli altri target fissi, non va scalato in proporzione alla rosa se questa cambia
dimensione — resta 12 finché l'obiettivo è "riuscire ad allenarsi in modo completo".

Dipende da `serieAllenamenti` (vedi [Serie di presenze](serie-presenze.md)), calcolato sui dati
reali: un evento passato senza risposta vale come assenza e azzera la serie, quindi l'obiettivo
misura anche quanto la squadra risponde alle convocazioni, non solo la presenza fisica.

---

## Vittorie in campionato (o3/o4/o5) — dipendenza dal portale CSI

Le vittorie (`ctx.vittorie`) arrivano dal **JSON** delle partite del portale CSI Bologna
(`getEventsByTeamId.php`, non la pagina HTML della classifica), tramite
`partiteGiocate(csi.partite).filter(p => p.setNostri > p.setLoro)` calcolato in
`src/lib/rosa.ts` (`useObiettivi()`). `o3`/`o4`/`o5` sono lo stesso numero di vittorie letto a
tre soglie diverse (1/5/10), ciascuna cappata con `Math.min` — nessuna delle tre supera mai il
proprio target, nemmeno con più vittorie di quante ne servano.

### Il limite: il parsing del JSON può rompersi in silenzio

`result` e `partials` nella risposta di `getEventsByTeamId.php` sono stringhe libere tipo
`"3-1"`, lette con un'espressione regolare (`punteggio()`/`parziali()` in `csi-core.ts`). Se il
portale CSI cambiasse formato (es. `"3:1"`, o un punteggio come oggetto invece che stringa), la
regex non troverebbe corrispondenza e la partita risulterebbe "non ancora giocata" — **senza
errori**. Se la risposta cambiasse forma radicalmente (non più un array), `partiteDaEventi()`
torna `[]`. In entrambi i casi `o3`/`o4`/`o5` restano bloccati a 0% anche a fronte di vittorie
reali, e il fallback della route (`/api/public/csi`) non se ne accorgerebbe da solo: lancia un
errore solo se *sia* la classifica *sia* le partite sono vuote insieme, quindi se si rompe solo
il JSON delle partite mentre la classifica HTML continua a funzionare, la route risponde
comunque `200` con `partite: []`.

### Come è mitigato oggi

- **`partiteFormatoSospetto()`** (`csi-core.ts`) confronta gli eventi grezzi ricevuti con il
  risultato di `partiteDaEventi()`: se ci sono eventi ma nessuno è stato riconosciuto come
  nostra partita, il formato è quasi certamente cambiato (distingue così un vero "formato
  rotto" da un legittimo "nessuna gara ancora in programma", dove gli eventi grezzi sono vuoti
  anche loro).
- La route (`src/routes/api/public/csi.ts`) logga un `console.error` quando succede.
- Il flag viaggia anche nella risposta JSON (`DatiCsi.formatoSospetto`) fino a `/classifica`
  (`src/routes/classifica.tsx`), dove sostituisce la riga "Dati CSI aggiornati alle..." con un
  badge discreto color warning ("Il portale CSI potrebbe aver cambiato formato: dati da
  verificare.") — visibile a chi apre la pagina campionato, non solo nei log del server.

### Come fixarlo, se succede

1. **Vedere il nuovo formato**: guardare la risposta reale dell'endpoint, o lanciare
   `CSI_LIVE=1 bun test/unit/csi-core.test.ts` (interroga il portale vero).
2. **Aggiornare il parsing** in `src/lib/csi-core.ts`: quasi sempre basta toccare
   `punteggio()`/`parziali()` (le regex sul formato del punteggio) o i nomi dei campi letti in
   `partiteDaEventi()`. Il resto dell'app consuma solo i tipi già puliti che questo file
   produce (`DatiCsi`, `PartitaCsi[]`), quindi il fix resta isolato.
3. Serve toccare anche `src/routes/api/public/csi.ts` solo se cambiano gli **URL/endpoint**
   stessi o serve autenticazione — non per un semplice cambio di formato dei dati.
4. **Aggiornare i test**: `test/unit/csi-core.test.ts` con fixture nel nuovo formato, altrimenti
   restano verdi contro un formato che non esiste più.

Dettagli completi (endpoint, identificativi di stagione, altri limiti del collegamento CSI) in
[Collegamento CSI](collegamento-csi.md).

---

## Copertura test

Tutti e 10 gli obiettivi hanno unit test **e** integration test end-to-end (dati scritti/letti
da un backend reale, non solo funzione pura con contesto costruito a mano).

| Obiettivi   | Unit test                     | Integration test                                         |
| ------------ | -------------------------------- | ------------------------------------------------------------ |
| o1, o2, o6   | `test/unit/obiettivi.test.ts`    | `test/integration/obiettivi.test.ts` (Supabase locale)       |
| o7           | `test/unit/obiettivi.test.ts`    | `test/integration/obiettivi.test.ts` (Supabase locale)       |
| o11          | `test/unit/obiettivi.test.ts`    | `test/integration/obiettivi.test.ts` (Supabase locale)       |
| o12, o13     | `test/unit/obiettivi.test.ts`    | `test/integration/obiettivi.test.ts` (Supabase locale)       |
| o3, o4, o5   | `test/unit/obiettivi.test.ts`    | `test/integration/api.test.ts` (CSI reale in produzione)     |

- **o1/o2/o6** (Supabase locale): scrive eventi e risposte veri su `eventi_app`/
  `risposte_presenze`, li rilegge con `leggiEventi()` (la stessa funzione server dell'app) e una
  query REST equivalente a `fetchPresenze()`. Copre: contesto vuoto, aggregazione su più eventi,
  filtro sui tipi (partite/allenamenti contano, eventi sociali/compleanni no), il mese dinamico
  (evento dentro/fuori mese), scadenza dinamica.
- **o7** (Supabase locale): scrive eventi/presenze reali, calcola `contaPresenzeGiocatore()` (la
  stessa funzione pura usata da `useRosa()` in produzione) sui dati riletti, verifica la somma.
- **o11** (Supabase locale): scrive tre allenamenti e presenze reali, calcola
  `serieConsecutiva()` sui dati riletti, verifica che solo chi resta in serie venga contato.
- **o12/o13** (Supabase locale): scrive voti veri su `pagelle_voti` rispettando i vincoli reali
  della tabella (`pagelle_no_autovoto`, `pagelle_voto_range`), li rilegge, verifica media
  arrotondata e conteggio.
- **o3/o4/o5** (CSI reale, non Supabase — le vittorie non toccano il database): estende
  `test/integration/api.test.ts`, che già chiama `/api/public/csi` dal vivo. Legge le vittorie
  vere del giorno con la stessa logica di `useObiettivi()`, le passa a `obiettiviSquadra()` e
  verifica cap e target su dati reali.

Per rilanciare tutto: `npm run test` (unit, nessuna rete) e `npm run test:integration`
(richiede `npx supabase start` per o1/o2/o6/o7/o11/o12/o13, e rete verso CSI Bologna per
o3/o4/o5 — quest'ultimo gira comunque anche senza stack Supabase locale).
