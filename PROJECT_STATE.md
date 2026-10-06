# Project State

Ultimo aggiornamento: 06/10/2026

Questo file dice **a che punto siamo ora**. Le funzionalità stanno in
[docs/ROADMAP.md](docs/ROADMAP.md), i rilasci in [docs/CHANGELOG.md](docs/CHANGELOG.md), lo
schema in [docs/DATABASE.md](docs/DATABASE.md), le procedure in
[docs/OPERATIONS.md](docs/OPERATIONS.md). Non ripetere qui quello che hanno già loro.

## Stato generale

- **Versione:** 1.2.3 (in produzione su `main` la 1.2.2) — notifiche su tre canali, avvisi di palloni
  (3 ore prima) e presenze (24 ore prima) una sola volta, niente promemoria evento, niente foto
  tessera, avviso certificato a 30 giorni per il giocatore, avviso rosso per chi non l'ha caricato.
- **Backend:** Supabase proprietario (`kfkcldwncxqaixetsjes`). Lovable Cloud e il vecchio
  Project Ref `hetycilxgkdmccelwerq` non si usano più.
- **Migration:** 42 file in `supabase/migrations/`, fino a `m31_notifica_compleanno`. Le prime 41 (fino a
  `m30_sollecito_solo_24h`) sono applicate in produzione (verificato con `npx supabase migration list` il
  01/10/2026); la `m31` no, ancora da applicare (DD-047). La `m29` toglie
  `foto_path`: il codice che non la legge più (1.2.2) va rilasciato.
- **Su `develop`, non ancora rilasciato:** obiettivi cliccabili con card di dettaglio, presenze del mese
  calcolate sui convocati, obiettivi «Presenze collettive» e «evento di squadra al mese» (ora dell'evento),
  tessera CSI tolta dalla dashboard (DD-048), avvisi in Home ridisegnati e caratteri più grandi in tutta l'app (DD-049), notifica di compleanno (DD-047, migration `m31`). Dettaglio in
  [docs/CHANGELOG.md](docs/CHANGELOG.md).
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
