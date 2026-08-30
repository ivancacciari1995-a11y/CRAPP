# Changelog

Tutte le modifiche significative del progetto vengono registrate in questo documento, in
ordine dalla più recente. L'elenco delle funzionalità disponibili e previste non si ripete
qui: sta in [ROADMAP.md](ROADMAP.md).

## Versione attuale — agosto 2026

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
