/** Check del collegamento documenti ↔ codice nel grafo: `bun test/unit/graphify-link-docs.test.ts`. */
import assert from "node:assert/strict";
import {
  archiConcetti,
  archiDocumento,
  archiRfc,
  estraiRfc,
  estraiPercorsi,
  estraiSimboli,
  idDocumento,
} from "../../scripts/graphify-link-docs";

// --- percorsi: solo file del repo, con la prima riga in cui compaiono ---------
const testo =
  "Intro\nVedi `src/lib/rosa.ts` e src/routes/partita.$id.tsx.\nDi nuovo src/lib/rosa.ts, www.x.it/a.ts";
const p = estraiPercorsi(testo);
assert.deepEqual([...p.keys()], ["src/lib/rosa.ts", "src/routes/partita.$id.tsx"]);
assert.equal(p.get("src/lib/rosa.ts"), 2, "tiene la prima riga");

// --- simboli: solo tra backtick, senza parentesi ------------------------------
assert.deepEqual(
  [...estraiSimboli("`useIo` e `inRosa()` ma non useRosa né `a b`")],
  ["useIo", "inRosa"],
);

// --- id del documento come lo costruisce graphify -----------------------------
assert.equal(idDocumento("docs/modules/allenatore.md"), "docs_modules_allenatore");
assert.equal(idDocumento("docs/decisions/DD-034.md"), "docs_decisions_dd_034");

// --- archi: file citato + simboli citati che ci stanno dentro -----------------
const grafo = {
  nodes: [
    { id: "docs_modules_allenatore", label: "Modulo" },
    { id: "src_lib_rosa", label: "rosa.ts", source_file: "src/lib/rosa.ts", source_location: "L1" },
    {
      id: "src_lib_rosa_useio",
      label: "useIo()",
      source_file: "src/lib/rosa.ts",
      source_location: "L160",
    },
    {
      id: "src_lib_rosa_altro",
      label: "altro()",
      source_file: "src/lib/rosa.ts",
      source_location: "L9",
    },
    { id: "src_lib_x", label: "x.ts", source_file: "src/lib/x.ts", source_location: "L1" },
  ],
  links: [],
};
const archi = archiDocumento(
  grafo,
  "docs/modules/allenatore.md",
  "File: `src/lib/rosa.ts` (`useIo`)",
);
assert.deepEqual(
  archi.map((a) => a.target),
  ["src_lib_rosa", "src_lib_rosa_useio"],
  "il file e solo il simbolo citato; non altro() né file non citati",
);
assert.equal(archi[0]?.source, "docs_modules_allenatore");
assert.equal(archi[0]?.["confidence"], "EXTRACTED");
assert.deepEqual(
  archiDocumento(grafo, "docs/non-nel-grafo.md", "src/lib/rosa.ts"),
  [],
  "documento ignoto: nessun arco",
);
assert.deepEqual(
  archiDocumento(grafo, "docs/modules/allenatore.md", "src/lib/inesistente.ts"),
  [],
  "file non nel grafo",
);

// --- RFC: tutte le forme, anche «8188/8291» ------------------------------------
assert.deepEqual([...estraiRfc("cifrata (RFC 8188/8291), poi RFC-8030 e RFC 123")].sort(), [
  "8030",
  "8188",
  "8291",
]);
const conRfc = {
  nodes: [
    { id: "docs_decisions_dd_026", label: "DD" },
    { id: "r8291", label: "RFC-8291" },
    { id: "r8030", label: "RFC-8030" },
  ],
  links: [],
};
assert.deepEqual(
  archiRfc(conRfc, "docs/decisions/DD-026.md", "cifrata (RFC 8188/8291)").map((a) => a.target),
  ["r8291"],
  "solo le RFC che esistono come nodi",
);

// --- concetti: nome esatto e unico, solo dai documenti --------------------------
const conc = {
  nodes: [
    {
      id: "c1",
      label: "mediePagelle()",
      source_file: "docs/modules/pagelle.md",
      file_type: "concept",
    },
    {
      id: "k1",
      label: "mediePagelle()",
      source_file: "src/lib/pagelle.ts",
      file_type: "code",
      _origin: "ast",
    },
    { id: "c2", label: "Altra cosa", source_file: "docs/modules/pagelle.md", file_type: "concept" },
    { id: "c3", label: "dup()", source_file: "docs/x.md", file_type: "concept" },
    { id: "k2", label: "dup()", source_file: "src/a.ts", file_type: "code", _origin: "ast" },
    { id: "k3", label: "dup()", source_file: "src/b.ts", file_type: "code", _origin: "ast" },
  ],
  links: [],
};
const ac = archiConcetti(conc);
assert.deepEqual(
  ac.map((a) => [a.source, a.target]),
  [["c1", "k1"]],
  "esatto e unico; ambiguo scartato",
);
assert.equal(ac[0]?.["confidence"], "INFERRED");

// --- nodo-documento con id diverso da quello derivato dal percorso -------------
const altro = {
  nodes: [
    {
      id: "docs_decisions_dd_026_dd_026",
      label: "DD-026",
      source_file: "docs/decisions/DD-026.md",
      file_type: "document",
    },
    { id: "src_lib_rosa", label: "rosa.ts", source_file: "src/lib/rosa.ts", source_location: "L1" },
  ],
  links: [],
};
assert.equal(
  archiDocumento(altro, "docs/decisions/DD-026.md", "src/lib/rosa.ts")[0]?.source,
  "docs_decisions_dd_026_dd_026",
  "usa il nodo document del file se l'id derivato non esiste",
);

console.log("graphify-link-docs: ok");
