# Modulo — Badge

**Stato:** implementato (v1.0), coerente con DD-007 e DD-008
**File principali:** `src/lib/badges.ts`, `src/lib/badge-social.ts`,
`src/components/crapp/CollezioneBadge.tsx`, `src/components/crapp/BadgeDrawer.tsx`,
`src/components/crapp/CelebrazioneBadge.tsx`, `src/components/crapp/VotoSocial.tsx`

---

## Obiettivo

Gamification: sbloccare badge (gradi bronzo/argento/oro, più badge "segreti") in base a
statistiche personali reali del giocatore, per motivare la partecipazione senza penalizzare i
ruoli con meno statistiche "spettacolari" (DD-008).

---

## Dati

Nessuna tabella dedicata ai badge sbloccati: **calcolati interamente a runtime**
dall'oggetto `Giocatore` (DD-007). L'unica tabella coinvolta è `badge_social_voti`, per i
badge assegnati per voto dai compagni.

---

## Implementazione

- `badgeDefs`/`badgeSegreti` (`badges.ts`) definiscono ogni badge con una funzione
  `valore(g)` e soglie bronzo/argento/oro. Le fonti dato sono solo statistiche indipendenti
  dal ruolo in campo: MVP, media pagelle, turni palloni, presenze, serie, infortuni,
  ritardi, cacche — **mai** punti/ace/muri dello Scout Live, coerentemente con DD-008.
- I badge segreti restano nascosti (icona lucchetto) finché non sbloccati.
- **Badge social** (`badge-social.ts`, tabella `badge_social_voti`): 5 categorie fisse per
  partita ("Compagno affidabile", "Miglior spirito di squadra", "Fair play", "Meme della
  partita", "Cuore del gruppo"), votabili una volta a testa per categoria/partita
  (modificabile), con **auto-voto escluso in interfaccia** (`VotoSocial.tsx`) e rifiutato dal
  database (vincolo `badge_social_no_autovoto`, migration `m12_niente_autovoto`). A
  differenza delle [Pagelle](pagelle.md), qui non c'è alcun tentativo di anonimato:
  `votante_id`/`votato_id` sono entrambi visibili.
- `CollezioneBadge.tsx` mostra sbloccati, in progresso, badge social vinti e un contatore di
  badge segreti ancora da scoprire; `BadgeDrawer.tsx` il dettaglio di un singolo badge;
  `CelebrazioneBadge.tsx` l'overlay celebrativo alla prima visualizzazione di un badge nuovo.
- Il rilevamento "nuovo" (`notifiche-smart.ts`) confronta id deterministici con quelli già
  visti, salvati in `localStorage` — quindi **locale al dispositivo**, non sincronizzato tra
  dispositivi dello stesso giocatore.

---

## Regole rispettate

- **DD-007**: nessuna tabella `badge_sbloccati`, tutto calcolato a runtime dai dati
  esistenti.
- **DD-008**: nessun `BadgeDef` usa dati di reparto (punti/ace/muri); solo statistiche
  raggiungibili da qualunque ruolo.

---

## Limiti noti

- **Dipendenza dal modulo [Serie](serie-presenze.md)**: i badge "Sempre in palestra",
  "Risposta lampo" e il segreto "Mai un forfait" si muovono solo se cambiano le serie. Le
  serie sono calcolate sui dati reali dalla migration `m9` in avanti, ma "Risposta lampo" e
  "Mai un forfait" dipendono da `serieConferme`, e `risposto_il` non è ricostruibile per le
  risposte precedenti a `m9`: su quelle righe la serie è un'approssimazione.
- Nessuno storico dei badge sbloccati: se cambiano le soglie o i dati sorgente, un badge già
  "ottenuto" può sparire o apparire retroattivamente.
- La policy di M11 garantisce che il voto sia firmato con il proprio `votante_id`, ma non
  che il votato sia un giocatore convocato per quella partita: quello resta un filtro solo
  applicativo.
- Notifiche "nuovo badge" solo locali al dispositivo (localStorage), si ripetono cambiando
  browser o dispositivo.

---

## Evoluzioni possibili

- Sincronizzare lo stato "visto" su Supabase invece che solo in localStorage.
- Verificare sui dati di stagione che i tre badge legati alle serie si sblocchino davvero,
  ora che le serie sono calcolate.
