# Project State

Ultimo aggiornamento: 09/09/2026

## Stato generale

Fase corrente:

Backend migrato al nuovo Supabase proprietario. Autenticazione Google, dashboard
amministratore e Profilo Giocatore (lato giocatore e lato admin) sono in produzione su `main`.
Foto profilo (M6) e Scout Live (M7) non dipendono più da `localStorage`: entrambi ora
sincronizzano tra dispositivi tramite Supabase. Le serie di presenze sono calcolate sui dati
reali (M9). Prima versione pre-release rilasciata (0.9.0, vedi `docs/CHANGELOG.md`). Cancellare
un evento pulisce ora a cascata tutte le tabelle collegate (M14) e le righe orfane da
cancellazioni precedenti a M14 sono state bonificate una tantum (M15/M16).

---

## Infrastruttura

- Si lavora direttamente su `main` (DD-019): `develop` esiste ma è fermo indietro, quindi la
  sua preview Vercel non rappresenta lo stato attuale
- Cursor e Claude Code come ambienti di sviluppo
- Vercel configurato; Environment Variables aggiornate al nuovo Supabase (Preview e Production)
- Supabase proprietario attivo — Project Ref: `kfkcldwncxqaixetsjes`
- 27 migration in `supabase/migrations/`, fino a `m16_funzione_bonifica_dati_evento_orfani`
  (09/09/2026)
- Sviluppo locale verificato con il nuovo Supabase

---

## Backend

- Backend operativo: Supabase proprietario (`kfkcldwncxqaixetsjes`)
- Lovable Cloud: non più backend operativo di CrAPP
- Vecchio Project Ref `hetycilxgkdmccelwerq`: deprecato, non utilizzare

---

## Database

- Schema v1.0 e migration da M1 a M16 applicate al nuovo Supabase
  (`m16_funzione_bonifica_dati_evento_orfani` in produzione dal 09/09/2026, verificata con
  `npx supabase migration list`)
- `public.giocatori_squadra`: rosa iniziale di 17 giocatori (migration `m5_email_giocatori_squadra`)
  più quelli aggiunti da `/admin` a stagione in corso; da settembre 2026 tutti i giocatori
  attivi hanno l'email registrata (colonna `email`, DD-018), impostabile da `/admin` senza
  bisogno di una migration
- `public.giocatori_squadra` è ora la source of truth della rosa letta dall'app (DD-015,
  03/09/2026): «Aggiungi giocatore» e «Disattiva giocatore» della dashboard admin si
  riflettono su Squadra, Presenze, Pagelle, Badge e Scout. `src/lib/crapp-data.ts` resta
  solo come seed storico, fallback offline e sorgente della data di nascita (colonna non
  ancora presente su `giocatori_squadra`)
- Migration `m6_avatar_giocatori`: bucket pubblico `avatar-giocatori` per le foto profilo,
  al posto di `localStorage` (una per giocatore, letto da `src/lib/avatar-store.ts`)
- Migration `m10_azzera_turni_palloni_allenamenti`: toglie i turni palloni salvati sugli
  allenamenti, che non ricevono più una proposta automatica (vedi
  [docs/modules/palloni.md](docs/modules/palloni.md))
- Migration `m11_scritture_per_ruolo`: le policy di scrittura rispecchiano i permessi
  dell'interfaccia (DD-023). Fino a M10 un qualsiasi utente autenticato poteva svuotare il
  calendario o riscrivere il voto di un altro parlando direttamente con PostgREST; la tabella
  dei permessi sta in [docs/DATABASE.md](docs/DATABASE.md) ed è verificata da
  `test/integration/permessi.test.ts`
- Migration `m7_scout_partite`: nuova tabella `scout_partite` per l'archivio delle partite
  scoutate concluse, e collegamento della tabella `scout_sessioni` (già presente nello
  schema ma mai usata) al blocco condiviso dello Scout Live — prima entrambi vivevano solo
  in `localStorage`, quindi visibili a un solo dispositivo
- Migration `m13_convocati_e_pagelle_chiuse`: le RLS di `mvp_voti`/`pagelle_voti`/
  `badge_social_voti` richiedono che votante e votato siano convocati all'evento (e per le
  pagelle anche `pagelle_chiuse = false`)
- Migration `m14_pulizia_dati_evento_cancellato` (DD-029): cancellare un evento pulisce a
  cascata, tramite trigger, tutte le tabelle collegate (`risposte_presenze`,
  `cacche_partita`, `mvp_voti`, `pagelle_voti`, `badge_social_voti`, `turni_palloni`,
  `scout_sessioni`, `scout_live`, `scout_partite`)
- Migration `m15_bonifica_dati_evento_orfani`: bonifica una tantum delle righe orfane da
  cancellazioni di eventi precedenti a M14, senza toccare i vecchi voti MVP/pagelle/badge
  social legati a id Scout o CSI
- Migration `m16_funzione_bonifica_dati_evento_orfani`: la stessa logica di bonifica di M15
  resta richiamabile come funzione `bonifica_dati_evento_orfani()` (riservata al service
  role), se mai servisse di nuovo

---

## Moduli completati

- Squadra
- Presenze
- Badge (incluso badge social)
- Scout Live (blocco e archivio partite sincronizzati tra dispositivi, migration `m7_scout_partite`)
- Pagelle
- MVP
- Obiettivi di squadra
- Turno palloni (specifica in `docs/modules/palloni.md`)
- Infortuni, in forma minima (specifica in `docs/modules/infortuni.md`)
- Notifiche
- Profilo Giocatore (specifica in `docs/modules/profilo-giocatore.md`)
- Serie di presenze (specifica in `docs/modules/serie-presenze.md`)
- Collegamento CSI: classifica campionato e Coppa, storico e dettaglio partita — formazioni,
  scontri diretti (specifica in `docs/modules/collegamento-csi.md`)

---

## Autenticazione e dashboard amministratore

In produzione su `main`. **Il login è l'unica via d'accesso** (31/08/2026): la selezione
libera del giocatore non esiste più, senza sessione Google si resta su `/benvenuto`, e i
permessi di amministrazione arrivano solo da `user_roles`.

**Attenzione all'ordine:** finché il provider Google è spento in Supabase, «Accedi con
Google» risponde

```
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

e **nessuno entra nell'app**. Vale ancora per chi allestisce un ambiente nuovo (per esempio
lo stack Supabase locale): il passo 1 qui sotto va fatto per primo.

Passaggi in ordine, nessuno dei quali è reversibile a metà. **Stato al 04/09/2026: fatti i
passaggi 1, 2, 3 e 5 (M4 applicata); il passaggio 4 è un processo continuo (7 dei 16 giocatori
attivi hanno già fatto il primo accesso).**

1. **Provider Google in Supabase** — Google Cloud Console: consent screen _External_ (scope
   `email` e `profile`, non sensibili: nessuna verifica richiesta, e la modalità _Testing_
   regge fino a 100 utenti, più che sufficiente per la squadra), credenziale
   _Web application_ con redirect URI
   `https://kfkcldwncxqaixetsjes.supabase.co/auth/v1/callback`. Client ID e
   secret in _Authentication → Providers → Google_. In _URL Configuration_: Site URL di
   produzione, più `localhost:8080` e il wildcard delle preview Vercel tra i Redirect URLs.
   Per provare sullo stack locale invece che sul cloud servono anche `enabled = true` in
   `[auth.external.google]` di `supabase/config.toml`, le due variabili
   `SUPABASE_AUTH_GOOGLE_*` in `.env` e una credenziale con redirect URI
   `http://127.0.0.1:54321/auth/v1/callback`.
2. **Migration M2** (`supabase db push`). È un `CREATE` puro: si può applicare in
   produzione senza toccare il comportamento attuale.
3. **Primo admin**, dopo il primo login (l'ID esiste solo da quel momento):
   `INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE email = '<mail>';`
4. **Collegamento degli account**: ciascuno accede con Google e viene collegato in
   automatico al proprio giocatore per email (DD-018) — nessuna scelta manuale. Finché
   l'email di un giocatore non è impostata, il suo accesso mostra un errore; da `/admin` si
   imposta l'email di un giocatore (nuovo o esistente) senza bisogno di una migration. Da
   settembre 2026 tutti i giocatori attivi hanno l'email registrata, ma il collegamento vero
   e proprio (`auth_user_id`) avviene solo al primo login di ciascuno, quindi resta un
   processo continuo che si ripete a ogni nuovo giocatore aggiunto a stagione in corso. Uno
   slot già collegato può essere liberato solo da un admin.
5. **Solo a squadra collegata**: migration `m4_solo_autenticati`, che toglie al ruolo `anon`
   l'accesso alle tabelle v1.0. Da lì in poi i dati sono raggiungibili solo con una sessione;
   le route in `src/routes/api/public/` usano la service role e continuano a funzionare.
   **Applicata in produzione il 03/09/2026** — non è più necessario aspettare che l'intera
   rosa abbia già fatto login: il login era già l'unica via d'accesso lato app, quindi i
   giocatori non ancora collegati non erano comunque impattati; M4 chiudeva solo un residuo
   di accesso diretto al database bypassando l'app.

Attenzione: dev e produzione condividono lo stesso progetto Supabase. Un account di prova che
collega uno slot lo occupa anche in produzione, e va liberato da un admin.

## Prossimo sviluppo

Niente di assegnato: tutto quello che era in lavorazione è chiuso, tesseramento CSI incluso
(numero e data di tessera registrabili da `/admin`, migration `m8_tesseramento_csi`). Le voci
ancora aperte stanno in [docs/ROADMAP.md](docs/ROADMAP.md), sotto «Prossimo».

---

## Note

Il progetto segue una metodologia document-first.

Ogni nuova funzionalità viene progettata nella cartella `docs/modules/` prima di essere implementata.
