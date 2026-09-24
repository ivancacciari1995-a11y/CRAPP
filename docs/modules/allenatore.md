# Modulo — Ruolo Allenatore

**Stato:** implementato
**Decisione:** [DD-034](../DESIGN_DECISIONS.md#dd-034--lallenatore-è-uno-slot-della-squadra-con-tipo-diverso-non-un-giocatore)
**Migration:** `m20_ruolo_allenatore_enum`, `m21_ruolo_allenatore`
**File principali:** `src/lib/giocatori-squadra.ts` (`tipo`, `inRosa`, `isAllenatore`,
`ruoloVisibile`), `src/lib/ruoli.ts`, `src/lib/user-store.ts` (`useSonoAllenatore`,
`useGiocatoreInCampo`), `src/lib/auth-route.server.ts`, `src/routes/profilo.tsx`,
`src/routes/admin.tsx`, `src/routes/squadra.tsx`, `src/routes/index.tsx`
**Test:** `test/unit/giocatori-squadra.test.ts`, `test/unit/profili-core.test.ts`,
`test/unit/presenze.test.ts`, `test/integration/permessi-allenatore.test.ts`,
`test/integration/permessi-route.test.ts`

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

Il profilo dell'allenatore ha solo due tab (quelle del giocatore sono quattro):

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

Per l'allenatore il completamento conta solo data e luogo di nascita, telefono ed email, 25%
ciascuno (`completamentoAllenatore()`). Il widget in Home segue la stessa regola: sparisce
quando quei campi sono compilati.

## Home

La Home dell'allenatore tiene ciò che riguarda la squadra e toglie ciò che riguarda il
giocatore: restano classifica e bilancio, prossimo impegno e ultima partita; spariscono lo
streak personale, il promemoria palloni, «Da confermare», l'obiettivo di squadra e il
«Colpo d'occhio» con le statistiche personali. Non compare nemmeno l'avviso certificati: lo
vedono solo gli admin e il giocatore interessato (DD-035).

## Squadra

L'allenatore compare nella tab **Rosa** insieme ai giocatori, con foto, nome e cognome. Dove
per un giocatore c'è il ruolo in campo (palleggiatore, schiacciatore…) per lui c'è scritto
**Allenatore**, ricavato da `tipo` e non dal campo `ruolo`. Non ha numero di maglia né
statistiche, e non compare nella tab Stats né nelle classifiche.

Da allenatore, in `/squadra` vede solo **Rosa** e **Stats**: le tab **Obiettivi** e **Badge**
non compaiono.

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
| push «Sondaggio pre-partita aperto» | non parte verso i dispositivi degli allenatori (`apri-sondaggio.ts`)             |
| `/profilo`, `/squadra`              | le tab Badge (già escluse sopra)                                                 |

Presenze, media voto, MVP e palloni restano visibili.

## Gestione eventi

L'allenatore ha su `/eventi` gli stessi poteri dell'admin: crea, modifica, sposta ed elimina
eventi e sceglie i convocati (l'elenco dei convocati contiene solo giocatori). Nel database
la policy di scrittura su `eventi_app` è "admin o allenatore" (M21); la cancellazione a
cascata (DD-029) resta invariata. Il bottone «Gestisci eventi» del Calendario compare anche
a lui (`usePuoGestireEventi()`).

Può anche **sollecitare le presenze** di un evento, come l'admin: la route
`sollecita-presenze.ts` accetta admin o allenatore (`richiediGestoreEventi()`), e il
sollecito arriva solo ai giocatori che non hanno risposto, mai all'allenatore stesso.

**Restano solo admin:** dashboard `/admin`, dati e documenti dei giocatori, export CSI,
notifica personalizzata, promemoria palloni, apertura sondaggio cacche, correzione delle
risposte presenze altrui, gestione dei ruoli.

## Notifiche

L'allenatore riceve i promemoria automatici degli eventi (24h e 3h prima, centro notifiche
in-app di M17) come i giocatori, anche se non è convocato: `giocatori_destinatari_evento()`
lo include sempre. Riceve anche i messaggi dell'admin, e può attivare le push dal proprio
Profilo. Non riceve il sollecito presenze, il turno palloni né il sondaggio cacche, che
riguardano chi gioca.

## Esclusione dalla rosa

L'allenatore ha uno slot in `giocatori_squadra` (DD-034), quindi ogni lettura della "rosa di
gioco" lo esclude con `inRosa()` (`attivo` e `tipo = giocatore`) al posto del vecchio filtro
su `attivo`. Fanno eccezione la tab Rosa di Squadra, i compleanni del Calendario
(`useAnagraficaRosa({ conAllenatori: true })`), i destinatari dei promemoria evento e dei
messaggi admin, che lo includono.

| Livello  | Dove si esclude l'allenatore                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| client   | `useRosa()`, `useAnagraficaRosa()`, `useTurniPalloni()`, `usePresenzeUltimoMeseTutti()`, form convocati di `/eventi`, `EventoCard`, `TurnoPalloni`, `VotazioneMvp`, `VotoSocial` |
| identità | `useGiocatoreInCampo()` è `null` per l'allenatore: niente risposta presenze, voti, pagelle, cacche, promemoria palloni                                                           |
| server   | `destinatariSollecito()`, `promemoria-palloni.ts`, `apri-sondaggio.ts`                                                                                                           |
| database | policy presenze e cacche «la propria riga» solo per `tipo = giocatore`; `evento_permette_voto()` rifiuta votante o votato allenatore                                             |
| admin    | tab Squadra (conteggi, export CSI) e Profili (allenatori in un gruppo a parte, senza documenti né tesseramento)                                                                  |

Il compleanno dell'allenatore resta visibile in Calendario (è un membro della squadra, non un
giocatore).

## Permessi (riepilogo)

| Azione                                          | Giocatore  | Allenatore         | Admin              |
| ----------------------------------------------- | ---------- | ------------------ | ------------------ |
| Modificare nome e cognome                       | no         | sì, i propri       | tutti              |
| Dati personali e foto profilo                   | i propri   | i propri (ridotti) | tutti (non i file) |
| Documento, certificato, foto tessera            | i propri   | —                  | lettura/download   |
| Avviso certificati in Home                      | il proprio | no                 | tutta la rosa      |
| Creare/modificare/eliminare eventi, convocati   | no         | sì                 | sì                 |
| Sollecitare le presenze                         | no         | sì                 | sì                 |
| Promemoria palloni, notifica personalizzata     | no         | no                 | sì                 |
| Rispondere alle presenze, votare, essere votato | sì         | no                 | sì (se giocatore)  |
| Tab Stagione e Badge del profilo                | sì         | no                 | sì                 |
| Tab Obiettivi e Badge di Squadra                | sì         | no                 | sì                 |
| Badge e classifiche/dati sulle cacche           | sì         | no                 | sì                 |
| Dashboard `/admin`                              | no         | no                 | sì                 |

## Implementazione

- **Migration M20** aggiunge `allenatore` all'enum `app_role`: sta da sola perché Postgres non
  lascia usare un valore di enum nella transazione che lo crea.
- **Migration M21**: colonna `giocatori_squadra.tipo`; `numero` nullabile solo per gli
  allenatori (vincolo `giocatori_squadra_numero_giocatori`); trigger
  `enforce_giocatori_squadra_update` con `tipo` bloccato e nome/cognome liberi solo sullo slot
  del proprio allenatore; policy «L'allenatore aggiorna il proprio slot»; trigger
  `sincronizza_ruolo_allenatore` che aggiunge o toglie la riga `allenatore` in `user_roles` al
  collegamento, scollegamento, disattivazione o cambio di tipo; policy `eventi_app` admin o
  allenatore; presenze, cacche e voti chiusi all'allenatore; promemoria evento aperti.
- **Client**: nell'app `numero` resta un `number` (0 per l'allenatore, NULL a database). I
  permessi (eventi, sollecito) leggono `user_roles` con `usePuoGestireEventi()`; cosa si vede
  dipende dal tipo del proprio slot (`useSonoAllenatore()`), che è immediato.
- **Admin**: «Aggiungi giocatore o allenatore» con il campo Tipo; per l'allenatore il form non
  chiede numero e ruolo. Il tipo si sceglie solo alla creazione.

## Scelte confermate

- Riceve i promemoria degli eventi: sì.
- Sollecita le presenze: sì. Promemoria palloni: no.
- Badge e cacche: mai visibili all'allenatore, né classifiche né sondaggio.
- In Squadra: nessuna sezione Staff; compare in Rosa come gli altri, con «Allenatore» al
  posto del ruolo.
- Vede le risposte presenze e le pagelle dei giocatori: sì, la lettura è già aperta a tutti
  gli autenticati.
