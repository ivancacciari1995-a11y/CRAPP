# Modulo — Badge

**Stato:** implementato, coerente con DD-007 e DD-008
**File principali:** `src/lib/badges.ts`, `src/lib/badge-social.ts`,
`src/components/crapp/CollezioneBadge.tsx`, `src/components/crapp/BadgeDrawer.tsx`,
`src/components/crapp/CelebrazioneBadge.tsx`, `src/components/crapp/VotoSocial.tsx`

---

## Obiettivo

Gamification: sbloccare badge (gradi bronzo/argento/oro, più badge "segreti") in base a
statistiche personali reali del giocatore, per motivare la partecipazione senza penalizzare i
ruoli con meno statistiche "spettacolari" (DD-008).

---

## Dati

Nessuna tabella dedicata ai badge sbloccati: **calcolati interamente a runtime**
dall'oggetto `Giocatore` (DD-007). L'unica tabella coinvolta è `badge_social_voti`, per i
badge assegnati per voto dai compagni.

---

## Implementazione

- `badgeDefs`/`badgeSegreti` (`badges.ts`) definiscono ogni badge con una funzione
  `valore(g)` e tre soglie bronzo/argento/oro (elenco completo con fonte e soglie di ognuno in
  "Elenco badge" sotto). Il grado è calcolato da `gradoRaggiunto()`/`statoBadge()`: soglie
  inclusive, vince l'ultima raggiunta o superata. Per la maggior parte dei badge il valore è
  già pronto: `Giocatore` arriva da `useRosa()` con presenze, palloni, serie, infortuni,
  ritardi, cacche e media pagelle già calcolati da altri moduli — `badges.ts` si limita a
  confrontarli con le soglie. Fanno eccezione, con logica propria descritta sotto, il
  Pagellone, lo Sherpa dei palloni, l'MVP e i badge social.
- **Badge Sherpa dei palloni** (`palloni`, in `badgeDefs`): `g.palloni` non è un contatore
  incrementato a ogni evento, ma ricalcolato da `conteggioTurni()` (`palloni-core.ts`) su
  `Giocatore.palloni` (`rosa.ts`) — meccanismo di turni/rotazione descritto per intero in
  [palloni.md](palloni.md), non ripetuto qui. `rosa.ts` passa a `conteggioTurni()` **solo i
  turni confermati** (`turniSalvati` da `useTurniPalloni()`), non l'output di
  `completaTurni()`: le proposte automatiche di rotazione (usate altrove, per la UI di
  `TurnoPalloni.tsx`) non contano per il badge, che premia solo chi ha davvero confermato di
  aver portato i palloni. Conta solo per eventi già trascorsi (`e.data < oggi`, stesso
  criterio delle presenze).
- **Badge Pagellone** (`pagella`, in `badgeDefs`): a differenza degli altri badge da
  contatore, richiede un numero minimo di voti (`VOTI_MINIMI_PAGELLA = 5`, `badges.ts`) prima
  che `g.mediaVoto` conti — sotto soglia `valore(g)` è forzato a `0` (badge bloccato), anche
  con una media altissima. Aggiunto perché senza minimo un singolo voto poteva
  sbloccare/far sparire il badge senza nessuna significatività statistica (vedi
  [pagelle.md](pagelle.md) per la pipeline voto → media, qui non ripetuta). Il numero di voti
  ricevuti arriva in `Giocatore.votiPagella` (`rosa.ts`), popolato insieme a `mediaVoto` dalla
  stessa `mediePagelle()`.
- **Badge social** (`badge-social.ts`, tabella `badge_social_voti`): 5 categorie fisse per
  partita ("Compagno affidabile", "Miglior spirito di squadra", "Fair play", "Meme della
  partita", "Cuore del gruppo"), votabili una volta a testa per categoria/partita
  (modificabile), con **auto-voto escluso in interfaccia** (`VotoSocial.tsx`) e rifiutato dal
  database (vincolo `badge_social_no_autovoto`, migration `m12_niente_autovoto`). A
  differenza delle [Pagelle](pagelle.md), qui non c'è alcun tentativo di anonimato:
  `votante_id`/`votato_id` sono entrambi visibili.
- **Badge MVP** (`mvp`, in `badgeDefs`): l'unico badge normale la cui fonte non è un contatore
  già pronto ma il risultato della votazione MVP tra compagni — meccanismo di voto (chi vota
  chi, apertura, autovoto, RLS) descritto per intero in [mvp.md](mvp.md), non ripetuto qui.
  Quello che serve per capire il badge: `mvpVintiPerGiocatore()` (`mvp-voti.ts`) conta, per
  ogni giocatore, quante partite ha vinto con un **vantaggio netto** sul secondo (non il
  totale dei voti ricevuti; in caso di parità la partita non conta per nessuno). `rosa.ts`
  (`useRosa()`) scrive quel numero in `Giocatore.mvp`, che `badgeDefs` legge con
  `valore: (g) => g.mvp` e confronta con le soglie 1/3/5 (bronzo/argento/oro).
- `CollezioneBadge.tsx` mostra sbloccati, in progresso, badge social vinti e un contatore di
  badge segreti ancora da scoprire; `BadgeDrawer.tsx` il dettaglio di un singolo badge;
  `CelebrazioneBadge.tsx` l'overlay celebrativo alla prima visualizzazione di un badge nuovo.
- Il rilevamento "nuovo" (`notifiche-smart.ts`) confronta id deterministici con quelli già
  visti, salvati in `localStorage` — quindi **locale al dispositivo**, non sincronizzato tra
  dispositivi dello stesso giocatore.

---

## Elenco badge

Riferimento completo per chi lavora sul codice. **In app i 5 badge segreti restano nascosti
finché non sbloccati** (fanno parte della sorpresa per i giocatori): elencarli qui, con le
condizioni esatte, è una scelta deliberata per la documentazione tecnica, non una fuga di
informazioni verso l'interfaccia.

### Badge normali (gradi bronzo/argento/oro)

Tutti calcolati come `valore(g)` confrontato con tre soglie crescenti; il grado è l'ultima
soglia raggiunta o superata (soglie inclusive), oltre l'oro resta oro.

| id                  | nome               | come si guadagna                                                                                                                     | soglie B/A/O    |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| `mvp`               | MVP                | partite vinte nettamente al voto MVP dei compagni (`g.mvp`, vedi pipeline sopra)                                                     | 1 / 3 / 5       |
| `pagella`           | Pagellone          | media dei voti pagella ricevuti dai compagni a fine partita (`g.mediaVoto`), solo se ne ha ricevuti almeno `VOTI_MINIMI_PAGELLA` (5) | 6.5 / 7.5 / 8.5 |
| `palloni`           | Sherpa dei palloni | quante volte hai confermato il turno palloni (`g.palloni`) — le proposte automatiche non ancora confermate non contano               | 3 / 6 / 10      |
| `presenze`          | Presenza fissa     | totale presenze (presente o ritardo) a eventi/partite di sempre, non solo della stagione in corso (`g.presenze`)                     | 5 / 15 / 30     |
| `serie-allenamenti` | Sempre in palestra | allenamenti consecutivi presenti (`g.serieAllenamenti`); un infortunio non spezza la serie, un'assenza sì                            | 3 / 6 / 10      |
| `serie-conferme`    | Risposta lampo     | conferme di presenza consecutive date entro 24h dalla convocazione (`g.serieConferme`)                                               | 3 / 8 / 15      |

### Badge segreti (booleani, nascosti finché non sbloccati)

Stesso motore dei normali ma con soglie `{bronzo:1, argento:1, oro:1}`: `valore(g)` è 0 o 1,
quindi il badge è "trovato o no", mai graduato. In UI compaiono con icona lucchetto finché non
sbloccati. Attenzione se si tocca `gradoRaggiunto()`: con le tre soglie tutte uguali a 1, il
grado effettivo che risulta una volta sbloccato è sempre **`"oro"`** (l'ultimo che il ciclo
`for` sovrascrive), mai `"bronzo"` — l'unica cosa che conta davvero per questi badge è
`grado !== null`, non il suo valore, ed è così che li legge `badgeSegretiSbloccati()`.

| id              | nome                        | condizione esatta                                                                                                                                            |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `s-tiebreak`    | Uomo tie-break              | almeno 2 MVP **e** media pagella ≥ 8, sopra la soglia minima di voti di Pagellone (`g.mvp >= 2 && g.votiPagella >= VOTI_MINIMI_PAGELLA && g.mediaVoto >= 8`) |
| `s-mai-forfait` | Mai un forfait              | almeno 10 conferme rapide consecutive **e** almeno 15 presenze (`g.serieConferme >= 10 && g.presenze >= 15`)                                                 |
| `s-infermeria`  | Cliente VIP dell'Infermeria | almeno 3 eventi saltati per infortunio (`g.infortuni >= 3`)                                                                                                  |
| `s-ritardi`     | Aspettate, arrivo!          | almeno 5 ritardi a eventi (`g.ritardi >= 5`)                                                                                                                 |
| `s-cacche`      | Trono di ferro              | almeno 3 partite (campionato o amichevole) con 3 o più cacche pre-gara dichiarate (`g.cacche >= 3`)                                                          |

### Badge social (votati dai compagni, 5 categorie per partita)

Non hanno gradi: si "vince" o non si vince una categoria in una partita. `vincitoreCategoria()`
richiede un vantaggio netto sul secondo classificato, in parità nessun vincitore.
`badgeSocialVinti()` conta quante partite ha vinto ciascun giocatore in ogni categoria (non i
voti ricevuti).

| id           | nome                       | cosa premia                                      |
| ------------ | -------------------------- | ------------------------------------------------ |
| `affidabile` | Compagno affidabile        | sempre presente, sempre sul pezzo                |
| `spirito`    | Miglior spirito di squadra | carica il gruppo dal primo all'ultimo punto      |
| `fairplay`   | Fair play                  | rispetto per compagni, avversari e arbitro       |
| `meme`       | Meme della partita         | la scena più memorabile della partita            |
| `cuore`      | Cuore del gruppo           | chi tiene unita la squadra anche fuori dal campo |

---

## Regole rispettate

- **DD-007**: nessuna tabella `badge_sbloccati`, tutto calcolato a runtime dai dati
  esistenti.
- **DD-008**: nessun `BadgeDef` usa dati di reparto (punti/ace/muri); solo statistiche
  raggiungibili da qualunque ruolo.

---

## Copertura test

Tutti e 16 i badge hanno test unit (`test/unit/badges.test.ts`, `badge-social.test.ts`) e di
integration end-to-end sul database locale (`test/integration/*-badge.test.ts`,
`badge-social.test.ts`, più `scritture` e `permessi`). La logica pura sta in `badges.ts`; i test
verificano soglie inclusive (1→bronzo, soglia decimale 6.49 ≠ 6.5), confini dei badge segreti e
la soglia minima di voti della Pagella (`VOTI_MINIMI_PAGELLA`). Il dettaglio test per test lo
dicono i file, non questa pagina: leggili prima di cambiare una soglia.

### Riepilogo per badge

| #   | id                  | tipo    | test unit                     | test integration                              |
| --- | ------------------- | ------- | ----------------------------- | --------------------------------------------- |
| 1   | `mvp`               | normale | ✅                            | ✅ (`scritture`, `permessi`, `mvp-badge`)     |
| 2   | `pagella`           | normale | ✅ (incl. soglia minima voti) | ✅ (`scritture`, `permessi`, `pagella-badge`) |
| 3   | `palloni`           | normale | ✅                            | ✅ (`scritture`, `palloni-badge`)             |
| 4   | `presenze`          | normale | ✅                            | ✅ (`obiettivi`, `presenze-badge`)            |
| 5   | `serie-allenamenti` | normale | ✅                            | ✅ (`serie-allenamenti-badge`)                |
| 6   | `serie-conferme`    | normale | ✅ (vedi Limiti noti)         | ✅ (`serie-conferme-badge`)                   |
| 7   | `s-tiebreak`        | segreto | ✅ (soglia minima voti)       | ✅ (`s-tiebreak-badge`)                       |
| 8   | `s-mai-forfait`     | segreto | ✅                            | ✅ (`s-mai-forfait-badge`)                    |
| 9   | `s-infermeria`      | segreto | ✅                            | ✅ (`s-infermeria-badge`)                     |
| 10  | `s-ritardi`         | segreto | ✅                            | ✅ (`s-ritardi-badge`)                        |
| 11  | `s-cacche`          | segreto | ✅                            | ✅ (`s-cacche-badge`)                         |
| 12  | `affidabile`        | social  | ✅                            | ✅ (`scritture`, `permessi`, `badge-social`)  |
| 13  | `spirito`           | social  | ✅ (meccanismo generico)      | ✅ (meccanismo generico, `badge-social`)      |
| 14  | `fairplay`          | social  | ✅ (meccanismo generico)      | ✅ (meccanismo generico, `badge-social`)      |
| 15  | `meme`              | social  | ✅                            | ✅ (`badge-social`)                           |
| 16  | `cuore`             | social  | ✅                            | ✅ (autovoto, `badge-social`)                 |

---

## Problemi noti da sistemare

- **`badgeSbloccati()` morta** (`badges.ts:283-285`): duplica esattamente
  `collezioneBadge(g).sbloccati`. Zero riferimenti fuori dalla propria definizione, né in
  `src/` né nei test. Da rimuovere o documentare perché esiste (es. uso futuro/esterno).
- **`categoria` senza vincolo DB** in `badge_social_voti`: la colonna è `text NOT NULL` senza
  CHECK o FK verso i 5 id di `categorieSocial`
  (`supabase/migrations/20260803140647_affa1c11-fa92-450f-9f00-02d87195a6d9.sql:4`). I test
  stessi lo dimostrano scrivendo categorie inesistenti (`"sorriso"`/`"urlo"`,
  `scritture.test.ts`). Non sfruttabile da un utente normale (l'app manda solo le 5 categorie
  valide), stesso tipo di gap "solo applicativo, non a DB" del punto sotto sul votato/convocato.
- **`conteggioTurni()` non filtra per tipo evento** (`palloni-core.ts:70-82`), a differenza di
  `eventiPalloni()` che include solo partite e allenamenti. Un turno registrato per errore su
  un evento fuori dal dominio "richiede i palloni" conterebbe comunque per il badge Sherpa dei
  palloni. Rischio teorico basso — l'UI non offre questa combinazione, dato che
  `TurnoPalloni`/`completaTurni()`/i promemoria ora si fermano a `eventiPalloni()` — comportamento
  pinnato da un test dedicato in `palloni-core.test.ts` così che un domani, se serve stringere,
  non lo si scopra rompendo un test esistente ma leggendo perché quel test lo dimostrava apposta.

---

## Limiti noti

- **Dipendenza dal modulo [Serie](serie-presenze.md)**: i badge "Sempre in palestra",
  "Risposta lampo" e il segreto "Mai un forfait" si muovono solo se cambiano le serie. Le
  serie sono calcolate sui dati reali dalla migration `m9` in avanti, ma "Risposta lampo" e
  "Mai un forfait" dipendono da `serieConferme`, e `risposto_il` non è ricostruibile per le
  risposte precedenti a `m9`: su quelle righe la serie è un'approssimazione.
- Nessuno storico dei badge sbloccati: se cambiano le soglie o i dati sorgente, un badge già
  "ottenuto" può sparire o apparire retroattivamente.
- Notifiche "nuovo badge" solo locali al dispositivo (localStorage), si ripetono cambiando
  browser o dispositivo.

**Risolto (analisi del badge Sherpa dei palloni)**: prima `g.palloni` (`rosa.ts`) includeva
anche i turni che `completaTurni()` propone in automatico per un evento passato senza
assegnazione esplicita, non solo quelli confermati in `turni_palloni` — un giocatore poteva
vedere avanzare il badge senza aver mai confermato nulla, semplicemente perché l'algoritmo di
rotazione l'aveva proposto. Ora `rosa.ts` passa a `conteggioTurni()` solo `turniSalvati` (i
turni confermati), non l'output di `completaTurni()`: quest'ultimo resta in uso solo per la
UI di rotazione (`TurnoPalloni.tsx`, `PromemoriaPalloni.tsx`), mai per il conteggio del badge.
Dimostrato con dati veri in `palloni-badge.test.ts`. [palloni.md](palloni.md) aggiornato di
conseguenza.

**Risolto (audit completo dei 16 badge)**: `s-tiebreak` (`badges.ts:139`) usava `g.mediaVoto`
senza applicare `VOTI_MINIMI_PAGELLA`, a differenza del badge normale `pagella` che usa lo
stesso campo — un giocatore con un solo voto pagella altissimo e 2 MVP poteva sbloccare il
segreto senza che la media fosse statisticamente significativa. Ora `s-tiebreak` richiede anche
`g.votiPagella >= VOTI_MINIMI_PAGELLA`, dimostrato con dati reali in `s-tiebreak-badge.test.ts`.
Il badge `s-cacche` prometteva invece "partite di **campionato**" nella descrizione senza che
nessuna funzione della pipeline lo verificasse mai (`statisticheCacche()` conta qualunque
partita) — qui si è scelto di correggere la descrizione, non il codice: il comportamento
"qualunque partita conta" resta quello voluto, pinnato in `s-cacche-badge.test.ts`.

**Risolto (M13, `20260908120000_m13_convocati_e_pagelle_chiuse.sql`)**: prima la policy di M11
garantiva solo che il voto fosse firmato con il proprio `votante_id`, non che il votato (né il
votante) fossero convocati per quella partita — filtro solo applicativo, aggirabile scrivendo
direttamente su PostgREST. Ora `evento_permette_voto()` lo verifica anche a database per
`pagelle_voti`, `mvp_voti` e `badge_social_voti` (convocati vuoto = tutta la rosa, stessa
convenzione di `convocatiEvento()`), e per le sole pagelle verifica anche che
`eventi_app.pagelle_chiuse` sia falso — prima un voto "fuori tempo" restava tecnicamente
possibile bypassando l'interfaccia. Le policy admin restano permissive: un amministratore può
ancora correggere un voto anche fuori convocazione o dopo la chiusura.

---

## Evoluzioni possibili

- Sincronizzare lo stato "visto" su Supabase invece che solo in localStorage.
- Verificare sui dati di stagione che i tre badge legati alle serie si sblocchino davvero,
  ora che le serie sono calcolate.
- Rimuovere `badgeSbloccati()` (codice morto) o documentarne lo scopo.
- Aggiungere un vincolo (CHECK o FK) sulla colonna `categoria` di `badge_social_voti`.
- Se un domani serve restringere `conteggioTurni()` per tipo evento (vedi "Problemi noti"),
  aggiornare anche il test che oggi ne pinna il comportamento permissivo.
