# Project Rules

Queste regole devono essere rispettate per qualsiasi modifica al progetto.

## Regole generali

- Non modificare il branch `main` direttamente.
- Tutte le nuove funzionalità vengono sviluppate su `develop`.
- Prima di implementare una funzionalità leggere sempre la documentazione presente in `docs/`.
- Non creare codice duplicato.
- Riutilizzare sempre componenti già esistenti quando possibile.
- Mantenere uno stile coerente con il progetto.

## Database

- Non modificare il database senza creare una nuova migration Supabase.
- Non eliminare tabelle esistenti senza esplicita richiesta.
- Preferire nuove tabelle rispetto all'aggiunta di molte colonne quando il modulo è indipendente.

## Componenti

- Preferire componenti piccoli e riutilizzabili.
- Evitare componenti con responsabilità multiple.

## Documentazione

Ogni nuova funzionalità deve essere documentata prima dell'implementazione.

La documentazione tecnica si trova nella cartella `docs/`.