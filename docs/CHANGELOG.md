# Changelog

Tutte le modifiche significative del progetto vengono registrate in questo documento, in
ordine dalla più recente. L'elenco delle funzionalità disponibili e previste non si ripete
qui: sta in [ROADMAP.md](ROADMAP.md).

## Versione attuale — agosto 2026

### Autenticazione e dashboard amministratore (su `develop`, non ancora in produzione)

- Login con Google tramite Supabase Auth (DD-011). Al primo accesso l'account si collega a
  un giocatore di `giocatori_squadra`, e il collegamento non è più modificabile dal
  giocatore stesso (DD-016 regola 2).
- I permessi di amministrazione arrivano da `user_roles` (`src/lib/ruoli.ts`) e non più
  dalla lista di nomi in `crapp-data.ts`, che resta solo come ponte finché
  `VITE_AUTH_OBBLIGATORIA` non viene acceso.
- Profilo giocatore: da `/profilo` ognuno compila i propri dati anagrafici e carica
  documento, certificato medico e foto tessera con le relative scadenze
  ([modules/profilo-giocatore.md](modules/profilo-giocatore.md)).
- Nuova schermata `/admin`: stato dei profili della squadra, download di documento,
  certificato e foto tessera, export CSV per il tesseramento CSI.
- Migration `m2_profili_giocatore` (tabella dei profili) e `m3_bucket_profili` (bucket
  privato), entrambe additive.
- Dalla dashboard l'amministratore modifica i dati squadra (nome, cognome, numero, ruolo),
  compila i dati personali al posto di un giocatore e scollega un account da un profilo
  (DD-017). I file restano esclusi: li carica solo il giocatore. Nessuna migration: le
  policy di M1 e M2 lo consentivano già.

### Test

- Suite di test in `test/` (unit, integration, end-to-end) eseguita con bun,
  senza nuove dipendenze: `npm run test` e `npm run test:all`.
- Corretto un difetto emerso dai test: una sessione Scout Live con timestamp
  illeggibile restava bloccata per sempre invece di scadere.

### Collegamento CSI

- Classifica e risultati ufficiali letti dal portale Livescore CSI Bologna
  (stagione 2025/26, Campionato Open Misto Eccellenza, Girone B).
- La pagina Campionato non usa più dati dimostrativi.
- Dettagli e limiti in [modules/collegamento-csi.md](modules/collegamento-csi.md).

### Infrastruttura

- Migrazione completa da Lovable a sviluppo locale.
- Configurazione Git.
- Repository GitHub indipendente.
- Deploy automatico tramite Vercel.
- Branch main e develop.

## Versione 1.0 — luglio 2026

Prima versione usata dalla squadra. Funzionalità incluse: vedi
[ROADMAP.md § Versione 1.0](ROADMAP.md#versione-10--rilasciata).
