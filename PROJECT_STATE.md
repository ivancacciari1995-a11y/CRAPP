# Project State

Ultimo aggiornamento: 03/09/2026

## Stato generale

Fase corrente:

Backend migrato al nuovo Supabase proprietario. M1 completata. M2 scritta e da applicare.
Autenticazione Google, dashboard amministratore e Profilo Giocatore (lato giocatore e lato
admin) implementati su `develop`, da attivare in produzione seguendo i passaggi più sotto.
Foto profilo (M6) e Scout Live (M7) non dipendono più da `localStorage`: entrambi ora
sincronizzano tra dispositivi tramite Supabase.

---

## Infrastruttura

- GitHub configurato con branch `main` e `develop`
- Cursor come ambiente di sviluppo
- Vercel configurato; Environment Variables aggiornate al nuovo Supabase (Preview e Production)
- Supabase proprietario attivo — Project Ref: `kfkcldwncxqaixetsjes`
- 18 migration locali applicate con successo al nuovo database
- Sviluppo locale verificato con il nuovo Supabase
- Preview Vercel di `develop` verificata con successo (presenza scritta su `risposte_presenze` confermata nel nuovo database)
- Produzione (`main`): non ancora verificata in questa fase

---

## Backend

- Backend operativo: Supabase proprietario (`kfkcldwncxqaixetsjes`)
- Lovable Cloud: non più backend operativo di CrAPP
- Vecchio Project Ref `hetycilxgkdmccelwerq`: deprecato, non utilizzare

---

## Database

- Schema v1.0 + M1 applicati al nuovo Supabase
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
- Migration `m7_scout_partite`: nuova tabella `scout_partite` per l'archivio delle partite
  scoutate concluse, e collegamento della tabella `scout_sessioni` (già presente nello
  schema ma mai usata) al blocco condiviso dello Scout Live — prima entrambi vivevano solo
  in `localStorage`, quindi visibili a un solo dispositivo

---

## Moduli completati

- Squadra
- Presenze
- Badge
- Scout Live (blocco e archivio partite sincronizzati tra dispositivi, migration `m7_scout_partite`)
- Pagelle
- MVP
- Notifiche
- Profilo Giocatore (su `develop`, specifica in `docs/modules/profilo-giocatore.md`)

---

## Autenticazione e dashboard amministratore

Implementate su `develop`. **Il login è l'unica via d'accesso** (31/08/2026): la selezione
libera del giocatore non esiste più, senza sessione Google si resta su `/benvenuto`, e i
permessi di amministrazione arrivano solo da `user_roles`.

**Attenzione all'ordine:** finché il provider Google è spento in Supabase, «Accedi con
Google» risponde

```
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

e **nessuno entra nell'app**, né in dev né sulla preview di `develop`. Il passo 1 qui sotto
va fatto prima di mandare questa versione in produzione.

Passaggi in ordine, nessuno dei quali è reversibile a metà. **Stato al 03/09/2026: fatti i
passaggi 1-3; il passaggio 4 è un processo continuo (7 dei 16 giocatori attivi hanno già
fatto il primo accesso); il passaggio 5 (M4) è stato applicato.**

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

Gestione tesseramenti CSI: la raccolta dati e l'export CSV sono pronti, manca il
tracciamento di chi è già tesserato (numero e data di tessera).

---

## Note

Il progetto segue una metodologia document-first.

Ogni nuova funzionalità viene progettata nella cartella `docs/modules/` prima di essere implementata.
