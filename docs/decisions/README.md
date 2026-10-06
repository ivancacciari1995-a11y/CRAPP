# Registro delle decisioni di progetto

Ogni file di questa cartella è **una decisione** (`DD-XXX.md`): una scelta che ha influito sulla
direzione del prodotto, sull'organizzazione del lavoro o su come l'app si evolve. Non descrive
_come_ è fatto il codice (per quello esistono [ARCHITECTURE.md](../ARCHITECTURE.md) e
[DATABASE.md](../DATABASE.md)): risponde a _perché abbiamo scelto così_, _cosa avevamo escluso_
e _quando conviene riaprire la scelta_.

**Leggi solo le decisioni che ti servono**: cerca il tema nell'indice qui sotto e apri il file
corrispondente. Non serve leggerle tutte.

## Come usare questo registro

Ogni decisione segue lo schema di [../_template-dd.md](../_template-dd.md):

| Campo                    | Significato                                            |
| ------------------------ | ------------------------------------------------------ |
| **Data**                 | Quando la decisione è stata presa o confermata         |
| **Stato**                | Accettata · In valutazione · Sostituita · Obsoleta     |
| **Contesto**             | Quale problema o opportunità avevamo di fronte         |
| **Decisione**            | Cosa abbiamo scelto di fare                            |
| **Alternative scartate** | Cosa non abbiamo fatto e perché                        |
| **Conseguenze**          | Cosa comporta nel quotidiano (utenti, admin, sviluppo) |
| **Riesame**              | Quando ha senso riconsiderarla                         |

**Quando aggiungere una voce**

- una scelta influisce su più moduli o su più release;
- escludiamo un'alternativa non ovvia;
- accettiamo un compromesso consapevole (debito, limitazione, ritardo);
- cambiamo una decisione precedente.

**Quando non serve**

- dettagli implementativi locali;
- scelte estetiche minori;
- bugfix o correzioni puntuali.

**Come registrare una nuova decisione**

Copiare [../_template-dd.md](../_template-dd.md) in `docs/decisions/DD-XXX.md` con il primo ID
libero (gli ID non si riusano e non si rinumerano), poi aggiungere la riga all'indice qui sotto.
Una decisione sostituita non si cancella: si cambia il suo **Stato** e si rimanda a quella nuova.

## Indice

**Accettate**

| ID                  | Titolo                                      |
| ------------------- | ------------------------------------------- |
| [DD-001](DD-001.md) | Indipendenza da Lovable                     |
| [DD-002](DD-002.md) | Sviluppo document-first                     |
| [DD-004](DD-004.md) | Ogni versione aggiunge, non riscrive        |
| [DD-005](DD-005.md) | Mobile-first                                |
| [DD-006](DD-006.md) | AI solo se utile                            |
| [DD-007](DD-007.md) | Badge calcolati, non in DB                  |
| [DD-008](DD-008.md) | Gamification equa tra ruoli                 |
| [DD-009](DD-009.md) | CSI manuale, poi integrazione API           |
| [DD-010](DD-010.md) | Niente storico certificati                  |
| [DD-011](DD-011.md) | Auth reale prima del profilo                |
| [DD-012](DD-012.md) | Rimandare la migrazione ID                  |
| [DD-013](DD-013.md) | Portabilità dello stack                     |
| [DD-015](DD-015.md) | Rosa da hardcoded a DB                      |
| [DD-016](DD-016.md) | Schema dati Profilo Giocatore               |
| [DD-017](DD-017.md) | L'admin scrive al posto del giocatore       |
| [DD-018](DD-018.md) | Collegamento automatico per email           |
| [DD-019](DD-019.md) | Il branch lo decide l'utente                |
| [DD-020](DD-020.md) | Test obbligatori e verdi                    |
| [DD-021](DD-021.md) | Molle interrompibili con motion             |
| [DD-022](DD-022.md) | App solo chiara                             |
| [DD-023](DD-023.md) | Scritture limitate per ruolo                |
| [DD-024](DD-024.md) | Route di notifica autenticate               |
| [DD-025](DD-025.md) | Promemoria palloni manuale                  |
| [DD-026](DD-026.md) | Payload push cifrato                        |
| [DD-027](DD-027.md) | Voto limitato ai convocati                  |
| [DD-028](DD-028.md) | Soglia minima Media voto e MVP              |
| [DD-029](DD-029.md) | Pulizia a cascata evento cancellato         |
| [DD-030](DD-030.md) | Centro notifiche in-app                     |
| [DD-031](DD-031.md) | Nascita pubblica sincronizzata              |
| [DD-032](DD-032.md) | Stagione CSI dalle date delle gare          |
| [DD-033](DD-033.md) | Gestione eventi solo da calendario          |
| [DD-034](DD-034.md) | Ruolo allenatore                            |
| [DD-035](DD-035.md) | Avviso certificati in Home                  |
| [DD-036](DD-036.md) | Notifiche email via Gmail                   |
| [DD-037](DD-037.md) | Promemoria evento senza ritorni             |
| [DD-038](DD-038.md) | Tre canali per ogni notifica                |
| [DD-039](DD-039.md) | Niente promemoria all'allenatore            |
| [DD-040](DD-040.md) | Palloni e solleciti automatici              |
| [DD-047](DD-047.md) | Notifica di compleanno                      |
| [DD-046](DD-046.md) | Avviso certificati mancanti                 |
| [DD-045](DD-045.md) | Sollecito presenze: un solo avviso a 24 ore |
| [DD-044](DD-044.md) | Via la foto tessera dal profilo             |
| [DD-043](DD-043.md) | Niente promemoria evento a 24 e 3 ore       |
| [DD-042](DD-042.md) | Turno palloni: un solo avviso a 3 ore       |
| [DD-041](DD-041.md) | Avviso certificati: giocatore a 30 giorni   |

**In valutazione**

| ID                  | Titolo                |
| ------------------- | --------------------- |
| [DD-014](DD-014.md) | Convergenza schema DB |

**Sostituite**

| ID                  | Titolo                |
| ------------------- | --------------------- |
| [DD-003](DD-003.md) | Branch main / develop |
