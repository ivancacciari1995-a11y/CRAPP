---
name: Portabilità su Node.js + PostgreSQL
description: Vincolo di architettura — l'app deve girare su un normale server Node.js con PostgreSQL, senza servizi esclusivi Lovable Cloud
type: constraint
---
L'app deve restare completamente portabile: ogni funzionalità deve poter girare su un normale server Node.js con PostgreSQL.

Regole:
- Accesso ai dati solo tramite i moduli in `src/lib/*.ts`; i componenti non parlano mai direttamente col database.
- Vietato usare funzionalità proprietarie Lovable/Supabase non self-hostable (edge functions proprietarie, auth Lovable come unico login, storage proprietario). `src/integrations/lovable/*` resta opzionale e non importato.
- SQL standard PostgreSQL nelle migrazioni; niente estensioni esclusive del provider.
- Configurazione solo via variabili d'ambiente standard; niente valori hardcoded.
- Job pianificati sempre richiamabili con un semplice HTTP POST, così funzionano con qualsiasi scheduler.
- Web push implementato con Web Crypto (compatibile Node 18+), non con SDK proprietari.

Dettaglio e guida di migrazione: `docs/PORTABILITA.md`.
