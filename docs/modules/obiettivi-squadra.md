# Modulo — Obiettivi di squadra

**Stato:** implementato (v1.0), con costanti stagionali da aggiornare a mano
**File principali:** `src/lib/obiettivi.ts`, `src/lib/rosa.ts` (`useObiettivi()`)

---

## Obiettivo

Mostrare traguardi collettivi (non individuali) che avanzano con il contributo di tutta la
rosa — presenze, risposte alle convocazioni, pagelle, risultati di campionato — per motivare
comportamenti di squadra oltre alla singola prestazione.

---

## Dati

Nessuna tabella dedicata: ogni obiettivo è una funzione pura in `obiettivi.ts` che legge dati
già aggregati altrove (`risposte_presenze`, `pagelle_voti`, i risultati ufficiali CSI, le
serie).

---

## Obiettivi definiti

| Obiettivo                          | Calcolo                                         | Target | Fonte                                          |
| ---------------------------------- | ----------------------------------------------- | ------ | ---------------------------------------------- |
| 90% presenze ad agosto             | risposte presente/ritardo sugli eventi del mese | 90%    | `risposte_presenze`                            |
| Tutti rispondono alle convocazioni | risposte totali / eventi possibili              | 90%    | `risposte_presenze`                            |
| 250 presenze complessive           | somma presenze di tutta la rosa                 | 250    | aggregato da `useRosa()`                       |
| Media pagelle da 7.5               | media di squadra                                | 7.5    | `pagelle_voti`                                 |
| 200 pagelle compilate              | conteggio voti                                  | 200    | `pagelle_voti`                                 |
| Continuità di squadra              | giocatori con ≥3 allenamenti consecutivi        | 12     | `serieAllenamenti`                             |
| 1 / 5 / 10 vittorie in campionato  | partite vinte da dati CSI ufficiali             | 1/5/10 | modulo [Collegamento CSI](collegamento-csi.md) |
| 1 evento di squadra al mese        | eventi di tipo "evento" nel mese                | 1      | `eventi_app`                                   |

Mostrati in `squadra.tsx` (elenco completo con barra di progresso) e in `index.tsx` (home: il
primo obiettivo non completato). Un obiettivo che supera il 90% genera anche una notifica
smart (`notifiche-smart.ts`).

---

## Limiti noti

- "Continuità di squadra" dipende da `serieAllenamenti` (vedi
  [Serie di presenze](serie-presenze.md)), calcolato sui dati reali: un evento passato senza
  risposta vale come assenza e azzera la serie, quindi l'obiettivo misura anche quanto la
  squadra risponde alle convocazioni, non solo la presenza.
- **Il mese di riferimento è una costante fissa nel codice** (agosto 2026): gli obiettivi
  legati al mese corrente vanno aggiornati manualmente a ogni cambio di mese o stagione, oggi
  sono "congelati" su un mese già passato.
- Le vittorie di campionato dipendono dal parsing HTML del portale CSI: se quel parsing si
  rompe, questi tre obiettivi restano a 0% anche a fronte di vittorie reali.
- I target (250 presenze, 200 pagelle, ecc.) sono costanti fisse, da rivedere manualmente a
  ogni stagione.

---

## Evoluzioni possibili

- Calcolare il mese di riferimento dinamicamente invece di una costante hardcoded.
