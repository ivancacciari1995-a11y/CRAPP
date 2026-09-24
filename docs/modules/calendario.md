# Modulo — Calendario ed Eventi

**Stato:** implementato
**File principali:** `src/lib/eventi.ts`, `src/lib/eventi.server.ts`, `src/lib/calendario.ts`
(griglia mensile condivisa), `src/routes/calendario.tsx` (vista mensile, tutti),
`src/routes/eventi.tsx` (creazione/modifica, admin e allenatori), `src/components/crapp/EventoCard.tsx`
(card condivisa)
**Test:** `test/unit/eventi.test.ts`, `test/unit/calendario.test.ts`

---

## Obiettivo

Un unico calendario condiviso per allenamenti, partite, amichevoli ed eventi extra
(riunioni, cene di squadra...), al posto di messaggi sparsi in chat. Ogni evento in
`eventi_app` diventa il punto a cui si agganciano presenze, convocazioni, MVP, pagelle,
scout e turno palloni — la maggior parte degli altri moduli dipende da un `evento.id`.

## Due schermate, due pubblici

- **`/calendario`** — vista mensile per tutta la squadra, sola lettura. Mostra allenamenti,
  partite, eventi ed **eventi virtuali** per i compleanni della rosa (`compleanniEventi()`
  in `eventi.ts`, generati a runtime dall'anagrafica di `useAnagraficaRosa({ conAllenatori:
true })` — ci sono anche gli allenatori, DD-034 — non righe
  vere di `eventi_app`): la spunta della vista `giorniIT`/`mesiIT` colora la cella per tipo
  di evento, i giorni con più eventi si dividono lo spazio.
- **`/eventi`** — "Gestione eventi", riservata ad amministratori e allenatori
  (`usePuoGestireEventi()`, [DD-034](../DESIGN_DECISIONS.md#dd-034--lallenatore-è-uno-slot-della-squadra-con-tipo-diverso-non-un-giocatore)):
  crea, modifica ed elimina un evento, sceglie i convocati tra i soli giocatori
  (`convocatiEvento()`, vuoto = tutta la rosa). Da qui si distingue "partita" da "amichevole" tramite il flag `campionato`
  (`categoriaEvento()`/`daCategoria()` in `eventi.ts` convertono tra la categoria mostrata
  in interfaccia e la coppia `{ tipo, campionato }` salvata nel database). La pagina mostra
  solo una griglia mensile (stessa logica di `/calendario`, tramite le funzioni condivise di
  `src/lib/calendario.ts`), che si scorre di mese in mese con le frecce o con lo swipe, con
  la stessa fisica a molla di `/calendario`. Ogni giorno è cliccabile, anche senza eventi, e
  apre un drawer con gli eventi di quel giorno (modifica/elimina) e un bottone "Nuovo evento
  in questo giorno" che apre il form con la data già precompilata: creare, modificare ed
  eliminare passano solo da lì. Nel form il giorno si legge come testo fisso e resta da
  scegliere solo l'ora; il campo data compare solo toccando «Cambia», per spostare l'evento. Fino a 0.9.2 sotto la griglia c'era anche la lista
  cronologica di tutti gli eventi, tolta perché ripeteva il calendario
  ([DD-033](../DESIGN_DECISIONS.md#dd-033--gestione-eventi-solo-calendario-giorno-fissato-dal-tocco)).

Entrambe leggono la stessa cache (`useEventi()`, `EVENTI_KEY`, `staleTime` 10 minuti: il
calendario cambia raramente). `EventoCard.tsx` è la card riusata da entrambe le schermate;
`linkPerEvento()` decide dove porta il click — `/partita/$id` per una partita (con
`/partita-csi/$id` come alternativa "solo CSI" quando non c'è un evento collegato, vedi
`collegamento-csi.md`), `/allenamento/$id` per un allenamento, nessun link per eventi ed
eventi virtuali (compleanni).

## Lettura lato server

`src/lib/eventi.server.ts` (`leggiEventi()`) è la stessa conversione riga→modello di
`eventi.ts`, ma con `supabaseAdmin` per le route API che girano senza sessione utente (es.
`sollecita-presenze.ts`, `promemoria-palloni.ts` — vedi `presenze.md` e `palloni.md`) e per
`notifiche-smart.ts`, che decide i promemoria da mandare in base agli eventi del giorno.

---

## Limiti noti

1. **Cancellare un evento è distruttivo per tutto ciò che vi era agganciato.** Un trigger
   (`m14_pulizia_dati_evento_cancellato`,
   [DD-029](../DESIGN_DECISIONS.md#dd-029--cancellare-un-evento-pulisce-a-cascata-i-dati-collegati))
   pulisce a cascata presenze, cacche, voti MVP/pagelle/badge social, turni palloni e scout
   di quell'evento: non è recuperabile con un annulla, e prima di M14 quelle righe restavano
   orfane nel database (bonificate una tantum da M15/M16, vedi `PROJECT_STATE.md`).
2. **Nessuna creazione automatica degli eventi partita dal calendario CSI.** Le gare
   ufficiali arrivano già come dati (`getEventsByTeamId.php`, vedi `collegamento-csi.md`),
   ma un amministratore deve comunque creare a mano l'evento corrispondente in `/eventi`
   perché esistano convocazioni, presenze, MVP e pagelle per quella partita — altrimenti la
   gara resta visibile solo nello storico CSI, con un dettaglio "solo CSI" più povero
   (`/partita-csi/$id` invece di `/partita/$id`). In `docs/ROADMAP.md` sotto "Prossimo".
