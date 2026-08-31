# Project State

Ultimo aggiornamento: 30/08/2026

## Stato generale

Fase corrente:

Backend migrato al nuovo Supabase proprietario. M1 completata. M2 e M3 scritte e da applicare.
Autenticazione Google, dashboard amministratore e Profilo Giocatore (lato giocatore e lato
admin) implementati su `develop`, da attivare in produzione seguendo i passaggi più sotto.

---

## Infrastruttura

- GitHub configurato con branch `main` e `develop`
- Cursor come ambiente di sviluppo
- Vercel configurato; Environment Variables aggiornate al nuovo Supabase (Preview e Production)
- Supabase proprietario attivo — Project Ref: `kfkcldwncxqaixetsjes`
- 12 migration locali applicate con successo al nuovo database
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
- `public.giocatori_squadra`: 17 giocatori iniziali presenti

---

## Moduli completati

- Squadra
- Presenze
- Badge
- Scout Live
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

Passaggi in ordine, nessuno dei quali è reversibile a metà:

1. **Provider Google in Supabase** — Google Cloud Console: consent screen *External* (scope
   `email` e `profile`, non sensibili: nessuna verifica richiesta, e la modalità *Testing*
   regge fino a 100 utenti, più che sufficiente per la squadra), credenziale
   *Web application* con redirect URI
   `https://kfkcldwncxqaixetsjes.supabase.co/auth/v1/callback`. Client ID e
   secret in *Authentication → Providers → Google*. In *URL Configuration*: Site URL di
   produzione, più `localhost:8080` e il wildcard delle preview Vercel tra i Redirect URLs.
   Per provare sullo stack locale invece che sul cloud servono anche `enabled = true` in
   `[auth.external.google]` di `supabase/config.toml`, le due variabili
   `SUPABASE_AUTH_GOOGLE_*` in `.env` e una credenziale con redirect URI
   `http://127.0.0.1:54321/auth/v1/callback`.
2. **Migration M2 e M3** (`supabase db push`). Sono `CREATE` puri: si possono applicare in
   produzione senza toccare il comportamento attuale.
3. **Primo admin**, dopo il primo login (l'ID esiste solo da quel momento):
   `INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE email = '<mail>';`
4. **Collegamento dei 17 account**: ciascuno accede con Google e sceglie il proprio nome una
   volta sola. Uno slot già collegato può essere liberato solo da un admin.
5. **Solo a squadra collegata**: migration `m4_solo_autenticati`, che toglie al ruolo `anon`
   l'accesso alle tabelle v1.0. Da lì in poi i dati sono raggiungibili solo con una sessione;
   le route in `src/routes/api/public/` usano la service role e continuano a funzionare.

Attenzione: dev e produzione condividono lo stesso progetto Supabase. Un account di prova che
collega uno slot lo occupa anche in produzione, e va liberato da un admin.

## Prossimo sviluppo

Gestione tesseramenti CSI: la raccolta dati e l'export CSV sono pronti, manca il
tracciamento di chi è già tesserato (numero e data di tessera).

---

## Note

Il progetto segue una metodologia document-first.

Ogni nuova funzionalità viene progettata nella cartella `docs/modules/` prima di essere implementata.
