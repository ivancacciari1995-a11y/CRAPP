# Project State

Ultimo aggiornamento: 30/08/2026

## Stato generale

Fase corrente:

Backend migrato al nuovo Supabase proprietario. M1 completata. M2 e M3 scritte e da applicare.
Autenticazione Google e dashboard amministratore implementate su `develop`, da attivare in
produzione seguendo i passaggi più sotto. Profilo Giocatore lato giocatore ancora da fare.

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

---

## Modulo da implementare

Profilo Giocatore (specifica in `docs/modules/profilo-giocatore.md`)

---

## Autenticazione e dashboard amministratore

Implementate su `develop`, **non ancora attive in produzione**. Il codice è additivo: finché
i passaggi qui sotto non sono fatti, l'app si comporta esattamente come prima.

Passaggi in ordine, nessuno dei quali è reversibile a metà:

1. **Provider Google in Supabase** — Google Cloud Console: consent screen *External* (scope
   `email` e `profile`, nessuna verifica richiesta), credenziale *Web application* con
   redirect URI `https://kfkcldwncxqaixetsjes.supabase.co/auth/v1/callback`. Client ID e
   secret in *Authentication → Providers → Google*. In *URL Configuration*: Site URL di
   produzione, più `localhost:8080` e il wildcard delle preview Vercel tra i Redirect URLs.
2. **Migration M2 e M3** (`supabase db push`). Sono `CREATE` puri: si possono applicare in
   produzione senza toccare il comportamento attuale.
3. **Primo admin**, dopo il primo login (l'ID esiste solo da quel momento):
   `INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE email = '<mail>';`
4. **Collegamento dei 17 account**: ciascuno accede con Google e sceglie il proprio nome una
   volta sola. Uno slot già collegato può essere liberato solo da un admin.
5. **Solo a squadra collegata**: `VITE_AUTH_OBBLIGATORIA=true` su Vercel (fa sparire la
   selezione libera del giocatore), poi la migration che rimuove le policy `anon` dalle
   tabelle v1.0. È l'unico passo che cambia il comportamento per tutti.

Attenzione: dev e produzione condividono lo stesso progetto Supabase. Un account di prova che
collega uno slot lo occupa anche in produzione, e va liberato da un admin.

## Prossimo sviluppo

Profilo giocatore lato giocatore (caricamento di documento, certificato e foto tessera):
finché non esiste, la dashboard amministratore mostra profili vuoti.

---

## Note

Il progetto segue una metodologia document-first.

Ogni nuova funzionalità viene progettata nella cartella `docs/modules/` prima di essere implementata.
