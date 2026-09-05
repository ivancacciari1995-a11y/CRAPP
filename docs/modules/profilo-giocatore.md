# Modulo — Profilo Giocatore

## Obiettivo

Il modulo "Profilo Giocatore" raccoglie tutte le informazioni personali, amministrative e documentali di ciascun membro della squadra.

L'obiettivo è centralizzare in un'unica schermata tutti i dati necessari sia al giocatore sia agli amministratori, eliminando la gestione tramite chat, documenti cartacei e fogli Excel.

## Utenti

### Giocatore

Può:

- visualizzare il proprio profilo
- modificare i propri dati personali
- aggiornare il certificato medico
- aggiornare i documenti
- caricare le immagini richieste

### Amministratore

Può:

- visualizzare il profilo di tutti i giocatori
- scaricare documenti e certificati
- esportare i dati necessari al tesseramento CSI
- verificare lo stato di completamento dei profili
- modificare i dati squadra di qualsiasi giocatore (nome, cognome, numero, ruolo, email)
- compilare e correggere i dati personali e del documento al posto di un giocatore (DD-017)
- scollegare un account da un profilo, liberando lo slot
- aggiungere un nuovo giocatore alla rosa (id, nome, cognome, numero, ruolo, email opzionale)
- disattivare un giocatore che ha lasciato la squadra, e riattivarlo in caso di errore: la
  riga non viene eliminata, così presenze, voti, pagelle e badge della stagione restano
  agganciati al suo id

Non può caricare o sostituire i file altrui: documento, certificato e foto restano
responsabilità del giocatore che li fornisce.

## Flusso utente

### Primo accesso

1. Login tramite Google oppure Email. _Implementato con il solo Google: la squadra ha tutti
   un account Google, e un secondo metodo è additivo (un bottone in più sulla stessa
   schermata) il giorno che serve._
2. Collegamento automatico al proprio giocatore, confrontando l'email dell'account Google
   con l'email registrata in `giocatori_squadra` (DD-018). Nessuna scelta manuale: se
   l'email non corrisponde a nessun profilo, l'accesso si ferma con un messaggio che invita
   a contattare un amministratore.
3. Accesso alla Home.

Se il profilo non è completo compare automaticamente un widget di completamento.

## Home

Il giocatore visualizza un widget dedicato.

### Completa il tuo profilo

Viene mostrata una barra di avanzamento (esempio: _Profilo completato — 85%_), composta dalle seguenti sezioni.

- Dati personali
- Documento di identità
- Certificato medico
- Foto tessera

Quando tutte le sezioni sono complete il widget scompare automaticamente.

Il tap apre Profilo sulla sottosezione **Tesseramento** (`/profilo?tab=tesseramento`), non
sulla tab Stagione.

## Profilo

Il profilo viene suddiviso in sette aree.

### Dati Giocatore

**Dati squadra** — solo lettura, gestiti esclusivamente dagli amministratori.

- Nome
- Cognome
- Numero di maglia
- Ruolo

**Dati personali** — modificabili dal giocatore.

- Data di nascita
- Luogo di nascita
- Indirizzo di residenza
- Telefono
- Email

### Documento di identità

Campi.

- Tipo documento
- Numero documento
- Rilasciato da
- Data emissione
- Data scadenza

Upload.

- Foto fronte
- Foto retro

### Certificato medico

Campi.

- Data di scadenza

Upload.

- Certificato medico

Il giocatore può aggiornare liberamente sia la data sia il file.

Lo storico non viene mantenuto nella prima versione.

### Foto tessera

Upload di una fotografia formato tessera.

Utilizzata dagli amministratori per il tesseramento CSI.

### Statistiche

Sezione già presente. Contiene.

- Presenze
- Voto medio
- MVP
- Serie
- Altre statistiche disponibili

### Badge

Sezione già presente.

Contiene tutti i badge ottenuti e quelli ancora da sbloccare.

### Impostazioni

Contiene.

- Logout
- Preferenze notifiche: un solo interruttore che iscrive il dispositivo a **tutte** le push
  (turno palloni, solleciti presenze) e abilita le notifiche smart in app — non è limitato
  ai soli palloni (vedi [Notifiche](notifiche.md))
- Impostazioni applicazione
- Segnala un bug e Suggerisci una nuova funzionalità: due link che aprono una issue GitHub
  già impostata sul template giusto (`.github/ISSUE_TEMPLATE/bug_report.yml` e
  `feature_request.yml`). Nessun dato passa dall'app — la segnalazione vive interamente su
  GitHub, così non servono né una tabella né una schermata di gestione.

## Dashboard amministratore

Gli amministratori dispongono di una schermata dedicata (`/admin`, raggiungibile da
Profilo → Impostazioni).

Per ogni giocatore vengono mostrati.

- Stato del profilo
- Certificato medico
- Documento di identità
- Foto tessera
- Stato tesseramento CSI (tesserato / da tesserare)

Azioni disponibili.

- Visualizza profilo (la scheda si apre in linea nell'elenco: nessuna schermata separata)
- Scarica certificato
- Scarica documento
- Scarica foto tessera
- Modifica dati squadra e dati personali del giocatore (DD-017)
- Registra numero e data della tessera CSI, una volta arrivata dal comitato
- Scollega account, per liberare uno slot assegnato per errore
- Aggiungi giocatore, per inserire un nuovo membro della squadra
- Disattiva/Riattiva giocatore, per chi lascia la squadra (o rientra)

## Esportazione CSI

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

## Tracciamento tesseramento

Numero e data della tessera CSI non sono dati che il giocatore conosce in anticipo: arrivano
dal comitato dopo l'iscrizione effettiva. Per questo, a differenza dei dati personali del
profilo, li scrive solo un amministratore — come nome, cognome, numero di maglia e ruolo
(DD-017), il trigger sulla tabella li rende non modificabili dal giocatore stesso. La
dashboard mostra un badge "Tesserato"/"Da tesserare" su ogni scheda e il conteggio
complessivo della squadra.

## Completamento profilo

Ogni sezione contribuisce alla percentuale di completamento.

| Sezione               | Peso |
| --------------------- | ---- |
| Dati personali        | 30%  |
| Documento di identità | 30%  |
| Certificato medico    | 30%  |
| Foto tessera          | 10%  |

Quando tutte le sezioni risultano complete il profilo raggiunge il 100%.

## Permessi

**Giocatore** — può modificare esclusivamente il proprio profilo.

**Amministratore** — può visualizzare tutti i profili, scaricare tutti i documenti, esportare i
dati, modificare dati squadra e dati personali di chiunque e scollegare un account (DD-017).
Non carica file al posto di altri.

## Versione 1

- Profilo giocatore
- Completamento profilo
- Gestione dati personali
- Documento di identità
- Certificato medico
- Foto tessera
- Dashboard amministratore
- Esportazione CSV CSI

## Versioni future

- Storico certificati medici
- Gestione documenti aggiuntivi
- Consensi privacy
- Firma digitale
- Verifica automatica documenti
