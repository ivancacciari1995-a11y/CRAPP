# Documentazione CrAPP

Indice della documentazione ufficiale del progetto. Ogni file risponde a una domanda
precisa: se l'informazione che cerchi non è nel file indicato, probabilmente non esiste
ancora e va **prima documentata** (vedi [DD-002](DESIGN_DECISIONS.md#dd-002--sviluppo-document-first)).

## Dove sta cosa

| Documento | Risponde a |
|---|---|
| [VISION.md](VISION.md) | Perché esiste CrAPP, quali principi deve rispettare una funzionalità |
| [ROADMAP.md](ROADMAP.md) | Cosa è fatto e cosa è previsto, versione per versione |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Com'è fatta l'app: stack, struttura del codice, flusso di sviluppo |
| [DATABASE.md](DATABASE.md) | Quali tabelle esistono, a cosa servono, chi le usa |
| [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) | Perché abbiamo scelto così, cosa abbiamo escluso e quando riaprire la scelta |
| [PORTABILITA.md](PORTABILITA.md) | Cosa lega l'app a un fornitore e cosa no, come spostarla su server proprio |
| [EFFICIENZA_CLOUD.md](EFFICIENZA_CLOUD.md) | Come tenere basso il consumo cloud: cache, query, push |
| [TODO.md](TODO.md) | A cosa si sta lavorando adesso |
| [CHANGELOG.md](CHANGELOG.md) | Cosa è cambiato e quando |
| [modules/](modules/) | Specifica funzionale di ogni modulo, una per file |

Le regole vincolanti per gli assistenti AI stanno in [AGENTS.md](../AGENTS.md);
lo stato corrente del lavoro in [PROJECT_STATE.md](../PROJECT_STATE.md).

## Ordine di lettura

Prima di modificare il codice, nell'ordine: questo indice → `VISION.md` → `ROADMAP.md` →
`ARCHITECTURE.md` → `DATABASE.md` → `DESIGN_DECISIONS.md` → `TODO.md` → il documento del
modulo interessato in `modules/`.

## Regole di manutenzione

Ogni informazione ha **una sola casa**, per evitare che le copie divergano:

- l'elenco delle funzionalità (fatte e previste) sta solo in `ROADMAP.md`;
- `CHANGELOG.md` registra *quando* qualcosa è stato rilasciato, non ripete l'elenco;
- `TODO.md` contiene solo il lavoro in corso o imminente, e rimanda alla roadmap;
- lo schema del database sta solo in `DATABASE.md`, allineato alle migration in
  `supabase/migrations/`: una tabella nuova si documenta nella stessa modifica che la crea;
- le motivazioni stanno solo in `DESIGN_DECISIONS.md`, in voci `DD-XXX`; per aggiungerne
  una si copia [\_template-dd.md](_template-dd.md).

Convenzioni di scrittura: un solo titolo `#` per file (le sezioni interne partono da `##`),
niente `---` come riempitivo tra i paragrafi, tabelle al posto degli elenchi ripetitivi.
