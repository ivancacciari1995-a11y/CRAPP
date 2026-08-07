# Database CrAPP

## Obiettivo

Questo documento descrive la struttura del database Supabase e il ruolo di ogni tabella.

---

# Utenti

## giocatori

Contiene l'anagrafica dei giocatori.

Utilizzato da:

- Squadra
- Profili
- Presenze
- Scout
- Badge
- Pagelle

---

## user_roles

Definisce i ruoli applicativi.

Esempi:

- amministratore
- giocatore

---

# Eventi

## eventi

Calendario generale.

Comprende:

- allenamenti
- partite
- eventi della squadra

---

## eventi_app

Eventi gestionali utilizzati dall'app.

---

# Presenze

## presenze

Gestisce le presenze agli eventi.

---

## risposte_presenze

Memorizza le risposte dei giocatori.

---

# Scout

## scout_sessioni

Sessioni di Scout Live.

Una sessione corrisponde ad una partita.

---

## scout_live

Eventi registrati durante lo Scout Live.

Serve esclusivamente per statistiche di squadra.

---

# Votazioni

## mvp_voti

Voti MVP assegnati a fine partita.

---

## pagelle_voti

Voti anonimi assegnati ai giocatori.

Utilizzati per il voto medio.

---

## badge_social_voti

Voti social per i badge.

---

# Badge

Attualmente i badge vengono calcolati dall'applicazione.

Non esiste una tabella dedicata.

---

# Turni

## turni_palloni

Gestione dei turni palloni.

---

# Notifiche

## push_subscriptions

Dispositivi registrati per le notifiche Push.

---

## promemoria_push

Storico dei promemoria inviati.

---

# Funzioni speciali

## cacche_partita

Sondaggio prepartita.

Utilizzato per statistiche e badge segreti.

---

# Moduli futuri

Da implementare

- Certificati medici
- Tesseramenti CSI
- Database allenamenti
- AI Allenamenti
- Integrazione CSI