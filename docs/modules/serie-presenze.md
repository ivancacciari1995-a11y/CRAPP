# Modulo — Serie di presenze

**Stato:** implementato — tutte e tre le serie calcolate sui dati reali
**File principali:** `src/lib/serie.ts`, `src/lib/presenze.ts`, `src/lib/rosa.ts`,
`src/components/crapp/SerieCard.tsx`
**Migration collegata:** `m9_risposte_presenze_risposto_il`
**Test:** `test/unit/serie.test.ts`, `test/unit/presenze.test.ts`

---

## Obiettivo

Motivare la costanza dei giocatori mostrando "serie" (streak) di comportamenti positivi
consecutivi — presenza agli allenamenti, presenza alle partite, risposta entro 24 ore alla
convocazione — con traguardi progressivi, sullo stile delle app fitness. È anche uno dei
requisiti di sblocco di alcuni [badge](badge.md) e di un [obiettivo di squadra](obiettivi-squadra.md).

---

## Le tre serie in sintesi

| Tipo          | Campo `Giocatore`  | Cosa conta                                                   | Traguardi    |
| ------------- | ------------------ | ------------------------------------------------------------ | ------------ |
| `allenamenti` | `serieAllenamenti` | Allenamenti passati consecutivi con presenza                 | 3, 6, 10, 15 |
| `partite`     | `seriePartite`     | Partite passate consecutive con presenza                     | 2, 5, 8, 12  |
| `conferme`    | `serieConferme`    | Eventi consecutivi con risposta entro 24h dalla convocazione | 3, 8, 15, 20 |

Esiste un quarto contatore fuori da questo modulo, `Giocatore.streak`: la stessa regola delle
presenze ma **su partite e allenamenti insieme**. Non ha card né traguardi, compare come
"presenze consecutive" in `src/routes/index.tsx`, `src/routes/squadra.tsx` e
`src/routes/profilo.tsx`.

Le serie sono **indipendenti**: un buco agli allenamenti non tocca partite e conferme. È la
regola scritta in `aggiornaSerie()` e va mantenuta se si aggiungono altre serie.

---

## Dati

Non esiste una tabella delle serie e non c'è nessun contatore salvato: **le serie sono
ricalcolate da zero a ogni render**, partendo dagli eventi e dalle risposte già in cache
React Query. Nessuna query aggiuntiva, nessuna migration da rifare quando si cambia una
regola, nessun rischio di contatori disallineati dalla realtà.

Conseguenza pratica: se domani si inseriscono le presenze di eventi passati (import,
backfill, correzione a mano), le serie si aggiornano da sole al caricamento successivo.

### Tabelle lette

| Tabella             | Colonne usate                                       | A cosa servono                                                           |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| `eventi_app`        | `id`, `tipo`, `data`, `convocati`, `creato_il`      | Quali impegni contano, in che ordine, e quando è partita la convocazione |
| `risposte_presenze` | `evento_id`, `giocatore_id`, `stato`, `risposto_il` | Se l'impegno è stato onorato e quanto in fretta è arrivata la risposta   |

`risposto_il` (migration `m9`) è l'istante della **prima** risposta del giocatore per quell'
evento. Un trigger (`risposte_presenze_risposto_il_immutabile`) lo blocca su qualsiasi
UPDATE: senza, un giocatore che risponde subito e cambia idea una settimana dopo risulterebbe
lento. `aggiornato_il` continua a registrare l'ultima modifica ed è un'altra cosa: non usarlo
per le conferme.

Cancellare la risposta (`stato: null` → DELETE) elimina anche `risposto_il`: se il giocatore
risponde di nuovo, riparte il cronometro. È voluto — ha ritirato la risposta.

---

## Flusso completo

```
eventi_app  ─┐
             ├─► useEventi()            ─┐
risposte_    │   (src/lib/eventi.ts)     │
presenze    ─┘                           ├─► useRosa()  ─► Giocatore.serie*  ─┐
                 useRispostePresenze()  ─┘   (rosa.ts)                        │
                 (presenze.ts)                                                │
                                                                              ▼
                                                        serieGiocatore() / serieMigliore()
                                                        (serie.ts, applica serieDefs)
                                                                              │
                                             ┌────────────────────────────────┼──────────────┐
                                             ▼                                ▼              ▼
                                      SerieGriglia                      SerieHome      badges.ts
                                      (profilo)                         (home)         obiettivi.ts
```

Chi calcola cosa:

- **`src/lib/presenze.ts`** — i tre numeri, dai dati grezzi.
- **`src/lib/rosa.ts`** — li attacca a ogni `Giocatore` dentro l'unica `useMemo` di `useRosa()`.
- **`src/lib/serie.ts`** — definizioni, traguardi, progresso e microcopy: da un numero a uno stato mostrabile.
- **`src/components/crapp/SerieCard.tsx`** — la resa a schermo.

---

## Il calcolo (`src/lib/presenze.ts`)

Tutte le serie passano dalla stessa funzione privata `serieSu()`, che fa quattro cose in
ordine:

1. **Filtra gli eventi rilevanti** con `eventiContanoPresenze()` — la stessa funzione che
   alimenta il conteggio presenze, così le due statistiche non possono divergere:
   - solo `tipo` `partita` o `allenamento` (mai `evento` o `compleanno`);
   - solo eventi a cui il giocatore era convocato. **`convocati` vuoto significa "tutta la
     rosa"**, non "nessuno": chi non è nell'elenco di una convocazione ristretta non vede
     quell'evento e la sua serie non si spezza.
2. **Scarta il futuro** (`e.data <= oggi`). Gli eventi di oggi contano già: se serve un
   confronto diverso, il parametro `oggi` è iniettabile (i test lo fissano a una data).
3. **Ordina per data crescente** (`localeCompare` su `YYYY-MM-DD`).
4. **Riduce** applicando `aggiornaSerie(serie, onorato(e))` a ogni evento: `+1` se onorato,
   `0` altrimenti. La serie finale è quella che risulta **dopo l'ultimo evento passato**.

Quel che cambia fra le serie è solo il predicato `onorato`.

### `serieConsecutiva()` — allenamenti, partite, `streak`

```ts
serieConsecutiva(giocatoreId, eventi, presenze, tipo?, oggi?)
```

Onorato = lo stato salvato è `presente` **o** `ritardo`. Gli stati possibili sono
`presente | assente | forse | ritardo | infortunato` (`src/lib/crapp-data.ts`).

Conseguenze da conoscere prima di cambiare qualcosa:

- **`infortunato` azzera la serie**, esattamente come `assente`. Coerente con il conteggio
  presenze, ma è una scelta da rivedere se si vuole "congelare" la serie di chi è fermo per
  infortunio.
- **Nessuna risposta azzera la serie.** Un evento passato per cui il giocatore non ha mai
  toccato l'app equivale a un'assenza. È voluto (la serie premia anche il rispondere), ma
  significa che eventi storici importati senza presenze schiacciano a zero le serie di tutti.
- Senza `tipo` conta partite e allenamenti insieme: è così che si ottiene `streak`.

### `serieConferme()` — conferme entro 24 ore

```ts
serieConferme(giocatoreId, eventi, tempi, oggi?)
```

Onorato = esiste una risposta **e** `risposto_il − creato_il ≤ 24h` (confronto inclusivo,
costante `ORE_24`, entrambi gli istanti passati da `Date.parse`).

- Conta **partite e allenamenti insieme**, non c'è una versione per tipo.
- **Lo stato non conta**: anche un "assente" dato in fretta tiene viva la serie. È una serie
  sulla reattività, non sulla presenza.
- **Gli eventi senza `creatoIl` vengono saltati e non spezzano la serie.** Sono gli eventi
  costruiti dal client e mai salvati a database — i compleanni di `compleanniEventi()` e la
  bozza di `eventoVuoto()`. Senza istante di convocazione la domanda "ha risposto in fretta?"
  non ha risposta, e trattarli come un buco punirebbe il giocatore per un dettaglio tecnico.
- **Le 24 ore partono dalla creazione dell'evento**, non da un invio di notifica: oggi un
  momento di "convocazione mandata" distinto non esiste. Se un domani ci sarà, è quello
  l'istante giusto da confrontare.

### Lettura e cache

`fetchPresenze()` fa **una sola query** e costruisce due mappe:

```ts
presenze: { [eventoId]: { [giocatoreId]: Stato } }
tempi:    { [eventoId]: { [giocatoreId]: string /* ISO */ } }
```

Entrambe vivono nella stessa entry di React Query (`PRESENZE_KEY`, `staleTime` 5 minuti) e
`useRispostePresenze()` le espone come `presenze` e `tempi`.

`useSalvaPresenza()` non rilegge dopo la scrittura: aggiorna la cache a mano e deve tenere
allineate **entrambe** le mappe. Sull'`upsert` la colonna `risposto_il` non viene inviata —
è quello che la lascia intatta lato database sugli aggiornamenti — e la cache locale imita
la stessa regola con `istanti[giocatoreId] ??= new Date().toISOString()`: si valorizza solo
se manca. Chi tocca quella mutation deve preservare questi due dettagli, altrimenti ogni
ripensamento farebbe ripartire il cronometro delle conferme.

---

## Da numero a card (`src/lib/serie.ts`)

`serieDefs` è l'unica fonte di verità della UI: label, descrizione, icona, traguardi e la
funzione `valore(g)` che pesca il campo giusto dal `Giocatore`.

`statoSerie(def, g)` produce quello che serve a disegnare una card:

| Campo       | Come si ricava                                                              |
| ----------- | --------------------------------------------------------------------------- |
| `valore`    | `def.valore(g)`                                                             |
| `prossimo`  | primo traguardo **strettamente maggiore** del valore; `null` oltre l'ultimo |
| `manca`     | `prossimo - valore` (`0` se fuori scala)                                    |
| `progresso` | percentuale **dentro il livello corrente**, vedi sotto                      |
| `messaggio` | microcopy, vedi sotto                                                       |

### Progresso

```
progresso = round((valore - traguardoPrecedente) / (prossimo - traguardoPrecedente) * 100)
```

La base è il traguardo già raggiunto, non zero. Con la vecchia formula (`valore / prossimo`)
la barra **tornava indietro** ogni volta che se ne raggiungeva uno: a 2 allenamenti segnava
67%, al terzo scendeva al 50%. Ora ogni traguardo apre un livello nuovo che riparte da 0% e
sale fino a 100%, che si tocca solo restando fuori scala (`prossimo === null`).

Esempio con i traguardi degli allenamenti (3, 6, 10, 15):

| Valore | Prossimo | Base | Progresso |
| ------ | -------- | ---- | --------- |
| 0      | 3        | 0    | 0%        |
| 2      | 3        | 0    | 67%       |
| 3      | 6        | 3    | 0%        |
| 5      | 6        | 3    | 67%       |
| 15+    | —        | —    | 100%      |

### Messaggi

`messaggioSerie()` valuta in quest'ordine, prima corrispondenza vince:

1. `valore === 0` → «Serie … azzerata: riparti dal prossimo.»
2. `prossimo === null` → «Serie leggendaria: sei fuori scala!»
3. `manca === 1` → «Manca solo una volta al prossimo traguardo!»
4. `valore >= 5` → «Che continuità: ancora N e sali di livello.»
5. altrimenti → «Bella partenza: N al prossimo traguardo.»

Nota: il caso 1 scatta anche per chi non ha **mai** iniziato, e dice "azzerata". Se dà
fastidio, va distinto lì — il calcolo non sa differenziare "mai partito" da "appena rotto".

### Aggregatori

- `serieGiocatore(g)` — tutte le serie nell'ordine di `serieDefs`.
- `serieMigliore(g)` — quella col valore più alto. `Array.sort` è stabile, quindi **a parità
  vince la prima definita in `serieDefs`**: con tutto a zero esce sempre "Allenamenti".

---

## Interfaccia (`src/components/crapp/SerieCard.tsx`)

- **`SerieGriglia`** — montata in `src/routes/profilo.tsx`, sezione "Serie di presenze". Una
  card per serie: icona (sfondo gradiente se `valore > 0`, grigio se a zero), label,
  descrizione, fiamma col numero, barra `Barra` e riga di testo `"valore/prossimo · messaggio"`
  (il prefisso `valore/prossimo` sparisce fuori scala).
- **`SerieHome`** — riepilogo compatto: la serie migliore in evidenza più i tre numeri in
  griglia. Attualmente **non è montata in nessuna route**: è pronta ma non usata.

---

## Chi dipende dalle serie

Toccare la regola di calcolo muove anche questi, che non hanno logica propria:

| Dove                            | Cosa                                                           | Soglie                      |
| ------------------------------- | -------------------------------------------------------------- | --------------------------- |
| `badges.ts` `serie-allenamenti` | "Sempre in palestra", su `serieAllenamenti`                    | bronzo 3, argento 6, oro 10 |
| `badges.ts` `serie-conferme`    | "Risposta lampo", su `serieConferme`                           | bronzo 3, argento 8, oro 15 |
| `badges.ts` `s-mai-forfait`     | Badge segreto: `serieConferme >= 10` **e** `presenze >= 15`    | —                           |
| `obiettivi.ts` `o11`            | "Continuità di squadra": giocatori con `serieAllenamenti >= 3` | target 12                   |

---

## Costo

`useRosa()` ricalcola quattro serie per ogni giocatore attivo a ogni invalidazione della
memo, e ogni serie scorre tutti gli eventi: **O(rosa × eventi)** per render memoizzato. Con
una rosa e un calendario di squadra sono numeri irrisori. Le dipendenze della memo includono
`eventi`, `mappaPresenze` e `tempi`: se in futuro qualcuna cambiasse identità a ogni render,
il costo diventerebbe per-render e andrebbe stabilizzata a monte.

---

## Come modificare

- **Cambiare i traguardi di una serie** → l'array `traguardi` in `serieDefs`. Devono restare
  crescenti (un test lo verifica) e non serve altro: progresso e messaggi si adeguano.
- **Cambiare la regola di presenza** (per esempio non azzerare su `infortunato`) → il
  predicato dentro `serieConsecutiva()`. Valutare se allineare anche
  `contaPresenzeGiocatore()`, che oggi usa lo stesso criterio.
- **Non azzerare quando manca la risposta** → sempre in quel predicato: distinguere
  `stato === undefined` e restituire la serie invariata invece di `false`. Richiede di
  cambiare `serieSu()`, che oggi conosce solo "onorato sì/no".
- **Cambiare la finestra delle conferme** → la costante `ORE_24`.
- **Contare anche gli eventi extra-campo** (pizzate, `tipo: "evento"`) → il filtro in
  `eventiContanoPresenze()`, che però è condiviso col conteggio presenze: meglio un filtro
  dedicato passato a `serieSu()` che modificarlo lì.
- **Aggiungere una quarta serie** → una voce in `serieDefs` (label, descrizione, icona,
  traguardi, `valore`), un campo nel tipo `Giocatore` (`crapp-data.ts`, più lo zero nel seed),
  il calcolo in `presenze.ts` e il collegamento in `useRosa()`. La UI non va toccata: griglia
  e home iterano su `serieDefs`.
- **Mostrare il riepilogo in home** → `SerieHome` esiste già, basta montarla.

---

## Limiti noti

**Le conferme rapide valgono solo da `m9` in avanti.** `risposto_il` non è ricostruibile a
posteriori: le righe già esistenti al momento della migration hanno ereditato `aggiornato_il`,
che è l'ultima modifica e non la prima risposta. Sui dati precedenti la serie è quindi
un'approssimazione ottimistica.

**Un evento passato senza risposta azzera la serie**, come un'assenza dichiarata: chi non ha
mai risposto ha serie a 0.

**L'ordinamento usa solo `data`, non `ora`.** Due eventi lo stesso giorno vengono processati
nell'ordine in cui arrivano dalla query (`.order("data")`), quindi non deterministico fra
loro. Irrilevante finché un buco e una presenza nello stesso giorno danno lo stesso
risultato finale, ma va sistemato se un giorno serve l'ordine esatto.

**Il fuso è quello del client.** `oggi` nasce da `new Date().toISOString()`, cioè UTC: nelle
prime ore della giornata italiana un evento di oggi può risultare "non ancora passato".

---

## Evoluzioni possibili

- Istante di convocazione esplicito (invio notifica) da usare al posto di `creato_il` per le
  conferme.
- Distinguere "serie mai iniziata" da "serie interrotta" nel microcopy.
- Verificare che i badge e l'obiettivo "Continuità di squadra" si sblocchino davvero sui dati
  di stagione.
