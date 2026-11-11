/**
 * Check dei requisiti di layout per schermi stretti (360 px): `bun test/unit/layout-stretto.test.ts`.
 *
 * Non c'è un driver browser (vedi `test/README.md`), quindi si presidiano le due regole che,
 * se tolte, fanno tornare la pagina tagliata in larghezza su iPhone: i campi a 16 px (sotto,
 * iOS zooma al focus e non torna indietro) e la rete di sicurezza sull'overflow orizzontale.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classiInput } from "@/components/crapp/ui-bits";

assert.match(classiInput, /\btext-base\b/, "i campi devono essere a 16px (zoom automatico iOS)");
assert.doesNotMatch(classiInput, /text-\[1[0-5]px\]|text-sm|text-xs/);

const css = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
assert.match(css, /overflow-x:\s*clip/, "html/body devono impedire lo scroll orizzontale");
assert.match(
  css,
  /\.grid\s*>\s*\*\s*\{\s*min-width:\s*0/,
  "gli elementi di griglia devono poter restringersi",
);

const scout = readFileSync(
  new URL("../../src/components/crapp/ScoutReport.tsx", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  scout,
  /min-w-\[\d+rem\]/,
  "la tabella scout non deve imporre una larghezza minima",
);

console.log("layout-stretto: ok");
