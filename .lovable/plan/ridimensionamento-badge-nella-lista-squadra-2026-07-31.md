# Ridimensionamento badge nella lista squadra

## Obiettivo
Rendere i badge accanto al nome del giocatore nella lista squadra più compatti e meno invasivi, mantenendo lo stile stilizzato (icone Lucide colorate per grado) e lasciando la scheda espansa con una dimensione leggibile.

## Modifiche previste

1. **Lista squadra (`src/routes/squadra.tsx`)**
   - Ridurre le icone badge sbloccati mostrate accanto al nome da `h-4 w-4` (16px) a `h-3 w-3` (12px).
   - Mantenere il massimo di 3 badge visibili e il contatore `+N` con testo ridotto a `text-[9px]` per armonizzare.
   - Lasciare invariati avatar, nome, ruolo ed età.

2. **Scheda giocatore espansa (`src/routes/squadra.tsx`)**
   - Portare le icone badge dalla dimensione attuale a `h-4 w-4` (16px), leggibili ma non troppo grandi.
   - Mantenere card, colori per grado (bronzo/argento/oro) e testi descrittivi.

3. **Verifica**
   - Controllare la preview su `/squadra` per confermare che i badge in lista siano discreti e la scheda espansa rimanga leggibile.
   - Eseguire build per assicurarsi che non ci siano errori di tipo o stile.

## Cosa non cambia
- Colori dei gradi, soglie badge, logica di sblocco e votazione MVP.
- Layout generale della pagina e bottom navigation.
