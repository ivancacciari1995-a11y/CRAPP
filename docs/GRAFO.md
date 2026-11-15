# Grafo della conoscenza (graphify)

Mappa interrogabile del repository: codice, migrazioni SQL e documentazione, con le relazioni
tra simboli, file e concetti. Serve a orientarsi in fretta («cosa chiama questa funzione?»,
«quale decisione tocca questa tabella?»). **Non è fonte di verità**: se grafo e codice
divergono, vale il codice.

## Cosa c'è e dove

Il grafo vive in `graphify-out/`, **locale e non versionato** (è in `.gitignore`): si rigenera,
non si committa. Contiene `graph.json` (dati), `graph.html` (visualizzazione, si apre nel
browser) e `GRAPH_REPORT.md` (nodi centrali, community, domande suggerite).

| Parte            | Come è costruita                                | Costo                 |
| ---------------- | ----------------------------------------------- | --------------------- |
| Codice e SQL     | Analisi dell'AST, senza LLM                     | Gratis, secondi       |
| Documentazione   | Estrazione semantica con agenti (`docs/`, ...)  | Token, qualche minuto |
| Immagini e icone | Escluse di proposito: non dicono nulla di utile | Non estratte          |

## Installazione

Una tantum, per ogni sviluppatore. L'extra `[sql]` serve per le migrazioni in
`supabase/migrations/`: senza, i 53+ file `.sql` non entrano nel grafo.

```bash
uv tool install "graphifyy[sql]"
```

La skill `/graphify` per Claude Code è già nel repo in `.claude/skills/graphify/`.
Cursor e Codex non la leggono: lì si usa la CLI.

## Uso quotidiano

```bash
graphify query "chi scrive in eventi_app?"   # domanda in linguaggio naturale
graphify explain "Squadra"                   # un nodo e i suoi vicini
graphify path "GestioneEventi" "eventi_app"  # percorso più breve tra due nodi
```

In Claude Code: `/graphify query "..."`, oppure leggere `graphify-out/GRAPH_REPORT.md`.

## Quando rigenerarlo

| Situazione                        | Comando                                                | Costo                         |
| --------------------------------- | ------------------------------------------------------ | ----------------------------- |
| Hai cambiato codice o migrazioni  | `graphify update .`                                    | Gratis                        |
| Hai cambiato documenti in `docs/` | `/graphify . --update` (skill)                         | Token, solo i file modificati |
| Grafo assente (clone nuovo)       | `graphify update .`, poi la riga sopra per i documenti | Come sopra                    |

Il grafo riporta il commit da cui è stato costruito (`GRAPH_REPORT.md`, sezione «Graph
Freshness»): confrontalo con `git rev-parse HEAD` per sapere se è vecchio.

## Collegamento documenti ↔ codice

L'estrazione semantica dei documenti crea pochissimi archi verso il codice, anche quando il
documento cita il file. Lo script [scripts/graphify-link-docs.ts](../scripts/graphify-link-docs.ts)
li aggiunge in modo deterministico: per ogni percorso citato nei `.md` (`src/lib/rosa.ts`)
crea l'arco `references` dal documento al file, e ai simboli citati tra backtick (`useIo`) se
stanno in quel file. Sono archi EXTRACTED: il percorso è scritto nel testo.

```bash
bun scripts/graphify-link-docs.ts   # idempotente, gratis
```

Va rilanciato dopo ogni `/graphify . --update`, perché rielaborare un documento ne cancella
gli archi. Sopravvive invece a `graphify update .`. Un documento che cita un file solo per nome
(`rosa.ts`, senza `src/lib/`) non viene collegato: scrivi il percorso completo.

Nota: `graphify update .` su un grafo già completo conserva i nodi semantici dei documenti
(verificato). I `.md` nuovi o modificati entrano però solo come struttura (titoli e sezioni):
per l'estrazione semantica serve `/graphify . --update`, che rielabora solo quei file.

## Limiti noti

- Il report segnala archi su nodi inesistenti e archi multipli collassati, soprattutto nelle
  migrazioni SQL e nei template GitHub: il grafo può essere incompleto in quei punti.
- Un file letto solo in parte viene riprovato al giro successivo (`--update`).
- `src/styles.css` e i file di configurazione (Dockerfile, `.toml`, `.lock`, `.env.example`)
  non sono nel grafo. `.env.example` non va mai incluso.
