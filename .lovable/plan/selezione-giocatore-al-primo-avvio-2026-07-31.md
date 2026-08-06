# Selezione giocatore al primo avvio

Aggiungere un flusso di onboarding che chiede "Chi sei?" la prima volta che l'app viene aperta, memorizzando la scelta in `localStorage`. Il profilo e la home si aggiorneranno automaticamente in base al giocatore selezionato.

## Cosa cambia

1. **Nuovo store `src/lib/user-store.ts`**
   - Persiste in `localStorage` l'`id` del giocatore scelto.
   - Espone `useGiocatoreCorrente()` che restituisce il giocatore selezionato o `null`.
   - Espone `impostaGiocatore(id)` e `resetGiocatore()`.

2. **Nuova route `/benvenuto`**
   - Schermata full-screen con logo, titolo "Benvenuto in CrAPP" e lista scrollabile della rosa.
   - Ogni riga mostra iniziali, nome, ruolo e numero maglia.
   - Al tap su un giocatore, lo store viene aggiornato e l'utente viene portato a `/`.
   - Non mostra la bottom navigation.

3. **Reindirizzamento condizionato in `__root.tsx`**
   - Se non è ancora stato selezionato un giocatore, qualunque route apre `/benvenuto`.
   - Dopo la scelta, l'app funziona normalmente.

4. **Sostituzione di `giocatoreCorrente` con `useGiocatoreCorrente()`**
   - Aggiornare `src/routes/index.tsx` per salutare il giocatore selezionato e mostrarne le statistiche rapide.
   - Aggiornare `src/routes/profilo.tsx` per renderlo il profilo personale del giocatore scelto.

5. **Cambio utente dalle impostazioni**
   - In `src/routes/profilo.tsx`, aggiungere una voce "Cambia giocatore" che resetta la selezione e porta a `/benvenuto`.

## Note tecniche

- `localStorage` viene letto solo lato client, usando `useSyncExternalStore` per evitare mismatch di hydration.
- La rosa reale è già presente in `src/lib/crapp-data.ts` (`giocatori`).
- La costante esportata `giocatoreCorrente` verrà rimossa; i componenti consumeranno il nuovo hook.
- Nessun backend richiesto: resta un prototipo locale.
