# Operatività: ambienti, variabili e procedure

Come si allestisce, si configura e si rilascia CrAPP. Le scelte di fondo sono in
[PORTABILITA.md](PORTABILITA.md) (cosa lega l'app a un fornitore, come spostarla) e in
[ARCHITECTURE.md](ARCHITECTURE.md); il worker delle email ha il suo manuale in
[WORKER_EMAIL.md](WORKER_EMAIL.md).

## Ambienti

| Ambiente   | Dove                                        | Note                                                                                                                          |
| ---------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Produzione | Vercel (`main`) + Supabase proprietario     | Project Ref `kfkcldwncxqaixetsjes`. Il vecchio `hetycilxgkdmccelwerq` è deprecato: non usarlo.                                |
| Preview    | Vercel, da `develop` e dai branch           | `develop` è fermo indietro rispetto a `main` (DD-019): non rappresenta lo stato attuale.                                      |
| Locale     | `npm run dev` (8080) + `npx supabase start` | Database in Docker con migration e seed. Dev e produzione possono condividere lo stesso progetto Supabase: vedi «Attenzione». |
| Worker     | Raspberry Pi con Docker (`mailer/`)         | Email e push dei promemoria. Vedi [WORKER_EMAIL.md](WORKER_EMAIL.md).                                                         |

Lovable Cloud non è più il backend di CrAPP (DD-001).

## Variabili d'ambiente

Nomi usati dal codice; i valori stanno in `.env` / `.env.local` (mai nel repository) e nelle
Environment Variables di Vercel (Preview e Production).

| Variabile                                                         | Dove serve       | Per cosa                                                                               |
| ----------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`              | client (browser) | Connessione pubblica a Supabase                                                        |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`                        | server           | Come sopra, lato route                                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`                                       | server e worker  | Bypassa la RLS: solo nelle route `src/routes/api/public/` e nel worker. Mai al client. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`          | server e worker  | Firma delle notifiche push. Le chiavi devono essere le stesse nell'app e nel worker.   |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | worker           | Invio email via Gmail (password per app)                                               |
| `MAILER_FILE_SALUTE`                                              | worker           | File usato dall'healthcheck del container                                              |
| `SUPABASE_AUTH_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_GOOGLE_SECRET`   | Supabase locale  | Solo per provare il login Google sullo stack locale                                    |

Se aggiungi una variabile, aggiungila anche qui.

## Migration

Ordine obbligatorio (vedi anche [AGENTS.md](../AGENTS.md), sezione Database):

1. si progetta e si documenta in [DATABASE.md](DATABASE.md);
2. si crea una **nuova** migration in `supabase/migrations/` (mai riscrivere quelle applicate);
3. si prova in locale con `npx supabase db reset` e `npm run test:all`;
4. solo dopo `npx supabase db push` verso il cloud;
5. si verifica con `npx supabase migration list` che locale e remoto coincidano.

## Rilascio

`main` è la produzione: ogni commit deve lasciare l'app funzionante. Il deploy è quello di Vercel
sul push di `main`; un cron giornaliero (`/api/public/keepalive`, `vercel.json`) evita la pausa
del progetto. Prima di dire «finito» vale la checklist «Fine lavoro» di [AGENTS.md](../AGENTS.md).
Per tornare indietro: promuovere il deployment precedente da Vercel; le migration, essendo
additive, non si annullano ma si correggono con una migration nuova.

## Allestire un ambiente: autenticazione e primo admin

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
