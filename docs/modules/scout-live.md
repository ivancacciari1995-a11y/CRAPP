# Modulo — Scout Live

**Stato:** implementato (v1.0, fix M7 per la persistenza condivisa)
**File principali:** `src/lib/scout-live.ts`, `src/lib/scout-stato.ts`, `src/lib/scout-store.ts`,
`src/lib/scout-export.ts`, `src/lib/cacche.ts`, `src/components/crapp/ScoutEntry.tsx`,
`src/components/crapp/SondaggioCacche.tsx`, `src/routes/scout.tsx`, `src/routes/partita.$id.tsx`

---

## Obiettivo

Permettere a un solo referente per volta di registrare in tempo reale, durante la partita,
punti, ace, muri ed errori di ciascun giocatore in campo, con salvataggio condiviso su
Supabase (non più solo `localStorage`, fix M7) così che tutta la squadra veda lo stato
aggiornato da qualunque dispositivo.

---

## Dati

- `scout_sessioni` — chi ha il controllo dello Scout Live per una partita (una riga per
  `evento_id`, quindi un solo detentore).
- `scout_live` — stato in corso (azioni non ancora concluse) di una sessione.
- `scout_partite` — archivio delle partite scoutate concluse (risultato, parziali, azioni),
  mai più modificato una volta salvato (solo eliminabile per intero).
- `cacche_partita` — sondaggio goliardico pre-partita, un voto per giocatore/evento
  (`UNIQUE evento_id, giocatore_id`).

---

## Chi può usarlo

Solo gli admin lato UI: `ScoutEntry.tsx` e `scout.tsx` bloccano i non-admin con il messaggio
"Scout riservato". **Il controllo non è imposto a livello database**: le policy RLS di
`scout_sessioni`/`scout_live`/`scout_partite` sono aperte a qualunque utente autenticato, non
solo agli admin — la migration M4 toglie l'accesso solo al ruolo `anon`.

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

Tipi di azione (`AzioneTipo`, `scout-store.ts`): `attacco`, `ace`, `muro`, `errore`,
`punto_avv`, `errore_avv` — attacco/ace/muro ed errore avversario valgono come punto nostro,
errore nostro e punto avversario come punto avversario. Le azioni con giocatore
(attacco/ace/muro/errore) richiedono di selezionarlo prima dalla griglia dei convocati
(filtrati sulle risposte "presente"/"ritardo", con fallback a tutta la rosa se nessuno ha
risposto). Salvataggio automatico su `scout_live` con debounce di 800ms a ogni cambiamento.

---

## Fine partita

`finePartita()` (`scout.tsx`) compone i parziali finali, inserisce la partita in
`scout_partite` (INSERT, non upsert), poi cancella la riga da `scout_live` (stato consumato)
e rilascia la sessione.

---

## Export CSV

`scout-export.ts` genera un CSV (separatore `;`, BOM UTF-8) con parziali, riepilogo per
giocatore e log cronologico delle azioni. Scaricabile dagli admin dalla pagina partita,
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

- Controllo "solo admin" non imposto dal database (vedi sopra).
- Possibile, per quanto improbabile, doppio "successo" applicativo nel prendere il lock:
  lettura e upsert non sono atomici.
- `scout_partite` si inserisce ma non si corregge dall'interfaccia: solo eliminazione totale.
- Abbinamento partita↔scout fatto anche per uguaglianza di data come fallback: ambiguo se due
  partite cadono lo stesso giorno.

---

## Evoluzioni possibili

- Realtime (Supabase Realtime) per aggiornare la sessione condivisa senza refresh manuale.
- Restringere le policy RLS al solo ruolo admin.
