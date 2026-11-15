/**
 * Collega i documenti al codice nel grafo graphify: dove un `.md` cita un file (`src/lib/rosa.ts`)
 * aggiunge l'arco `references` dal documento al file, e dal documento ai simboli che cita in
 * backtick (`useIo`) se stanno in uno dei file citati. Gli archi sono EXTRACTED: il percorso è
 * scritto nel testo. Idempotente: rimuove i propri archi e li rifà. Va rilanciato dopo ogni
 * `/graphify . --update` (rielabora i documenti e perde gli archi di quelli cambiati).
 *
 *   bun scripts/graphify-link-docs.ts            # aggiorna graphify-out/graph.json
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const MARCA = "graphify-link-docs";

type Nodo = { id: string; label?: string; source_file?: string; source_location?: string };
type Arco = Record<string, unknown> & { source: string; target: string; _via?: string };
type Grafo = { nodes: Nodo[]; links: Arco[] } & Record<string, unknown>;

/** Percorsi di file del repo citati nel testo, con la prima riga in cui compaiono. */
export function estraiPercorsi(testo: string): Map<string, number> {
  const trovati = new Map<string, number>();
  const re = /\b(?:src|test|supabase|mailer|public)\/[\w./$@-]+?\.(?:tsx?|mjs|js|sql)\b/g;
  testo.split("\n").forEach((riga, i) => {
    for (const m of riga.matchAll(re)) if (!trovati.has(m[0])) trovati.set(m[0], i + 1);
  });
  return trovati;
}

/** Identificatori citati tra backtick (`useIo`, `inRosa()`), senza parentesi. */
export function estraiSimboli(testo: string): Set<string> {
  const s = new Set<string>();
  for (const m of testo.matchAll(/`([A-Za-z_$][\w$]*)(?:\(\))?`/g)) s.add(m[1] as string);
  return s;
}

/** Id del nodo-documento, come lo costruisce graphify: percorso senza estensione, in minuscolo. */
export function idDocumento(percorso: string): string {
  return percorso
    .replace(/\.[^./]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Archi `references` da un documento ai file e ai simboli di codice che cita. */
export function archiDocumento(grafo: Grafo, doc: string, testo: string): Arco[] {
  const idDoc = idDocumento(doc);
  if (!grafo.nodes.some((n) => n.id === idDoc)) return [];
  const archi: Arco[] = [];
  const base = (target: string, riga: number): Arco => ({
    source: idDoc,
    target,
    relation: "references",
    confidence: "EXTRACTED",
    confidence_score: 1.0,
    weight: 1.0,
    _origin: "semantic",
    _via: MARCA,
    source_file: doc,
    source_location: `L${riga}`,
  });
  const simboli = estraiSimboli(testo);
  for (const [percorso, riga] of estraiPercorsi(testo)) {
    const file = grafo.nodes.find((n) => n.source_file === percorso && n.source_location === "L1");
    if (!file) continue;
    archi.push(base(file.id, riga));
    for (const n of grafo.nodes) {
      if (n.source_file !== percorso || n.id === file.id) continue;
      if (n.label && simboli.has(n.label.replace(/\(\)$/, ""))) archi.push(base(n.id, riga));
    }
  }
  return archi;
}

function documenti(dir: string, fuori: string[] = []): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    if (fuori.some((f) => p.startsWith(f))) return [];
    return statSync(p).isDirectory() ? documenti(p, fuori) : p.endsWith(".md") ? [p] : [];
  });
}

if (import.meta.main) {
  const file = "graphify-out/graph.json";
  if (!existsSync(file))
    throw new Error("graphify-out/graph.json assente: lancia `graphify update .`");
  const grafo: Grafo = JSON.parse(readFileSync(file, "utf8"));
  grafo.links = grafo.links.filter((a) => a._via !== MARCA);
  const gia = new Set(grafo.links.map((a) => `${a.source}>${a.target}`));
  const elenco = [
    ...documenti("docs", ["docs/archive"]),
    "AGENTS.md",
    "PROJECT_STATE.md",
    "README.md",
  ];
  let aggiunti = 0;
  let conArchi = 0;
  for (const doc of elenco) {
    const nuovi = archiDocumento(grafo, doc, readFileSync(doc, "utf8")).filter(
      (a) => !gia.has(`${a.source}>${a.target}`),
    );
    for (const a of nuovi) gia.add(`${a.source}>${a.target}`);
    if (nuovi.length) conArchi++;
    grafo.links.push(...nuovi);
    aggiunti += nuovi.length;
  }
  writeFileSync(file, JSON.stringify(grafo));
  console.log(`graphify-link-docs: ${aggiunti} archi da ${conArchi}/${elenco.length} documenti`);
}
