# CrAPP - AI Development Guide

Questo documento definisce le regole che qualsiasi assistente AI (Cursor, Claude Code, Codex, ChatGPT o altri) deve seguire quando lavora su questo progetto.

---

# Obiettivo del progetto

CrAPP è una Progressive Web App sviluppata per digitalizzare completamente la gestione di una squadra di pallavolo.

L'obiettivo principale è:

- ridurre il lavoro amministrativo degli amministratori;

- aumentare il coinvolgimento dei giocatori;

- centralizzare tutte le informazioni della squadra;

- utilizzare l'intelligenza artificiale solo quando porta un reale beneficio.

---

# Prima di modificare il codice

Prima di implementare qualsiasi modifica leggere sempre:

1. docs/[README.md](http://README.md)

2. docs/[VISION.md](http://VISION.md)

3. docs/[ROADMAP.md](http://ROADMAP.md)

4. docs/[ARCHITECTURE.md](http://ARCHITECTURE.md)

5. docs/[DATABASE.md](http://DATABASE.md)

6. docs/DESIGN_[DECISIONS.md](http://DECISIONS.md)

7. docs/[TODO.md](http://TODO.md)

8. il documento interessato in docs/modules/

Inoltre, prima di iniziare una nuova attività:

- verificare lo stato attuale del repository;

- controllare le modifiche e i commit recenti;

- verificare eventuali modifiche introdotte da altri sviluppatori o assistenti AI;

- leggere la documentazione aggiornata relativa alla funzionalità interessata.

Non implementare funzionalità non documentate.

Non presumere che il progetto sia nello stesso stato dell'ultima sessione o conversazione.

---

# Workflow di sviluppo

Ogni nuova funzionalità segue sempre questo processo.

Idea

↓

Progettazione

↓

Documentazione

↓

Database

↓

Implementazione

↓

Test

↓

Pull Request

↓

Merge su develop

↓

Verifica

↓

Merge su main

↓

Deploy

Le funzionalità possono essere sviluppate in parallelo da persone diverse, ciascuna sul proprio branch.

---

# Git

Il repository utilizza due branch principali.

## main

Versione stabile.

Qualsiasi modifica deve mantenere l'app perfettamente funzionante.

`main` rappresenta la versione destinata alla produzione.

## develop

Branch di integrazione e test.

Le nuove funzionalità vengono integrate in `develop` prima di arrivare in `main`.

Non lavorare direttamente su `main`.

Evitare modifiche dirette a `develop`, salvo attività esplicitamente concordate.

---

# Branch di sviluppo

Ogni sviluppatore deve lavorare su un branch dedicato creato a partire da `develop`.

Esempi:

- `feature/profilo-giocatore`

- `feature/integrazione-csi`

- `fix/presenze`

- `refactor/supabase-client`

Non utilizzare lo stesso branch contemporaneamente per attività indipendenti.

Prima di iniziare un'attività verificare che il branch sia aggiornato rispetto a `develop`.

---

# Integrazione delle modifiche

Le modifiche significative devono essere integrate tramite Pull Request verso `develop`.

Una Pull Request dovrebbe permettere di capire:

- cosa è stato modificato;

- perché è stato modificato;

- quali file o moduli sono coinvolti;

- se il database è stato modificato;

- quali test sono stati eseguiti;

- eventuali rischi o conseguenze.

Prima del merge verificare eventuali conflitti con il lavoro sviluppato nel frattempo dagli altri collaboratori.

---

# Tracciabilità delle modifiche

Ogni modifica significativa deve lasciare una traccia nel progetto.

Devono essere utilizzati:

- commit con messaggi descrittivi;

- Pull Request per l'integrazione;

- [CHANGELOG.md](http://CHANGELOG.md) quando una modifica deve essere registrata nella cronologia del progetto;

- PROJECT_[STATE.md](http://STATE.md) quando cambia lo stato generale del progetto;

- DESIGN_[DECISIONS.md](http://DECISIONS.md) per decisioni architetturali significative.

La documentazione deve permettere a uno sviluppatore o a un assistente AI di ricostruire cosa è successo senza dipendere dalla cronologia delle conversazioni.

---

# Aggiornamento del contesto dopo la sincronizzazione

Quando vengono scaricate modifiche da GitHub, l'assistente AI deve considerare il repository come fonte di verità.

Prima di iniziare una nuova attività deve:

1. verificare i nuovi commit;

2. identificare le modifiche rilevanti;

3. leggere la documentazione modificata;

4. verificare eventuali modifiche al database;

5. tenere conto delle nuove decisioni architetturali.

Non ignorare modifiche introdotte da altri collaboratori.

Non sovrascrivere modifiche esistenti senza averne compreso lo scopo.

---

# Architettura

Frontend

- React

- TypeScript

- TanStack Start

- Tailwind CSS

Backend

- Supabase

Hosting

- Vercel

Repository

- GitHub

---

# Database

Il database utilizza Supabase.

Regole:

- non eliminare tabelle esistenti;

- non modificare lo schema senza creare una migration;

- preferire strutture scalabili;

- evitare duplicazione dei dati;

- non modificare migration già applicate;

- ogni modifica allo schema deve essere rappresentata da una nuova migration.

Fare sempre riferimento a:

docs/[DATABASE.md](http://DATABASE.md)

---

# Componenti

Preferire:

- componenti piccoli;

- componenti riutilizzabili;

- responsabilità singola;

- codice semplice da mantenere.

Evitare duplicazioni.

Prima di creare un nuovo componente verificare se esiste già un componente riutilizzabile.

---

# Interfaccia

Lo stile dell'app deve rimanere coerente.

Principi:

- semplice;

- moderna;

- pulita;

- veloce;

- ottimizzata per smartphone;

- poche schermate;

- pochi click.

---

# Documentazione

Ogni nuova funzionalità deve essere documentata prima dello sviluppo.

La documentazione dei moduli si trova in:

docs/modules/

Aggiornare sempre, quando necessario:

- [ROADMAP.md](http://ROADMAP.md)

- [CHANGELOG.md](http://CHANGELOG.md)

- [TODO.md](http://TODO.md)

- [DATABASE.md](http://DATABASE.md) (se il database cambia)

- DESIGN_[DECISIONS.md](http://DECISIONS.md) (se si prende una decisione architetturale importante)

- PROJECT_[STATE.md](http://STATE.md) (se cambia lo stato generale del progetto)

---

# Struttura della documentazione

La cartella `docs/` rappresenta la documentazione ufficiale del progetto.

## Documenti principali

- [README.md](http://README.md) → panoramica del progetto

- [VISION.md](http://VISION.md) → obiettivi e filosofia

- [ROADMAP.md](http://ROADMAP.md) → evoluzione prevista

- [ARCHITECTURE.md](http://ARCHITECTURE.md) → architettura tecnica

- [DATABASE.md](http://DATABASE.md) → struttura del database

- DESIGN_[DECISIONS.md](http://DECISIONS.md) → registro delle decisioni di progetto

- [CHANGELOG.md](http://CHANGELOG.md) → cronologia delle modifiche

- [TODO.md](http://TODO.md) → attività pianificate

- PROJECT_[STATE.md](http://STATE.md) → stato attuale del progetto

## Moduli

La cartella `docs/modules/` contiene una specifica funzionale per ogni modulo dell'applicazione.

Ogni nuovo modulo deve essere progettato e documentato prima dell'implementazione.

---

# Regola anti-regressione

Le nuove versioni devono principalmente aggiungere funzionalità.

Non riscrivere o modificare profondamente moduli già funzionanti senza una motivazione esplicita e una verifica degli impatti.

Evitare refactoring trasversali durante lo sviluppo di nuove funzionalità, salvo quando sono necessari per la funzionalità stessa.

Prima di modificare un modulo esistente verificare quali altre parti dell'app lo utilizzano.

---

# Regole per il database e le migration

Le migration già applicate sono parte della storia del database e non devono essere riscritte.

Per modificare il database:

1. progettare la modifica;

2. documentarla quando necessario;

3. creare una nuova migration;

4. testarla;

5. applicarla all'ambiente di sviluppo;

6. verificare l'assenza di regressioni;

7. solo successivamente applicarla all'ambiente di produzione.

---

# Regole

L'AI non deve:

- introdurre librerie senza necessità;

- modificare il database senza motivazione;

- eliminare funzionalità esistenti;

- modificare il comportamento dell'app senza richiesta esplicita;

- sovrascrivere modifiche di altri collaboratori senza comprenderle;

- riscrivere migration già applicate;

- lavorare direttamente su `main`;

- assumere che il repository sia invariato rispetto all'ultima sessione.

L'AI deve:

- spiegare le modifiche importanti;

- mantenere compatibilità con il codice esistente;

- privilegiare la semplicità;

- riutilizzare i componenti esistenti;

- controllare il lavoro recente degli altri collaboratori;

- mantenere aggiornata la documentazione quando necessario;

- segnalare conflitti, rischi e possibili regressioni prima di modificare parti sensibili.

---

# Filosofia del progetto

Prima di scrivere codice chiedersi sempre:

Questa modifica rende CrAPP più semplice?

Riduce il lavoro degli amministratori?

Migliora l'esperienza dei giocatori?

È coerente con la documentazione?

Riduce oppure aumenta la complessità futura?

Se almeno una risposta è negativa, rivalutare la soluzione proposta.

