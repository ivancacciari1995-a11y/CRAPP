# Registro delle decisioni di progetto

Questo documento raccoglie le **decisioni importanti** prese nel corso della vita di CrAPP: scelte che hanno influito sulla direzione del prodotto, sull’organizzazione del lavoro o su come l’app si evolve nel tempo.

Non descrive *come* è fatto il codice. Per quello esistono `ARCHITECTURE.md` e `DATABASE.md`.

Serve a rispondere a domande del tipo:

- *Perché abbiamo scelto così?*
- *Cosa avevamo escluso e perché?*
- *Quando conviene riaprire una decisione?*

---

## Indice

**Accettate**

| ID | Titolo |
|---|---|
| [DD-001](#dd-001--crapp-deve-restare-indipendente-da-lovable) | Indipendenza da Lovable |
| [DD-002](#dd-002--sviluppo-document-first) | Sviluppo document-first |
| [DD-003](#dd-003--due-branch-main-stabile-develop-per-il-lavoro) | Branch main / develop |
| [DD-004](#dd-004--ogni-versione-aggiunge-non-riscrive) | Ogni versione aggiunge, non riscrive |
| [DD-005](#dd-005--mobile-first-pochi-click-pochi-schermi) | Mobile-first |
| [DD-006](#dd-006--intelligenza-artificiale-solo-se-porta-beneficio-reale) | AI solo se utile |
| [DD-007](#dd-007--badge-calcolati-dallapp-non-salvati-nel-database) | Badge calcolati, non in DB |
| [DD-008](#dd-008--gamification-equa-tra-ruoli) | Gamification equa tra ruoli |
| [DD-009](#dd-009--tesseramento-csi-manuale-in-v11-integrazione-api-in-v20) | CSI manuale v1.1, API v2.0 |
| [DD-010](#dd-010--profilo-giocatore-niente-storico-certificati-in-v1) | Niente storico certificati v1 |
| [DD-011](#dd-011--autenticazione-reale-prima-del-profilo-amministrativo-completo) | Auth reale prima del profilo |
| [DD-012](#dd-012--non-migrare-gli-id-giocatore-in-v11) | Non migrare ID in v1.1 |
| [DD-013](#dd-013--portabilità-lapp-non-deve-dipendere-da-servizi-esclusivi) | Portabilità dello stack |
| [DD-016](#dd-016--schema-dati-profilo-giocatore-v11-f0) | Schema dati Profilo Giocatore v1.1 |

**In valutazione**

| ID | Titolo |
|---|---|
| [DD-014](#dd-014--convergenza-schema-database-eventi-e-presenze) | Convergenza schema DB |
| [DD-015](#dd-015--rosa-anagrafica-da-codice-hardcoded-a-database) | Rosa da hardcoded a DB |

---

## Come usare questo registro

Ogni decisione segue lo stesso schema:

| Campo | Significato |
|---|---|
| **Data** | Quando la decisione è stata presa o confermata |
| **Stato** | Accettata · In valutazione · Sostituita · Obsoleta |
| **Contesto** | Quale problema o opportunità avevamo di fronte |
| **Decisione** | Cosa abbiamo scelto di fare |
| **Alternative scartate** | Cosa non abbiamo fatto e perché |
| **Conseguenze** | Cosa comporta nel quotidiano (utenti, admin, sviluppo) |
| **Riesame** | Quando ha senso riconsiderarla |

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
**Stato:** Accettata

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
Se il team cresce e servono review più granulari (pull request per feature).

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
- Ogni proposta AI va valutata con la domanda: *chi risparmia tempo e quanto?*

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
Oggi l’app identifica l’utente con la selezione del giocatore da una lista, senza login. Documenti, certificati e dati personali richiedono sapere *chi* sta operando e impedire accessi non autorizzati.

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
- `src/lib/rosa.ts` dovrà leggere prima dal database e ricadere su `crapp-data.ts` in caso di errore o assenza dati.  
- Il completamento profilo (30/30/30/10) si calcola in app, non si persiste nel database.  
- Lo storico certificati non viene conservato in v1 (coerente con DD-010).  
- Le migration M1–M3 (tabelle, RLS, bucket) restano **additive**: solo `CREATE`, nessun `ALTER`/`DROP` su schema esistente.  
- Raffina e attua quanto proposto in DD-015 per la rosa anagrafica, senza sostituire formalmente quella voce.

**Riesame**  
- Quando `giocatori_squadra` è stabile in produzione e il fallback `crapp-data.ts` non serve più.  
- Quando si pianifica la convergenza verso UUID (DD-012, post v1.1).  
- Se il CSI o il regolamento richiedono conservazione storica documenti o consensi privacy dedicati.

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

**Data:** —  
**Stato:** In valutazione

**Contesto**  
La lista giocatori vive ancora nel codice sorgente. Il database ha già una tabella popolata ma non usata.

**Decisione proposta**  
Spostare l’anagrafica su database, mantenendo gli stessi ID finché non si fa DD-012.

**Perché non ora**  
Il profilo v1.1 può agganciarsi agli ID attuali; la migrazione rosa può essere fase 2.

**Riesame previsto**  
In parallelo o subito dopo il rollout auth.

---
