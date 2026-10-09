# Project State

Ultimo aggiornamento: 06/10/2026

Questo file dice **a che punto siamo ora**. Le funzionalità stanno in
[docs/ROADMAP.md](docs/ROADMAP.md), i rilasci in [docs/CHANGELOG.md](docs/CHANGELOG.md), lo
schema in [docs/DATABASE.md](docs/DATABASE.md), le procedure in
[docs/OPERATIONS.md](docs/OPERATIONS.md). Non ripetere qui quello che hanno già loro.

## Stato generale

- **Versione:** 1.4.0 (in produzione su `main` la 1.3.0, tag `v1.3.0`) — avviso «Presenza modificata» ad admin e
  allenatori (DD-050, `m32`-`m33`). La 1.3.1: il Calendario mostra solo i prossimi
  compleanni del mese; tolta la serie «Conferme 24h» con i badge «Risposta lampo» e «Mai un forfait». La 1.3.0
  portava la notifica di compleanno, gli obiettivi cliccabili, le presenze sui convocati, gli avvisi in Home
  ridisegnati e i caratteri più grandi. Dettaglio in [docs/CHANGELOG.md](docs/CHANGELOG.md).
- **Backend:** Supabase proprietario (`kfkcldwncxqaixetsjes`). Lovable Cloud e il vecchio
  Project Ref `hetycilxgkdmccelwerq` non si usano più.
- **Migration:** 44 file in `supabase/migrations/`, fino a `m33_presenza_modificata_allenatori`. Tutte applicate in produzione (verificato con `npx supabase migration list` il
  09/10/2026; la `m32` è l'avviso «Presenza modificata» ai soli admin, DD-050). La `m33`, che lo estende agli allenatori, è stata applicata il 09/10/2026. La `m29` toglie
  `foto_path`: il codice che non la legge più (1.2.2) va rilasciato.
- **Worker delle notifiche** (`mailer/`): in funzione su un Raspberry Pi con Docker dal 29/09/2026
  ([docs/WORKER_EMAIL.md](docs/WORKER_EMAIL.md)). Il codice con l'interruttore «Email» in Profilo
  è su `main` dalla 1.3.0.
- **Accesso:** il login Google è l'unica via d'ingresso; i permessi di amministrazione arrivano
  solo da `user_roles`. Il collegamento degli account è un processo continuo: ogni giocatore si
  collega al primo accesso (DD-018).
- **Lavoro in corso:** niente di assegnato. Le voci aperte stanno in
  [docs/ROADMAP.md](docs/ROADMAP.md), sotto «Prossimo».

## Cose da sapere

- Si lavora direttamente su `main` (DD-019); Cursor e Claude Code sono gli ambienti di sviluppo.
- Dev e produzione condividono lo stesso progetto Supabase: un account di prova che collega uno
  slot lo occupa anche in produzione e va liberato da un admin.
- Lo slot `g18` «Beta Tester» è un giocatore in produzione (dal 09/10/2026, prima era allenatore), numero 99 e
  ruolo «Palleggiatore»; non è collegato a nessun account. Serve per provare le notifiche con un secondo utente.

## Note

Il progetto segue una metodologia document-first (DD-002): ogni funzionalità si progetta in
`docs/modules/` prima di essere implementata.
