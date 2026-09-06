# Changelog

Tutte le modifiche significative del progetto, dalla più recente. Il formato segue
[Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e la numerazione
[Semantic Versioning](https://semver.org/lang/it/): il numero di versione è quello di
`package.json`.

L'elenco delle funzionalità disponibili e previste non si ripete qui: sta in
[ROADMAP.md](ROADMAP.md), che elenca il _cosa_ senza numeri di versione — quelli stanno solo
qui.

## [Non rilasciato] — 0.9.0

Prima versione, pre-release.

### Aggiunto

- Login con Google tramite Supabase Auth e collegamento automatico dell'account al proprio
  giocatore confrontando l'email (DD-011, DD-018; migration `m5_email_giocatori_squadra`):
  senza sessione non si entra in nessuna schermata.
- Dashboard amministratore `/admin`: stato dei profili, download di documento, certificato e
  foto tessera, export CSV per il tesseramento, aggiunta e disattivazione dei giocatori
  (la riga non viene mai eliminata, così presenze, voti e badge restano agganciati al suo id).
- Profilo giocatore: dati anagrafici, documento, certificato medico e foto tessera con le
  relative scadenze (migration `m2_profili_giocatore`, bucket privato), divisi nelle tab
  Stagione, Documenti e Opzioni — [modules/profilo-giocatore.md](modules/profilo-giocatore.md).
- Tracciamento del tesseramento CSI: numero e data di tessera in `giocatori_squadra`, badge e
  contatore in dashboard (migration `m8_tesseramento_csi`).
- Foto profilo condivise tra dispositivi tramite il bucket pubblico `avatar-giocatori`
  (migration `m6_avatar_giocatori`).
- Serie di presenze calcolate sui dati reali (`serieConsecutiva()`), con la colonna
  `risposto_il` che congela l'istante della **prima** risposta tramite trigger (migration
  `m9_risposte_presenze_risposto_il`): sblocca la serie "Conferme 24h" e i badge "Risposta
  lampo" e "Mai un forfait" — [modules/serie-presenze.md](modules/serie-presenze.md).
- Scout Live sincronizzato tra dispositivi: il blocco "chi sta scoutando" passa dalla tabella
  `scout_sessioni` e le partite concluse vengono archiviate in `scout_partite` (migration
  `m7_scout_partite`). Si apre dalla sezione «Scout live» di `/partita/$id`, solo il giorno
  della partita, e può usarlo chiunque sia autenticato: uno per volta, grazie al lock.
- Votazione MVP legata all'evento CrAPP e non al referto CSI o allo Scout: si apre due ore
  dopo `data`+`ora` della partita, anche senza risultato caricato — [modules/mvp.md](modules/mvp.md).
- Sondaggio pre-partita con apertura programmata alle 8:00 del giorno della partita e
  pulsante «Avvisa tutti del sondaggio» per gli amministratori
  (`POST /api/public/apri-sondaggio`); nessun cron, l'invio è manuale.
- Turni palloni con rotazione automatica sulle partite e assegnazione manuale per gli
  allenamenti, che restano «da assegnare» finché non si sceglie (migration M10).
- Notifiche push con il testo cifrato **dentro** la push (`aes128gcm`, RFC 8291), così
  arrivano anche ad app chiusa e a schermo bloccato (DD-026).
- Collegamento CSI: classifica e risultati ufficiali letti dal portale Livescore CSI Bologna
  (stagione 2025/26, Open Misto Eccellenza, Girone B) —
  [modules/collegamento-csi.md](modules/collegamento-csi.md).
- Note dell'evento visibili in `/allenamento/$id` e `/partita/$id`, con gli a capo mantenuti.
- «Segnala un bug» e «Suggerisci una nuova funzionalità» in `/profilo`: due link che aprono
  una issue GitHub sul template giusto, senza tabelle né schermate di gestione.
- Interfaccia accessibile: contrasto dei token colore sopra 4.5:1, `viewport-fit=cover` e
  `theme-color` coerenti con un'app chiara, `lang="it"`, `:focus-visible` globale, tocchi da
  44px, `aria-current`/`aria-pressed`/`aria-controls`/`aria-busy`, niente testo sotto i 12px.
- Movimento con molle interrompibili di `motion` al posto delle `@keyframes` a durata fissa,
  swipe fra i mesi del calendario e barre di progresso che misurano l'avanzamento tra un
  traguardo e il successivo (DD-021).
- Suite di test in `test/` (unit, integration, end-to-end) eseguita con bun e senza nuove
  dipendenze: `npm run test` e `npm run test:all`.
- Convenzioni interne: primitive condivise (`Card`, `Campo`, `classiInput` in `ui-bits`),
  cache aggiornata con `setQueryData` invece di rileggere il database dopo ogni scrittura, e
  logica pura estratta in `src/lib/` con i suoi test.
- Infrastruttura di sviluppo: migrazione da Lovable a sviluppo locale, repository GitHub
  indipendente, deploy automatico su Vercel.

### Sicurezza

- Migration `m4_solo_autenticati`: tolto al ruolo `anon` l'accesso alle tabelle dell'app
  (applicata in produzione il 03/09/2026).
- I permessi di amministrazione arrivano solo da `user_roles` (`src/lib/ruoli.ts`): senza,
  basterebbe scegliere il nome giusto per amministrare.
- Migration `m11_scritture_per_ruolo`: ogni voto è firmato con lo slot collegato all'account
  (DD-023); il collegamento account → giocatore non è modificabile dal giocatore stesso
  (DD-016).
- Migration `m12_niente_autovoto`: i vincoli `mvp_no_autovoto` e `badge_social_no_autovoto`
  rifiutano l'auto-voto anche a chi scrive direttamente su PostgREST, come già faceva
  `pagelle_voti`.
- Al voto MVP partecipano solo i presenti (o in ritardo) di quell'evento; il filtro è
  applicativo, non RLS ([modules/mvp.md](modules/mvp.md)).
- La suite copre i rifiuti `401` di `richiediAdmin` (DD-024), i permessi di
  `badge_social_voti` e le deroghe admin di M11, e verifica che un ripensamento non riscriva
  `risposto_il` (trigger di `m9`).
