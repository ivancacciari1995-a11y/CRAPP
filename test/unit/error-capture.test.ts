/**
 * Check della cattura errori server-side: `bun test/unit/error-capture.test.ts`.
 * Il modulo sovrascrive console.error al caricamento: qui verifichiamo sia
 * l'espansione della descrizione sia il recupero one-shot dell'errore originale.
 */
import assert from "node:assert/strict";
import { consumeLastCapturedError, describeError } from "@/lib/error-capture";

// --- describeError: un errore semplice ----------------------------------------
const semplice = new Error("boom");
assert.ok(describeError(semplice).includes("boom"));
assert.ok(describeError(semplice).includes(semplice.stack!.split("\n")[0]!));

// --- describeError: catena di cause, con lo stato HTTP se presente -----------
const interno = new Error("interno");
const esterno = new Error("esterno", { cause: interno });
(esterno as unknown as { status: number }).status = 404;
const descrizioneCatena = describeError(esterno);
assert.ok(descrizioneCatena.includes("(status 404)"), "riporta lo status dell'errore radice");
assert.ok(descrizioneCatena.includes("caused by:"), "etichetta le cause successive alla prima");
assert.ok(descrizioneCatena.includes("interno"), "include il messaggio della causa");

const conStatusCode = new Error("legacy");
(conStatusCode as unknown as { statusCode: number }).statusCode = 500;
assert.ok(describeError(conStatusCode).includes("(status 500)"), "accetta anche statusCode");

// --- describeError: valori che non sono Error ---------------------------------
assert.equal(describeError("solo una stringa"), "solo una stringa");
assert.equal(describeError({ a: 1 }), '{"a":1}', "gli oggetti passano da JSON.stringify");

// --- describeError: la catena si ferma dopo 5 livelli -------------------------
let radice = new Error("livello-0");
for (let i = 1; i <= 6; i++) radice = new Error(`livello-${i}`, { cause: radice });
const descrizioneLunga = describeError(radice);
assert.ok(descrizioneLunga.includes("livello-6"), "il primo livello è sempre incluso");
assert.ok(descrizioneLunga.includes("livello-2"), "quinto livello (indice 4) ancora incluso");
assert.ok(!descrizioneLunga.includes("livello-1"), "oltre 5 livelli la catena si tronca");

// --- describeError: la descrizione non supera 8000 caratteri -----------------
const enorme = new Error("grande");
enorme.stack = "x".repeat(20_000);
assert.equal(describeError(enorme).length, 8_000);

// --- console.error registra l'errore per consumeLastCapturedError ------------
// Il modulo ha già avvolto console.error al caricamento: chiamarlo (non
// sostituirlo, altrimenti si perderebbe il wrapper) registra l'errore.
assert.equal(consumeLastCapturedError(), undefined, "nulla da consumare all'inizio");
const catturato = new Error("da recuperare");
console.error(catturato);
assert.equal(consumeLastCapturedError(), catturato, "restituisce l'istanza originale");
assert.equal(consumeLastCapturedError(), undefined, "una volta consumato non si ripete");

console.log("error-capture: ok");
