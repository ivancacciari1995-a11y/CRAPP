# Project State

Ultimo aggiornamento: 30/08/2026

## Stato generale

Fase corrente:

Backend migrato al nuovo Supabase proprietario. M1 completata. Profilo Giocatore da implementare (M2).

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

## Prossimo sviluppo

**M2** — `profili_giocatore` + Supabase Storage privato + RLS

---

## Note

Il progetto segue una metodologia document-first.

Ogni nuova funzionalità viene progettata nella cartella `docs/modules/` prima di essere implementata.
