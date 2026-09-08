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
  Pagellone, l'MVP e i badge social.
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

| id | nome | come si guadagna | soglie B/A/O |
| --- | --- | --- | --- |
| `mvp` | MVP | partite vinte nettamente al voto MVP dei compagni (`g.mvp`, vedi pipeline sopra) | 1 / 3 / 5 |
| `pagella` | Pagellone | media dei voti pagella ricevuti dai compagni a fine partita (`g.mediaVoto`), solo se ne ha ricevuti almeno `VOTI_MINIMI_PAGELLA` (5) | 6.5 / 7.5 / 8.5 |
| `palloni` | Sherpa dei palloni | quante volte ti sei incaricato di portare la sacca palloni (`g.palloni`) | 3 / 6 / 10 |
| `presenze` | Presenza fissa | totale presenze a eventi/partite in stagione (`g.presenze`) | 5 / 15 / 30 |
| `serie-allenamenti` | Sempre in palestra | allenamenti consecutivi presenti, senza saltarne uno (`g.serieAllenamenti`) | 3 / 6 / 10 |
| `serie-conferme` | Risposta lampo | conferme di presenza consecutive date entro 24h dalla convocazione (`g.serieConferme`) | 3 / 8 / 15 |

### Badge segreti (booleani, nascosti finché non sbloccati)

Stesso motore dei normali ma con soglie `{bronzo:1, argento:1, oro:1}`: `valore(g)` è 0 o 1,
quindi il badge è "trovato o no", mai graduato. In UI compaiono con icona lucchetto finché non
sbloccati.

| id | nome | condizione esatta |
| --- | --- | --- |
| `s-tiebreak` | Uomo tie-break | almeno 2 MVP **e** media pagella ≥ 8 (`g.mvp >= 2 && g.mediaVoto >= 8`) |
| `s-mai-forfait` | Mai un forfait | almeno 10 conferme rapide consecutive **e** almeno 15 presenze (`g.serieConferme >= 10 && g.presenze >= 15`) |
| `s-infermeria` | Cliente VIP dell'Infermeria | almeno 3 eventi saltati per infortunio (`g.infortuni >= 3`) |
| `s-ritardi` | Aspettate, arrivo! | almeno 5 ritardi a eventi (`g.ritardi >= 5`) |
| `s-cacche` | Trono di ferro | almeno 3 partite di campionato con 3 o più cacche pre-gara dichiarate (`g.cacche >= 3`) |

### Badge social (votati dai compagni, 5 categorie per partita)

Non hanno gradi: si "vince" o non si vince una categoria in una partita. `vincitoreCategoria()`
richiede un vantaggio netto sul secondo classificato, in parità nessun vincitore.
`badgeSocialVinti()` conta quante partite ha vinto ciascun giocatore in ogni categoria (non i
voti ricevuti).

| id | nome | cosa premia |
| --- | --- | --- |
| `affidabile` | Compagno affidabile | sempre presente, sempre sul pezzo |
| `spirito` | Miglior spirito di squadra | carica il gruppo dal primo all'ultimo punto |
| `fairplay` | Fair play | rispetto per compagni, avversari e arbitro |
| `meme` | Meme della partita | la scena più memorabile della partita |
| `cuore` | Cuore del gruppo | chi tiene unita la squadra anche fuori dal campo |

---

## Regole rispettate

- **DD-007**: nessuna tabella `badge_sbloccati`, tutto calcolato a runtime dai dati
  esistenti.
- **DD-008**: nessun `BadgeDef` usa dati di reparto (punti/ace/muri); solo statistiche
  raggiungibili da qualunque ruolo.

---

## Copertura test

Verifica badge per badge (fatta rileggendo codice e test riga per riga, non solo per
categoria): nessun bug trovato nella logica di calcolo di nessuno dei 16 badge.

**Badge normali** — `badges.ts` testa la propria funzione pura (soglia → grado,
`badges.test.ts`) sull'output di altri moduli:
- `mvp`: soglie inclusive verificate (1→bronzo, 3→argento, 99→resta oro,
  `badges.test.ts:44-48`), progresso a metà (`:52-56`).
- `pagella`: caso critico delle soglie decimali senza arrotondamento per eccesso — 6.4 →
  nessun grado, 6.5 → bronzo (`badges.test.ts:65-67`); un vero 6.49 non diventa "quasi
  bronzo". Più la soglia minima di voti (vedi sotto).
- `palloni`, `presenze`, `serie-allenamenti`, `serie-conferme`: stessa funzione di soglia già
  testata a fondo su `mvp`/`pagella`, coperti dagli invarianti generali
  (`badges.test.ts:154-159`: soglie crescenti, testi presenti, id unici) e da
  `collezioneBadge`/`prossimoTraguardo` con valori al massimo (`:119-144`).
- Nessun integration dedicato per questi 4: non toccano il database, le statistiche sorgente
  (`presenze.test.ts`, `palloni-core.test.ts`, ecc.) sono già coperte nei rispettivi moduli.
  `mvp` e `pagella` fanno eccezione (sotto) perché la loro fonte passa da una tabella di voto.

**Badge segreti** — ognuno testato con la propria condizione esatta e il confine appena sotto
(`badges.test.ts:77-109`): `s-tiebreak` (mediaVoto 7.9 non basta, serve 8), `s-mai-forfait`
(unica condizione doppia, testato che **entrambe** servano), `s-infermeria`, `s-ritardi`,
`s-cacche`. Copertura unit completa; integration non necessario per lo stesso motivo dei
normali (le statistiche sorgente sono testate nei rispettivi moduli).

**Badge MVP — pipeline end-to-end** (aggiunta in una sessione dedicata a completare la
copertura di questo badge):
- Unit: `badges.test.ts` (soglie/gradi) + `mvp-voti.test.ts` (conteggio partita, vincitore con
  vantaggio netto, parità che non assegna, apertura voto 2h dopo il fischio d'inizio).
- Integration (`npx supabase start` richiesto):
  - `scritture.test.ts` — semantica dell'`upsert` di `mvp_voti` (un voto per
    partita/votante, l'ultimo sostituisce) e rifiuto dell'autovoto a database
    (`mvp_no_autovoto`).
  - `permessi.test.ts` — RLS di `m11`: il proprio voto MVP si registra (caso positivo), non
    si può votare a nome di un altro (caso negativo); RLS di `m13` (sotto): un votante o un
    votato non convocati vengono rifiutati.
  - `mvp-badge.test.ts` — end-to-end reale: scrive voti su `mvp_voti`, rilegge via REST come
    fa `useVotiMvp()`, calcola `mvpVintiPerGiocatore()` e verifica che `statoBadge()` assegni
    il grado corretto (bronzo a 1-2 vittorie nette, argento a 3), incluso un pareggio che non
    deve contare come vittoria.

**Badge Pagellone — pipeline end-to-end e soglia minima di voti** (stessa sessione di sopra,
dopo l'analisi che ha trovato il gap "un voto solo sblocca il badge"):
- Unit: `badges.test.ts:69-88` — sotto `VOTI_MINIMI_PAGELLA` (5) il badge resta bloccato anche
  con `mediaVoto: 10`; esattamente a 5 la media torna a contare; sopra soglia valgono le
  normali soglie di grado (`mediaVoto: 6.5` con 5 voti → bronzo, non oro).
- Integration (`npx supabase start` richiesto):
  - `scritture.test.ts` — semantica dell'`upsert` di `pagelle_voti` e rifiuto dell'autovoto
    (`pagelle_no_autovoto`), già presente prima di questa sessione.
  - `permessi.test.ts` — RLS di `m13`: un votante o un votato non convocati vengono rifiutati
    (per tutte e tre le tabelle di voto, non solo le pagelle), e un voto pagella dopo
    `pagelle_chiuse` viene rifiutato anche a database, non solo nascosto in UI.
  - `pagella-badge.test.ts` (nuovo) — end-to-end reale: scrive voti su `pagelle_voti`, rilegge
    via REST come fa `usePagelle()`, calcola `mediePagelle()` e verifica che `statoBadge()`
    tenga il badge bloccato sotto soglia, lo sblocchi al voto minimo con il grado giusto, e
    applichi le soglie normali sopra soglia.

**Badge social** — nessuna delle 5 categorie ha logica *propria* nel codice: l'id è solo una
chiave di raggruppamento, `conteggioCategoria`/`vincitoreCategoria`/`badgeSocialVinti` sono
identici per tutte (`badge-social.ts:107-158`). Testare a fondo 2-3 categorie copre l'intero
meccanismo:
- Unit (`badge-social.test.ts`): conteggio isolato per match+categoria (`:29-32`), vantaggio
  netto/parità → nessun vincitore (`:38-41`), vittorie multi-partita (`badgeSocialVinti`, g2
  vince in `m1` e `m2` → `{affidabile: 2}`, `:48`), zero voti → zero badge (`:51`).
- Integration: upsert/sostituzione voto per categoria (`scritture.test.ts:170-202`), autovoto
  rifiutato — doppia barriera UI + database (`scritture.test.ts:124-148`), RLS `m11` — un
  giocatore firma solo il proprio voto (`permessi.test.ts:344-369`).

### Riepilogo per badge

| # | id | tipo | test unit | test integration |
| - | --- | --- | --- | --- |
| 1 | `mvp` | normale | ✅ | ✅ (`scritture`, `permessi`, `mvp-badge`) |
| 2 | `pagella` | normale | ✅ (incl. soglia minima voti) | ✅ (`scritture`, `permessi`, `pagella-badge`) |
| 3 | `palloni` | normale | ✅ | non necessario |
| 4 | `presenze` | normale | ✅ | non necessario |
| 5 | `serie-allenamenti` | normale | ✅ (limite noto sotto) | non necessario |
| 6 | `serie-conferme` | normale | ✅ (limite noto sotto) | non necessario |
| 7 | `s-tiebreak` | segreto | ✅ | non necessario |
| 8 | `s-mai-forfait` | segreto | ✅ | non necessario |
| 9 | `s-infermeria` | segreto | ✅ | non necessario |
| 10 | `s-ritardi` | segreto | ✅ (parziale, manca "appena sotto") | non necessario |
| 11 | `s-cacche` | segreto | ✅ (parziale, manca "appena sotto") | non necessario |
| 12 | `affidabile` | social | ✅ | ✅ |
| 13 | `spirito` | social | ✅ (meccanismo generico) | ✅ (meccanismo generico) |
| 14 | `fairplay` | social | ✅ (meccanismo generico) | ✅ (meccanismo generico) |
| 15 | `meme` | social | ✅ | ✅ |
| 16 | `cuore` | social | ✅ | ✅ (autovoto) |

---

## Problemi noti da sistemare

Trovati in audit, nessuno bloccante (nessun bug nella logica di calcolo):

- **`badgeSbloccati()` morta** (`badges.ts:283-285`): duplica esattamente
  `collezioneBadge(g).sbloccati`. Zero riferimenti fuori dalla propria definizione, né in
  `src/` né nei test. Da rimuovere o documentare perché esiste (es. uso futuro/esterno).
- **`categoria` senza vincolo DB** in `badge_social_voti`: la colonna è `text NOT NULL` senza
  CHECK o FK verso i 5 id di `categorieSocial`
  (`supabase/migrations/20260803140647_affa1c11-fa92-450f-9f00-02d87195a6d9.sql:4`). I test
  stessi lo dimostrano scrivendo categorie inesistenti (`"sorriso"`/`"urlo"`,
  `scritture.test.ts`). Non sfruttabile da un utente normale (l'app manda solo le 5 categorie
  valide), stesso tipo di gap "solo applicativo, non a DB" del punto sotto sul votato/convocato.

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
