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

## Struttura

| Cartella | Cosa verifica | Serve rete? |
|---|---|---|
| `unit/` | Logica di dominio pura: badge, serie, palloni, pagelle, MVP, cacche, scout, obiettivi, notifiche, parsing CSI, dati della rosa | No |
| `integration/` | Le route `/api/public/*` sul server di sviluppo: risposte, cache, validazione degli input. Più schema e permessi del Profilo Giocatore (`schema-profili`) contro il database configurato | Sì |
| `e2e/` | Percorsi completi sull'app servita: schermate, dati CSI fino alla pagina, file PWA, 404 | Sì |
| `helpers/` | Avvio del server di test e mini-harness condiviso | — |

## Convenzioni

- **Nessun test scrive sul database.** Integration ed e2e fanno solo letture e
  verifiche di validazione: si possono lanciare anche contro l'ambiente reale.
  L'unica eccezione apparente è `schema-profili`, che *tenta* scritture da utente
  anonimo proprio per dimostrare che la RLS le respinge, e poi rilegge la riga per
  verificare che non sia cambiata: su un UPDATE a zero righe PostgREST risponde 2xx,
  quindi lo stato conta più del codice di risposta.
- I test legati alle migration M2/M3 si **saltano da soli** dove quelle migration non
  sono ancora applicate, indicandolo nel motivo. Per vederli tutti verdi serve un
  database che le contenga: `npx supabase start` ne crea uno in locale.
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
