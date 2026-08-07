# Profilo Giocatore

## Obiettivo

Il modulo "Profilo Giocatore" raccoglie tutte le informazioni personali, amministrative e documentali di ciascun membro della squadra.

L'obiettivo è centralizzare in un'unica schermata tutti i dati necessari sia al giocatore sia agli amministratori, eliminando la gestione tramite chat, documenti cartacei e fogli Excel.

---

# Utenti

## Giocatore

Può:

- visualizzare il proprio profilo
- modificare i propri dati personali
- aggiornare il certificato medico
- aggiornare i documenti
- caricare le immagini richieste

---

## Amministratore

Può:

- visualizzare il profilo di tutti i giocatori
- scaricare documenti e certificati
- esportare i dati necessari al tesseramento CSI
- verificare lo stato di completamento dei profili

---

# Flusso utente

## Primo accesso

1. Login tramite Google oppure Email.
2. Selezione del proprio giocatore.
3. Accesso alla Home.

Se il profilo non è completo compare automaticamente un widget di completamento.

---

# Home

Il giocatore visualizza un widget dedicato.

## Completa il tuo profilo

Viene mostrata una barra di avanzamento.

Esempio

Profilo completato

85%

La barra è composta dalle seguenti sezioni.

- Dati personali
- Documento di identità
- Certificato medico
- Foto tessera

Quando tutte le sezioni sono complete il widget scompare automaticamente.

---

# Profilo

Il profilo viene suddiviso in cinque aree.

## Dati Giocatore

Contiene.

### Dati squadra

Solo lettura.

- Nome
- Cognome
- Numero di maglia
- Ruolo

Questi dati sono gestiti esclusivamente dagli amministratori.

---

### Dati personali

Modificabili dal giocatore.

- Data di nascita
- Luogo di nascita
- Indirizzo di residenza
- Telefono
- Email

---

## Documento di identità

Campi.

- Tipo documento
- Numero documento
- Rilasciato da
- Data emissione
- Data scadenza

Upload.

- Foto fronte
- Foto retro

---

## Certificato medico

Campi.

- Data di scadenza

Upload.

- Certificato medico

Il giocatore può aggiornare liberamente sia la data sia il file.

Lo storico non viene mantenuto nella prima versione.

---

## Foto tessera

Upload di una fotografia formato tessera.

Utilizzata dagli amministratori per il tesseramento CSI.

---

## Statistiche

Sezione già presente.

Contiene.

- Presenze
- Voto medio
- MVP
- Serie
- Altre statistiche disponibili

---

## Badge

Sezione già presente.

Contiene tutti i badge ottenuti e quelli ancora da sbloccare.

---

## Impostazioni

Contiene.

- Logout
- Preferenze notifiche
- Impostazioni applicazione

---

# Dashboard amministratore

Gli amministratori dispongono di una schermata dedicata.

Per ogni giocatore vengono mostrati.

- Stato del profilo
- Certificato medico
- Documento di identità
- Foto tessera

Azioni disponibili.

- Visualizza profilo
- Scarica certificato
- Scarica documento
- Scarica foto tessera

---

# Esportazione CSI

Gli amministratori possono esportare un file CSV contenente esclusivamente i dati richiesti per il tesseramento.

Campi esportati.

- Nome
- Cognome
- Data di nascita
- Luogo di nascita
- Indirizzo
- Telefono
- Email
- Tipo documento
- Numero documento
- Rilasciato da
- Data emissione
- Data scadenza

---

# Completamento profilo

Ogni sezione contribuisce alla percentuale di completamento.

## Pesi

Dati personali

30%

Documento di identità

30%

Certificato medico

30%

Foto tessera

10%

Quando tutte le sezioni risultano complete il profilo raggiunge il 100%.

---

# Permessi

## Giocatore

Può modificare esclusivamente il proprio profilo.

## Amministratore

Può visualizzare tutti i profili.

Può scaricare tutti i documenti.

Può esportare i dati.

---

# Versione 1

- Profilo giocatore
- Completamento profilo
- Gestione dati personali
- Documento di identità
- Certificato medico
- Foto tessera
- Dashboard amministratore
- Esportazione CSV CSI

---

# Versioni future

- Storico certificati medici
- Gestione documenti aggiuntivi
- Consensi privacy
- Firma digitale
- Verifica automatica documenti