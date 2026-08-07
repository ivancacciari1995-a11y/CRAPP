# AGENTS.md

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

1. docs/README.md
2. docs/VISION.md
3. docs/ROADMAP.md
4. docs/ARCHITECTURE.md
5. docs/DATABASE.md
6. docs/TODO.md
7. il documento interessato in docs/modules/

Non implementare funzionalità non documentate.

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

Merge su main

↓

Deploy automatico

---

# Git

Il repository utilizza due branch principali.

## main

Versione stabile.

Qualsiasi modifica deve mantenere l'app perfettamente funzionante.

## develop

Branch utilizzato per lo sviluppo delle nuove funzionalità.

Tutte le nuove implementazioni devono essere realizzate qui.

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
- evitare duplicazione dei dati.

Fare sempre riferimento a:

docs/DATABASE.md

---

# Componenti

Preferire:

- componenti piccoli;
- componenti riutilizzabili;
- responsabilità singola;
- codice semplice da mantenere.

Evitare duplicazioni.

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

- ROADMAP.md
- CHANGELOG.md
- TODO.md
- DATABASE.md (se il database cambia)
---

# Struttura della documentazione

La cartella `docs/` rappresenta la documentazione ufficiale del progetto.

## Documenti principali

- README.md → panoramica del progetto
- VISION.md → obiettivi e filosofia
- ROADMAP.md → evoluzione prevista
- ARCHITECTURE.md → architettura tecnica
- DATABASE.md → struttura del database
- CHANGELOG.md → cronologia delle modifiche
- TODO.md → attività pianificate

## Moduli

La cartella `docs/modules/` contiene una specifica funzionale per ogni modulo dell'applicazione.

Ogni nuovo modulo deve essere progettato e documentato prima dell'implementazione.
---

# Regole

L'AI non deve:

- introdurre librerie senza necessità;
- modificare il database senza motivazione;
- eliminare funzionalità esistenti;
- modificare il comportamento dell'app senza richiesta esplicita.

L'AI deve:

- spiegare le modifiche importanti;
- mantenere compatibilità con il codice esistente;
- privilegiare la semplicità;
- riutilizzare i componenti esistenti.

---

# Filosofia del progetto

Prima di scrivere codice chiedersi sempre:

Questa modifica rende CrAPP più semplice?

Riduce il lavoro degli amministratori?

Migliora l'esperienza dei giocatori?

È coerente con la documentazione?

Se almeno una risposta è negativa, rivalutare la soluzione proposta.