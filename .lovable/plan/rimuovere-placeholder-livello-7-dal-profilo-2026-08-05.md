# Rimuovere placeholder "Livello 7" dal Profilo

## Obiettivo

Eliminare il testo statico "Livello 7" dalla scheda profilo, dato che non è collegato a nessun calcolo reale e l'utente preferisce toglierlo per ora.

## Modifica

- `src/routes/profilo.tsx`: rimuovere il paragrafo `<p className="font-display text-2xl leading-none">Livello 7</p>` (riga 116) e, se necessario, riallineare il layout circostante per evitare spazi vuoti strani.

## Verifica

- Build senza errori.
- Preview della pagina Profilo: nessun riferimento a "Livello" visibile.
