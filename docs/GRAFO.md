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

Collega anche i documenti alle RFC che nominano (`RFC 8188/8291`) e unisce i concetti dei
documenti che hanno lo stesso nome esatto di un simbolo del codice (`mediePagelle()`): questi
ultimi sono archi `describes` INFERRED, perché si basano solo sul nome.

Va rilanciato dopo ogni `/graphify . --update`, perché rielaborare un documento ne cancella
gli archi. Sopravvive invece a `graphify update .`. Un documento che cita un file solo per nome
(`rosa.ts`, senza `src/lib/`) non viene collegato: scrivi il percorso completo.

Nota: `graphify update .` su un grafo già completo conserva i nodi semantici dei documenti
(verificato). I `.md` nuovi o modificati entrano però solo come struttura (titoli e sezioni):
per l'estrazione semantica serve `/graphify . --update`, che rielabora solo quei file.

## Limiti noti

- Gli avvisi di salute del build («archi su nodi inesistenti», «archi collassati») si
  riferiscono all'estrazione prima dell'unione. Nel `graph.json` finale gli archi su nodi
  inesistenti sono 0; gli archi tra la stessa coppia di nodi con relazioni diverse (import e
  chiamata, o più righe) diventano uno solo e conservano le varianti in `also_seen`. I due
  archi da un nodo a se stesso sono funzioni ricorsive vere. Per ricontrollare:
  `graphify diagnose multigraph`.
- La coesione bassa di una community non indica da sola un modulo da dividere: nei test, nei
  documenti-indice e nel file generato `routeTree.gen.ts` è normale. Rilette tutte le
  community da 25 nodi in su, nessuna mescola responsabilità diverse nel codice dell'app.
- Un file letto solo in parte viene riprovato al giro successivo (`--update`).
- `src/styles.css` non è nel grafo perché graphify non ha un estrattore per il CSS: l'import
  in `__root.tsx` produce solo un nodo segnaposto `src_styles` senza file. I file di
  configurazione (Dockerfile, `.toml`, `.lock`, `.env.example`) restano fuori di proposito:
  `.env.example` non va mai incluso.
