---
name: Efficienza Cloud
description: Regole per minimizzare query, traffico e invocazioni Cloud (piano 20 crediti/mese, 17 utenti)
type: feature
---
- Nessun polling (`refetchInterval`) verso il database; sincronizzazione locale via BroadcastChannel/storage dove possibile.
- QueryClient globale: staleTime 5 min, gcTime 30 min, refetchOnWindowFocus/Mount/Reconnect disattivati, retry 1.
- Dopo una mutazione aggiornare la cache con `setQueryData`, non `invalidateQueries` (evita riletture).
- Scout live: scrive solo l'utente che segna; gli altri leggono dati già salvati.
- Statistiche, badge e classifiche: "write once, read many" — calcolate e salvate una volta a fine partita, mai ricalcolate a ogni apertura pagina.
- Dati CSI: sincronizzazione periodica server-side salvata su tabella locale; l'app legge solo dal database interno.
- Push solo per eventi importanti: convocazioni, promemoria allenamento/partita, turno palloni, esito finale.
- Niente foto/video/chat o funzionalità pesanti.
- Schema target: team_id, eventi, presenze, azioni_scout, statistiche_aggregate, classifica_csi, notifiche, con indici sui campi di filtro/relazione.
