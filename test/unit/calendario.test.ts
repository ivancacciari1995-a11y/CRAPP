/** Check delle funzioni pure della griglia mensile: `bun test/unit/calendario.test.ts`. */
import assert from "node:assert/strict";
import { giorniDelMese, pad2 } from "@/lib/calendario";

// --- pad2 --------------------------------------------------------------
assert.equal(pad2(1), "01");
assert.equal(pad2(9), "09");
assert.equal(pad2(10), "10");
assert.equal(pad2(31), "31");

// --- giorniDelMese -------------------------------------------------------
// Febbraio 2026 (non bisestile): 28 giorni, inizia di domenica -> offset 6.
assert.deepEqual(giorniDelMese(2026, 1), { giorni: 28, offsetLunedi: 6 });

// Febbraio 2028 (bisestile): 29 giorni.
assert.deepEqual(giorniDelMese(2028, 1), { giorni: 29, offsetLunedi: 1 });

// Settembre 2026: 30 giorni, il 1° settembre 2026 è martedì -> offset 1.
assert.deepEqual(giorniDelMese(2026, 8), { giorni: 30, offsetLunedi: 1 });

// Gennaio 2027: il 1° gennaio è venerdì -> offset 4.
assert.deepEqual(giorniDelMese(2027, 0), { giorni: 31, offsetLunedi: 4 });

console.log("calendario: ok");
