# Project State

Ultimo aggiornamento: 01/10/2026

Questo file dice **a che punto siamo ora**. Le funzionalità stanno in
[docs/ROADMAP.md](docs/ROADMAP.md), i rilasci in [docs/CHANGELOG.md](docs/CHANGELOG.md), lo
schema in [docs/DATABASE.md](docs/DATABASE.md), le procedure in
[docs/OPERATIONS.md](docs/OPERATIONS.md). Non ripetere qui quello che hanno già loro.

## Stato generale

- **Versione in produzione:** 1.2.1 su `main` — notifiche su tre canali (push, in-app, email),
  promemoria che non si ripetono, turno palloni e solleciti presenze automatici.
- **Backend:** Supabase proprietario (`kfkcldwncxqaixetsjes`). Lovable Cloud e il vecchio
  Project Ref `hetycilxgkdmccelwerq` non si usano più.
- **Migration:** 37 file in `supabase/migrations/`, fino a `m26_notifiche_automatiche`, tutte
  applicate in produzione (verificato con `npx supabase migration list` il 30/09/2026).
- **Worker delle notifiche** (`mailer/`): in funzione su un Raspberry Pi con Docker dal 29/09/2026
  ([docs/WORKER_EMAIL.md](docs/WORKER_EMAIL.md)). Il codice con l'interruttore «Email» in Profilo
  è su `develop`, non ancora su `main`.
- **Accesso:** il login Google è l'unica via d'ingresso; i permessi di amministrazione arrivano
  solo da `user_roles`. Il collegamento degli account è un processo continuo: ogni giocatore si
  collega al primo accesso (DD-018).
- **Lavoro in corso:** niente di assegnato. Le voci aperte stanno in
  [docs/ROADMAP.md](docs/ROADMAP.md), sotto «Prossimo».

## Cose da sapere

- Si lavora direttamente su `main` (DD-019); Cursor e Claude Code sono gli ambienti di sviluppo.
- Dev e produzione condividono lo stesso progetto Supabase: un account di prova che collega uno
  slot lo occupa anche in produzione e va liberato da un admin.
- Lo slot `g18` «Beta Tester» è impostato come allenatore in produzione (24/09/2026). Numero 99
  e ruolo «Palleggiatore» sono rimasti apposta per la 0.9.2: da svuotare da `/admin` se ancora
  presenti.

## Note

Il progetto segue una metodologia document-first (DD-002): ogni funzionalità si progetta in
`docs/modules/` prima di essere implementata.
