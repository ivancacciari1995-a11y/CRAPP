# Registro delle decisioni di progetto

Questo documento raccoglie le **decisioni importanti** prese nel corso della vita di CrAPP: scelte che hanno influito sulla direzione del prodotto, sull’organizzazione del lavoro o su come l’app si evolve nel tempo.

Non descrive _come_ è fatto il codice. Per quello esistono `ARCHITECTURE.md` e `DATABASE.md`.

Serve a rispondere a domande del tipo:

- _Perché abbiamo scelto così?_
- _Cosa avevamo escluso e perché?_
- _Quando conviene riaprire una decisione?_

---

## Indice

**Accettate**

| ID                                                                                | Titolo                                |
| --------------------------------------------------------------------------------- | ------------------------------------- |
| [DD-001](#dd-001--crapp-deve-restare-indipendente-da-lovable)                     | Indipendenza da Lovable               |
| [DD-002](#dd-002--sviluppo-document-first)                                        | Sviluppo document-first               |
| [DD-004](#dd-004--ogni-versione-aggiunge-non-riscrive)                            | Ogni versione aggiunge, non riscrive  |
| [DD-005](#dd-005--mobile-first-pochi-click-pochi-schermi)                         | Mobile-first                          |
| [DD-006](#dd-006--intelligenza-artificiale-solo-se-porta-beneficio-reale)         | AI solo se utile                      |
| [DD-007](#dd-007--badge-calcolati-dallapp-non-salvati-nel-database)               | Badge calcolati, non in DB            |
| [DD-008](#dd-008--gamification-equa-tra-ruoli)                                    | Gamification equa tra ruoli           |
| [DD-009](#dd-009--tesseramento-csi-manuale-in-v11-integrazione-api-in-v20)        | CSI manuale v1.1, API v2.0            |
| [DD-010](#dd-010--profilo-giocatore-niente-storico-certificati-in-v1)             | Niente storico certificati v1         |
| [DD-011](#dd-011--autenticazione-reale-prima-del-profilo-amministrativo-completo) | Auth reale prima del profilo          |
| [DD-012](#dd-012--non-migrare-gli-id-giocatore-in-v11)                            | Non migrare ID in v1.1                |
| [DD-013](#dd-013--portabilità-lapp-non-deve-dipendere-da-servizi-esclusivi)       | Portabilità dello stack               |
| [DD-015](#dd-015--rosa-anagrafica-da-codice-hardcoded-a-database)                 | Rosa da hardcoded a DB                |
| [DD-016](#dd-016--schema-dati-profilo-giocatore-v11-f0)                           | Schema dati Profilo Giocatore v1.1    |
| [DD-017](#dd-017--lamministratore-può-compilare-i-dati-al-posto-del-giocatore)    | L'admin scrive al posto del giocatore |
| [DD-018](#dd-018--collegamento-automatico-giocatoreaccount-per-email)             | Collegamento automatico per email     |
| [DD-019](#dd-019--il-branch-dei-commit-lo-decide-lutente)                         | Il branch lo decide l'utente          |
| [DD-020](#dd-020--una-funzione-modificata-senza-test-non-è-finita)                | Test obbligatori e verdi              |
| [DD-021](#dd-021--molle-interrompibili-al-posto-delle-animazioni-a-durata-fissa)  | Molle interrompibili con motion       |
| [DD-022](#dd-022--lapp-è-solo-chiara)                                             | App solo chiara                       |
| [DD-023](#dd-023--ogni-scrittura-è-limitata-a-chi-la-fa)                          | Scritture limitate per ruolo          |
| [DD-024](#dd-024--le-route-che-avvisano-la-squadra-chiedono-le-credenziali)       | Route di notifica autenticate         |
| [DD-025](#dd-025--il-promemoria-palloni-lo-manda-ladmin-per-un-evento)            | Promemoria palloni manuale            |
| [DD-026](#dd-026--il-testo-della-notifica-viaggia-dentro-la-push)                 | Payload push cifrato                  |

**In valutazione**

| ID                                                               | Titolo                |
| ---------------------------------------------------------------- | --------------------- |
| [DD-014](#dd-014--convergenza-schema-database-eventi-e-presenze) | Convergenza schema DB |

**Sostituite**

| ID                                                               | Titolo                |
| ---------------------------------------------------------------- | --------------------- |
| [DD-003](#dd-003--due-branch-main-stabile-develop-per-il-lavoro) | Branch main / develop |

---

## Come usare questo registro

Ogni decisione segue lo stesso schema:

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
- escludiamo un’alternativa non ovvia;
- accettiamo un compromesso consapevole (debito, limitazione, ritardo);
- cambiamo una decisione precedente.

**Quando non serve**

- dettagli implementativi locali;
- scelte estetiche minori;
- bugfix o correzioni puntuali.

**Come registrare una nuova decisione**

Copiare [`_template-dd.md`](_template-dd.md) in fondo al documento, assegnare il primo ID
libero e aggiungerlo all'indice.

---

## Decisioni accettate

---

### DD-001 — CrAPP deve restare indipendente da Lovable

**Data:** luglio 2026  
**Stato:** Accettata

**Contesto**  
Il progetto nasce come prototipo su Lovable Cloud. Per crescere serve controllo su codice, deploy, database e costi.

**Decisione**  
Spostare lo sviluppo su repository GitHub indipendente, con deploy su Vercel e database Supabase gestito dal team.

**Alternative scartate**

- Restare su Lovable come unica piattaforma → troppa dipendenza da un servizio esterno.
- Riscrivere tutto da zero → costo e rischio inutili; il prototipo funzionava già.

**Conseguenze**

- Maggiore libertà e responsabilità per il team.
- Restano tracce del passaggio (dipendenze, meta tag): vanno eliminate gradualmente, non in blocco.
- L’app deve poter girare anche fuori dall’ecosistema Lovable (vedi `PORTABILITA.md`).

**Riesame**  
Quando il progetto non userà più alcun componente Lovable.

---

### DD-002 — Sviluppo document-first

**Data:** agosto 2026  
**Stato:** Accettata

**Contesto**  
Con più persone (e assistenti AI) che lavorano sul codice, serviva un modo per evitare funzionalità “inventate” al volo e incoerenze tra moduli.

**Decisione**  
Ogni nuova funzionalità significativa viene prima **progettata e documentata** in `docs/modules/`, poi implementata. Il flusso ufficiale è: idea → progettazione → documentazione → database → codice → test → release.

**Alternative scartate**

- Documentare solo a posteriori → troppo spesso incompleto o assente.
- Affidarsi solo al codice come documentazione → illeggibile per chi non programma.

**Conseguenze**

- Rallenta leggermente l’avvio di nuove feature, ma riduce rework e discussioni infinite.
- I moduli v1.0 vanno retro-documentati quando possibile.
- Nessuna feature non documentata entra in produzione.

**Riesame**  
Se il team diventa molto piccolo e la documentazione smette di essere consultata.

---

### DD-003 — Due branch: main stabile, develop per il lavoro

**Data:** agosto 2026  
**Stato:** Sostituita da [DD-019](#dd-019--il-branch-dei-commit-lo-decide-lutente) (settembre 2026)

**Contesto**  
Serve separare ciò che i giocatori usano ogni giorno da ciò che è ancora in prova.

**Decisione**

- `main` → produzione, sempre funzionante, deploy automatico.
- `develop` → sviluppo e preview, merge su `main` solo dopo test.

**Alternative scartate**

- Sviluppare direttamente su `main` → rischio di rotture in produzione.
- Branch per ogni feature → eccessivo per la dimensione attuale del team.

**Conseguenze**

- Gli utenti in produzione non vedono lavori incompleti.
- Ogni release su `main` deve includere verifica delle funzionalità esistenti.

**Riesame**  
Sostituita: nella pratica il lavoro è finito direttamente su `main` e `develop` è rimasto
indietro. Vedi DD-019.

---

### DD-004 — Ogni versione aggiunge, non riscrive

**Data:** agosto 2026  
**Stato:** Accettata

**Contesto**  
CrAPP v1.0 è già usata dalla squadra per presenze, calendario, scout, badge e notifiche. Rischiare regressioni su moduli funzionanti vanifica la fiducia degli utenti.

**Decisione**  
Le nuove versioni **introducono** funzionalità. Non si riscrive un modulo già operativo salvo richiesta esplicita e pianificata.

**Alternative scartate**

- Refactoring ampio “per pulire” insieme a ogni release → alto rischio, poco valore immediato per gli utenti.

**Conseguenze**

- Coesistono temporaneamente soluzioni vecchie e nuove (es. dati hardcoded accanto a tabelle database).
- Il debito tecnico va gestito con migration dedicate, non di nascosto.

**Riesame**  
Quando un modulo diventa ingestibile o blocca una release importante.

---

### DD-005 — Mobile-first, pochi click, pochi schermi

**Data:** origine progetto  
**Stato:** Accettata

**Contesto**  
I giocatori usano l’app soprattutto da smartphone, spesso in spogliatoio o in palestra, con poco tempo e poca pazienza.

**Decisione**  
Interfaccia semplice, veloce, ottimizzata per telefono. Navigazione ridotta (barra inferiore). Ogni schermata deve avere uno scopo chiaro.

**Alternative scartate**

- Layout da desktop con menu complessi → scomodo in mobilità.
- App nativa iOS/Android → costi e tempi di pubblicazione non giustificati per una squadra amatoriale.

**Conseguenze**

- Funzionalità amministrative complesse vanno semplificate o suddivise con cura.
- La PWA è la forma giusta per questo pubblico.

**Riesame**  
Se emergono esigenze desktop forti (es. gestione documenti massiva solo da PC).

---

### DD-006 — Intelligenza artificiale solo se porta beneficio reale

**Data:** origine progetto  
**Stato:** Accettata

**Contesto**  
L’AI è attraente ma può complicare l’app, aumentare i costi e creare aspettative irrealistiche.

**Decisione**  
Usare l’AI solo quando riduce lavoro agli admin o migliora concretamente l’esperienza dei giocatori. Non introdurla “perché si può”.

**Alternative scartate**

- AI ovunque (chatbot, suggerimenti automatici, analisi predittive) → fuori focus per una squadra amatoriale.

**Conseguenze**

- “AI Allenamenti” è in roadmap v1.2, non v1.1.
- Ogni proposta AI va valutata con la domanda: _chi risparmia tempo e quanto?_

**Riesame**  
Quando l’AI diventa economica e affidabile per casi d’uso chiari (es. generazione allenamenti).

---

### DD-007 — Badge calcolati dall’app, non salvati nel database

**Data:** origine progetto  
**Stato:** Accettata

**Contesto**  
I badge dipendono da statistiche già disponibili (presenze, MVP, cacche, ecc.). Salvare ogni badge sbloccato nel database aggiungerebbe complessità senza beneficio immediato.

**Decisione**  
I badge vengono **calcolati al volo** dall’applicazione in base ai dati esistenti. Non esiste una tabella badge dedicata.

**Alternative scartate**

- Tabella `badge_sbloccati` con storico → utile in futuro per notifiche retroattive o audit, ma non necessaria ora.

**Conseguenze**

- Meno migration e meno sincronizzazione.
- Lo “sblocco” celebrativo usa cache locale per non ripetere animazioni.
- Un eventuale storico badge richiederà una nuova decisione.

**Riesame**  
Se servono badge manuali assegnati dagli admin o storico immutabile.

---

### DD-008 — Gamification equa tra ruoli

**Data:** origine progetto  
**Stato:** Accettata

**Contesto**  
In pallavolo i ruoli hanno statistiche diverse (un libero non segna punti d’attacco). Confrontare tutti sugli stessi numeri sarebbe ingiusto e scoraggiante.

**Decisione**  
Le statistiche **personali** in profilo e squadra devono essere **eque per tutti i ruoli**. Dati tecnici di reparto (punti, ace, muri) restano nello Scout Live come informazione di squadra, non come leva competitiva individuale.

**Alternative scartate**

- Classifiche individuali basate su punti → penalizza libero, palleggiatore, centrale.

**Conseguenze**

- Badge e obiettivi usano presenze, MVP, pagelle, serie, cacche — metriche accessibili a tutti.
- Lo scout resta strumento tecnico, non gioco.

**Riesame**  
Se la squadra chiede esplicitamente classifiche tecniche per ruolo.

---

### DD-009 — Tesseramento CSI manuale in v1.1, integrazione API in v2.0

**Data:** agosto 2026  
**Stato:** Accettata

**Contesto**  
La v1.1 deve aiutare gli admin a raccogliere documenti e dati per il tesseramento CSI. Un collegamento automatico al sistema CSI è complesso e non urgente.

**Decisione**

- **v1.1:** profilo completo, dashboard admin, download documenti, export CSV con i campi richiesti dal CSI.
- **v2.0:** eventuale collegamento automatico a CSI (calendario, risultati, classifica ufficiale).

**Alternative scartate**

- Integrazione CSI già in v1.1 → scope troppo ampio, dipendenza da API esterne non controllate.

**Conseguenze**

- Gli admin guadagnano subito tempo (niente più Excel e chat per i documenti).
- L’export CSV deve essere affidabile e completo: è il deliverable chiave della v1.1.

**Riesame**  
Quando il CSI mette a disposizione API stabili o quando il volume di tesseramenti giustifica l’automazione.

---

### DD-010 — Profilo giocatore: niente storico certificati in v1

**Data:** agosto 2026  
**Stato:** Accettata

**Contesto**  
Il certificato medico va aggiornato ogni stagione. Tenere lo storico di tutte le versioni complica upload, storage e privacy.

**Decisione**  
In v1 il giocatore può **sovrascrivere** certificato e data di scadenza. Lo storico delle versioni precedenti non viene conservato.

**Alternative scartate**

- Archivio certificati → utile per audit, rinviato a versioni future.

**Conseguenze**

- Implementazione più semplice e veloce.
- Gli admin vedono solo il certificato attuale.
- Va comunicato chiaramente ai giocatori che sostituire il file elimina quello precedente.

**Riesame**  
Se il CSI o il regolamento interno richiedono conservazione storica.

---

### DD-011 — Autenticazione reale prima del profilo amministrativo completo

**Data:** agosto 2026  
**Stato:** Accettata

**Contesto**  
Oggi l’app identifica l’utente con la selezione del giocatore da una lista, senza login. Documenti, certificati e dati personali richiedono sapere _chi_ sta operando e impedire accessi non autorizzati.

**Decisione**  
Prima di completare il modulo Profilo Giocatore (v1.1), introdurre **login con Google o email** tramite Supabase Auth — non tramite Lovable Auth. Dopo il login, il giocatore associa il proprio profilo squadra.

**Alternative scartate**

- Continuare solo con selezione da lista → inaccettabile per dati sensibili.
- Lovable Auth → crea dipendenza da piattaforma che stiamo abbandonando.

**Conseguenze**

- Tutti dovranno fare login almeno una volta.
- Gli admin useranno ruoli veri (`user_roles`), non una lista di nomi hardcoded.
- È prerequisito per dashboard admin e export CSI.

**Riesame**  
Dopo il rollout auth, se emergono problemi di adozione (giocatori poco digitali).

---

### DD-012 — Non migrare gli ID giocatore in v1.1

**Data:** agosto 2026  
**Stato:** Accettata

**Contesto**  
L’app usa identificativi semplici (`g1`, `g2`, …) collegati a presenze, voti, palloni e altre funzioni già in uso. Nel database esiste anche una tabella `giocatori` con UUID, non collegata al codice attuale.

**Decisione**  
Per la v1.1 **non** unificare gli ID. I nuovi dati del profilo si agganciano agli identificativi già in uso. La migrazione verso UUID resta un lavoro separato, pianificato e testato.

**Alternative scartate**

- Migrare tutto a UUID in v1.1 → rischio alto di rompere presenze, voti, scout e notifiche.

**Conseguenze**

- Coesistono due modelli anagrafici fino a migration dedicata.
- `DATABASE.md` va tenuto aggiornato su cosa è “attivo” e cosa è “futuro”.

**Riesame**  
Quando la v1.1 è stabile e c’è tempo per una migration con checklist regressioni completa.

---

### DD-013 — Portabilità: l’app non deve dipendere da servizi esclusivi

**Data:** luglio 2026  
**Stato:** Accettata

**Contesto**  
La squadra potrebbe voler cambiare hosting, database o fornitore auth in futuro.

**Decisione**  
CrAPP deve poter girare su **Node.js + PostgreSQL standard**. Niente funzionalità bloccate su servizi proprietari. I dati si accedono solo tramite moduli in `src/lib/`, non direttamente dai componenti.

**Alternative scartate**

- Accettare lock-in per velocità → contrario alla lunga vita del progetto.

**Conseguenze**

- Supabase va bene perché è PostgreSQL e self-hostable.
- Le API push e i job restano endpoint HTTP richiamabili da qualsiasi scheduler.

**Riesame**  
Se si adotta un servizio che viola questa regola.

---

### DD-016 — Schema dati Profilo Giocatore v1.1 (F0)

**Data:** agosto 2026  
**Stato:** Accettata

**Contesto**  
La progettazione F0 del modulo Profilo Giocatore ha definito come persistere dati personali, documenti e certificati, in coesistenza con l’anagrafica attuale (`g1`…`g17` nel codice) e con la tabella `giocatori` UUID già presente ma non usata. Serviva una scelta chiara su dove salvare i dati, come collegare l’autenticazione e come proteggere documenti sensibili — senza toccare le tabelle v1.0 già operative.

**Decisione**  
Per la v1.1 si introducono **due nuove tabelle additive**:

- **`giocatori_squadra`** — anagrafica squadra con ID testuali (`g1`…`g17`), dati gestiti dagli admin (nome, cognome, numero, ruolo) e collegamento account (`auth_user_id`).
- **`profili_giocatore`** — dati personali, metadati documento identità, certificato medico e path dei file, in relazione 1:1 con `giocatori_squadra`.

Regole vincolanti:

1. **`giocatori_squadra` diventa progressivamente la source of truth** per l’anagrafica squadra. Durante la transizione, `crapp-data.ts` resta come **fallback** se il database non è disponibile o i dati non sono ancora migrati.
2. L’associazione **`auth_user_id` ↔ giocatore** è un’operazione **controllata e atomica** (es. al primo accesso da `/benvenuto`, con `UPDATE … WHERE auth_user_id IS NULL`). Il giocatore **non può modificare liberamente** `auth_user_id`; solo un admin può resettarlo in casi eccezionali.
3. I file (documento identità, certificato, foto tessera) vivono nel bucket Storage **`profili-giocatore`**, configurato come **privato**.
4. Documenti personali e sanitari **non devono mai essere esposti tramite URL pubblici**. Accesso solo tramite client autenticato con policy RLS, o signed URL a scadenza breve per download admin.
5. Le **tabelle v1.0 esistenti non vengono modificate** (`eventi_app`, `risposte_presenze`, voti, palloni, scout, push, ecc.). Il profilo si aggancia agli ID `g1`…`g17` già in uso, senza migrare verso UUID in v1.1 (coerente con DD-012).
6. La tabella `giocatori` (UUID) resta **invariata e non usata** dal modulo profilo in v1.1.

**Alternative scartate**

- Estendere la tabella `giocatori` UUID → conflitto con ID operativi del codice e rischio di regressioni.
- Salvare file come base64 nel database → ingestibile, difficile da gestire e da scaricare.
- Bucket pubblico con URL permanenti → inaccettabile per dati sanitari e documenti d’identità.
- Permettere al giocatore di cambiare `auth_user_id` liberamente → rischio di impersonazione e race condition.
- Modificare tabelle v1.0 per aggiungere FK verso il profilo → viola DD-004 e DD-012.

**Conseguenze**

- Coesistono temporaneamente tre rappresentazioni dell’anagrafica: `crapp-data.ts` (fallback), `giocatori_squadra` (target), `giocatori` UUID (dormiente).
- `src/lib/rosa.ts` legge dal database e ricade su `crapp-data.ts` in caso di errore o assenza dati (DD-015).
- Il completamento profilo (30/30/30/10) si calcola in app, non si persiste nel database.
- Lo storico certificati non viene conservato in v1 (coerente con DD-010).
- Le migration M1–M2 (tabelle, RLS, bucket) restano **additive**: solo `CREATE`, nessun `ALTER`/`DROP` su schema esistente.
- Raffina e attua quanto proposto in DD-015 per la rosa anagrafica, senza sostituire formalmente quella voce.

**Riesame**

- Quando `giocatori_squadra` è stabile in produzione e il fallback `crapp-data.ts` non serve più.
- Quando si pianifica la convergenza verso UUID (DD-012, post v1.1).
- Se il CSI o il regolamento richiedono conservazione storica documenti o consensi privacy dedicati.

---

### DD-017 — L'amministratore può compilare i dati al posto del giocatore

**Data:** agosto 2026  
**Stato:** Accettata

**Contesto**  
Il modulo Profilo Giocatore era costruito su un confine netto: ognuno scrive solo la propria riga, l'amministratore legge e scarica. Nella pratica quel confine blocca il lavoro che il modulo doveva togliere: se metà squadra non compila i propri dati, l'export per il tesseramento CSI resta incompleto e l'admin torna a chiedere le informazioni in chat — esattamente ciò che CrAPP deve eliminare. Inoltre le docs assegnavano già agli admin la gestione dei dati squadra (nome, cognome, numero, ruolo) e il reset del collegamento all'account (DD-016 regola 2), senza che esistesse una schermata per farlo.

**Decisione**  
Dalla dashboard amministratore, un admin può:

1. modificare i **dati squadra** di qualsiasi giocatore (nome, cognome, numero, ruolo);
2. compilare e correggere i **dati personali e del documento** di qualsiasi giocatore;
3. **scollegare** un account da un profilo, liberando lo slot.

Restano fuori, e non cambiano:

- i **file** (documento, certificato, foto): l'admin li scarica ma non li carica né li sostituisce. Un documento d'identità lo produce il suo titolare, e la catena di responsabilità deve restare leggibile;
- il **giocatore**, che continua a non poter toccare i propri dati squadra.

**Alternative scartate**

- Lasciare tutto al giocatore → l'export CSI resta incompleto e il lavoro amministrativo torna in chat, contro la missione del progetto.
- Dare all'admin anche l'upload dei file → confonde chi ha fornito un documento, su dati sanitari e d'identità dove serve il contrario.
- Un ruolo intermedio (segreteria) per i soli dati personali → un ruolo in più per una squadra sola, con gli stessi tre amministratori di adesso.

**Conseguenze**

- Il modello dei permessi non è più "ognuno i suoi": è "ognuno i suoi, più l'admin su tutti, tranne i file". Le policy RLS di M1 e M2 lo consentivano già, quindi non servono migration.
- Un admin può correggere un errore di battitura in un numero di documento senza inseguire il giocatore.
- Un admin vede e scrive dati personali altrui: è un potere reale, dato a tre persone su diciassette. Va assegnato con la stessa cura di prima (una riga in `user_roles`, nessuna auto-promozione).
- Il completamento del profilo smette di essere un indicatore di _chi ha risposto_ e diventa un indicatore di _quali dati mancano_, chiunque li abbia inseriti.

**Riesame**

- Se la squadra cresce al punto da rendere sensato un ruolo di sola segreteria.
- Se serve tracciare _chi_ ha modificato un dato: oggi non c'è audit, e con la scrittura condivisa la domanda prima o poi arriva.

---

### DD-018 — Collegamento automatico giocatore↔account per email

**Data:** settembre 2026  
**Stato:** Accettata

**Contesto**  
DD-016 regola 2 prevedeva che, al primo accesso, il giocatore scegliesse manualmente il proprio slot libero da un elenco (`/benvenuto`). In pratica ogni giocatore ha un'email nota (o presto nota), quindi far scegliere un nome da una lista è un passaggio superfluo e un rischio: un giocatore può selezionare per errore lo slot di un compagno, e nulla nel flusso lo impedisce a livello di prodotto.

**Decisione**  
Al primo accesso, `giocatori_squadra` viene interrogata per email (case-insensitive, tramite la nuova colonna `email`) invece di mostrare un elenco di slot liberi. Se l'email dell'account Google corrisponde a una riga libera, il collegamento avviene automaticamente. Se non corrisponde a nessuna riga (email non ancora nota, o nessun profilo per quella persona), l'utente vede solo un messaggio d'errore che invita a contattare un amministratore, con un pulsante per uscire e riprovare con un altro account — nessuna selezione manuale di ripiego. Le email sono popolate via migration (`m5_email_giocatori_squadra`) per la rosa iniziale; un'interfaccia in `/admin` per impostarle su nuovi giocatori è arrivata poco dopo (vedi "Alternative scartate"). Il trigger `enforce_giocatori_squadra_update` (DD-016) viene esteso per richiedere anche la corrispondenza email, non solo lo slot libero: il vincolo resta nel database, non solo nella UI.

**Alternative scartate**

- Mantenere la selezione manuale come ripiego quando l'email non trova corrispondenza → scartata: vanificherebbe la garanzia "ognuno collega solo il proprio profilo" e reintrodurrebbe il rischio di scelta errata che questa decisione vuole eliminare.
- Un'interfaccia admin per scrivere l'email dei giocatori → rimandata al momento della decisione, poi implementata nel form "Aggiungi giocatore" di `/admin` (`src/routes/admin.tsx`): serviva per collegare i giocatori aggiunti a metà stagione senza passare da una nuova migration ogni volta.

**Conseguenze**

- Le righe senza email nota restano bloccate — nessuno può collegarle, nemmeno per errore — finché un admin non la imposta da `/admin` (o, per la rosa iniziale, una migration). Da settembre 2026 tutta la rosa attiva ha l'email registrata.
- `slotLiberi` (funzione ed elenco "slot liberi" in `/benvenuto`) è stato rimosso: non aveva più chiamanti in produzione dopo il cambio.
- Un utente che accede con l'account Google sbagliato resta bloccato su `/benvenuto` finché non esce e riprova con l'account giusto.

**Riesame**

- Se in futuro serve un'assistenza admin diretta dal flusso di login invece che da `/admin`.

---

## Decisioni in valutazione

---

### DD-014 — Convergenza schema database (eventi e presenze)

**Data:** —  
**Stato:** In valutazione

**Contesto**  
Esistono due modelli paralleli: tabelle “legacy” usate dall’app (`eventi_app`, `risposte_presenze`) e tabelle “nuove” con autenticazione e vincoli (`eventi`, `presenze`, `giocatori` UUID).

**Decisione proposta**  
Unificare gradualmente sul modello autenticato, dopo auth e profilo stabili.

**Perché non ora**  
Rischio regressioni su calendario e presenze, moduli più usati della squadra.

**Riesame previsto**  
Post v1.1, con migration e test dedicati.

---

### DD-015 — Rosa anagrafica: da codice hardcoded a database

**Data:** 3 settembre 2026  
**Stato:** Accettata

**Contesto**  
La lista giocatori viveva nel codice sorgente (`src/lib/crapp-data.ts`). Il database aveva già
`giocatori_squadra` (migration M1) popolata ma non letta da nessuna schermata tranne
`/benvenuto` e `/admin`: «Aggiungi giocatore» e «Disattiva giocatore» della dashboard non
avevano effetto su Squadra, Presenze, Pagelle, Badge e Scout, mantenendo gli stessi ID finché
non si farà DD-012.

**Decisione**  
`useRosa()` (e con lei `useIo`, `useObiettivi`) legge ora `giocatori_squadra` tramite
`useGiocatoriSquadra()`, filtrando solo i giocatori `attivo`. Tutti i punti che prima
importavano la lista statica (`convocatiEvento`, `compleanniEventi`, `completaTurni`,
`csvScoutMatch`, i widget di voto/scout/palloni, le due route API che mandano push) sono stati
agganciati allo stesso hook o, lato server, a `leggiGiocatoriSquadra()`
(`src/lib/giocatori-squadra.server.ts`, stesso pattern di `eventi.server.ts`).

**Conseguenze**

- Un giocatore aggiunto o disattivato dalla dashboard admin ora si riflette ovunque, non solo
  in `/benvenuto` e `/admin`.
- `giocatori_squadra` non ha ancora una colonna per la data di nascita: per i 17 giocatori
  storici resta quella di `crapp-data.ts` (`nascitaPerId`, lookup per id); un giocatore
  aggiunto dopo la migrazione non ha nascita nota finché la colonna non esiste. Follow-up da
  aprire quando serve davvero.
- `src/lib/crapp-data.ts` resta come seed storico e fallback (`rosaFallback()`), non più come
  fonte viva.

---

### DD-019 — Il branch dei commit lo decide l'utente

**Data:** 4 settembre 2026  
**Stato:** Accettata — sostituisce [DD-003](#dd-003--due-branch-main-stabile-develop-per-il-lavoro)

**Contesto**  
DD-003 prevedeva di lavorare su `develop` e portare su `main` solo dopo i test. Nella pratica
è successo il contrario: `main` è arrivato a 43 commit di vantaggio su `develop`, che è rimasto
fermo. Una regola che nessuno segue è peggio di nessuna regola, perché rende inaffidabile tutto
il resto del documento — e con più assistenti AI in gioco il rischio vero non era il branch
sbagliato, ma un agente che committa o pusha per conto suo.

**Decisione**  
È l'utente a dire su quale branch va un commit. L'assistente può **consigliare** un branch
dedicato quando la modifica è rischiosa o parallela ad altro lavoro, ma non cambia branch, non
committa, non fa push e non apre PR di propria iniziativa. In assenza di indicazioni si lavora
dove si trova il repository, di fatto `main`.

**Alternative scartate**

- Tenere DD-003 e riallineare `develop` → si sarebbe rotta di nuovo alla prima fretta.
- Dismettere `develop` → si perderebbero le preview Vercel, utili quando servono davvero.

**Conseguenze**

- `main` è insieme produzione e branch di lavoro: ogni commit deve lasciare l'app funzionante,
  quindi la rete di sicurezza sono i test (vedi DD-020), non il branch.
- `develop` esiste ancora ma è indietro: la sua preview Vercel non rappresenta lo stato attuale
  finché non viene riallineata.

**Riesame**  
Se il team cresce oltre una persona che scrive codice, o se un lavoro lungo ha bisogno di stare
fuori produzione per più di qualche giorno.

---

### DD-020 — Una funzione modificata senza test non è finita

**Data:** 4 settembre 2026  
**Stato:** Accettata

**Contesto**  
Con `main` come branch di lavoro (DD-019) non c'è più un ambiente di prova tra il codice e i
giocatori. La suite in `test/` esisteva già ma scriverla era di fatto facoltativo, e i difetti
trovati dai test sono arrivati a posteriori (la sessione Scout Live che non scadeva mai, le
serie di presenze ferme a zero per settimane).

**Decisione**  
Chi aggiunge o modifica una funzione scrive o aggiorna il test nello stesso lavoro, e i test
devono essere verdi prima di consegnare. Non si commenta un test che fallisce né si indebolisce
un'asserzione per farla passare: se il comportamento voluto è cambiato, si aggiorna il test
dicendo perché.

**Alternative scartate**

- Test solo sui moduli critici → il confine «critico» si sposta a ogni fretta.
- Introdurre un framework di test → la suite bun con `node:assert` funziona e non aggiunge
  dipendenze (vedi [test/README.md](../test/README.md)).

**Conseguenze**

- La logica di dominio va tenuta separabile dagli hook (`*-core.ts`), altrimenti non è
  testabile in `test/unit/` senza rete.
- Le modifiche costano un po' di più; le regressioni in produzione costano di più.

**Riesame**  
Se comparisse un ambiente di staging stabile che rende superflua parte della copertura.

---

### DD-021 — Molle interrompibili al posto delle animazioni a durata fissa

**Data:** 5 settembre 2026  
**Stato:** Accettata

**Contesto**  
Il movimento era fatto con `@keyframes` CSS e transizioni a durata fissa. Funzionava, ma
nessuna di quelle animazioni può essere interrotta: se l'utente tocca o scorre a metà, la
sequenza va avanti per conto suo, e per ripartire deve prima finire. Mancava del tutto
qualsiasi gesto: il calendario si cambiava solo con due frecce.

Contemporaneamente 43 componenti su 45 in `src/components/ui/` non erano importati da nessuna
parte, e con loro ~45 dipendenze (tutti i `@radix-ui/*`, `recharts`, `react-hook-form`,
`date-fns`, `embla`, `cmdk`, …): superficie di aggiornamento e di sicurezza pagata a vuoto.

**Decisione**  
Aggiungere **una** libreria di animazione — `motion` — e toglierne ~45 inutilizzate. I
parametri stanno in `src/lib/molla.ts` e sono i due di Apple (_Designing Fluid Interfaces_):
rimbalzo e durata, non massa/rigidità/smorzamento. `molla.ui` (nessun sorpasso) è il default;
`molla.slancio` si usa **solo** dopo un gesto che portava già inerzia.

**Alternative scartate**

- Tenere solo CSS con easing `linear()` e View Transitions → copre le comparse, non i gesti:
  niente handoff di velocità, niente ripartenza dal valore corrente.
- GSAP → più grande e orientato alla timeline, cioè al modello prescritto che stiamo lasciando.

**Conseguenze**

- Le animazioni partono dal valore _a schermo_: un dato che cambia a metà transizione non
  produce salti.
- Il movimento è ora codice JavaScript: senza JS non c'è comparsa (l'app già non funziona
  senza, per auth e dati).
- `src/lib/motion.ts` resta solo per il movimento ridotto e i coriandoli.
- `src/components/ui/` non è più una libreria: aggiungere una primitiva shadcn significa
  installarla, non pescarla da lì.

**Riesame**  
Se il peso del bundle client diventasse un problema misurato, o se il web recuperasse
nativamente l'interrompibilità (`ScrollTimeline` e `linear()` sono un primo passo).

---

### DD-022 — L'app è solo chiara

**Data:** 5 settembre 2026  
**Stato:** Accettata

**Contesto**  
`styles.css` conteneva un blocco `.dark` completo che non veniva mai applicato: nessun
interruttore, nessun `prefers-color-scheme`. Peggio, era incoerente. In `.dark` l'accento
diventava grigio-blu — il rosso del brand spariva — e mancavano del tutto `--success`,
`--warning`, `--info`, `--training`, i metalli dei badge, i due gradienti e le due ombre. Un
terzo stato: presente, sbagliato, morto.

**Decisione**  
CrAPP è un'app solo chiara. Il blocco `.dark` è rimosso e `:root` dichiara
`color-scheme: light`, così anche i controlli nativi restano coerenti.

**Alternative scartate**

- Completare il tema scuro → è lavoro vero (gradienti, ombre, i due colori dei metalli, le
  superfici traslucide) per una richiesta che nessuno ha fatto.
- Lasciare il blocco lì «per dopo» → un tema mai attivato non si accorge di rompersi.

**Conseguenze**

- Chi riaprirà il tema scuro parte da zero, ma da zero onesto: la palette chiara ha ora
  contrasti verificati e i token con suffisso `-testo` per i colori che come testo non
  reggono.
- La barra di stato (`theme-color`) e lo splash del manifest sono allineati al fondo chiaro.

**Riesame**  
Se arriva una richiesta reale dalla squadra, o se si gioca in palestre al buio abbastanza
spesso da rendere il tema scuro una funzione e non un vezzo.

### DD-023 — Ogni scrittura è limitata a chi la fa

**Data:** 6 settembre 2026  
**Stato:** Accettata

**Contesto**  
Le tabelle della v1.0 sono nate con policy `USING (true)` per `anon, authenticated`. M4
(DD-011) ha tolto il GRANT ad `anon`, e la cosa è stata letta come «ora è chiuso». Non lo
era: per gli autenticati non c'era rimasto nessun limite. Verificato sul database locale con
un utente appena creato, senza ruolo e senza slot nella rosa: `POST /rest/v1/eventi_app` →
201, `DELETE` → 200. Qualsiasi giocatore loggato poteva svuotare il calendario della squadra
o riscrivere il voto pagella di un altro, parlando direttamente con PostgREST — senza
passare dall'interfaccia, che quei pulsanti glieli nasconde.

Il permesso viveva quindi solo nei componenti (`useIsAdmin()`, `io.id`), cioè nel posto che
un attaccante non usa.

**Decisione**  
Le policy rispecchiano quello che l'interfaccia già fa. Tre gruppi:

- **solo admin**: `eventi_app`. Nell'app li scrive unicamente la rotta `/eventi`, che è già
  riservata agli amministratori.
- **solo la propria riga**: `risposte_presenze`, `cacche_partita` (per `giocatore_id`),
  `pagelle_voti`, `mvp_voti`, `badge_social_voti` (per `votante_id`). L'admin resta incluso,
  perché DD-017 gli riconosce già il diritto di agire al posto del giocatore.
- **invariate**: `turni_palloni` e le tre tabelle scout. Nell'interfaccia non hanno nessun
  gate — il turno palloni se lo passa chiunque, e chiunque può aprire lo Scout Live —
  quindi stringerle sarebbe una funzionalità nuova, non una messa in sicurezza.

L'identità è lo slot di `giocatori_squadra` collegato all'account, espresso con lo stesso
`EXISTS` che usano le policy dei profili — la funzione `mio_giocatore_id()` di M2 è stata
rimossa dalla migration di correzione e non si reintroduce. Regge perché `io.id` non è una
scelta libera: dopo DD-011 e DD-018 il `localStorage` viene forzato sullo slot collegato
all'account (`benvenuto.tsx`), e senza slot non si entra.

**Alternative scartate**

- Lasciare tutto aperto e documentarlo → si può difendere per una squadra di venti persone
  che si conoscono, ma non regge il primo account che passa di mano o il primo telefono
  perso, e rende ogni bug indistinguibile da un dispetto.
- Controllare i permessi nelle route server → CrAPP scrive dal client con supabase-js. Ci
  vorrebbe un livello API che oggi non esiste, per ottenere quello che la RLS fa da sola.
- Stringere anche palloni e scout → cambierebbe come funziona la squadra, e nessuno l'ha
  chiesto.

**Conseguenze**

- Un giocatore che non ha ancora collegato lo slot non scrive più niente: l'`EXISTS` non
  trova nessuna riga. È lo stesso muro di `/benvenuto`, ora applicato anche al database.
- La lettura resta aperta a tutti gli autenticati, pagelle comprese: chi interroga PostgREST
  può ancora vedere **chi** ha votato cosa. L'anonimato delle pagelle è una scelta di
  interfaccia, non una garanzia del database, e questa migration non lo cambia.
- I test in `test/integration/permessi.test.ts` diventano la definizione eseguibile di questa
  tabella dei permessi.

**Riesame**  
Se l'anonimato delle pagelle deve diventare reale (servirebbe una vista aggregata e la
chiusura della lettura riga per riga), o se turni e scout acquistano un gate
nell'interfaccia: allora le loro policy devono seguirlo.

### DD-024 — Le route che avvisano la squadra chiedono le credenziali

**Data:** 6 settembre 2026  
**Stato:** Accettata

**Contesto**  
Le route in `src/routes/api/public/` girano con la service role e saltano la RLS: DD-023 non
le tocca. Nessuna di loro faceva un controllo di accesso — cercando `authorization` in quella
cartella l'unico header era lo User-Agent con cui `csi.ts` chiama il portale CSI. Chiunque
conoscesse l'URL poteva quindi far suonare i telefoni di tutta la squadra:
`promemoria-palloni` accetta perfino una POST con il corpo vuoto.

La difesa apparente delle altre due — «serve un id evento valido» — non è una difesa: l'id è
`e` + il timestamp in base 36 (`nuovoIdEvento()`), compare negli URL che la squadra si
scambia, ed è elencabile da qualsiasi utente loggato.

Il danno non è furto di dati: i testi delle notifiche li costruisce il server. È molestia e
consumo della quota push. Non è però una ragione per lasciare la porta aperta.

**Decisione**  
Le tre route che inviano notifiche chiedono le credenziali, con due controlli diversi perché
i chiamanti sono diversi (`src/lib/auth-route.server.ts`):

- `apri-sondaggio` e `sollecita-presenze` → `richiediAdmin`: token della sessione Supabase
  verificato con `auth.getUser`, poi ruolo `admin` letto da `user_roles`, la stessa fonte di
  `src/lib/ruoli.ts` (DD-011). `401` senza token valido, `403` con token ma senza ruolo. Il
  controllo viene **prima** della validazione dell'input, così la risposta non rivela
  nemmeno se un evento esiste.
- `promemoria-palloni` → all'inizio `richiediSegreto`, con un segreto da cron; sostituito
  subito dopo da `richiediAdmin` quando la route è diventata manuale (DD-025).

`csi`, `push-config` e `push-subscribe` restano aperte: le chiama il browser prima del login,
dove qualsiasi segreto sarebbe pubblico. (`push-messaggio` esisteva per lo stesso motivo ed è
sparita con DD-026.)

**Alternative scartate**

- Un segreto condiviso anche per le due route dell'app → finirebbe nel bundle JavaScript,
  cioè pubblico.
- Il middleware `requireSupabaseAuth` già presente nel repository → è
  `createMiddleware({ type: "function" })`, protegge le server function di TanStack Start. In
  CrAPP `createServerFn` non compare da nessuna parte: quel file non è mai stato eseguito,
  e non si applica comunque alle route in `src/routes/api/`.
- Fidarsi dell'id evento come credenziale → è un timestamp in un URL condiviso.

**Conseguenze**

- Nessuna variabile d'ambiente da configurare: dopo DD-025 tutte e tre le route usano lo
  stesso controllo sul ruolo.
- I due pulsanti dell'app mandano ora il token con `intestazioniAutenticate()`
  (`src/lib/auth.ts`), letto al momento della chiamata e non da uno stato React, così non si
  spedisce un token scaduto.
- `api.test.ts` non può più verificare la validazione dell'input di `sollecita-presenze`,
  che ora sta dietro all'accesso: quel pezzo si è spostato in
  `test/integration/permessi-route.test.ts`, che gira sullo stack locale perché ha bisogno
  di utenti veri.

**Riesame**  
Se un giorno l'app userà `createServerFn`, il middleware già presente diventa la strada
naturale e questi controlli vanno riletti alla sua luce.

### DD-025 — Il promemoria palloni lo manda l'admin, per un evento

**Data:** 6 settembre 2026  
**Stato:** Accettata

**Contesto**  
`promemoria-palloni` era disegnata per un cron quotidiano: calcolava chi è di turno **oggi** e
gli mandava una push. DD-024 l'aveva chiusa con un segreto condiviso, coerente con quel
disegno. Ma nel repository non c'è nessun cron, e `docs/modules/palloni.md` lo annotava già
come «da verificare lato hosting»: nei fatti quel promemoria non è mai partito. Una route che
funziona e che nessuno chiama.

Nel frattempo l'app aveva già il precedente giusto: `apri-sondaggio` è manuale fin dall'inizio
(«Nessun cron: l'invio è manuale», CHANGELOG v1.0.6).

**Decisione**  
Il promemoria lo fa partire un amministratore dal pulsante «Avvisa chi è di turno», dentro il
riquadro palloni della pagina evento. La route accetta un `eventoId` e avvisa i destinatari di
**quell'evento** — chi deve prendere i palloni e chi deve riportarli — invece della giornata
corrente. Il controllo di accesso diventa `richiediAdmin` come le altre due, e
`richiediSegreto` con la sua variabile `CRON_SEGRETO` spariscono.

Il testo dell'avviso viaggia dentro la push, cifrato nel payload (DD-026): il service worker
lo mostra così com'è, quindi un avviso mandato il martedì per il sabato arriva col testo
giusto.

**Alternative scartate**

- Un pulsante «manda il promemoria di oggi» in Dashboard → rispecchia la route com'era, ma
  premuto un martedì qualsiasi risponderebbe «inviate: 0» e sembrerebbe rotto. L'admin
  ragiona per evento, non per giornata.
- Tenere il cron e configurarlo davvero → più lavoro, una variabile d'ambiente da gestire in
  ogni ambiente, e nessuno l'aveva chiesto. Un pulsante che funziona batte uno scheduler che
  non esiste.
- Calcolare il testo al volo sulla giornata corrente → funziona solo se l'avviso parte il
  giorno stesso, cioè proprio il vincolo da cui volevamo uscire.

**Conseguenze**

- Il promemoria è ora una scelta consapevole di un admin, non un automatismo: se nessuno preme
  il pulsante, non parte niente. È un passo indietro rispetto all'idea originale, ma un passo
  avanti rispetto alla realtà, dove non partiva mai.
- `destinatariPromemoriaPalloni()` non è più usata dalla route ma resta in `palloni-core.ts`.
- Sparisce `CRON_SEGRETO`: nessuna variabile d'ambiente nuova da configurare in nessun
  ambiente.

**Riesame**  
Se la squadra si accorge che l'admin si dimentica di premere il pulsante. A quel punto il cron
torna utile, e con lui il segreto: DD-024 descrive già come farlo.

---

### DD-026 — Il testo della notifica viaggia dentro la push

**Stato:** accettata · **Data:** settembre 2026

**Contesto**  
Le push partivano senza payload: il service worker, appena svegliato, chiedeva a
`/api/public/push-messaggio` che cosa mostrare. Ad app aperta funzionava; ad app chiusa e
telefono bloccato non arrivava niente. È lo scenario per cui il browser dà al worker pochi
secondi di vita: una fetch verso un endpoint che interroga Supabase è esattamente ciò che non
riesce a chiudersi in tempo, e senza `showNotification` non compare nulla. `Urgency: high` e
un timeout di 3 secondi sul recupero del testo avevano attenuato il sintomo, non la causa.

**Decisione**  
Titolo e testo viaggiano cifrati nel corpo della push (`aes128gcm`, RFC 8188/8291) con le
chiavi `p256dh` e `auth` già salvate in `push_subscriptions`. Il service worker legge
`event.data.json()` e mostra la notifica: zero rete, zero attesa.

Cadono di conseguenza la route `push-messaggio`, la coda `promemoria_push` (con la sua
scadenza a 12 ore), `messaggioPalloniOggi()` e il timeout nel service worker: tutti pezzi che
esistevano solo per rimediare al payload vuoto. Tutti e tre i mittenti
(`apri-sondaggio`, `sollecita-presenze`, `promemoria-palloni`) avevano già il testo pronto
prima di inviare.

**Alternative scartate**

- Usare la libreria `web-push` → dipende da `node:crypto`, e il build nitro ha come target
  Cloudflare. La cifratura sta in ~40 righe di Web Crypto, già disponibile ovunque.
- Allungare ancora il timeout della fetch → allunga anche il tempo in cui il worker può
  morire prima di mostrare qualcosa. Il problema era la fetch, non la sua durata.

**Conseguenze**

- La notifica non dipende più dalla rete al momento del risveglio, e nemmeno da una funzione
  serverless che risponda in fretta a freddo.
- Sparisce l'unico punto in cui chiunque conoscesse un endpoint push poteva leggere il
  messaggio destinato a quel dispositivo.
- Il payload sta sotto i 4 KB: i testi attuali sono ampiamente dentro, ma un messaggio molto
  lungo andrebbe accorciato.
- La tabella `promemoria_push` resta nel database, ora inutilizzata: va rimossa con una
  migrazione quando si tocca lo schema.

**Riesame**  
Se servisse mandare payload più grandi del limite del protocollo, o se un servizio push
smettesse di accettare corpi cifrati (nessuno lo fa: è lo standard).
