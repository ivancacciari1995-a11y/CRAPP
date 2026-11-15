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

Attenzione: `graphify update .` da solo ricostruisce i `.md` come semplici strutture (titoli e
sezioni) e **sovrascrive** i nodi semantici dei documenti. Dopo averlo lanciato su un grafo
già completo, rilancia `/graphify . --update` per ripristinarli: la cache evita di pagare di
nuovo i file invariati.

## Limiti noti

- Il report segnala archi su nodi inesistenti e archi multipli collassati, soprattutto nelle
  migrazioni SQL e nei template GitHub: il grafo può essere incompleto in quei punti.
- Un file letto solo in parte viene riprovato al giro successivo (`--update`).
- `src/styles.css` e i file di configurazione (Dockerfile, `.toml`, `.lock`, `.env.example`)
  non sono nel grafo. `.env.example` non va mai incluso.
