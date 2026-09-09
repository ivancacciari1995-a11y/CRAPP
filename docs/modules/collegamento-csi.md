# Modulo — Collegamento CSI

**Stato:** implementato (stagione 2025/26)
**Route interessate:** `/classifica` (classifica e storico), `/partita/$id` e `/partita-csi/$id`
(dettaglio di una gara: formazioni e scontri diretti)

---

## Obiettivo

Mostrare nell'app la classifica e i risultati **ufficiali** del campionato CSI, al posto
dei dati dimostrativi hardcoded in `crapp-data.ts`. Nessun inserimento manuale da parte
degli amministratori: è esattamente il tipo di lavoro amministrativo che CrAPP deve togliere.

---

## Sorgente dati

Portale **Livescore CSI Bologna** (`https://livescore.csibologna.it`).

Il portale **non espone un'API pubblica documentata**. Vengono usati gli stessi endpoint
che il sito chiama internamente via ajax: sono raggiungibili senza autenticazione e senza
API key, ma **non offrono alcuna garanzia di stabilità**.

Le pagine "umane" (`league_details.php`, `team_details.php`) sono gusci lato server: non
contengono dati, li caricano dopo via JS dagli stessi endpoint `components/*.php` —
verificato leggendo `assets/js/project.js` e `assets/js/team.js`, referenziati in fondo
alle due pagine. Servono solo per la consultazione manuale nel browser (es. per ritrovare
un `project_id`), nessun codice le chiama direttamente.

### Identificativi (stagione 2025/26)

| Cosa                  | Valore                                 |
| ---------------------- | ---------------------------------------- |
| Campionato             | PVM - Campionato Open Misto Eccellenza |
| `project_id` (girone)  | `767`                                  |
| Coppa                  | PVM Coppa CSI Misto Silver             |
| `project_id` (coppa)   | `848`                                  |
| Squadra sul portale    | `C.R.A.P. Volley` (con i punti)        |
| `team_id`              | `3359`                                 |
| Girone                 | B                                      |

`project_id` (767), `CSI_COPPA_PROJECT_ID` (848) e `team_id` (3359) sono costanti in
`src/lib/csi-core.ts`.

Per ritrovare questi id a ogni cambio stagione: `components/team-main.php?team_id=3359`
(dietro `team_details.php`) contiene una sezione "Campionati" con un link
`league_details.php?project_id=…` per ogni competizione a cui la squadra è iscritta —
verificato chiamando l'endpoint direttamente, che oggi restituisce sia
`project_id=848` (Coppa) sia `project_id=767` (Campionato). Non serve aprire
`team_details.php` nel browser, questo componente basta.

### Endpoint usati dall'app

| Endpoint                                          | Formato | Uso                                | Pagina "umana" corrispondente     |
| -------------------------------------------------- | ------- | ------------------------------------ | ------------------------------------ |
| `components/project-sheets.php?project_id=767`    | HTML    | Classifica completa dei due gironi di campionato | `league_details.php?project_id=767` (tab "Classifica") |
| `components/project-sheets.php?project_id=848`    | HTML    | Classifica del girone di Coppa (solo fase a gironi, vedi limite 4) | `league_details.php?project_id=848` (tab "Classifica") |
| `assets/json/getEventsByTeamId.php?team_id=3359`  | JSON    | Tutte le gare della squadra        | `team_details.php?team_id=3359` (tab "Calendario", `team-calendar.php`) |

**Formato di `project-sheets.php`** — tabella HTML per girone (una per `<table>`,
`parseClassifica()` in `csi-core.ts` prende quella che contiene il nome della squadra).
Colonne per `<td>` (0-indicizzate): `0` Pos · `1` Squadra (nome + logo + link a
`team_details.php?team_id=…`) · `2` Punti · `3` Partite giocate · `4` Vinte · `5` Perse ·
`6`-`7` Tie-break vinti/persi (non lette) · `8` Set fatti · `9` Set subiti · poi punti
fatti/subiti, quoziente, ultime cinque (non lette). Stessa struttura per `project_id=767`
(campionato) e `project_id=848` (fase a gironi della Coppa): `parseClassifica()` è
condivisa, nessun parser dedicato per la Coppa.

**Formato di `getEventsByTeamId.php`** — array JSON, un oggetto per gara (girone **e**
Coppa insieme, vedi limite 4), con: `id`, `start` (`"2025-11-12T22:00:00"`, data+ora
locale), `team1`/`team2` (nomi squadre), `result` (`"3 - 1"`, stringa libera), `partials`
(`"25 - 23</br>23 - 25</br>..."`, HTML nei separatori), `field` (impianto), `project`
(nome campionato, es. `"PVM - Coppa CSI Misto Silver"` — usato per distinguere le
competizioni, vedi limite 4), `league`, `group` (es. `"Girone B"`), `match_number`. Letto
da `partiteDaEventi()` in `csi-core.ts`, che estrae punteggio/parziali con le regex
`punteggio()`/`parziali()` — vedi limite 5 sui rischi di questo parsing.

**Campi leggeri aggiuntivi letti dallo stesso JSON** (nessuna fetch in più, solo campi in
più letti dallo stesso `evento`): `team1_logo`/`team2_logo` (URL del logo, quello
dell'avversario finisce in `PartitaCsi.logoAvversario`), `group` (girone, es. `"Girone
B"`), `match_number` (n° gara, es. `"5/XEB"`), `referees` (arbitro, spesso vuoto), `link`
(URL del referto ufficiale, `match_details.php?id=…`).

Altri endpoint disponibili ma non usati: `getEventsByProjectIdHierarchical.php` (tutte le
gare del campionato), `project-chart-rankings.php` (solo punti), `project-next_matches.php`,
`project-last_results.php`, `project-sheets-scorers.php`/`-results.php`/`-measures.php`
(sotto-tab di `project-sheets`: marcatori, risultati per giornata, provvedimenti
disciplinari), `team-roster.php` (rosa), `team-staff.php`, `team-results.php`,
`team-scorers.php`.

### Dettaglio di una singola gara (formazioni e scontri diretti)

Il referto di ogni gara sul portale (`match_details.php?id=<matchId>`, dove `matchId` è lo
stesso `id` restituito da `getEventsByTeamId.php`) carica a sua volta tre componenti via
`assets/js/match.js`:

| Endpoint                                      | Formato | Uso                                                    |
| ----------------------------------------------- | ------- | --------------------------------------------------------- |
| `components/match-main.php?match_id=<id>`     | HTML    | Giornata e una nota libera sotto l'impianto            |
| `components/match-players.php?match_id=<id>`  | HTML    | Formazioni: titolari, panchina, staff di entrambe le squadre |
| `components/match-stats.php?match_id=<id>`    | HTML    | Storico scontri diretti e probabilità di vittoria calcolata dal CSI |

Altri due componenti della stessa pagina non sono usati: `match-live.php` (diretta testuale
punto-per-punto, utile solo a gara in corso) e la lista dettagliata dei precedenti dentro
`historyModal` in `match-stats.php` (un elenco partita-per-partita meno affidabile del
riepilogo aggregato — vedi sotto).

**`match-main.php`** — `parseInfoPartita()` (`csi-core.ts`) legge: la giornata (es. `"2ª
Giornata"`, assente per gare fuori dal girone come la finale di Coppa) e una nota libera
sotto l'impianto (`nota`). Quella nota **non ha un formato fisso**: a volte è `"Pubblico
non ammesso"`, a volte il nome della palestra, a volte altro — va mostrata così com'è, non
interpretata come un flag booleano.

**`match-players.php`** — `parseFormazioni()` legge due blocchi `<div class="col-12
col-md-6 mt-4">`, separati nel markup dal commento `<!-- SQUADRA OSPITE -->`, ciascuno con
una `<ul class="list-group">` di giocatori in ordine titolari → divisore "A DISPOSIZIONE"
→ panchina → divisore "STAFF" → staff (numero maglia, nome, ruolo; lo staff ha la stessa
struttura ma senza numero). Quale dei due blocchi sia "noi" si riconosce con
`isNostraSquadra()`, non assumendo un ordine fisso casa/ospite — verificato che l'ordine
nel markup è sempre "squadra casa" prima e "squadra ospite" dopo, ma il codice non si fida
di questo per evitare sorprese. `null` se nessuno dei due nomi è la nostra squadra
(referto non ancora compilato o formato cambiato).

**`match-stats.php`** — `parsePrecedenti()` legge il blocco di riepilogo in fondo alla
pagina (non la lista `historyModal` partita-per-partita, che in un caso osservato conteneva
gare di **altre squadre** senza relazione con la gara corrente — dato non affidabile da
interpretare): numero di precedenti, vittorie totali/in casa/fuori di entrambe, probabilità
di vittoria calcolata dal CSI. **Attenzione a un'insidia verificata sui dati reali**: le
due barre di probabilità sono colorate per chi è favorito (verde = più alta, rosso = più
bassa), **non** per casa/ospite — un parser ingenuo che associasse il verde alla squadra
casa sbaglierebbe metà delle volte. Il parser usa invece l'ordine di apparizione nel
markup (prima barra = squadra casa, seconda = ospite), coerente con l'ordine dei blocchi
"Squadra casa"/"Squadra ospite" più sopra nella stessa pagina. Con "0 precedenti" il CSI
omette del tutto le righe vittorie/in-casa/fuori (restano a `0`) ma la probabilità resta
comunque presente: `parsePrecedenti()` distingue quindi "0 precedenti" (oggetto valido con
`totale: 0`) da "formato non riconosciuto" (`null`, solo se nessuno dei due nomi squadra è
identificabile).

**Formato di `DettaglioPartitaCsi`** (il JSON che compongono insieme):
`{ giornata, nota, formazioni: { noi, avversario } | null, precedenti: PrecedentiCsi | null
}`, dove ogni `FormazioneSquadra` è `{ squadra, titolari: GiocatoreFormazione[], panchina,
staff: StaffFormazione[] }` e `GiocatoreFormazione` è `{ numero, nome, ruolo }`.

---

## Implementazione

```
CSI (portale)
      ↓  fetch server-side, cache 6 ore
/api/public/csi              → src/routes/api/public/csi.ts
      ↓  JSON { classifica, classificaCoppa, partite, girone, aggiornato }
useCsi()                     → src/lib/csi.ts (React Query, staleTime 6h)
      ↓
/classifica                  → src/routes/classifica.tsx (tab "Classifica": Coppa sopra, Girone
                                sotto; tab "Storico partite": ogni squadra col proprio logo,
                                chevron di dettaglio sulle gare cliccabili)

CSI (portale, 3 endpoint)
      ↓  fetch server-side on-demand, cache per-partita 6 ore
/api/public/csi-partita/$id  → src/routes/api/public/csi-partita.$id.ts
      ↓  JSON DettaglioPartitaCsi { giornata, nota, formazioni, precedenti }
useCsiPartita()              → src/lib/csi-partita.ts (React Query, staleTime 6h)
      ↓
DettaglioCsiEsteso           → src/components/crapp/DettaglioCsi.tsx (formazioni + scontri diretti)
      ↓
/partita/$id (evento CrAPP collegato) o /partita-csi/$id (nessun evento collegato)
```

- **`src/lib/csi-core.ts`** — costanti, tipi e funzioni pure: `parseClassifica()` (HTML → righe,
  usata sia per `classifica` sia per `classificaCoppa`), `partiteDaEventi()` (JSON → partite),
  `isNostraSquadra()`, `partiteGiocate()`, `matchDaPartitaCsi()` (porta i campi leggeri —
  logo, girone, n° gara, arbitro, link — nella forma usata dalle liste), `parseInfoPartita()`,
  `parseFormazioni()`, `parsePrecedenti()` (vedi sezione precedente).
- **`src/routes/api/public/csi.ts`** — unica route che contatta il CSI per classifica e
  partite: tre fetch in parallelo (classifica girone, classifica Coppa, partite). Cache in
  memoria di 6 ore; in caso di errore restituisce l'ultimo dato buono (`503` solo se non ne
  esiste uno). Se solo la Coppa fallisce (`scarica(...).catch(() => "")`) la risposta resta
  comunque `200` con `classificaCoppa: []`: è un dato supplementare, non blocca la classifica
  del girone.
- **`src/routes/api/public/csi-partita.$id.ts`** — route separata per il dettaglio di una
  singola gara: tre fetch in parallelo (`match-main`/`match-players`/`match-stats.php`). Cache
  in memoria **per `matchId`** (una `Map`, non un singolo valore come `csi.ts`), stessa
  finestra di 6 ore. A differenza di `/api/public/csi`, qui un fallimento del fetch è fatale
  (`503`, nessun fallback "meglio un dato vecchio"): non c'è ancora una cache da riusare la
  prima volta che qualcuno apre una gara, e un errore upstream reale (verificato: CSI risponde
  `500` su `match-stats.php` per un `match_id` inventato) va distinto da "gara senza
  formazioni ancora pubblicate" (quell'endpoint risponde `200` con markup vuoto, gestito da
  `parseFormazioni()`/`parsePrecedenti()` restituendo `null`, non da un errore HTTP).
- **`src/lib/csi.ts`** / **`src/lib/csi-partita.ts`** — hook client React Query, stessa
  `staleTime` di 6h. `useCsiPartita(matchId)` è `enabled` solo quando `matchId` è definito:
  va montato solo nel dettaglio di una gara, mai in una lista (altrimenti sarebbe una fetch
  per riga, vedi "Regole rispettate" sotto).
- **`src/components/crapp/DettaglioCsi.tsx`** — UI condivisa tra `/partita/$id` e
  `/partita-csi/$id`: `LogoSquadra` (logo con hotlink diretto al portale CSI, si nasconde da
  sola se l'immagine non carica invece di mostrare un'icona rotta), `MetaPartitaCsi` (girone,
  n° gara, arbitro, link al referto — campi leggeri, zero fetch aggiuntive), `DettaglioCsiEsteso`
  (formazioni + scontri diretti, monta `useCsiPartita()`).
- **`src/routes/partita-csi.$id.tsx`** — dettaglio "solo CSI" per le gare **senza** un evento
  CrAPP collegato (l'app non crea ancora eventi automaticamente dal calendario CSI, vedi
  "Evoluzioni possibili"): nessuna convocazione/presenza/MVP/scout, solo risultato, parziali
  e i dati CSI di questa sezione. `id` è l'`id` della gara sul portale CSI
  (`PartitaCsi.id`), non un evento CrAPP.
- **`src/routes/partita.$id.tsx`** — per le gare **con** un evento CrAPP collegato, mostra le
  stesse informazioni CSI (logo, metadati, formazioni, scontri diretti) in più rispetto a
  prima, quando `csiMatch` esiste per quella data.
- **`test/unit/csi-core.test.ts`** — check del parsing: `bun test/unit/csi-core.test.ts`.
  Con `CSI_LIVE=1` verifica anche gli endpoint reali, incluse formazioni e precedenti di una
  gara giocata.

### Regole rispettate

- **Nessuna chiamata dal browser per classifica/partite**: il portale viene contattato solo
  lato server, al massimo 4 volte al giorno per `/api/public/csi`, indipendentemente da
  quanti giocatori aprono l'app (regola anti-consumo). **`/api/public/csi-partita/$id` è
  diverso di proposito**: è on-demand, chiamato solo quando un giocatore apre il dettaglio
  di una gara specifica (mai precaricato in una lista, vedi `useCsiPartita()` sopra) — non
  rientra nel limite delle 4 chiamate/giorno perché non è un dato mostrato a tutti a ogni
  apertura dell'app, ma cache comunque 6 ore per evitare rifetch ripetuti sulla stessa gara.
- **Nessuna dipendenza nuova**: parsing con espressioni regolari sulla struttura della
  tabella/lista, sia per classifica/partite sia per formazioni/precedenti.
- **Fallback**: se il CSI non risponde, l'endpoint `/api/public/csi` restituisce l'ultimo
  dato buono in cache; se non ne ha ancora uno, la classifica resta vuota e i risultati
  ricadono sulle partite dello Scout Live locale (`useScoutMatches()`).
  `/api/public/csi-partita/$id` non ha questo fallback sulla prima chiamata per una gara mai
  vista (vedi sopra): fallisce con `503`, e la UI (`DettaglioCsiEsteso`) semplicemente non
  mostra la sezione formazioni/scontri diretti, senza rompere il resto della pagina.
- **Portabilità (DD-013)**: endpoint HTTP standard, nessun servizio esclusivo.

---

## Limiti noti

1. **La classifica si legge da HTML.** Se il portale cambia la struttura della tabella il
   parsing restituisce un array vuoto: `/classifica` non si rompe, ma mostra "Classifica non
   ancora disponibile" (o l'ultimo dato buono in cache, se ce n'è uno) e i risultati ricadono
   sulle partite dello Scout Live locale, non su dati demo — non esistono più in `crapp-data.ts`.
   Il check con `CSI_LIVE=1` serve a scoprire il problema di parsing.
2. **`project_id` è legato alla stagione.** Per il 2026/27 servirà un nuovo id (vedi
   "Sorgente dati" sopra per come ritrovarlo). Oggi va aggiornato a mano in `csi-core.ts`.
3. **La cache vive nel processo del server.** Si perde a ogni cold start e non è condivisa tra
   istanze — vale sia per `/api/public/csi` sia per la `Map` per-partita di
   `/api/public/csi-partita/$id`. Sufficiente per una squadra; se serve di più, spostare i
   dati in una tabella Supabase riempita da un job cron (stesso pattern di
   `promemoria-palloni`).
4. **Le partite includono sia il girone di campionato sia la Coppa, mescolate.**
   `getEventsByTeamId.php?team_id=3359` è per squadra, non per competizione (vedi tabella
   endpoint sopra): risponde con tutte le gare di `C.R.A.P. Volley`. Il campo `project`
   distingue le due nel JSON grezzo, ma `partiteDaEventi()` (`csi-core.ts`) oggi non lo usa
   per filtrare: tutte le gare finiscono in `DatiCsi.partite` senza distinzione (`storico
   partite` in `/classifica` le mostra tutte insieme). Se in futuro servisse separarle, il
   filtro va aggiunto su `evento.project` in `partiteDaEventi()`.
   **La classifica della Coppa, invece, è mostrata** (sopra quella del girone in
   `/classifica`): `project-sheets.php?project_id=848` (`CSI_COPPA_PROJECT_ID`) ha la stessa
   struttura a tabella-per-girone di `project_id=767`, quindi `parseClassifica()` funziona
   invariata — nessun parser dedicato. Resta un limite: quella pagina copre **solo la fase a
   gironi**. La Coppa (PVM Coppa CSI Misto Silver) prevede due gironi da 4 squadre sola
   andata seguiti da una finale secca tra le due vincenti, disputata in un `project_id`
   figlio separato generato a fine fase a gironi (verificato con `curl` diretto:
   `project-main.php?project_id=848` descrive il regolamento — "due gironi sola andata, le
   due vincenti in finale, gare 3 set su 5" — e `project-sheets.php?project_id=848` mostra
   sia le due classifiche a girone sia, in un'altra sezione della stessa risposta, il
   tabellone a eliminazione con quel `project_id` figlio). Se la squadra arrivasse in
   finale, `/classifica` continuerebbe a mostrare la classifica (ormai chiusa) del proprio
   girone di Coppa, non l'esito della finale: non c'è codice che segua quel `project_id`
   figlio, che oltretutto cambia a ogni edizione della Coppa e non è noto in anticipo.
5. **Le partite si leggono da JSON, con parsing fragile su campi testuali.** `result` e
   `partials` in `getEventsByTeamId.php` sono stringhe libere tipo `"3-1"`, lette con
   un'espressione regolare (`punteggio()`/`parziali()` in `csi-core.ts`). Se il portale CSI
   cambiasse formato (es. `"3:1"`, o un punteggio come oggetto invece che stringa), la regex
   non troverebbe corrispondenza e la partita risulterebbe "non ancora giocata"
   (`setNostri`/`setLoro` a `null`) — silenziosamente, senza errori. Se invece la risposta
   cambiasse forma radicalmente (non più un array), `partiteDaEventi()` torna `[]`.
   **Conseguenza sugli obiettivi di squadra**: le "vittorie in campionato" (`obiettivi.ts`,
   obiettivi o3/o4/o5) dipendono da `partiteGiocate(csi.partite)` — se il parsing delle partite
   si rompe così, questi tre obiettivi restano bloccati a 0% anche a fronte di vittorie reali.
   **Il fallback della route non se ne accorgerebbe da solo**: `/api/public/csi` lancia un
   errore solo se *sia* la classifica *sia* le partite sono vuote insieme
   (`classifica.length === 0 && partite.length === 0`); se si rompe solo il parsing delle
   partite mentre la classifica HTML continua a funzionare, la route risponde comunque `200`
   con `partite: []`. Per questo `leggiCsi()` confronta il JSON grezzo con il risultato di
   `partiteDaEventi()` tramite `partiteFormatoSospetto()` (`csi-core.ts`): se ci sono eventi
   grezzi ma nessuno è stato riconosciuto come nostra partita, logga un `console.error` —
   distingue così un vero "formato cambiato" da un legittimo "nessuna gara ancora in
   programma" (dove gli eventi grezzi stessi sono vuoti). Il flag `formatoSospetto` viaggia
   anche nella risposta JSON (`DatiCsi.formatoSospetto`) fino a `/classifica`
   (`src/routes/classifica.tsx`), dove mostra un badge discreto ("Il portale CSI potrebbe aver
   cambiato formato: dati da verificare.") al posto della normale riga "Dati CSI aggiornati
   alle...": un log server passa inosservato per settimane, un badge visibile a chi apre la
   pagina campionato molto meno. Il fix, quando succede, è isolato a
   `partiteDaEventi()`/`punteggio()`/`parziali()` in `csi-core.ts` (gli endpoint stessi
   cambiano solo se cambia il dominio o serve autenticazione, nel qual caso va toccata anche
   `src/routes/api/public/csi.ts`); va poi aggiornato anche `test/unit/csi-core.test.ts` con
   fixture nel nuovo formato.
6. **Il portale può essere del tutto irraggiungibile, non solo cambiare formato.** Scenario
   diverso dal punto 5 (lì il JSON è valido ma non riconosciuto, qui la risposta non è
   nemmeno JSON): l'8 settembre 2026 `getEventsByTeamId.php` ha risposto con `200` ma un
   errore SQL del loro backend in chiaro al posto del JSON
   (`Query non valida (getProjectTeams): Table 'uqc2os2x_livescore.seasons' doesn't exist`,
   verificato con `curl` diretto sul loro dominio). `leggiCsi()` (`src/routes/api/public/
   csi.ts`) intercetta l'eccezione di `JSON.parse` nel `try/catch` della route e risponde
   `503 "CSI non raggiungibile"` (o serve la cache se ce n'è una) — nessun crash, ma nessun
   dato nuovo finché il portale non torna. **Effetto sulla suite test**: i test di
   `test/integration/api.test.ts` che leggono il CSI reale sondano `/api/public/csi` una
   volta prima di partire; se risponde con errore li salta (`salta()`, non `prova()`) invece
   di farli fallire, loggando il motivo — la suite resta verde durante un'indisponibilità
   temporanea del portale, senza che quei 5 test vengano cancellati o disattivati in modo
   permanente: tornano a girare da soli non appena il CSI risponde di nuovo con `200`.
7. **I loghi delle squadre sono "hotlinked" direttamente dal browser al portale CSI**
   (`LogoSquadra` in `DettaglioCsi.tsx` punta a `logoAvversario`, un URL
   `livescore.csibologna.it/images/...`). È un'eccezione consapevole alla regola "nessuna
   chiamata dal browser al CSI": un'immagine, a differenza dei dati, non ha bisogno di
   passare dalla cache server per restare aggiornata, e proxarla/cacherla lato server per
   ogni squadra avversaria (potenzialmente decine a stagione) sarebbe uno sforzo sproporzionato
   al beneficio. Se un logo non carica (URL cambiato, squadra senza foto),
   `LogoSquadra` si nasconde da sola (`onError` → `null`) invece di mostrare un'icona rotta.
8. **L'ordine "titolari"/"A disposizione" in `parseFormazioni()` è quello del referto CSI,
   non necessariamente il sestetto che è sceso davvero in campo al fischio d'inizio.** Il
   CSI non separa esplicitamente "chi ha giocato titolare" da "chi era comunque convocato e
   in lista gara": il divisore "A DISPOSIZIONE" nella pagina sembra riflettere l'ordine di
   inserimento nel referto più che le sostituzioni reali. Va quindi presentato come "referto
   del CSI", non come cronaca esatta di chi ha giocato quanto.

---

## Evoluzioni possibili

- Prossima partita ufficiale nella home e nel calendario (i dati sono già disponibili).
- Creazione automatica degli eventi partita da calendario CSI — risolverebbe anche il
  limite 4 di sopra: ogni gara avrebbe un evento CrAPP e andrebbe sempre su `/partita/$id`,
  senza più bisogno di `/partita-csi/$id` per le gare "orfane".
- Confronto tra i parziali ufficiali e quelli dello Scout Live.
- Tabellone a eliminazione della fase finale di Coppa (limite 4): oggi non tracciato, il
  `project_id` figlio (es. `905`) andrebbe scoperto a runtime leggendo il link dentro
  `project-sheets.php?project_id=848` invece di essere una costante.
