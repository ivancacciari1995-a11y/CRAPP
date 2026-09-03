# Modulo — Collegamento CSI

**Stato:** implementato (stagione 2025/26)
**Route interessata:** `/classifica`

---

## Obiettivo

Mostrare nell'app la classifica e i risultati **ufficiali** del campionato CSI, al posto
dei dati dimostrativi hardcoded in `crapp-data.ts`. Nessun inserimento manuale da parte
degli amministratori: è esattamente il tipo di lavoro amministrativo che CrAPP deve togliere.

---

## Sorgente dati

Portale **Livescore CSI Bologna** (`https://livescore.csibologna.it`).

Il portale **non espone un'API pubblica documentata**. Vengono usati gli stessi endpoint
che il sito chiama internamente via ajax: sono raggiungibili senza autenticazione e senza
API key, ma **non offrono alcuna garanzia di stabilità**.

| Endpoint                                         | Formato | Uso                                                                            |
| ------------------------------------------------ | ------- | ------------------------------------------------------------------------------ |
| `components/project-sheets.php?project_id=767`   | HTML    | Classifica completa dei due gironi                                             |
| `assets/json/getEventsByTeamId.php?team_id=3359` | JSON    | Tutte le gare della squadra: data, ora, avversario, campo, risultato, parziali |

Altri endpoint disponibili ma non usati: `getEventsByProjectIdHierarchical.php` (tutte le
gare del campionato), `project-chart-rankings.php` (solo punti), `project-next_matches.php`,
`project-last_results.php`, `team-roster.php`, `team-results.php`.

### Identificativi (stagione 2025/26)

| Cosa                | Valore                                 |
| ------------------- | -------------------------------------- |
| Campionato          | PVM - Campionato Open Misto Eccellenza |
| `project_id`        | `767`                                  |
| Squadra sul portale | `C.R.A.P. Volley` (con i punti)        |
| `team_id`           | `3359`                                 |
| Girone              | B                                      |

Gli identificativi sono costanti in `src/lib/csi-core.ts`.

---

## Implementazione

```
CSI (portale)
      ↓  fetch server-side, cache 6 ore
/api/public/csi          → src/routes/api/public/csi.ts
      ↓  JSON { classifica, partite, girone, aggiornato }
useCsi()                 → src/lib/csi.ts (React Query, staleTime 6h)
      ↓
/classifica              → src/routes/classifica.tsx
```

- **`src/lib/csi-core.ts`** — costanti, tipi e funzioni pure: `parseClassifica()` (HTML → righe),
  `partiteDaEventi()` (JSON → partite), `isNostraSquadra()`, `partiteGiocate()`.
- **`src/routes/api/public/csi.ts`** — unica route che contatta il CSI. Cache in memoria di
  6 ore; in caso di errore restituisce l'ultimo dato buono (`503` solo se non ne esiste uno).
- **`src/lib/csi.ts`** — hook client, una lettura per sessione.
- **`src/lib/csi-core.test.ts`** — check del parsing: `bun src/lib/csi-core.test.ts`.
  Con `CSI_LIVE=1` verifica anche gli endpoint reali.

### Regole rispettate

- **Nessuna chiamata dal browser**: il portale viene contattato solo lato server, al massimo
  4 volte al giorno, indipendentemente da quanti giocatori aprono l'app (regola anti-consumo).
- **Nessuna dipendenza nuova**: parsing con espressioni regolari sulla struttura della tabella.
- **Fallback**: se il CSI non risponde, l'endpoint `/api/public/csi` restituisce l'ultimo
  dato buono in cache; se non ne ha ancora uno, la classifica resta vuota e i risultati
  ricadono sulle partite dello Scout Live locale (`useScoutMatches()`).
- **Portabilità (DD-013)**: endpoint HTTP standard, nessun servizio esclusivo.

---

## Limiti noti

1. **La classifica si legge da HTML.** Se il portale cambia la struttura della tabella il
   parsing restituisce un array vuoto: `/classifica` non si rompe, ma mostra "Classifica non
   ancora disponibile" (o l'ultimo dato buono in cache, se ce n'è uno) e i risultati ricadono
   sulle partite dello Scout Live locale, non su dati demo — non esistono più in `crapp-data.ts`.
   Il check con `CSI_LIVE=1` serve a scoprire il problema di parsing.
2. **`project_id` è legato alla stagione.** Per il 2026/27 servirà un nuovo id, ricavabile da
   `team_details.php?team_id=3359`, che elenca i campionati della squadra. Oggi va aggiornato
   a mano in `csi-core.ts`.
3. **La cache vive nel processo del server.** Si perde a ogni cold start e non è condivisa tra
   istanze. Sufficiente per una squadra; se serve di più, spostare i dati in una tabella
   Supabase riempita da un job cron (stesso pattern di `promemoria-palloni`).
4. **I risultati includono anche la Coppa**, non solo il girone di campionato.

---

## Evoluzioni possibili

- Prossima partita ufficiale nella home e nel calendario (i dati sono già disponibili).
- Creazione automatica degli eventi partita da calendario CSI.
- Confronto tra i parziali ufficiali e quelli dello Scout Live.
