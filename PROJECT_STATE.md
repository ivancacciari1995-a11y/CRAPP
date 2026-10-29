# Project State

Ultimo aggiornamento: 26/10/2026

Questo file dice **a che punto siamo ora**. Le funzionalità stanno in
[docs/ROADMAP.md](docs/ROADMAP.md), i rilasci in [docs/CHANGELOG.md](docs/CHANGELOG.md), lo
schema in [docs/DATABASE.md](docs/DATABASE.md), le procedure in
[docs/OPERATIONS.md](docs/OPERATIONS.md). Non ripetere qui quello che hanno già loro.

## Stato generale

- **Versione:** 1.5.0 su `main` (tag `v1.5.0`): campionato CSI sulla stagione 2026/27 (nuovi `project_id`
  e `team_id`, nessuna Coppa). Su `feature/gara` c'è del lavoro non ancora rilasciato (voto MVP, vedi
  «Lavoro in corso»). La 1.4.2: ogni evento può avere un link Google Maps del luogo, mostrato come
  «Apri su Maps» nelle schede (`m34`). La 1.4.1: gli eventi con convocati si
  vedono solo ai convocati (admin e allenatori sempre) e «Rosa e presenze» elenca solo loro. La 1.4.0:
  avviso «Presenza modificata» ad admin e allenatori (DD-050, `m32`-`m33`). La 1.3.1: il Calendario
  mostra solo i prossimi compleanni del mese; tolta la serie «Conferme 24h» con i badge «Risposta
  lampo» e «Mai un forfait». La 1.3.0 portava la notifica di compleanno, gli obiettivi cliccabili, le
  presenze sui convocati, gli avvisi in Home ridisegnati e i caratteri più grandi. Dettaglio in
  [docs/CHANGELOG.md](docs/CHANGELOG.md).
- **Backend:** Supabase proprietario (`kfkcldwncxqaixetsjes`). Lovable Cloud e il vecchio
  Project Ref `hetycilxgkdmccelwerq` non si usano più.
- **Migration:** 49 file in `supabase/migrations/`, fino a `m38_nome_votato_badge_social`. In produzione
  sono applicate 45 su 49, fino alla `m34_link_maps_evento` (verificato con
  `npx supabase migration list --linked` il 26/10/2026: le uniche mancanti sono `m35`-`m38`, nessuna
  migration remota è assente dal repository). **Da applicare ancora: `m35`-`m38`**
  (voto MVP e badge social, DD-051 e DD-052, branch `feature/gara`): `npx supabase db push` è rinviato
  per scelta, non è stato eseguito. Vanno applicate subito prima del rilascio del codice: con le sole
  migration il voto MVP dell'app in produzione (1.4.2) smette di funzionare, con il solo codice la
  vista dei conteggi non esiste.
- **Worker delle notifiche** (`mailer/`): in funzione su un Raspberry Pi con Docker dal 29/09/2026
  ([docs/WORKER_EMAIL.md](docs/WORKER_EMAIL.md)). Il codice con l'interruttore «Email» in Profilo
  è su `main` dalla 1.3.0.
- **Accesso:** il login Google è l'unica via d'ingresso; i permessi di amministrazione arrivano
  solo da `user_roles`. Il collegamento degli account è un processo continuo: ogni giocatore si
  collega al primo accesso (DD-018).
- **Lavoro in corso:** branch `feature/gara` per le funzioni di gara (correzioni e nuove
  funzioni; in futuro anche lo scouting). Primo lavoro: il voto MVP definitivo, segreto, a tempo e
  tra presenti, con i pari merito (DD-051, DD-052). Non ancora in `main`, non rilasciato, versione
  invariata. Le altre voci aperte stanno in [docs/ROADMAP.md](docs/ROADMAP.md), sotto «Prossimo».

## Cose da sapere

- Si lavora direttamente su `main` (DD-019); Cursor e Claude Code sono gli ambienti di sviluppo.
- Dev e produzione condividono lo stesso progetto Supabase: un account di prova che collega uno
  slot lo occupa anche in produzione e va liberato da un admin.
- Lo slot `g18` «Beta Tester» è un giocatore in produzione (dal 09/10/2026, prima era allenatore), numero 99 e
  ruolo «Palleggiatore»; non è collegato a nessun account. Serve per provare le notifiche con un secondo utente.

## Note

Il progetto segue una metodologia document-first (DD-002): ogni funzionalità si progetta in
`docs/modules/` prima di essere implementata.
