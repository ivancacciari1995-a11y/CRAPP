# Changelog

Tutte le modifiche significative del progetto vengono registrate in questo documento, in
ordine dalla più recente. L'elenco delle funzionalità disponibili e previste non si ripete
qui: sta in [ROADMAP.md](ROADMAP.md).

## Versione attuale — agosto 2026

### La suite copre i conteggi presenze, il calendario e la guardia delle notifiche

- Nuovi check unitari su `contaPresenzeGiocatore`/`totaliEventiGiocatore` (numeratore e
  denominatore delle statistiche), su `compleanniEventi`, `convocatiEvento` ed `eventoVuoto`,
  su `mvpVintiPerGiocatore` e sui rifiuti `401` di `richiediAdmin` (DD-024).
- I test dei permessi coprono ora anche `badge_social_voti` e le deroghe
  «Gli admin gestiscono tutti/e …» introdotte da M11.
- Perché servivano modifiche al codice: le funzioni di conteggio presenze leggevano la data
  di oggi dall'orologio e non erano verificabili — ora accettano `oggi` come parametro,
  come già facevano le serie; `richiediAdmin` scarta anche i token con segmenti vuoti
  (`Bearer ..`), che prima arrivavano fino alla chiamata di rete.

### Le notifiche push arrivano anche ad app chiusa

- Il testo della notifica viaggia ora cifrato **dentro** la push (`aes128gcm`, RFC 8291)
  invece di essere recuperato dal service worker con una fetch al risveglio: era quella fetch
  a non arrivare mai in tempo a telefono bloccato, e la notifica non compariva affatto
  (DD-026).
- Spariscono la route `/api/public/push-messaggio`, la coda `promemoria_push` e
  `messaggioPalloniOggi()`: esistevano solo per rimediare al payload vuoto.

### Lo Scout Live si apre dalla pagina della partita

- Tolto dalla home, era rimasto senza nessun link: `/scout` si raggiungeva solo scrivendo
  l'URL. Ora la card `ScoutEntry` sta in `/partita/$id`, sezione «Scout live».
- Si accende solo se la partita aperta è quella di oggi (nuova prop `eventoId`), altrimenti
  resta grigia con «Si attiva il giorno della partita». Lock di sessione invariato.
- Non è più riservato agli admin: può scoutare chiunque sia autenticato, uno per volta grazie
  al lock. Sparisce il messaggio «Scout riservato».

### Il sondaggio pre-partita apre alle 8:00 del giorno della partita

- Prima era sempre votabile, anche settimane prima: ora la card resta chiusa con l'avviso di
  apertura e si sblocca alle 8:00 del giorno stesso.
- Quando è aperto, gli amministratori hanno nella card il pulsante «Avvisa tutti del
  sondaggio» (`POST /api/public/apri-sondaggio`), che manda la push a tutti i dispositivi
  iscritti — stesso meccanismo del sollecito presenze. Nessun cron: l'invio è manuale.

### Le note dell'evento si leggono aprendolo

- Il campo Note del form eventi si poteva scrivere ma non lo vedeva nessuno: ora compare
  nella scheda di `/allenamento/$id` e `/partita/$id`, sotto orario e luogo, con gli a capo
  mantenuti. Se è vuoto non compare niente.

### Form eventi: data e ora non sfondano più la card su iOS

- Lo stesso difetto già corretto sul tesseramento: `Campo` e le classi degli input erano
  ricopiati identici in tre file, quindi il `min-w-0` aggiunto in `ProfiloAmministrativo`
  non arrivava né al form «Nuovo evento» né alla dashboard admin. Ora `Campo` e
  `classiInput` stanno una volta sola in `ui-bits`.
- La regola CSS che rende ridimensionabili i controlli nativi copre anche
  `input[type="time"]`, che nel form eventi sta affiancato alla data in `grid-cols-2`.

### Profilo: tab Documenti e Opzioni, barra senza scroll

- L'etichetta nominava lo scopo (il tesseramento CSI) invece del contenuto: dentro ci sono
  dati personali, documento, certificato medico e foto tessera. Cambia anche la rotta
  (`/profilo?tab=documenti`): i vecchi link `?tab=tesseramento` aprono la tab Stagione.
- «Impostazioni» diventa «Opzioni»: con le quattro etichette accorciate la barra delle
  sottosezioni ci sta in uno schermo da telefono. Le voci ora si dividono la riga in parti
  uguali (`grow basis-0`) e tornano a scorrere solo se non ci stanno, quindi vale anche per
  le barre di Squadra e Classifica.

### Palloni: allenamenti senza proposta automatica

- `completaTurni` non assegna più gli allenamenti: restano «da assegnare» finché non si
  sceglie a mano. Le partite tengono la rotazione. Migration M10 cancella eventuali turni
  salvati su allenamenti da oggi in poi.

### Profilo: etichetta notifiche allineata al comportamento

- L’interruttore in Impostazioni non è più «Notifiche turno palloni»: iscrive il dispositivo
  a tutte le push (palloni, solleciti) e alle smart in app. Testo e docs aggiornati.
- Il widget Home «Completa il tuo profilo» apre direttamente la tab Tesseramento
  (`/profilo?tab=tesseramento`).

### Revisione dell'interfaccia: accessibilità, movimento, peso

- **Contrasto**: `--success`, `--info` e `--training` erano tra 3.3:1 e 3.5:1 con il testo
  bianco sopra (chip «Presente», «Allenamento», celle del calendario): ora sono sotto la
  soglia di luminosità che garantisce 4.5:1. I gradi dei badge usavano `text-oro` e
  `text-argento` su bianco, cioè 1.9:1 e 2.5:1 — praticamente invisibili: nascono i token
  `--oro-testo`, `--argento-testo`, `--bronzo-testo` per il testo, mentre le versioni chiare
  restano su sfondi e bordi.
- **PWA**: mancava `viewport-fit=cover`, quindi `env(safe-area-inset-bottom)` valeva sempre 0
  e su iPhone la BottomNav finiva sotto la home bar. `theme-color` e `background_color` erano
  `#111111` su un'app chiara: barra di stato nera e splash nero prima di una UI bianca.
- **`lang="it"`** al posto di `lang="en"`, su un'app interamente in italiano; 404 e schermata
  d'errore tradotte; anteprima social ripulita dall'immagine Lovable scaduta e da
  `twitter:site` che puntava a `@Lovable`.
- **Tocco e tastiera**: nessun `:focus-visible` era definito (ora c'è una regola globale);
  chip presenza, filtri e bottoni icona portati a 44px; `aria-current` sulla navigazione,
  `aria-pressed` sui controlli a stato, `aria-controls` sulle sezioni a tendina, `aria-busy`
  sui caricamenti. Il testo sotto i 12px è sparito (108 occorrenze).
- **Movimento** (DD-021): molle interrompibili di `motion` al posto delle `@keyframes` a
  durata fissa. `Reveal` compare quando entra davvero nel viewport (prima consumava
  l'animazione a vuoto sotto la piega); `Barra` anima `scaleX` invece di `width`; `Numero`
  cambia rotta se il dato cambia a metà conteggio. Il calendario si cambia mese anche con lo
  swipe, con il punto d'arrivo scelto proiettando la velocità di rilascio.
- **Meno dipendenze** (DD-021): rimossi 43 componenti `src/components/ui/` non importati da
  nessuna parte e ~45 dipendenze (tutti i `@radix-ui/*`, `recharts`, `react-hook-form`,
  `date-fns`, `embla`, `cmdk`; `zod` resta perché lo usano le route API). Restano `drawer` e
  `sonner`. Il bundle **non** cala per questo — quel codice era già escluso dal
  tree-shaking — ma cala la superficie da aggiornare e da controllare: 50 dipendenze dirette
  diventano 21. Il bundle client cresce di ~42 KB gzip per `motion` (267 → 308 KB).
- **Primitiva `Card`**: `rounded-3xl bg-card p-4 shadow-card` era ricopiato a mano 22 volte.
- **Tema scuro rimosso** (DD-022): esisteva un blocco `.dark` mai applicato e incoerente.
- Tolte le quattro switch di notifica in `/profilo` che erano `defaultChecked` e non facevano
  niente, e la conferma nativa prima di _cambiare_ la foto profilo (resta su quella che la
  rimuove, che è irreversibile).
- Le celle del calendario con più tipi di evento non usano più un gradiente a fette con
  un'ombra bianca sul numero per restare leggibili: fondo neutro e un puntino per tipo.

### Serie di presenze calcolate sui dati reali

- `serieConsecutiva()` (`src/lib/presenze.ts`) deriva le serie da eventi passati e
  `risposte_presenze`: prima erano `0` fisso in `useRosa()` e la sezione «Serie di presenze»
  del profilo era di fatto inerte, insieme ai badge e all'obiettivo «Continuità di squadra»
  che ne dipendono.
- Migration `m9_risposte_presenze_risposto_il`: nuova colonna `risposto_il` con l'istante
  della **prima** risposta, resa immutabile da un trigger (`aggiornato_il` registrava solo
  l'ultima modifica, quindi chi rispondeva subito e cambiava idea dopo risultava lento).
  Confrontata con `eventi_app.creato_il` sblocca finalmente la serie "Conferme 24h" e i badge
  "Risposta lampo" e "Mai un forfait". Il dato non è ricostruibile all'indietro: vale da qui
  in avanti (vedi [modules/serie-presenze.md](modules/serie-presenze.md)).
- La barra di progresso di una serie ora misura l'avanzamento fra il traguardo raggiunto e il
  successivo: prima usava `valore/prossimo` e tornava indietro a ogni traguardo (2/3 = 67%,
  poi 3/6 = 50%).

### Segnalazioni dal profilo

- «Segnala un bug» e «Suggerisci una nuova funzionalità» in `/profilo` → Impostazioni: due
  link che aprono una issue GitHub sul template giusto
  (`.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`). Nessuna tabella e nessuna
  schermata di gestione: la segnalazione vive su GitHub
  (vedi [modules/profilo-giocatore.md](modules/profilo-giocatore.md)).

### Autenticazione e dashboard amministratore (in produzione)

- Login con Google tramite Supabase Auth (DD-011). Al primo accesso l'account si collega a
  un giocatore di `giocatori_squadra`, e il collegamento non è più modificabile dal
  giocatore stesso (DD-016 regola 2).
- La selezione libera del giocatore è stata rimossa: `/benvenuto` offre solo l'accesso con
  Google e senza sessione non si entra in nessuna schermata. Sparita anche la variabile
  `VITE_AUTH_OBBLIGATORIA` (non serve più) e il pulsante «Cambia giocatore» in `/profilo`.
- I permessi di amministrazione arrivano solo da `user_roles` (`src/lib/ruoli.ts`): la lista
  di nomi in `crapp-data.ts` è stata eliminata, altrimenti bastava scegliere il nome giusto
  per amministrare.
- Migration `m4_solo_autenticati`: toglie al ruolo `anon` l'accesso alle tabelle v1.0.
  Applicata in produzione il 03/09/2026, dopo aver impostato l'email di tutta la rosa
  attiva — il login era già l'unica via d'accesso lato app, quindi il collegamento dei
  singoli account (che resta un processo continuo a ogni login) non era comunque
  condizionato da questa migration.
- Collegamento automatico al proprio giocatore per email (DD-018, migration
  `m5_email_giocatori_squadra`): niente più scelta manuale da un elenco, `/benvenuto`
  confronta l'email dell'account Google con `giocatori_squadra.email` e collega da solo.
  Senza corrispondenza compare solo un messaggio d'errore, con un pulsante per uscire e
  riprovare con un altro account.
- Dashboard admin: nuove azioni "Aggiungi giocatore" (con email opzionale per il
  collegamento automatico) e "Disattiva/Riattiva giocatore" per chi lascia la squadra — la
  riga non viene mai eliminata, così presenze, voti, pagelle e badge della stagione restano
  agganciati al suo id. L'email è anche modificabile dal pannello "Dati squadra" di ogni
  giocatore già in rosa.
- Tracciamento tesseramento CSI (migration `m8_tesseramento_csi`): numero e data di tessera
  in `giocatori_squadra`, come gli altri campi che gestisce solo l'admin (DD-016/DD-018). La
  dashboard mostra chi è già tesserato (badge sulla scheda, contatore in "Squadra") e un
  pannello per registrare numero e data una volta arrivata la tessera dal CSI.
- Profilo giocatore: da `/profilo` ognuno compila i propri dati anagrafici e carica
  documento, certificato medico e foto tessera con le relative scadenze
  ([modules/profilo-giocatore.md](modules/profilo-giocatore.md)).
- Nuova schermata `/admin`: stato dei profili della squadra, download di documento,
  certificato e foto tessera, export CSV per il tesseramento CSI.
- Migration `m2_profili_giocatore` (tabella dei profili e bucket privato), additiva.
- Dalla dashboard l'amministratore modifica i dati squadra (nome, cognome, numero, ruolo),
  compila i dati personali al posto di un giocatore e scollega un account da un profilo
  (DD-017). I file restano esclusi: li carica solo il giocatore. Nessuna migration: le
  policy di M1 e M2 lo consentivano già.
- Foto profilo sincronizzate tra dispositivi: da `/profilo` la foto caricata finisce nel
  bucket pubblico `avatar-giocatori` (migration `m6_avatar_giocatori`) invece che in
  `localStorage`, così compare per tutta la squadra e non solo su chi l'ha caricata.
  L'Avatar mostra numero/iniziali finché la foto non è presente.
- Scout Live sincronizzato tra dispositivi: il blocco "chi sta scoutando" ora passa dalla
  tabella `scout_sessioni` invece che da `localStorage`, quindi due telefoni non possono più
  prendere il controllo insieme sovrascrivendosi a vicenda. Le partite scoutate concluse
  vengono archiviate nella nuova tabella `scout_partite` (migration `m7_scout_partite`):
  prima restavano visibili solo sul telefono di chi aveva chiuso la partita.

### Test

- Suite di test in `test/` (unit, integration, end-to-end) eseguita con bun,
  senza nuove dipendenze: `npm run test` e `npm run test:all`.
- Corretto un difetto emerso dai test: una sessione Scout Live con timestamp
  illeggibile restava bloccata per sempre invece di scadere.

### Collegamento CSI

- Classifica e risultati ufficiali letti dal portale Livescore CSI Bologna
  (stagione 2025/26, Campionato Open Misto Eccellenza, Girone B).
- La pagina Campionato non usa più dati dimostrativi.
- Dettagli e limiti in [modules/collegamento-csi.md](modules/collegamento-csi.md).

### Infrastruttura

- Migrazione completa da Lovable a sviluppo locale.
- Configurazione Git.
- Repository GitHub indipendente.
- Deploy automatico tramite Vercel.
- Branch main e develop.

## Versione 1.0 — luglio 2026

Prima versione usata dalla squadra. Funzionalità incluse: vedi
[ROADMAP.md § Versione 1.0](ROADMAP.md#versione-10--rilasciata).
