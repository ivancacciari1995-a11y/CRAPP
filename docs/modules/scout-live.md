# Modulo — Scout Live

**Stato:** implementato (fix M7 per la persistenza condivisa)
**File principali:** `src/lib/scout-live.ts`, `src/lib/scout-stato.ts`, `src/lib/scout-store.ts`,
`src/lib/scout-export.ts`, `src/lib/cacche.ts`, `src/components/crapp/ScoutEntry.tsx`,
`src/components/crapp/SondaggioCacche.tsx`, `src/routes/scout.tsx`, `src/routes/partita.$id.tsx`

---

## Obiettivo

Permettere a un solo referente per volta di registrare in tempo reale, durante la partita,
un giudizio − / + sui fondamentali (battuta, ricezione, attacco, muro) di ciascun convocato,
per set, con salvataggio condiviso su Supabase (non più solo `localStorage`, fix M7) così che tutta la squadra veda lo stato
aggiornato da qualunque dispositivo.

---

## Dati

- `scout_sessioni` — chi ha il controllo dello Scout Live per una partita (una riga per
  `evento_id`, quindi un solo detentore).
- `scout_live` — stato in corso (azioni non ancora concluse) di una sessione.
- `scout_partite` — archivio delle partite scoutate concluse (risultato, parziali, azioni,
  valutazioni − / +),
  mai più modificato una volta salvato (solo eliminabile per intero).
- `cacche_partita` — sondaggio goliardico pre-partita, un voto per giocatore/evento
  (`UNIQUE evento_id, giocatore_id`).

---

## Chi può usarlo

Chiunque sia autenticato: non è più riservato agli admin. A tenere l'ordine basta il lock di
sessione — scoutizza uno per volta, gli altri vedono "In uso da …". Questo allinea l'interfaccia
alle policy RLS di `scout_sessioni`/`scout_live`/`scout_partite`, che sono sempre state aperte a
qualunque utente autenticato (la migration M4 toglie l'accesso solo al ruolo `anon`).

---

## Da dove ci si arriva

`ScoutEntry.tsx` è l'unico accesso a `/scout`: sta nella pagina della partita
(`partita.$id.tsx`, sezione «Scout live»), visibile a tutta la squadra. Si accende solo se
**quella** partita è quella di oggi — la prop `eventoId` confronta l'evento aperto con
`partitaDiOggi()` — e se nessun altro ha il lock; negli altri casi resta una card grigia non
cliccabile («Si attiva il giorno della partita» / «In uso da …»). Dalla home è stato tolto
perché occupava spazio 6 giorni su 7.

---

## Meccanismo di lock condiviso

- `useApriSessioneScout()` (`scout-live.ts`) prende il controllo con un upsert su
  `scout_sessioni` (chiave `evento_id`), rifiutando se un altro giocatore ha già una sessione
  non scaduta.
- Una sessione scade dopo 5 minuti di inattività; `useHeartbeatScout()` la rinnova ogni 60
  secondi finché lo scout resta aperto.
- Il rilascio (`useChiudiSessioneScout()`) avviene al bottone "Rilascia", a fine partita, e
  sull'evento `pagehide` della finestra (per liberare il lock se il browser viene chiuso senza
  uscire esplicitamente).
- Nessun realtime: la sessione si rilegge solo all'apertura/focus pagina o al bottone
  "Aggiorna" (`staleTime` 30s).

---

## Cosa registra

La schermata `/scout` ha due passi: **1. Tocca il giocatore** (griglia dei convocati, filtrati sulle
risposte "presente"/"ritardo", con fallback a tutta la rosa se nessuno ha risposto) e **2. Valuta**
(vedi sotto), seguiti da «Ultime azioni», «Chiudi set» e «Fine partita». Salvataggio automatico su
`scout_live` con debounce di 800ms a ogni cambiamento.

**Punteggio e azioni.** L'interfaccia non registra più il punteggio: sono stati tolti i tasti delle
azioni (punto attacco, ace, muro, errore nostro, punto e errore avversario), il tabellone con punti
e set e il blocco avversario / in casa / trasferta. Avversario e campo restano quelli ricavati dal
titolo della partita (o dallo stato già salvato) e non si modificano. I tipi di azione
(`AzioneTipo`, `scout-store.ts`: `attacco`, `ace`, `muro`, `errore`, `punto_avv`, `errore_avv`),
i totali `totaliPerGiocatore()` e il campo `scout_partite.azioni` restano nel codice e nei dati:
leggono le partite scoutate prima di questa modifica, ma oggi nessuna schermata crea nuove azioni.

---

## Valutazioni dei fondamentali (− / +)

Per ogni convocato lo scout può segnare un **−** o un **+** su battuta, ricezione, attacco e muro
([DD-053](../decisions/DD-053.md)). Non sono punti: restano fuori dal punteggio, dai parziali e dai
totali P/A/M/E. Si seleziona il giocatore (passo 1) e si tocca − o + sul fondamentale (passo 2, il cui titolo mostra
cognome e numero del giocatore e il set in corso);
accanto a ogni tasto compare il conteggio di quel giocatore **nel set in corso**. «Annulla» nella
sezione toglie l'ultima valutazione del set in corso (l'«Annulla» in alto agisce solo sulle azioni, quindi oggi è sempre spento).

Ogni tocco è una riga `Valutazione` (`giocatoreId`, `fondamentale`, `segno`, `set`, `ts`) in una
lista separata da `azioni`; i conteggi per set si calcolano con `contaValutazioni()`
(`scout-store.ts`). Lo stato in corso le salva in `scout_live.stato.valutazioni` (assente negli
stati salvati prima: vale lista vuota); a fine partita finiscono in `scout_partite.valutazioni`.

---

## Fine partita

**Limite attuale:** `chiudiSet()` e `finePartita()` si basano sui punti, che non si registrano più. «Chiudi
set» risponde «Set senza azioni» (quindi il set resta sempre il 1) e «Fine partita» «Nessun set da
salvare»: le valutazioni restano nello stato in corso e non arrivano in `scout_partite`.

`finePartita()` (`scout.tsx`) compone i parziali finali, inserisce la partita in
`scout_partite` (INSERT, non upsert), poi cancella la riga da `scout_live` (stato consumato)
e rilascia la sessione.

---

## Export CSV

`scout-export.ts` genera un CSV (separatore `;`, BOM UTF-8) con parziali, riepilogo per
giocatore e log cronologico delle azioni. Se ci sono valutazioni, aggiunge una tabella per set e giocatore con i

- e i − di ogni fondamentale (solo per chi ne ha). Scaricabile dagli admin dalla pagina partita,
  sezione "Report tecnico".

---

## Sondaggio cacche

`SondaggioCacche.tsx` chiede "quante cacche hai fatto prima di questa partita" (0-5+), sempre
modificabile. `sondaggioAperto()` (`cacche.ts`) lo apre alle **8:00 del giorno della partita**
(ora locale del dispositivo) e da lì lo lascia aperto per sempre; prima la card mostra solo
l'avviso di apertura. Quando è aperto, gli **amministratori** vedono nella card il pulsante
«Avvisa tutti del sondaggio»: chiama `POST /api/public/apri-sondaggio` e manda la push a tutti
i dispositivi iscritti, come il sollecito presenze (vedi [Notifiche](notifiche.md)). Nessun
invio automatico: parte solo quando un admin lo preme.
`statisticheCacche()` (`cacche.ts`) calcola media, record e `giornateTop`
(giornate con ≥3), soglia usata per un [badge](badge.md) segreto — coerente con DD-007 (badge
calcolati a runtime).

---

## Regole rispettate

- **DD-008 (gamification equa)**: i dati tecnici (punti/ace/muri) restano confinati allo Scout
  Live come statistica di squadra e non entrano nel tipo `Giocatore` usato per badge o
  classifiche individuali.

---

## Limiti noti

- Senza punteggio, set e partita non si chiudono (vedi «Fine partita»): da risolvere, per esempio
  chiudendo il set anche senza punti e salvando la partita con le sole valutazioni.
- Scout aperto a tutta la squadra: nessun filtro su chi può registrare le azioni, l'unica
  garanzia è il lock di sessione (vedi sopra).
- Possibile, per quanto improbabile, doppio "successo" applicativo nel prendere il lock:
  lettura e upsert non sono atomici.
- Avversario e campo non si correggono dallo scout.
- `scout_partite` si inserisce ma non si corregge dall'interfaccia: solo eliminazione totale.
- Abbinamento partita↔scout fatto anche per uguaglianza di data come fallback: ambiguo se due
  partite cadono lo stesso giorno.

---

## Evoluzioni possibili

- Mostrare le valutazioni anche nella pagina della partita (oggi solo nel CSV admin).
- Realtime (Supabase Realtime) per aggiornare la sessione condivisa senza refresh manuale.
