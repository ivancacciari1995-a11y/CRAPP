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

Verifica badge per badge (fatta rileggendo codice e test riga per riga, non solo per
categoria). Due bug trovati in una sessione di audit dedicata su tutti i 16 badge (dettagli
nelle sezioni sotto e in "Problemi noti"): `s-tiebreak` non applicava la soglia minima di voti
di Pagellone (**corretto**), `s-cacche` prometteva "partite di campionato" senza che il codice
lo verificasse mai (**la descrizione è stata corretta**, il comportamento — qualunque partita
conta — era già quello voluto). Tutti e 16 i badge hanno ora copertura unit **e** integration
end-to-end completa.

**Badge normali** — `badges.ts` testa la propria funzione pura (soglia → grado,
`badges.test.ts`) sull'output di altri moduli:

- `mvp`: soglie inclusive verificate (1→bronzo, 3→argento, 99→resta oro,
  `badges.test.ts:44-48`), progresso a metà (`:52-56`).
- `pagella`: caso critico delle soglie decimali senza arrotondamento per eccesso — 6.4 →
  nessun grado, 6.5 → bronzo (`badges.test.ts:65-67`); un vero 6.49 non diventa "quasi
  bronzo". Più la soglia minima di voti (vedi sotto).
- `palloni`: soglie 3/6/10 testate esplicitamente (bronzo/argento/oro, confine incluso e
  oltre l'oro resta oro, `badges.test.ts:94-104`), oltre a un caso di progresso non tondo
  (5/6 → 83%). Pipeline end-to-end sotto, come `mvp`/`pagella`.
- `presenze`: soglie 5/15/30 testate esplicitamente (confine incluso, oltre l'oro resta oro,
  `badges.test.ts:108-116`). Pipeline end-to-end sotto, come `mvp`/`pagella`/`palloni`.
- `serie-allenamenti`: soglie 3/6/10 testate esplicitamente (confine incluso, oltre l'oro
  resta oro, `badges.test.ts:118-126`). Pipeline end-to-end sotto, come gli altri badge da
  tabella.
- `serie-conferme`: soglie 3/8/15 testate esplicitamente (confine incluso, oltre l'oro resta
  oro, `badges.test.ts:128-136`), oltre agli invarianti generali e a
  `collezioneBadge`/`prossimoTraguardo` con valori al massimo. Pipeline end-to-end sotto, come
  gli altri badge da tabella.

`mvp`, `pagella`, `palloni`, `presenze`, `serie-allenamenti` e `serie-conferme` sono le
eccezioni con integration dedicato (sotto) perché la loro fonte passa da una tabella di
voto/turni/presenze
letta e ricalcolata dal vivo, non da un contatore già pronto altrove.

**Badge segreti** — ognuno testato con la propria condizione esatta e il confine appena sotto:
`s-tiebreak` (mvp:1 non basta, mediaVoto 7.9 non basta, sotto `VOTI_MINIMI_PAGELLA` voti non
basta nemmeno con media alta — vedi il bug fix sotto), `s-mai-forfait` (ogni soglia isolata al
confine, non solo "entrambe servono"), `s-infermeria` (2 infortuni non bastano), `s-ritardi` (4
ritardi non bastano — gap colmato in questa sessione), `s-cacche` (2 cacche non bastano).
Copertura unit completa **e** integration dedicato per tutti e 5 (aggiunto in questa sessione,
vedi sotto): i dati sorgente hanno già i propri test di integrazione nei rispettivi moduli, ma
nessuno prima arrivava fino a `statoBadge()` sul segreto stesso con dati scritti a database.

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

**Badge Sherpa dei palloni — pipeline end-to-end, ora senza contare le proposte non
confermate** (analisi dedicata: trovato e sistemato il gap "le proposte contano", che
gonfiava il badge di turni mai confermati da nessuno — vedi "Problemi noti da sistemare"):

- Unit: `badges.test.ts:93-104` — soglie 3/6/10 (confine incluso, oltre l'oro resta oro) +
  `palloni-core.test.ts`, già completo prima di questa sessione (`completaTurni()`,
  `conteggioTurni()`, rotazione bilanciata su un giro completo di partite, allenamenti mai
  proposti in automatico, turno di un giocatore non più in rosa che non rompe il conteggio).
- Integration (`npx supabase start` richiesto):
  - `scritture.test.ts` — un turno resta uno per evento (l'upsert sostituisce, non aggiunge).
  - `palloni-badge.test.ts` — end-to-end reale: scrive eventi e turni **solo parzialmente
    confermati** su `eventi_app`/`turni_palloni`, rilegge via REST come fa `fetchTurni()`/
    `daRiga()` e passa `turniSalvati` (solo confermati, mai l'output di `completaTurni()`) a
    `conteggioTurni()` fino a `statoBadge()`: dimostra che un evento passato senza turno
    confermato **non conta per nessuno**, anche se un algoritmo di rotazione (usato altrove
    per la UI) lo proporrebbe automaticamente; verifica anche che un evento futuro non conti,
    pur avendo già una conferma.

**Badge Presenza fissa — pipeline end-to-end** (analisi dedicata: nessun bug trovato; a
differenza di MVP/pagelle/badge social, per questo badge **non serve** l'estensione RLS di
M13 — vedi sotto):

- Unit: `badges.test.ts:108-116` — soglie 5/15/30 (confine incluso, oltre l'oro resta oro) +
  `presenze.test.ts`, già molto completo prima di questa sessione (`contaPresenzeGiocatore()`
  con ritardo che conta come presenza, denominatore uguale per tutti, eventi futuri esclusi,
  filtro sui convocati, solo partite/allenamenti).
- Integration (`npx supabase start` richiesto):
  - `obiettivi.test.ts` — copre già `contaPresenzeGiocatore()` end-to-end per l'obiettivo
    "250 presenze complessive" (o3), la stessa funzione usata dal badge.
  - `presenze-badge.test.ts` (nuovo) — end-to-end reale sul badge: scrive eventi e risposte
    su `eventi_app`/`risposte_presenze`, rilegge via REST come fa `fetchPresenze()`/`daRiga()`
    e verifica che `statoBadge()` attraversi le tre soglie con dati veri (incluso un ritardo
    che conta come presenza e un'assenza che non conta). Dimostra anche che una risposta
    scritta per un evento senza convocazione **non conta comunque**, perché
    `contaPresenzeGiocatore()` filtra già per `convocati` lato applicazione — a differenza di
    MVP/pagelle/badge social, qui non serve una policy RLS aggiuntiva: il filtro è nella
    funzione pura che il badge consuma, non solo in UI.

**Badge Sempre in palestra — pipeline end-to-end** (analisi dedicata: nessun bug trovato).
Stessa fonte dati di `presenze` (`risposte_presenze`) ma logica diversa: non un totale, una
**serie consecutiva** che un buco azzera e un infortunio congela. Anche qui, come per
`presenze`, non serve nessuna estensione RLS: il filtro sui convocati è già nella funzione
pura.

- Unit: `badges.test.ts:118-126` — soglie 3/6/10 (confine incluso, oltre l'oro resta oro) +
  `presenze.test.ts`, già completo prima di questa sessione su `serieConsecutiva()` (buco che
  azzera, infortunio che congela invece di azzerare, nessuna risposta vale come buco,
  convocati che non spezzano la serie di chi non era coinvolto).
- Integration (`npx supabase start` richiesto):
  - `serie-allenamenti-badge.test.ts` (nuovo) — end-to-end reale: scrive allenamenti e
    risposte su `eventi_app`/`risposte_presenze`, rilegge via REST e verifica che
    `statoBadge()` attraversi bronzo/argento/oro con presenze consecutive vere, che
    un'assenza dopo 10 presenze di fila azzeri tutto (torna a nessun grado), e — separatamente
    — che un infortunio **non** azzeri la serie ma la lasci congelata (3 presenze vere,
    un infortunio nel mezzo saltato dal conteggio, poi ancora presente: la serie resta a 3,
    non riparte da 1).

**Badge Risposta lampo — pipeline end-to-end** (analisi dedicata: nessun bug trovato nella
logica di calcolo; l'unico limite è quello già noto e documentato sui dati pre-`m9`, vedi
"Limiti noti"). Il badge dipende da `serieConferme()`, che passa da due colonne facili da
confondere fra loro (`creato_il`/`risposto_il`, vedi [serie-presenze.md](serie-presenze.md)):
un integration test aggiunto per verificare che la mappatura verso `creatoIl`/`tempi` regga con
dati reali, non solo con timestamp scelti a mano — cosa che i test unitari, che non toccano il
database, non possono garantire.

- Unit: `badges.test.ts:128-136` — soglie 3/8/15 (confine incluso, oltre l'oro resta oro) +
  `presenze.test.ts`, esteso in questa sessione su `serieConferme()`: oltre al buco che azzera
  e all'evento senza `creatoIl` che viene saltato (già presenti), ora anche un evento convocato
  solo per un altro giocatore che non spezza la serie, partite e allenamenti sommati nella
  stessa serie, il confronto inclusivo esattamente a 24h (dentro conta, un secondo oltre
  azzera), e un evento futuro che non entra ancora nel calcolo.
- Integration (`npx supabase start` richiesto):
  - `serie-conferme-badge.test.ts` (nuovo) — end-to-end reale: scrive eventi con `creato_il`
    esplicito e risposte con `risposto_il` esplicito su `eventi_app`/`risposte_presenze`,
    rilegge via REST come fa `daRiga()`/`fetchPresenze()` e verifica che `statoBadge()`
    attraversi bronzo/argento/oro con conferme rapide vere, che una risposta arrivata oltre le
    24h azzeri tutto anche dopo 15 conferme di fila, e — separatamente — che partite e
    allenamenti si sommino nella stessa serie senza bisogno di un filtro per tipo.

**Badge Cliente VIP dell'Infermeria e Aspettate, arrivo! — pipeline end-to-end** (analisi
dedicata: nessun bug trovato). Stessa fonte (`contaInfortuni()`/`contaRitardi()` in
`src/lib/infortuni.ts`, entrambe sopra la stessa `contaStato()` privata) e stessa struttura di
`serie-allenamenti`/`serie-conferme`, ma senza serie: un contatore semplice di eventi passati.

- Unit: `badges.test.ts` (soglie 3 e 5, confine appena sotto) + `infortuni.test.ts`, esteso in
  questa sessione con un giocatore che ha **sia** un infortunio **sia** un ritardo (su eventi
  diversi): i due conteggi restano indipendenti, nessuno "ruba" voci all'altro.
- Integration (`npx supabase start` richiesto):
  - `s-infermeria-badge.test.ts` / `s-ritardi-badge.test.ts` (nuovi) — end-to-end reali: scrivono
    eventi e risposte "infortunato"/"ritardo" su `eventi_app`/`risposte_presenze`, rileggono via
    REST e verificano che il segreto resti bloccato appena sotto soglia e si sblocchi
    esattamente al confine (3 infortuni, 5 ritardi).

**Badge Trono di ferro — pipeline end-to-end, descrizione corretta** (analisi dedicata: trovato
un disallineamento fra descrizione e codice, **risolto aggiornando il testo**, non la logica —
vedi "Problemi noti" più sotto per il perché). `statisticheCacche()` (`src/lib/cacche.ts`) non
ha mai distinto partite di campionato da amichevoli: contava (e conta ancora) qualunque partita
con 3+ cacche dichiarate. La vecchia descrizione del badge prometteva "partite di campionato",
cosa che il codice non ha mai verificato — corretta in "partite (campionato o amichevole)".

- Unit: `badges.test.ts` (soglia 3, confine appena sotto — gap colmato in questa sessione) +
  `cacche.test.ts` (già completo su `giornateTop`).
- Integration (`npx supabase start` richiesto):
  - `s-cacche-badge.test.ts` (nuovo) — end-to-end reale: scrive 2 giornate da record su partite
    di campionato e una su un'amichevole, dimostrando con dati veri che l'amichevole conta
    esattamente come le altre — pin del comportamento attuale, così chi in futuro reintroduce un
    filtro sul campionato deve accorgersene qui, non scoprirlo in produzione.

**Badge Uomo tie-break — pipeline end-to-end, bug corretto** (analisi dedicata: trovato e
sistemato il gap "un voto pagella solo sblocca il segreto insieme a 2 MVP"). Il segreto usa
`g.mediaVoto`, lo stesso campo del badge normale `pagella` — che però lo azzera sotto
`VOTI_MINIMI_PAGELLA` (5) voti ricevuti, proprio per evitare che un singolo voto sblocchi/tolga
il badge senza significatività statistica. `s-tiebreak` non applicava lo stesso filtro: ora sì
(`g.mvp >= 2 && g.votiPagella >= VOTI_MINIMI_PAGELLA && g.mediaVoto >= 8`).

- Unit: `badges.test.ts` — sotto la soglia minima di voti il segreto resta bloccato anche con
  media 8 e 2 MVP; un solo MVP non basta (isolato dal resto).
- Integration (`npx supabase start` richiesto):
  - `s-tiebreak-badge.test.ts` (nuovo) — end-to-end reale: scrive voti MVP e pagella veri,
    dimostra che un solo voto pagella (media alta, 2 MVP) NON sblocca il segreto, e che il quinto
    voto lo sblocca — il fix verificato con la stessa pipeline `mvp_voti`/`pagelle_voti` → REST →
    `mvpVintiPerGiocatore()`/`mediePagelle()` → `statoBadge()` che userebbe l'app.

**Badge Mai un forfait — pipeline end-to-end** (analisi dedicata: nessun bug trovato). Unico
segreto a combinare due statistiche indipendenti (`serieConferme()` e
`contaPresenzeGiocatore()`), entrambe già testate a fondo nei rispettivi moduli.

- Unit: `badges.test.ts`, esteso in questa sessione con ogni soglia isolata al confine
  (`serieConferme` appena sotto con `presenze` abbondanti, e viceversa), non solo "insieme non
  bastano".
- Integration (`npx supabase start` richiesto):
  - `s-mai-forfait-badge.test.ts` (nuovo) — end-to-end reale: scrive eventi con `creato_il` e
    risposte con `risposto_il` veri, verifica che il segreto resti bloccato a 9/9 e si sblocchi a
    15/15, e che una risposta lenta azzeri la serie di conferme **senza** azzerare le presenze
    già accumulate (le due statistiche restano indipendenti anche a database).

**Badge social** — nessuna delle 5 categorie ha logica _propria_ nel codice: l'id è solo una
chiave di raggruppamento, `conteggioCategoria`/`vincitoreCategoria`/`badgeSocialVinti` sono
identici per tutte (`badge-social.ts:107-158`). Testare a fondo 2-3 categorie copre l'intero
meccanismo:

- Unit (`badge-social.test.ts`): conteggio isolato per match+categoria (`:29-32`), vantaggio
  netto/parità → nessun vincitore (`:38-41`), vittorie multi-partita (`badgeSocialVinti`, g2
  vince in `m1` e `m2` → `{affidabile: 2}`, `:48`), zero voti → zero badge (`:51`). Estesi in
  questa sessione: un voto totale solo basta a vincere, una parità a 3 candidati (i primi due
  pari, il terzo staccato) resta senza vincitore, categorie diverse nella stessa partita non si
  mischiano in `badgeSocialVinti()`.
- Integration: upsert/sostituzione voto per categoria (`scritture.test.ts:170-202`), autovoto
  rifiutato — doppia barriera UI + database (`scritture.test.ts:124-148`), RLS `m11` — un
  giocatore firma solo il proprio voto (`permessi.test.ts:344-369`).
  - `badge-social.test.ts` (nuovo, in `test/integration/`) — end-to-end reale sulle **5
    categorie effettive** di `categorieSocial` (non più solo 2-3, e non più le categorie
    inventate di `scritture.test.ts`): scrive voti veri su `badge_social_voti`, dimostra che
    tutte e 5 si contano e si vincono allo stesso modo, e che una parità su una categoria non
    tocca il conteggio delle altre 4 nella stessa partita.

### Riepilogo per badge

| #   | id                  | tipo    | test unit                             | test integration                              |
| --- | ------------------- | ------- | ------------------------------------- | --------------------------------------------- |
| 1   | `mvp`               | normale | ✅                                    | ✅ (`scritture`, `permessi`, `mvp-badge`)     |
| 2   | `pagella`           | normale | ✅ (incl. soglia minima voti)         | ✅ (`scritture`, `permessi`, `pagella-badge`) |
| 3   | `palloni`           | normale | ✅                                    | ✅ (`scritture`, `palloni-badge`)             |
| 4   | `presenze`          | normale | ✅                                    | ✅ (`obiettivi`, `presenze-badge`)            |
| 5   | `serie-allenamenti` | normale | ✅                                    | ✅ (`serie-allenamenti-badge`)                |
| 6   | `serie-conferme`    | normale | ✅ (limite noto sotto)                | ✅ (`serie-conferme-badge`)                   |
| 7   | `s-tiebreak`        | segreto | ✅ (bug corretto, vedi sotto)         | ✅ (`s-tiebreak-badge`)                       |
| 8   | `s-mai-forfait`     | segreto | ✅                                    | ✅ (`s-mai-forfait-badge`)                    |
| 9   | `s-infermeria`      | segreto | ✅                                    | ✅ (`s-infermeria-badge`)                     |
| 10  | `s-ritardi`         | segreto | ✅                                    | ✅ (`s-ritardi-badge`)                        |
| 11  | `s-cacche`          | segreto | ✅ (descrizione corretta, vedi sotto) | ✅ (`s-cacche-badge`)                         |
| 12  | `affidabile`        | social  | ✅                                    | ✅ (`scritture`, `permessi`, `badge-social`)  |
| 13  | `spirito`           | social  | ✅ (meccanismo generico)              | ✅ (meccanismo generico, `badge-social`)      |
| 14  | `fairplay`          | social  | ✅ (meccanismo generico)              | ✅ (meccanismo generico, `badge-social`)      |
| 15  | `meme`              | social  | ✅                                    | ✅ (`badge-social`)                           |
| 16  | `cuore`             | social  | ✅                                    | ✅ (autovoto, `badge-social`)                 |

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
  `eventiPalloni()` che scarta i compleanni. Un turno registrato per errore su un evento fuori
  dal dominio "richiede i palloni" conterebbe comunque per il badge Sherpa dei palloni. Rischio
  teorico basso (l'UI non offre questa combinazione), comportamento pinnato da un test dedicato
  in `palloni-core.test.ts` così che un domani, se serve stringere, non lo si scopra rompendo un
  test esistente ma leggendo perché quel test lo dimostrava apposta.

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
