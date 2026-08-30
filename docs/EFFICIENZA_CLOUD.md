# Efficienza cloud

Regola di progetto: CrAPP gira su un piano cloud minimo (Supabase + Vercel) per ~17 utenti.
Query, traffico e invocazioni vanno tenuti al minimo **per costruzione**, non ottimizzati dopo.

## Regole da rispettare

1. **Niente polling**: mai `refetchInterval` verso il database. Per sincronizzare più schede
   aperte si usano `BroadcastChannel` o gli eventi di `storage`.
2. **Cache lunga e passiva**: i default del `QueryClient` stanno in `src/router.tsx`
   (`staleTime` 5 min, `gcTime` 30 min, `refetchOnWindowFocus/Mount/Reconnect` disattivati,
   `retry: 1`). Non alzare la frequenza di refetch modulo per modulo.
3. **Dopo una mutazione si aggiorna la cache con `setQueryData`**, non con
   `invalidateQueries`: invalidare costa una rilettura. Unica eccezione oggi:
   `src/lib/scout-live.ts`.
4. **Scout Live**: scrive solo chi sta segnando; gli altri leggono dati già salvati.
5. **Write once, read many**: statistiche, badge e classifiche si calcolano una volta e non
   si ricalcolano a ogni apertura di pagina. I badge restano calcolati a runtime dai dati già
   in cache, senza query aggiuntive (DD-007): `src/lib/rosa.ts` aggrega ciò che è già stato
   letto.
6. **Push solo per eventi importanti**: convocazioni, promemoria allenamento/partita, turno
   palloni, esito finale.
7. **Niente funzionalità pesanti**: foto, video, chat.
8. **Indici** sui campi usati per filtri e relazioni in ogni nuova migration.

## Obiettivi non ancora attuati

Questi punti sono stati definiti come direzione, ma **non sono implementati**: non descrivono
il comportamento attuale.

- **Dati CSI**: sincronizzazione periodica server-side salvata su una tabella locale, con
  l'app che legge solo dal database interno. Oggi la lettura è live dal portale a ogni
  richiesta, tramite `/api/public/csi` (vedi [modules/collegamento-csi.md](modules/collegamento-csi.md)).
- **Aggregati persistiti**: uno schema con `statistiche_aggregate` e `classifica_csi` è stato
  ipotizzato ma non esiste; nessuna di quelle tabelle è in `supabase/migrations/`. Va valutato
  con una decisione dedicata, perché tocca DD-007 (badge e statistiche calcolati a runtime).
