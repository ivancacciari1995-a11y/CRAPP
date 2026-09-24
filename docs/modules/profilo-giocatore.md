# Modulo — Profilo Giocatore

**Stato:** implementato
**File principali:** `src/lib/profili.ts`, `src/lib/profili-core.ts`, `src/routes/profilo.tsx`,
`src/routes/admin.tsx`

---

## Obiettivo

Il modulo "Profilo Giocatore" raccoglie tutte le informazioni personali, amministrative e documentali di ciascun membro della squadra.

L'obiettivo è centralizzare in un'unica schermata tutti i dati necessari sia al giocatore sia agli amministratori, eliminando la gestione tramite chat, documenti cartacei e fogli Excel.

## Utenti

L'allenatore ha un profilo ridotto (solo Docs con i dati personali essenziali e Opzioni):
la specifica sta in [allenatore.md](allenatore.md).

### Giocatore

Può:

- visualizzare il proprio profilo
- modificare i propri dati personali
- aggiornare il certificato medico
- aggiornare i documenti
- caricare le immagini richieste

### Amministratore

Può:

- visualizzare il profilo di tutti i giocatori
- scaricare documenti e certificati
- esportare i dati necessari al tesseramento CSI
- verificare lo stato di completamento dei profili
- modificare i dati squadra di qualsiasi giocatore (nome, cognome, numero, ruolo, email)
- compilare e correggere i dati personali e del documento al posto di un giocatore (DD-017)
- scollegare un account da un profilo, liberando lo slot
- aggiungere un nuovo giocatore alla rosa (id, nome, cognome, numero, ruolo, email opzionale),
  oppure un allenatore (tipo «Allenatore»: niente numero né ruolo, DD-034)
- disattivare un giocatore che ha lasciato la squadra, e riattivarlo in caso di errore: la
  riga non viene eliminata, così presenze, voti, pagelle e badge della stagione restano
  agganciati al suo id

Non può caricare o sostituire i file altrui: documento, certificato e foto restano
responsabilità del giocatore che li fornisce.

## Flusso utente

### Primo accesso

1. Login tramite Google oppure Email. _Implementato con il solo Google: la squadra ha tutti
   un account Google, e un secondo metodo è additivo (un bottone in più sulla stessa
   schermata) il giorno che serve._
2. Collegamento automatico al proprio giocatore, confrontando l'email dell'account Google
   con l'email registrata in `giocatori_squadra` (DD-018). Nessuna scelta manuale: se
   l'email non corrisponde a nessun profilo, l'accesso si ferma con un messaggio che invita
   a contattare un amministratore.
3. Accesso alla Home.

Se il profilo non è completo compare automaticamente un widget di completamento.

## Home

Il giocatore visualizza un widget dedicato e, quando serve, l'avviso sul certificato medico.

### Completa il tuo profilo

Viene mostrata una barra di avanzamento (esempio: _Profilo completato — 85%_), composta dalle seguenti sezioni.

- Dati personali
- Documento di identità
- Certificato medico
- Foto tessera

Quando tutte le sezioni sono complete il widget scompare automaticamente.

Il tap apre Profilo sulla sottosezione **Documenti** (`/profilo?tab=documenti`), non
sulla tab Stagione.

### Avviso certificati

**Stato:** da implementare (DD-035).

Un avviso in Home segnala i certificati medici in scadenza o scaduti, così nessuno se ne
accorge quando il giocatore è già fuori regola. Si calcola al volo dalla data di scadenza
già salvata: niente tabella, niente migration, niente push.

#### Chi lo vede

| Utente                      | Cosa vede                                                       | Al tocco                      |
| --------------------------- | --------------------------------------------------------------- | ----------------------------- |
| Admin                       | l'avviso **dello staff**: i nomi di tutti i giocatori coinvolti | niente, non è cliccabile      |
| Giocatore interessato       | l'avviso **personale**: solo il proprio certificato             | apre `/profilo?tab=documenti` |
| Admin che è anche giocatore | solo l'avviso dello staff, dove compare già il suo nome         | niente                        |
| Altri giocatori             | niente                                                          | —                             |
| Allenatore                  | niente: non vede i certificati altrui e non ne ha uno (DD-034)  | —                             |

L'avviso dello staff non è cliccabile, come quello dei palloni: l'admin non può caricare il
certificato al posto del giocatore (DD-017), quindi può solo sollecitarlo, e il giocatore
riceve già il proprio avviso. Quello personale porta invece dove si carica il certificato
nuovo, come il widget «Completa il tuo profilo».

I certificati sono dati sanitari: fuori da `/admin` li legge solo il titolare (DD-016).
Nessuna policy cambia, perché `useProfili()` restituisce già tutti i profili a un admin e il
solo proprio a un giocatore.

#### Quando compare

`giorni` è la differenza in giorni di calendario tra la scadenza e oggi (ora locale), soglia
`GIORNI_AVVISO_CERTIFICATO = 7`.

| Condizione           | Stato       | Avviso             |
| -------------------- | ----------- | ------------------ |
| `giorni > 7`         | valido      | nessuno            |
| `0 ≤ giorni ≤ 7`     | in scadenza | giallo (`warning`) |
| `giorni < 0`         | scaduto     | nero (`primary`)   |
| data o file mancanti | mancante    | nessuno            |

- Il giorno della scadenza il certificato vale ancora, coerente con `statoScadenza()`: il
  giocatore compare nel giallo con «scade oggi» e passa al nero dal giorno dopo.
- L'avviso nero resta finché il giocatore non aggiorna la data: non c'è un limite di tempo.
- Il certificato **mancante** non genera avviso: è un problema diverso, già visibile nella
  tab Profili di `/admin` e nel widget di completamento del giocatore.
- Sono esclusi i giocatori disattivati e gli allenatori: conta solo la rosa (`inRosa()`,
  cioè `attivo` e `tipo = 'giocatore'`).

#### Testi

| Avviso            | Titolo (staff / personale) | Riga                                                                     |
| ----------------- | -------------------------- | ------------------------------------------------------------------------ |
| Giallo, staff     | «Certificati in scadenza»  | «Mario Rossi — scade tra 5 giorni», «… — scade domani», «… — scade oggi» |
| Nero, staff       | «Certificati scaduti»      | «Mario Rossi — scaduto il 12/09/2026»                                    |
| Giallo, personale | «Certificato in scadenza»  | «Il tuo certificato medico scade tra 5 giorni» / «domani» / «oggi»       |
| Nero, personale   | «Certificato scaduto»      | «Il tuo certificato medico è scaduto il 12/09/2026: caricane uno nuovo»  |

Il numero di giorni scende da solo ogni giorno (7, 6, 5… domani, oggi): l'avviso non
conserva niente, rilegge la data a ogni apertura della Home.

#### Più giocatori

- Più giocatori nello stesso stato stanno in un **unico avviso**, una riga ciascuno, e
  compaiono **tutti**: nessun limite al numero di nomi, anche a inizio stagione quando ne
  scadono molti insieme.
- Se ci sono sia certificati in scadenza sia scaduti compaiono **due avvisi**: prima quello
  nero, poi quello giallo.
- Ordine delle righe: dalla scadenza più vicina nel giallo, dal certificato scaduto da più
  tempo nel nero; a parità di data, alfabetico per cognome e poi per nome. L'ordine è
  stabile, quindi l'elenco non si rimescola tra un'apertura e l'altra.

#### Aspetto e posizione

- Stessa forma del banner palloni (`PromemoriaPalloni`): card arrotondata a tutta larghezza
  con icona e titolo in `font-display` maiuscolo, righe in testo piccolo sotto.
- Giallo: sfondo `bg-warning`, testo `text-warning-foreground`. Nero: sfondo `bg-primary`,
  testo `text-primary-foreground`. L'app è solo chiara (DD-022), quindi il nero non rischia
  di confondersi con lo sfondo.
- In Home sta subito **sotto il banner palloni** e sopra «Completa il tuo profilo»: prima
  ciò che scade oggi, poi ciò che manca.

#### Rinnovo

Il giocatore rinnova dal proprio profilo, sottosezione Documenti: carica il file nuovo e
aggiorna la data. Il salvataggio aggiorna la cache dei profili (`setQueryData`), quindi il
suo avviso personale sparisce subito. Nell'avviso dello staff il nome sparisce alla lettura
successiva dei profili da parte dell'admin (cache di 30 minuti, `useProfili()`), senza
nessuna azione da parte sua. Quando non resta nessuno, l'avviso non compare più.

Basta aggiornare la data: l'avviso guarda solo quella (e la presenza di un file). Che il
file caricato sia davvero quello nuovo resta un controllo dell'admin, come oggi. Anche l'admin
può correggere la data dalla scheda del giocatore (DD-017, non il file): l'avviso segue la
data, chiunque l'abbia scritta.

#### Caricamento

Finché ruoli e profili non sono arrivati, l'avviso non compare: così un admin che è anche
giocatore non vede per un attimo l'avviso personale prima di quello dello staff. Se la
lettura dei profili fallisce l'avviso semplicemente non compare, senza messaggio d'errore:
la Home non deve rompersi per un dato accessorio.

#### Implementazione

| Pezzo                                           | Ruolo                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GIORNI_AVVISO_CERTIFICATO` (`profili-core.ts`) | la soglia, 7                                                                                                                                |
| `giorniAllaScadenza(scadenza, oggi)`            | differenza in giorni di calendario tra due date `AAAA-MM-GG`, negativa se scaduto                                                           |
| `avvisiCertificati(rosa, profili, oggi)`        | funzione pura: restituisce `{ scaduti, inScadenza }`, ognuno una lista ordinata di `{ giocatoreId, nome, cognome, scadenza, giorni }`       |
| `testoScadenza(giorni)`                         | «scade oggi» / «scade domani» / «scade tra N giorni»                                                                                        |
| `src/components/crapp/AvvisoCertificati.tsx`    | legge `useGiocatoriSquadra()`, `useProfili()`, `useIsAdmin()` e l'utente corrente; sceglie avviso dello staff o personale e disegna le card |
| `src/routes/index.tsx`                          | monta `<AvvisoCertificati />` subito dopo `<PromemoriaPalloni />`                                                                           |

- "Oggi" viene da `oggiISO()` (`palloni-core.ts`), in ora locale. Non da
  `new Date().toISOString()`, che è in UTC e tra mezzanotte e le 2 darebbe il giorno prima.
- Nessuna query nuova: `useProfili()` ha la stessa chiave di cache usata da Profilo e
  `/admin`, quindi al massimo una lettura di `profili_giocatore` per sessione (vedi
  [EFFICIENZA_CLOUD.md](../EFFICIENZA_CLOUD.md)). Per l'allenatore il componente non legge
  i profili.
- Test in `test/unit/profili-core.test.ts`: soglia (8 giorni no, 7 sì, 0 sì, −1 scaduto),
  certificato senza file o senza data escluso, giocatore disattivato e allenatore esclusi,
  ordinamento (per data, poi alfabetico), testi al singolare e al plurale, cambio di mese e
  di anno nel calcolo dei giorni.

## Profilo

Il profilo viene suddiviso in sette aree.

### Dati Giocatore

**Dati squadra** — solo lettura, gestiti esclusivamente dagli amministratori.

- Nome
- Cognome
- Numero di maglia
- Ruolo

**Dati personali** — modificabili dal giocatore.

- Data di nascita — oltre a `profili_giocatore.data_nascita`, un trigger la sincronizza in
  `giocatori_squadra.nascita` (DD-031): a differenza degli altri campi di questa sezione,
  visibile a **tutta la squadra**, non solo al giocatore stesso o all'admin (alimenta
  Squadra e i compleanni nel Calendario, vedi `squadra.md`). Cancellare il profilo azzera
  anche quel valore pubblico.
- Luogo di nascita
- Indirizzo di residenza
- Telefono
- Email

### Documento di identità

Campi.

- Tipo documento
- Numero documento
- Rilasciato da
- Data emissione
- Data scadenza

Upload.

- Foto fronte
- Foto retro

### Certificato medico

Campi.

- Data di scadenza

Upload.

- Certificato medico

Il giocatore può aggiornare liberamente sia la data sia il file.

Quando mancano 7 giorni o meno alla scadenza, o il certificato è scaduto, il giocatore
riceve un avviso nella propria Home e compare in quello degli admin (vedi
[Avviso certificati](#avviso-certificati)).

Lo storico non viene mantenuto nella prima versione.

### Foto tessera

Upload di una fotografia formato tessera.

Utilizzata dagli amministratori per il tesseramento CSI.

### Statistiche

Sezione già presente. Contiene.

- Presenze
- Voto medio
- MVP
- Serie
- Altre statistiche disponibili

### Badge

Sezione già presente.

Contiene tutti i badge ottenuti e quelli ancora da sbloccare.

### Opzioni

Contiene.

- Logout
- Preferenze notifiche: un solo interruttore che iscrive il dispositivo a **tutte** le push
  (turno palloni, solleciti presenze) e abilita le notifiche smart in app — non è limitato
  ai soli palloni (vedi [Notifiche](notifiche.md))
- Impostazioni applicazione
- Segnala un bug e Suggerisci una nuova funzionalità: due link che aprono una issue GitHub
  già impostata sul template giusto (`.github/ISSUE_TEMPLATE/bug_report.yml` e
  `feature_request.yml`). Nessun dato passa dall'app — la segnalazione vive interamente su
  GitHub, così non servono né una tabella né una schermata di gestione.

## Dashboard amministratore

Gli amministratori dispongono di una schermata dedicata (`/admin`, raggiungibile da
Profilo → Opzioni), organizzata in tab scorrevoli a pillole (`BarraSottosezioni`, stesso
componente di [Squadra](squadra.md) e Campionato): Squadra, Profili, Disattivati (solo se
c'è almeno un giocatore disattivato) e Notifiche.

La tab **Notifiche** mostra quanti giocatori attivi hanno almeno un dispositivo iscritto
alle notifiche push e i loro nomi, leggendo `GET /api/public/notifiche-attive` (vedi
[Notifiche](notifiche.md)). È solo consultiva: l'attivazione resta un gesto che ogni
giocatore deve fare dal proprio dispositivo (Profilo), l'admin non può attivarla per conto
di altri.

Gli allenatori stanno nella stessa tab in un gruppo «Allenatori» a parte, senza documenti né
tesseramento, e non entrano nei conteggi della tab Squadra né nell'export CSI (DD-034).

Per ogni giocatore, nella tab Profili, vengono mostrati.

- Stato del profilo
- Certificato medico
- Documento di identità
- Foto tessera
- Stato tesseramento CSI (tesserato / da tesserare)

Azioni disponibili.

- Visualizza profilo (la scheda si apre in linea nell'elenco: nessuna schermata separata)
- Scarica certificato
- Scarica documento
- Scarica foto tessera
- Modifica dati squadra e dati personali del giocatore (DD-017)
- Registra numero e data della tessera CSI, una volta arrivata dal comitato
- Scollega account, per liberare uno slot assegnato per errore
- Aggiungi giocatore, per inserire un nuovo membro della squadra
- Disattiva/Riattiva giocatore, per chi lascia la squadra (o rientra)

## Esportazione CSI

Gli amministratori possono esportare un file CSV contenente esclusivamente i dati richiesti per il tesseramento.

Campi esportati.

- Nome
- Cognome
- Data di nascita
- Luogo di nascita
- Indirizzo
- Telefono
- Email
- Tipo documento
- Numero documento
- Rilasciato da
- Data emissione
- Data scadenza

## Tracciamento tesseramento

Numero e data della tessera CSI non sono dati che il giocatore conosce in anticipo: arrivano
dal comitato dopo l'iscrizione effettiva. Per questo, a differenza dei dati personali del
profilo, li scrive solo un amministratore — come nome, cognome, numero di maglia e ruolo
(DD-017), il trigger sulla tabella li rende non modificabili dal giocatore stesso. La
dashboard mostra un badge "Tesserato"/"Da tesserare" su ogni scheda e il conteggio
complessivo della squadra.

## Completamento profilo

Ogni sezione contribuisce alla percentuale di completamento.

| Sezione               | Peso |
| --------------------- | ---- |
| Dati personali        | 30%  |
| Documento di identità | 30%  |
| Certificato medico    | 30%  |
| Foto tessera          | 10%  |

Quando tutte le sezioni risultano complete il profilo raggiunge il 100%.

## Permessi

**Giocatore** — può modificare esclusivamente il proprio profilo.

**Amministratore** — può visualizzare tutti i profili, scaricare tutti i documenti, esportare i
dati, modificare dati squadra e dati personali di chiunque e scollegare un account (DD-017).
Non carica file al posto di altri.

**Avviso certificati** — il giocatore vede solo il proprio, l'admin i nomi di tutta la rosa,
nessun altro ne vede (vedi [Avviso certificati](#avviso-certificati)).

## Versione 1

- Profilo giocatore
- Completamento profilo
- Gestione dati personali
- Documento di identità
- Certificato medico
- Foto tessera
- Dashboard amministratore
- Esportazione CSV CSI

## Versioni future

- Storico certificati medici
- Avviso certificati anche via push, o con una soglia regolabile dall'admin (DD-035, Riesame)
- Gestione documenti aggiuntivi
- Consensi privacy
- Firma digitale
- Verifica automatica documenti
