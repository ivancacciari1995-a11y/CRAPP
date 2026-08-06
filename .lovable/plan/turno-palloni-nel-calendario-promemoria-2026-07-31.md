# Turno palloni nel calendario + promemoria

Aggiungere a ogni allenamento/partita un incaricato dei palloni, condiviso tra tutti, con rotazione automatica proposta dall'app e promemoria (in-app e push).

## Cosa vedrà la squadra

- **Riga "Palloni" su ogni evento** (allenamento e partita) nella card del calendario e in Home: avatar + nome dell'incaricato, oppure "Da assegnare".
- **Chiunque può cambiarlo**: tocco sulla riga, si apre la lista della rosa, si sceglie il nome. La modifica è immediata e visibile a tutti.
- **Proposta automatica a rotazione**: l'app suggerisce chi non ha ancora fatto il turno di recente (o è stato meno volte incaricato). Il suggerimento è solo una proposta: resta sempre modificabile.
- **Storico turni** nella scheda squadra/giocatore: quante volte ciascuno ha portato i palloni.
- **Due promemoria per l'incaricato**:
  1. il giorno stesso dell'evento in cui li deve **prendere** a fine allenamento/partita;
  2. il giorno dell'evento successivo, per ricordargli di **riportarli**.
- I promemoria arrivano come banner ben visibile in Home e, per chi attiva le notifiche, come notifica push sul telefono.

## Impostazione tecnica

**Backend (Lovable Cloud)**
- Attivazione di Lovable Cloud.
- Tabella `eventi` (spostando i dati demo attuali su database) o, in alternativa minima, tabella `turni_palloni` con `evento_id`, `giocatore_id`, `aggiornato_da`, `aggiornato_il`. Scelgo la seconda per limitare il refactor: gli eventi restano in `crapp-data.ts` finché non si passa a calendario dinamico.
- Tabella `push_subscriptions` (giocatore_id, endpoint, chiavi) per le notifiche.
- Grant espliciti + RLS: lettura e scrittura aperte a tutti gli utenti dell'app (nessun login previsto oggi → policy per `anon` limitate a queste tabelle, nessun dato personale sensibile).
- Server functions in `src/lib/palloni.functions.ts`: `getTurni`, `setTurno`, `suggerisciTurno`.

**Frontend**
- Nuovo componente `TurnoPalloni` usato in `EventoCard` e in Home.
- Lettura via TanStack Query (`ensureQueryData` nel loader, `useSuspenseQuery` nel componente), invalidazione dopo la modifica.
- Banner promemoria in Home basato su data odierna + evento successivo, mostrato solo al giocatore selezionato in `user-store`.

**Notifiche push**
- Service worker dedicato al messaging (separato dalla PWA esistente), chiavi VAPID salvate come secret.
- Schermata in Profilo: "Attiva notifiche palloni" con richiesta di permesso.
- Invio schedulato tramite un endpoint `src/routes/api/public/promemoria-palloni.ts` protetto da secret, richiamato una volta al giorno da un job pianificato (pg_cron).
- Nota: su iPhone le notifiche push funzionano solo se l'app è installata dalla schermata Home.

## Ordine di lavoro

1. Attivare Lovable Cloud e creare tabelle + policy.
2. Server functions + UI del turno palloni (assegnazione manuale condivisa).
3. Rotazione automatica suggerita + storico turni.
4. Banner promemoria in-app.
5. Notifiche push + job giornaliero.
