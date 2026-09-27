# Backup di disaster recovery

Script per scaricare su questo host un backup completo del progetto Supabase:
schema DB, dati, utenti auth e file storage. Serve per poter ripartire in fretta
se il progetto Supabase (o Vercel) venisse perso.

## Preparazione, passo per passo

Da fare una volta sola per host (poi il backup si rilancia semplicemente con
`./backups/backup.sh`).

1. **Installa/aggiorna la CLI Supabase** (via `npx`, non serve installarla a parte):
   ```bash
   npx supabase --version
   ```
2. **Accedi con il tuo account Supabase**:
   ```bash
   npx supabase login
   ```
   Si apre il browser per l'OAuth; il token resta salvato in locale.
3. **Collega il repo al progetto Supabase** (il `project_id` è già in
   `supabase/config.toml`, quindi in genere basta):
   ```bash
   npx supabase link --project-ref <project_id>
   ```
   Verifica che sia andato a buon fine con `npx supabase projects list`
   (il progetto deve comparire con `"linked":true`).
4. **Crea/controlla il file `.env`** nella root del repo (accanto a
   `package.json`, non dentro `backups/`) con almeno queste due chiavi:
   ```
   VITE_SUPABASE_URL="https://<project_id>.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="<service role key>"
   ```
   Le trovi su [supabase.com/dashboard](https://supabase.com/dashboard) → progetto →
   Project Settings → API. La **service role key** è quella con permessi pieni
   (bypassa le RLS): serve solo per scaricare i file dai bucket, non va mai
   esposta lato client né committata.
5. **Verifica che gpg sia installato** (serve per cifrare, di default):
   ```bash
   gpg --version
   ```
   Su Debian/Ubuntu: `sudo apt install gnupg` se manca.

A questo punto sei pronto per lanciare il backup vero e proprio (vedi sotto).

## Uso

```bash
./backups/backup.sh              # crea backups/YYYYMMDD_HHMM/, poi comprime e cifra
                                  # in backups/YYYYMMDD_HHMM.tar.gz.gpg (chiede una
                                  # passphrase a te scelta) e cancella cartella+tar.gz
                                  # in chiaro
./backups/backup.sh --no-encrypt # come sopra ma lascia solo il tar.gz in chiaro
                                  # (nessuna passphrase richiesta)
```

La passphrase non è salvata da nessuna parte: la scegli tu al momento (gpg la
chiede due volte, per conferma) e ti serve identica per decifrare in seguito —
se la perdi, il backup cifrato è irrecuperabile. Tienila in un password manager.

Ogni esecuzione crea una cartella/archivio nuovo con timestamp: non sovrascrive
backup precedenti. Non c'è pulizia automatica dei vecchi backup — cancellali a
mano quando non servono più.

Se un passaggio fallisce (un dump o anche un solo file dello storage non scaricato),
lo script si ferma con un errore e **non** stampa «Backup completato»: un backup
incompleto non va considerato valido, rilancialo.

Il backup contiene:

| File/cartella       | Contenuto                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `schema_public.sql` | schema delle tabelle applicative (tabelle, funzioni, RLS)                                                  |
| `data_public.sql`   | dati delle tabelle applicative                                                                             |
| `schema_auth.sql`   | schema utenti Supabase Auth                                                                                |
| `data_auth.sql`     | utenti reali, incluso l'hash della password                                                                |
| `storage/`          | tutti i file dei bucket (`avatar-giocatori`, `profili-giocatore`: foto, documenti d'identità, certificati) |

## Decomprimere

Archivio cifrato (caso di default), chiede la passphrase scelta al momento
del backup:

```bash
gpg -d backups/AAAAMMGG_hhmm.tar.gz.gpg | tar xz -C backups/
```

Ricrea `backups/AAAAMMGG_hhmm/` con dentro i file elencati sopra.

Archivio non cifrato (generato con `--no-encrypt`):

```bash
tar xzf backups/AAAAMMGG_hhmm.tar.gz -C backups/
```

## Ripristino

1. Nuovo progetto Supabase (o `supabase start` in locale via Docker).
2. Importa nell'ordine: `schema_public.sql` → `schema_auth.sql` →
   `data_auth.sql` → `data_public.sql` (gli utenti auth prima dei dati
   pubblici, perché `giocatori.auth_user_id` referenzia `auth.users.id`).
3. Ricrea i bucket `avatar-giocatori` e `profili-giocatore` e ricarica il
   contenuto di `storage/`.
4. Reimposta le variabili d'ambiente su Vercel/locale (non incluse in questo
   backup — vedi sotto).
5. Redeploy dal repo git (il codice non serve backupparlo qui, è già su
   GitHub e Gitea).

## Cosa NON è incluso

- **Variabili d'ambiente Vercel**: richiede `vercel login` interattivo, non
  automatizzabile da questo script. Esportale a mano con `vercel env pull`.
- **Codice applicativo**: vive nel repo git, non nel database.

## Sicurezza

Questi backup contengono password hash, documenti d'identità e altri dati
personali reali. Per questo:

- la cartella `backups/` è in `.gitignore` (tranne questo README e gli script:
  quelli sì restano in git) — **non committare mai i dati generati**;
- se sposti un backup fuori da questo host, usa l'archivio cifrato (default)
  invece del tar.gz in chiaro generato con `--no-encrypt`;
- cancella i backup in chiaro quando non ti servono più.

## File di questa cartella

| File                   | Ruolo                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `backup.sh`            | Punto di ingresso: esegue dump e download in ordine                                              |
| `download-storage.mjs` | Scarica i file dei bucket (usa la service role key del `.env`)                                   |
| `storage-core.ts`      | Logica pura (lettura del `.env`, elenco dei file), coperta da `test/unit/backup-storage.test.ts` |
