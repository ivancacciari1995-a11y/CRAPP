/**
 * Check della guardia delle route che mandano notifiche: `bun test/unit/auth-route.test.ts`.
 *
 * `richiediAdmin` (DD-024) è l'unica barriera davanti a route che usano la service role e
 * saltano la RLS: qui si verificano i rifiuti che non richiedono rete, cioè tutti quelli
 * decisi prima di chiedere l'utente a Supabase. Il caso «token buono ma non admin» sta in
 * `test/integration/permessi-route.test.ts`, che ha un database vero.
 */
import assert from "node:assert/strict";
import { richiediAdmin } from "@/lib/auth-route.server";

const con = (intestazioni: Record<string, string>) =>
  richiediAdmin(new Request("http://localhost/api/public/qualcosa", { headers: intestazioni }));

const rifiuti: Array<[string, Record<string, string>]> = [
  ["nessuna intestazione", {}],
  ["schema sbagliato", { authorization: "Basic abc" }],
  ["Bearer senza token", { authorization: "Bearer " }],
  ["token non JWT", { authorization: "Bearer non-un-jwt" }],
  ["JWT a due segmenti", { authorization: "Bearer aaa.bbb" }],
  ["JWT con segmenti vuoti", { authorization: "Bearer .." }],
];

for (const [caso, intestazioni] of rifiuti) {
  const res = await con(intestazioni);
  assert.ok(res, `${caso}: la richiesta va fermata`);
  assert.equal(res.status, 401, `${caso}: risponde 401`);
}

console.log("auth-route: ok");
