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
5. **(Solo se userai `--encrypt`) Verifica che gpg sia installato**:
   ```bash
   gpg --version
   ```
   Su Debian/Ubuntu: `sudo apt install gnupg` se manca.

A questo punto sei pronto per lanciare il backup vero e proprio (vedi sotto).

## Uso

```bash
./backups/backup.sh              # crea backups/YYYYMMDD_HHMM/ con tutto dentro
./backups/backup.sh --encrypt    # come sopra, poi comprime e cifra in un unico
                                  # backups/YYYYMMDD_HHMM.tar.gz.gpg (chiede una
                                  # passphrase) e cancella la cartella in chiaro
```

Ogni esecuzione crea una cartella nuova con timestamp: non sovrascrive backup
precedenti. Non c'è pulizia automatica dei vecchi backup — cancellali a mano
quando non servono più.

Il backup contiene:

| File/cartella       | Contenuto                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `schema_public.sql` | schema delle tabelle applicative (tabelle, funzioni, RLS)                                                  |
| `data_public.sql`   | dati delle tabelle applicative                                                                             |
| `schema_auth.sql`   | schema utenti Supabase Auth                                                                                |
| `data_auth.sql`     | utenti reali, incluso l'hash della password                                                                |
| `storage/`          | tutti i file dei bucket (`avatar-giocatori`, `profili-giocatore`: foto, documenti d'identità, certificati) |

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

Per un archivio cifrato: `gpg -d backups/AAAAMMGG_hhmm.tar.gz.gpg | tar xz`.

## Cosa NON è incluso

- **Variabili d'ambiente Vercel**: richiede `vercel login` interattivo, non
  automatizzabile da questo script. Esportale a mano con `vercel env pull`.
- **Codice applicativo**: vive nel repo git, non nel database.

## Sicurezza

Questi backup contengono password hash, documenti d'identità e altri dati
personali reali. Per questo:

- la cartella `backups/` è in `.gitignore` (tranne questo README e gli script:
  quelli sì restano in git) — **non committare mai i dati generati**;
- se sposti un backup fuori da questo host, usa sempre `--encrypt` o cifra tu
  l'archivio a mano;
- cancella i backup in chiaro quando non ti servono più.
