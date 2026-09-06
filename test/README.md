# Test

Suite eseguita con **bun**, senza framework né dipendenze aggiuntive: ogni file è
uno script che usa `node:assert/strict` e termina con codice diverso da zero se
un controllo fallisce.

```bash
npm run test              # unit (veloce, nessuna rete, nessun database)
npm run test:integration  # route server vere
npm run test:e2e          # percorsi sull'app servita
npm run test:all          # tutto
bun test/unit/badges.test.ts   # un singolo file
```

Il runner (`test/run.ts`) esegue ogni file in un processo separato, così un test
non può inquinare gli altri.

Per le push, `unit/push-sw.test.ts` esegue il service worker reale in contesti isolati,
senza pagina né rete: verifica la notifica al risveglio e le promesse di `waitUntil`.
`unit/push-client.test.ts` verifica anche l'aggiornamento del worker all'avvio e al ritorno
in primo piano, inclusi errori offline e pulizia del listener. Sono test del codice:
la consegna effettiva a schermo bloccato richiede un telefono e il servizio push reale.

## Struttura

| Cartella       | Cosa verifica                                                                                                                                                                                                                                                                                                                           | Serve rete? |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `unit/`        | Logica di dominio pura: badge, serie, palloni, pagelle, MVP, cacche, scout, obiettivi, notifiche, parsing CSI, dati della rosa. Più le funzioni pure isolabili nei moduli con hook/rete (validazione upload, guardie push, JWT VAPID, cattura errori, avatar)                                                                           | No          |
| `integration/` | Le route `/api/public/*` sul server di sviluppo: risposte, cache, validazione degli input. Più schema e permessi del Profilo Giocatore (`schema-profili`) contro il database configurato; permessi per ruolo (`permessi`), accesso alle route di notifica (`permessi-route`) e semantica degli upsert (`scritture`) sul database locale | Sì          |
| `e2e/`         | Percorsi completi sull'app servita: schermate, dati CSI fino alla pagina, file PWA, 404                                                                                                                                                                                                                                                 | Sì          |
| `helpers/`     | Avvio del server di test e mini-harness condiviso                                                                                                                                                                                                                                                                                       | —           |

## Database locale in Docker

Alcune cose non si possono verificare senza scrivere: le policy RLS scritte su
`auth.uid()`, i trigger, i vincoli. Contro il progetto cloud quelle scritture non
si fanno, quindi servono un database usa e getta e utenti veri.

```bash
npx supabase start     # avvia lo stack in Docker (migration applicate + seed.sql)
npx supabase status    # URL e chiavi locali; Studio su http://127.0.0.1:54323
npx supabase db reset  # ricrea il database da zero se i dati si sporcano
npx supabase stop      # spegne tutto

bun test/integration/permessi.test.ts        # permessi per ruolo sulle tabelle
bun test/integration/permessi-route.test.ts  # chi può far partire le notifiche
bun test/integration/scritture.test.ts       # semantica degli upsert
```

`permessi-route` avvia il server di sviluppo **puntato al database locale** invece che al
progetto di `.env`: gli serve creare utenti veri per provare i tre casi (nessun token,
giocatore, amministratore).

Il primo `start` scarica le immagini (qualche minuto), i successivi partono in
una decina di secondi. Le mail finiscono in Mailpit (http://127.0.0.1:54324),
non escono dalla macchina.

I test che scrivono **non leggono `.env`**: prendono URL e chiavi da
`supabase status` (helper `test/helpers/locale.ts`) e si fermano se l'URL non è
`127.0.0.1`. È una cintura di sicurezza, non una comodità: così un `.env`
puntato alla produzione non può trasformare un test in una scrittura sul
database vero.

Ognuno ripristina lo stato che tocca in un `finally` — utenti creati, slot della
rosa, colonne modificate, e per `scritture` tutte le righe con il prefisso
`test-scritture`, che nessun dato vero può avere. Così la suite si rilancia
all'infinito senza un `db reset` in mezzo.

Due cose scoperte scrivendo questi test, utili a chi ne aggiunge:

- la **service key non è un amministratore**: per il trigger
  `enforce_giocatori_squadra_update` (DD-016) `auth.uid()` è NULL, quindi ogni
  UPDATE su `giocatori_squadra` fatto con la service key viene rifiutato. Per
  collegare uno slot a un account serve il JWT di un utente con ruolo `admin`;
- su un UPDATE o un DELETE che non tocca nessuna riga PostgREST risponde 2xx.
  Il codice di stato non basta: serve `Prefer: return=representation` e contare
  le righe, oppure rileggere il dato.

## Convenzioni

- **Sul database configurato in `.env` nessun test scrive.** Integration ed e2e
  fanno solo letture e verifiche di validazione: si possono lanciare anche contro
  l'ambiente reale. L'unica eccezione apparente è `schema-profili`, che _tenta_
  scritture da utente anonimo proprio per dimostrare che la RLS le respinge, e poi
  rilegge la riga per verificare che non sia cambiata: su un UPDATE a zero righe
  PostgREST risponde 2xx, quindi lo stato conta più del codice di risposta.
  I test che scrivono davvero girano solo sul database locale (vedi sopra).
- I test legati alla migration M2 si **saltano da soli** dove quella migration non è
  ancora applicata, indicandolo nel motivo. Per vederli tutti verdi serve un
  database che la contenga: `npx supabase start` ne crea uno in locale.
- `integration` ed `e2e` avviano da soli il server di sviluppo. Per usarne uno già
  attivo: `BASE_URL=http://localhost:8080 npm run test:e2e`.
- Le variabili d'ambiente vengono lette da `.env`; i nomi senza prefisso
  (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) sono derivati da quelli `VITE_*`.
  I test che richiedono `SUPABASE_SERVICE_ROLE_KEY` si saltano da soli se manca.
- Il check del parsing CSI può girare contro il portale reale:
  `CSI_LIVE=1 bun test/unit/csi-core.test.ts`.

## Limite noto

L'app renderizza i contenuti dopo l'idratazione: il server invia solo il guscio
(titolo, meta, splash). Gli e2e verificano quindi le risposte HTTP, i dati che
alimentano le pagine e i file della PWA, ma **non** l'interfaccia renderizzata.
Per quella servirebbe un driver browser (es. Playwright), oggi non installato.
