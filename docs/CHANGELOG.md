# Changelog

Tutte le modifiche significative del progetto vengono registrate in questo documento.

---

## Versione attuale

### Test

- Suite di test in `test/` (unit, integration, end-to-end) eseguita con bun,
  senza nuove dipendenze: `npm run test` e `npm run test:all`.
- Corretto un difetto emerso dai test: una sessione Scout Live con timestamp
  illeggibile restava bloccata per sempre invece di scadere.

### Collegamento CSI

- Classifica e risultati ufficiali letti dal portale Livescore CSI Bologna
  (stagione 2025/26, Campionato Open Misto Eccellenza, Girone B).
- La pagina Campionato non usa più dati dimostrativi.
- Dettagli e limiti in `docs/modules/collegamento-csi.md`.

### Infrastruttura

- Migrazione completa da Lovable a sviluppo locale.
- Configurazione Git.
- Repository GitHub indipendente.
- Deploy automatico tramite Vercel.
- Branch main e develop.

---

## Funzionalità implementate

- Gestione squadra
- Calendario
- Presenze
- Scout Live
- Badge
- Obiettivi di squadra
- Pagelle
- Badge social
- Serie di presenze
- Notifiche intelligenti