/** Check dei campi del profilo: `bun test/unit/profilo-campi.test.ts` (DD-044: niente foto tessera). */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampiProfilo } from "@/components/crapp/ProfiloAmministrativo";
import { profiloVuoto, sezioniComplete } from "@/lib/profili-core";

const corrente = profiloVuoto("g1");
const html = renderToStaticMarkup(
  createElement(CampiProfilo, {
    corrente,
    aggiorna: () => {},
    sezioni: sezioniComplete(corrente),
    fileDocumento: createElement("p", null, "slot-documento"),
    fileCertificato: createElement("p", null, "slot-certificato"),
  }),
);

// --- le sezioni rimaste ci sono ----------------------------------------------
assert.ok(html.includes("Dati personali"));
assert.ok(html.includes("slot-documento"), "lo slot del documento è mostrato");
assert.ok(html.includes("slot-certificato"), "lo slot del certificato è mostrato");

// --- la foto tessera non c'è più, né come titolo né come campo ----------------
assert.ok(!/foto tessera/i.test(html), "nessun riferimento alla foto tessera");
assert.ok(!html.includes("fotoPath"));

console.log("profilo-campi: ok");
