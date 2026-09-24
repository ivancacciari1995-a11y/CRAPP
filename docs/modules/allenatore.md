# Modulo — Ruolo Allenatore

**Stato:** da implementare (specifica)
**Decisione:** [DD-034](../DESIGN_DECISIONS.md#dd-034--lallenatore-è-uno-slot-della-squadra-con-tipo-diverso-non-un-giocatore)
**File coinvolti (previsti):** `src/lib/ruoli.ts`, `src/lib/auth-route.server.ts`,
`src/routes/profilo.tsx`, `src/routes/eventi.tsx`, `src/routes/admin.tsx`,
`src/lib/profili-core.ts`, i punti che leggono la rosa (vedi [Esclusione dalla rosa](#esclusione-dalla-rosa))

## Obiettivo

Dare accesso all'app all'allenatore, con permessi diversi da quelli di un giocatore: gestisce
gli eventi (allenamenti, partite, amichevoli) e sollecita le presenze, ma non gioca: compare
in Squadra come membro con la dicitura «Allenatore», però non è convocabile, non vota, non
riceve voti e non ha statistiche, badge o stagione.

## Registrazione

Stesso flusso dei giocatori (DD-018), senza passaggi in più:

1. L'admin, da `/admin` → **Aggiungi**, sceglie il tipo **Allenatore** invece di Giocatore e
   inserisce nome, cognome ed email Gmail. Numero di maglia e ruolo in campo non si chiedono.
2. L'allenatore accede con Google; l'email corrisponde allo slot e il collegamento è
   automatico. Se l'email non corrisponde, stesso messaggio di errore dei giocatori.
3. Entra in Home.

Il permesso nasce dalla registrazione fatta dall'admin: l'allenatore non può
auto-promuoversi, perché il tipo dello slot lo scrive solo un admin (come oggi numero e ruolo).

## Profilo

Il profilo dell'allenatore ha solo due tab (in `TAB_PROFILO` oggi sono quattro):

| Tab          | Giocatore | Allenatore                                     |
| ------------ | --------- | ---------------------------------------------- |
| Stagione     | sì        | **no**                                         |
| Badge        | sì        | **no**                                         |
| Documenti    | sì        | sì, ridotta (vedi sotto); tab iniziale         |
| Impostazioni | sì        | sì, identica (logout, notifiche, segnalazioni) |

Un link diretto a `/profilo?tab=stagione` o `?tab=badge` apre Documenti.

### Dati modificabili dall'allenatore

| Campo            | Dove sta oggi                     | Nota                                                                                           |
| ---------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Nome, cognome    | `giocatori_squadra`               | per un giocatore li scrive solo l'admin; per l'allenatore anche lui sul proprio slot           |
| Email (contatto) | `profili_giocatore.email`         | non è l'email di login, che resta quella registrata dall'admin                                 |
| Data di nascita  | `profili_giocatore.data_nascita`  | sincronizzata in `giocatori_squadra.nascita` come per tutti (DD-031): compleanno in Calendario |
| Luogo di nascita | `profili_giocatore.luogo_nascita` |                                                                                                |
| Telefono         | `profili_giocatore.telefono`      |                                                                                                |
| Foto profilo     | bucket `avatar-giocatori`         | stesso cerchio avatar e stesso upload dei giocatori                                            |

**Non** si mostrano: indirizzo di residenza, documento d'identità, certificato medico, foto
tessera, tesseramento CSI.

### Completamento profilo

Per l'allenatore il completamento conta solo i dati personali della tabella sopra (100%).
Il widget in Home segue la stessa regola: sparisce quando quei campi sono compilati.

## Squadra

L'allenatore compare nella tab **Rosa** insieme ai giocatori, con foto, nome e cognome. Dove
per un giocatore c'è il ruolo in campo (palleggiatore, schiacciatore…) per lui c'è scritto
**Allenatore**, ricavato da `tipo` e non dal campo `ruolo`. Non ha numero di maglia né
statistiche, e non compare nella tab Stats né nelle classifiche.

Da allenatore, in `/squadra` vede solo **Rosa** e **Stats**. Le tab **Obiettivi** e **Badge**
non compaiono, e un link diretto a una delle due apre Rosa.

| Tab       | Giocatore | Allenatore |
| --------- | --------- | ---------- |
| Rosa      | sì        | sì         |
| Stats     | sì        | sì         |
| Obiettivi | sì        | **no**     |
| Badge     | sì        | **no**     |

## Badge e cacche nascosti

L'allenatore non vede **nessun badge** e **nessuna classifica o dato sulle cacche**, in
nessuna schermata:

| Dove                                | Cosa si nasconde all'allenatore                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| `/squadra` → Stats                  | il criterio di ordinamento «Cacche» (`cacchePartita`)                            |
| `/squadra` → Rosa, scheda giocatore | la riga «Cacche/partita 💩»                                                      |
| `/partita/$id`                      | la sezione «Badge votati dai compagni» e il sondaggio cacche (`SondaggioCacche`) |
| `/profilo`, `/squadra`              | le tab Badge (già escluse sopra)                                                 |

Presenze, media voto, MVP e palloni restano visibili.

## Gestione eventi

L'allenatore ha su `/eventi` gli stessi poteri dell'admin: crea, modifica, sposta ed elimina
eventi e sceglie i convocati. Nel database la policy di scrittura su `eventi_app` passa da
"solo admin" a "admin o allenatore" (oggi `m11_scritture_per_ruolo`); la cancellazione a
cascata (DD-029) resta invariata.

Il link a `/eventi` compare dove oggi compare per l'admin.

Può anche **sollecitare le presenze** di un evento, come l'admin: la route
`sollecita-presenze.ts` accetta admin o allenatore (oggi `richiediAdmin()`), e il sollecito
arriva solo ai giocatori che non hanno risposto, mai all'allenatore stesso.

**Restano solo admin:** dashboard `/admin`, dati e documenti dei giocatori, export CSI,
notifica personalizzata, promemoria palloni, apertura sondaggio cacche, correzione delle
risposte presenze altrui, gestione dei ruoli.

## Notifiche

L'allenatore riceve i promemoria degli eventi (24h e 3h prima, push e centro notifiche
in-app) come i giocatori, anche se non è convocato, e può attivare le push dal proprio
Profilo. Non riceve il sollecito presenze né il turno palloni, che riguardano chi gioca.

## Esclusione dalla rosa

L'allenatore ha uno slot in `giocatori_squadra` (DD-034), quindi ogni lettura della "rosa di
gioco" deve escluderlo: oggi il filtro è `attivo`, diventa `attivo e tipo = giocatore`. Fanno
eccezione la tab Rosa di Squadra, i compleanni del Calendario e i destinatari dei promemoria
evento, che lo includono. Punti da coprire, da verificare uno per uno in implementazione:

- client: `useRosa()`, `useGiocatoriSquadra()` (dove usata come rosa), `useAnagraficaRosa()`
  — Squadra (Stats, Obiettivi, Badge), Presenze, Palloni, Pagelle, MVP, Badge, Classifica,
  Scout, form convocati di `/eventi`;
- server e condivisi: `leggiGiocatoriSquadra()`, `convocatiEvento()` (`eventi.ts`, riceve la
  rosa già filtrata), route API che notificano "tutta la rosa";
- database: `evento_permette_voto()` (M13), che con `convocati` vuoto intende "tutta la rosa
  attiva"; i cron dei promemoria evento (M17) invece aggiungono sempre l'allenatore ai
  destinatari, convocato o no;
- admin: tab Profili (conteggi di completamento e tesseramento), export CSI.

Il compleanno dell'allenatore resta visibile in Calendario (è un membro della squadra, non un
giocatore).

## Permessi (riepilogo)

| Azione                                          | Giocatore | Allenatore         | Admin              |
| ----------------------------------------------- | --------- | ------------------ | ------------------ |
| Modificare nome e cognome                       | no        | sì, i propri       | tutti              |
| Dati personali e foto profilo                   | i propri  | i propri (ridotti) | tutti (non i file) |
| Documento, certificato, foto tessera            | i propri  | —                  | lettura/download   |
| Creare/modificare/eliminare eventi, convocati   | no        | sì                 | sì                 |
| Sollecitare le presenze                         | no        | sì                 | sì                 |
| Promemoria palloni, notifica personalizzata     | no        | no                 | sì                 |
| Rispondere alle presenze, votare, essere votato | sì        | no                 | sì (se giocatore)  |
| Tab Stagione e Badge del profilo                | sì        | no                 | sì                 |
| Tab Obiettivi e Badge di Squadra                | sì        | no                 | sì                 |
| Badge e classifiche/dati sulle cacche           | sì        | no                 | sì                 |
| Dashboard `/admin`                              | no        | no                 | sì                 |

## Cosa implementare

1. **Migration** (nuova, non si riscrivono le esistenti):
   - `giocatori_squadra.tipo` (`giocatore` | `allenatore`, default `giocatore`, non nullo);
   - valore `allenatore` nell'enum `app_role`, assegnato in `user_roles` da una funzione
     `SECURITY DEFINER` al momento del collegamento di uno slot con `tipo = allenatore`
     (i permessi restano letti da `user_roles`, DD-011);
   - trigger `enforce_giocatori_squadra_update`: `tipo` scrivibile solo dall'admin; `nome` e
     `cognome` scrivibili dall'allenatore sul proprio slot;
   - policy di scrittura `eventi_app`: admin o allenatore;
   - `evento_permette_voto()`: escludere `tipo = allenatore`;
   - cron promemoria evento: includere sempre gli allenatori attivi tra i destinatari.
2. **`src/lib/ruoli.ts`**: `useIsAllenatore()` e `usePuoGestireEventi()` (admin o allenatore),
   stessa lettura di `user_roles` e stessa cache.
3. **`/eventi`**: gate `usePuoGestireEventi()` al posto di `useIsAdmin()`, anche per il link di accesso.
   Il bottone del sollecito presenze usa lo stesso gate; lato server `sollecita-presenze.ts`
   passa da `richiediAdmin()` a un controllo "admin o allenatore" in `auth-route.server.ts`.
4. **`/profilo`**: tab e campi in base al tipo; nome e cognome modificabili per l'allenatore.
5. **`/squadra`**: l'allenatore compare in Rosa con la dicitura «Allenatore», senza numero né
   statistiche; da allenatore non si vedono le tab Obiettivi e Badge, né il criterio e la riga
   delle cacche.
   **`/partita/$id`**: niente sezione badge né sondaggio cacche per l'allenatore.
6. **`profili-core.ts`**: completamento dedicato all'allenatore (solo dati personali).
7. **`/admin`**: scelta del tipo in "Aggiungi"; allenatori mostrati a parte, fuori dai conteggi
   di completamento e tesseramento; nessun export CSI per loro.
8. **Filtro rosa** in tutti i punti elencati sopra.
9. **Test**: unit sul completamento e sul filtro rosa; integration in
   `test/integration/permessi.test.ts` (l'allenatore scrive `eventi_app`, non vota, non cambia
   il proprio `tipo`, non scrive slot altrui).
10. **Documentazione** alla consegna: `DATABASE.md` (colonna, enum, tabella permessi),
    `profilo-giocatore.md`, `squadra.md`, `calendario.md`, `CHANGELOG.md`, `ROADMAP.md`, DD-034 → Accettata.

## Scelte confermate

- Riceve i promemoria degli eventi: sì.
- Sollecita le presenze: sì. Promemoria palloni: no.
- Badge e cacche: mai visibili all'allenatore, né classifiche né sondaggio.
- In Squadra: nessuna sezione Staff; compare in Rosa come gli altri, con «Allenatore» al
  posto del ruolo.
- Vede le risposte presenze e le pagelle dei giocatori: sì, la lettura è già aperta a tutti
  gli autenticati.
