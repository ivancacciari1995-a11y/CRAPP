/**
 * Check dell'avatar giocatore: `bun test/unit/avatar-store.test.ts`.
 * `urlAvatar` è puro (il bucket è pubblico, nessuna richiesta di rete): qui
 * verifichiamo solo la forma dell'URL, non serve un database.
 */
import assert from "node:assert/strict";
import { urlAvatar } from "@/lib/avatar-store";

const url = urlAvatar("g1");

assert.ok(url.includes("avatar-giocatori"), "punta al bucket degli avatar");
assert.ok(url.includes("g1/avatar.jpg"), "il percorso è <id>/avatar.jpg");
assert.equal(urlAvatar("g1"), url, "deterministico: nessuna chiamata di rete coinvolta");
assert.notEqual(urlAvatar("g2"), url, "id diversi -> percorsi diversi");

console.log("avatar-store: ok");
