/** Check della pagina di errore statica: `bun test/unit/error-page.test.ts`. */
import assert from "node:assert/strict";
import { renderErrorPage } from "@/lib/error-page";

const html = renderErrorPage();

// --- è un documento HTML completo e senza contenuto dinamico ------------------
assert.ok(html.startsWith("<!doctype html>"), "documento HTML valido");
assert.ok(html.includes("<html"), "ha il tag html");
assert.ok(html.includes("</html>"), "è chiuso correttamente");
assert.ok(!html.includes("${"), "nessun placeholder di template rimasto non risolto");

// --- contenuto minimo per l'utente: titolo e via di uscita --------------------
assert.ok(html.includes("This page didn't load"));
assert.ok(html.includes('href="/"'), "offre un link per tornare alla home");
assert.ok(html.includes("location.reload()"), "offre un modo per riprovare");

// --- è deterministica: nessuno stato o input, stesso output ogni volta -------
assert.equal(renderErrorPage(), html);

console.log("error-page: ok");
