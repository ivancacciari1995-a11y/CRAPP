/**
 * Check della segnalazione errori verso l'editor Lovable: `bun test/unit/lovable-error-reporting.test.ts`.
 * Fuori dal browser (nessun `window`) deve essere un no-op silenzioso; qui simuliamo
 * anche un `window` minimale per verificare cosa viene inoltrato al hook di reporting.
 */
import assert from "node:assert/strict";
import { reportLovableError } from "@/lib/lovable-error-reporting";

// --- fuori dal browser: nessun window, nessun crash ---------------------------
assert.equal(typeof window, "undefined", "il test gira in ambiente server, senza DOM");
assert.doesNotThrow(() => reportLovableError(new Error("boom")));

// --- con un window simulato: inoltra al hook dell'editor ----------------------
type Riportato = { message: string; stack?: string; filename?: string };
let riportato: Riportato | undefined;
const finto = {
  location: { pathname: "/rosa" },
  __lovableReportRuntimeError: (payload: Riportato) => {
    riportato = payload;
  },
} as unknown as Window & typeof globalThis;

(globalThis as { window?: unknown }).window = finto;
try {
  reportLovableError(new Error("qualcosa è andato storto"));
  assert.ok(riportato, "il payload è stato inoltrato");
  assert.equal(riportato!.message, "qualcosa è andato storto");
  assert.equal(riportato!.filename, "/rosa");
  assert.ok(riportato!.stack, "include lo stack per un Error");

  // Una Response non ha un messaggio leggibile: si usa status + url.
  riportato = undefined;
  reportLovableError(new Response(null, { status: 404 }));
  assert.equal(riportato!.message, "Response 404");
  assert.equal(riportato!.stack, undefined, "una Response non ha stack");

  // Un valore qualunque diventa la sua stringa.
  riportato = undefined;
  reportLovableError("motivo generico");
  assert.equal(riportato!.message, "motivo generico");
} finally {
  delete (globalThis as { window?: unknown }).window;
}

assert.equal(typeof window, "undefined", "il window simulato non è rimasto in giro");

console.log("lovable-error-reporting: ok");
