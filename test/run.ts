/**
 * Esecutore della suite: `bun test/run.ts [unit|integration|e2e|all]`.
 * Ogni file gira in un processo separato, così un test non può inquinare gli altri.
 * Senza argomenti esegue solo gli unit test (non serve rete né database).
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const cartelle = { unit: "test/unit", integration: "test/integration", e2e: "test/e2e" };
type Gruppo = keyof typeof cartelle;

const argomento = (process.argv[2] ?? "unit") as Gruppo | "all";
const gruppi: Gruppo[] =
  argomento === "all" ? (Object.keys(cartelle) as Gruppo[]) : [argomento as Gruppo];

for (const g of gruppi) {
  if (!cartelle[g]) {
    console.error(`Gruppo sconosciuto: ${g}. Usa unit, integration, e2e oppure all.`);
    process.exit(2);
  }
}

const falliti: string[] = [];
let totali = 0;

for (const gruppo of gruppi) {
  const cartella = cartelle[gruppo];
  const file = readdirSync(cartella)
    .filter((f) => f.endsWith(".test.ts"))
    .sort();

  console.log(`\n── ${gruppo} (${file.length} file)`);
  for (const nome of file) {
    const percorso = `${cartella}/${nome}`;
    totali += 1;
    const esito = spawnSync("bun", [percorso], { stdio: "inherit" });
    if (esito.status !== 0) falliti.push(percorso);
  }
}

console.log(
  `\n${totali - falliti.length}/${totali} file ok` +
    (falliti.length ? `\nfalliti:\n  ${falliti.join("\n  ")}` : ""),
);
process.exit(falliti.length ? 1 : 0);
