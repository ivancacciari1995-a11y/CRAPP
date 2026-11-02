# Project State

Ultimo aggiornamento: 02/11/2026

Questo file dice **a che punto siamo ora**. Le funzionalità stanno in
[docs/ROADMAP.md](docs/ROADMAP.md), i rilasci in [docs/CHANGELOG.md](docs/CHANGELOG.md), lo
schema in [docs/DATABASE.md](docs/DATABASE.md), le procedure in
[docs/OPERATIONS.md](docs/OPERATIONS.md). Non ripetere qui quello che hanno già loro.

## Stato generale

- **Versione:** 1.6.0 su `main` (tag `v1.6.0`), pubblicata il 02/11/2026: voto MVP definitivo, segreto e a
  tempo (DD-051, DD-052) e Scout live a valutazioni − / + (DD-053). La 1.5.0: campionato CSI sulla stagione 2026/27 (nuovi `project_id` e `team_id`,
  nessuna Coppa). La 1.4.2: ogni evento può avere un link Google Maps del luogo, mostrato come
  «Apri su Maps» nelle schede (`m34`). La 1.4.1: gli eventi con convocati si
  vedono solo ai convocati (admin e allenatori sempre) e «Rosa e presenze» elenca solo loro. La 1.4.0:
  avviso «Presenza modificata» ad admin e allenatori (DD-050, `m32`-`m33`). La 1.3.1: il Calendario
  mostra solo i prossimi compleanni del mese; tolta la serie «Conferme 24h» con i badge «Risposta
  lampo» e «Mai un forfait». La 1.3.0 portava la notifica di compleanno, gli obiettivi cliccabili, le
  presenze sui convocati, gli avvisi in Home ridisegnati e i caratteri più grandi. Dettaglio in
  [docs/CHANGELOG.md](docs/CHANGELOG.md).
- **Backend:** Supabase proprietario (`kfkcldwncxqaixetsjes`). Lovable Cloud e il vecchio
  Project Ref `hetycilxgkdmccelwerq` non si usano più.
- **Migration:** 50 file in `supabase/migrations/`, fino a `m39_scout_valutazioni`. In produzione sono
  applicate tutte e 50 (`npx supabase db push` del 02/11/2026: `m35`-`m39`, verificato con
  `npx supabase migration list --linked`; nessuna migration remota è assente dal repository). Prima
  del push è stato salvato lo schema di produzione (solo schema, non i dati).
- **Worker delle notifiche** (`mailer/`): in funzione su un Raspberry Pi con Docker dal 29/09/2026
  ([docs/WORKER_EMAIL.md](docs/WORKER_EMAIL.md)). Il codice con l'interruttore «Email» in Profilo
  è su `main` dalla 1.3.0.
- **Accesso:** il login Google è l'unica via d'ingresso; i permessi di amministrazione arrivano
  solo da `user_roles`. Il collegamento degli account è un processo continuo: ogni giocatore si
  collega al primo accesso (DD-018).
- **Lavoro in corso:** nessuno su branch. Le voci aperte stanno in [docs/ROADMAP.md](docs/ROADMAP.md), sotto
  «Prossimo». Da decidere sullo scout: il pulsante «Annulla» in alto agisce solo sulle azioni, che non
  si creano più, quindi è sempre spento.

## Cose da sapere

- Si lavora direttamente su `main` (DD-019); Cursor e Claude Code sono gli ambienti di sviluppo.
- Dev e produzione condividono lo stesso progetto Supabase: un account di prova che collega uno
  slot lo occupa anche in produzione e va liberato da un admin.
- Lo slot `g18` «Beta Tester» è un giocatore in produzione (dal 09/10/2026, prima era allenatore), numero 99 e
  ruolo «Palleggiatore»; non è collegato a nessun account. Serve per provare le notifiche con un secondo utente.

## Note

Il progetto segue una metodologia document-first (DD-002): ogni funzionalità si progetta in
`docs/modules/` prima di essere implementata.
