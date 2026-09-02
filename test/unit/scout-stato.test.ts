/** Check dello stato condiviso dello Scout Live: `bun test/unit/scout-stato.test.ts`. */
import assert from "node:assert/strict";
import { SCOUT_STATO_KEY, statoIniziale } from "@/lib/scout-stato";

// --- statoIniziale: parte vuoto, con avversario e campo memorizzati -----------
const stato = statoIniziale("Avversari", true);
assert.deepEqual(stato, { azioni: [], setChiusi: [], avversario: "Avversari", casa: true });

const trasferta = statoIniziale("Altra Squadra", false);
assert.equal(trasferta.casa, false);
assert.deepEqual(trasferta.azioni, [], "ogni chiamata parte da una lista vuota indipendente");

// Le liste non devono essere condivise tra due stati distinti.
stato.azioni.push({ id: "a1", tipo: "attacco", set: 1, ts: 0 });
assert.deepEqual(trasferta.azioni, [], "modificare uno stato non tocca l'altro");

// --- SCOUT_STATO_KEY: chiave stabile per React Query --------------------------
assert.deepEqual(SCOUT_STATO_KEY("evt-1"), ["scout-stato", "evt-1"]);
assert.notDeepEqual(
  SCOUT_STATO_KEY("evt-1"),
  SCOUT_STATO_KEY("evt-2"),
  "chiavi diverse per eventi diversi",
);

console.log("scout-stato: ok");
