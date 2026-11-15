/**
 * Collega i documenti al codice nel grafo graphify: dove un `.md` cita un file (`src/lib/rosa.ts`)
 * aggiunge l'arco `references` dal documento al file, e dal documento ai simboli che cita in
 * backtick (`useIo`) se stanno in uno dei file citati. Gli archi sono EXTRACTED: il percorso è
 * scritto nel testo. Collega anche i documenti alle RFC che nominano (`RFC 8188/8291`) e i
 * concetti dei documenti che hanno lo stesso nome di un simbolo (`mediePagelle()`). Idempotente: rimuove i propri archi e li rifà. Va rilanciato dopo ogni
 * `/graphify . --update` (rielabora i documenti e perde gli archi di quelli cambiati).
 *
 *   bun scripts/graphify-link-docs.ts            # aggiorna graphify-out/graph.json
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const MARCA = "graphify-link-docs";

type Nodo = {
  id: string;
  label?: string;
  source_file?: string;
  source_location?: string;
} & Record<string, unknown>;
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

/**
 * Il nodo che rappresenta il documento. Di solito ha l'id derivato dal percorso, ma
 * l'estrazione ne dà a volte uno diverso (`docs_decisions_dd_026_dd_026`): in quel caso vale il
 * nodo `document` di quel file, e se ce ne sono più d'uno il primo.
 */
export function idNodoDocumento(grafo: Grafo, doc: string): string | undefined {
  const id = idDocumento(doc);
  if (grafo.nodes.some((n) => n.id === id)) return id;
  return grafo.nodes.find((n) => n.source_file === doc && n["file_type"] === "document")?.id;
}

/** Archi `references` da un documento ai file e ai simboli di codice che cita. */
export function archiDocumento(grafo: Grafo, doc: string, testo: string): Arco[] {
  const idDoc = idNodoDocumento(grafo, doc);
  if (!idDoc) return [];
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

/** Numeri di RFC nominati nel testo: «RFC 8291», «RFC-8291», «RFC 8188/8291». */
export function estraiRfc(testo: string): Set<string> {
  const numeri = new Set<string>();
  for (const m of testo.matchAll(/RFC[ -]?(\d{4}(?:\/\d{4})*)/g))
    for (const n of (m[1] as string).split("/")) numeri.add(n);
  return numeri;
}

const senzaParentesi = (etichetta: string) => etichetta.replace(/\(\)$/, "");
const arcoDa = (
  source: string,
  target: string,
  doc: string,
  extra: Record<string, unknown>,
): Arco => ({
  source,
  target,
  weight: 1.0,
  _origin: "semantic",
  _via: MARCA,
  source_file: doc,
  ...extra,
});

/** Archi dal documento ai nodi-RFC che nomina (le RFC sono nodi creati dall'estrazione). */
export function archiRfc(grafo: Grafo, doc: string, testo: string): Arco[] {
  const idDoc = idNodoDocumento(grafo, doc);
  if (!idDoc) return [];
  const numeri = estraiRfc(testo);
  return grafo.nodes
    .filter((n) => n.label?.startsWith("RFC-") && numeri.has(n.label.slice(4)))
    .map((n) =>
      arcoDa(idDoc, n.id, doc, {
        relation: "references",
        confidence: "EXTRACTED",
        confidence_score: 1.0,
      }),
    );
}

/**
 * Concetti dei documenti con lo stesso nome di un simbolo del codice (`mediePagelle()` nel
 * modulo, `mediePagelle` in `pagelle.ts`): l'arco `describes` li unisce. Solo corrispondenze
 * esatte e uniche; è un'inferenza sul nome, quindi INFERRED.
 */
export function archiConcetti(
  grafo: Grafo & { nodes: Array<Nodo & Record<string, unknown>> },
): Arco[] {
  const codice = new Map<string, Nodo[]>();
  for (const n of grafo.nodes)
    if (n["_origin"] === "ast" && n["file_type"] === "code" && n.label) {
      const k = senzaParentesi(n.label);
      codice.set(k, [...(codice.get(k) ?? []), n]);
    }
  const archi: Arco[] = [];
  for (const n of grafo.nodes) {
    if (n["_origin"] === "ast" || !n.label || !n.source_file?.endsWith(".md")) continue;
    if (!["concept", "rationale", "code"].includes(n["file_type"] as string)) continue;
    const trovati = codice.get(senzaParentesi(n.label));
    if (trovati?.length !== 1) continue;
    archi.push(
      arcoDa(n.id, (trovati[0] as Nodo).id, n.source_file, {
        relation: "describes",
        confidence: "INFERRED",
        confidence_score: 0.95,
        source_location: n.source_location ?? "L1",
      }),
    );
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
    const testo = readFileSync(doc, "utf8");
    const nuovi = [...archiDocumento(grafo, doc, testo), ...archiRfc(grafo, doc, testo)].filter(
      (a) => !gia.has(`${a.source}>${a.target}`),
    );
    for (const a of nuovi) gia.add(`${a.source}>${a.target}`);
    if (nuovi.length) conArchi++;
    grafo.links.push(...nuovi);
    aggiunti += nuovi.length;
  }
  for (const a of archiConcetti(grafo)) {
    if (gia.has(`${a.source}>${a.target}`)) continue;
    gia.add(`${a.source}>${a.target}`);
    grafo.links.push(a);
    aggiunti++;
  }
  writeFileSync(file, JSON.stringify(grafo));
  console.log(`graphify-link-docs: ${aggiunti} archi da ${conArchi}/${elenco.length} documenti`);
}
