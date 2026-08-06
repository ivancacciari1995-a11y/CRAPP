# Rendere CrAPP operativa: migrazione dal prototipo al Cloud

## Stato attuale

L'app è un prototipo UI con alcune funzioni già collegate a Lovable Cloud:

- Già sul Cloud: voti MVP (`mvp_voti`), iscrizioni push (`push_subscriptions`), sessioni scout (`scout_sessioni`), turni palloni (`turni_palloni`).
- Ancora in locale come dati demo: rosa giocatori, calendario eventi, storico partite, classifica CSI, statistiche individuali, presenze/assenze, badge.

## Cosa serve per renderla operativa

1. **Rosa e profili giocatori sul database**
   - Creare tabella `profiles` (o `giocatori`) con nome, numero maglia, ruolo, data di nascita, foto profilo.
   - Collegare ogni riga all'utente autenticato corrispondente.
   - Rimuovere la rosa statica da `src/lib/crapp-data.ts` e caricarla dal backend.

2. **Autenticazione reale**
   - Sostituire la semplice selezione "Chi sei?" in `localStorage` con login email/password o OAuth (Google).
   - Ogni giocatore accede con le proprie credenziali e vede solo i propri dati modificabili.
   - Necessaria per garantire che uno scout o un voto MVP provenga davvero da quel giocatore.

3. **Calendario eventi persistente**
   - Tabella `eventi` con tipo, titolo, data, ora, luogo, avversario, casa/fuori.
   - Tabella `presenze` (evento_id, giocatore_id, stato, aggiornato_il).
   - I compleanni possono restare derivati dalla data di nascita dei giocatori.

4. **Statistiche e badge dinamici**
   - Tabella `statistiche` o `azioni_scout` (evento_id, giocatore_id, tipo azione, valore, creato_il).
   - I badge vengono calcolati in tempo reale dalle statistiche accumulate, senza valori fissi in `crapp-data.ts`.

5. **Scout live collegato ai dati reali**
   - Le azioni registrate in `scout.tsx` devono scrivere sulle tabelle eventi/statistiche.
   - Mantenere il lock di modifica singolo e l'attivazione solo il giorno della partita.

6. **Classifica CSI**
   - Tabella `classifica` aggiornata manualmente da un admin o importata dal sito CSI quando disponibile.
   - Per ora nessuna API CSI ufficiale: si inserisce a mano o si copia/incolla.

7. **Notifiche push definitive**
   - Verificare che i cron job inviino correttamente i promemoria palloni.
   - Aggiungere notifiche per conferma eventi, promemoria presenze, MVP votabile.

8. **Ruoli e permessi**
   - Definire chi può creare/modificare eventi (capitano/admin).
   - Chi può fare scout (designato per partita).
   - Chi può modificare i turni palloni (tutti, come da tua richiesta).

## Cosa resta salvato nel Cloud

Sì: tutto ciò che viene scritto sulle tabelle Lovable Cloud/Supabase resta salvato online e condiviso tra tutti i dispositivi.

I dati demo in `src/lib/crapp-data.ts` invece no: sono file statici, quindi ogni aggiornamento dell'app li sovrascrive e ogni telefono li vede identici.

## Decisioni da prendere insieme

- Vuoi abilitare login email/password per ogni giocatore, o preferisci mantenere la selezione "Chi sei?" senza password per semplicità?
- Chi gestirà inserimento eventi e aggiornamento classifica: solo alcuni o tutta la squadra?
- Vuoi procedere per fasi (prima rosa + calendario + presenze, poi statistiche) o tutto insieme?
