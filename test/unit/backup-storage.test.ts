/** Logica pura del backup storage: `bun test/unit/backup-storage.test.ts`. Solo dati finti. */
import assert from "node:assert/strict";
import { elencaFile, leggiEnv, type Voce } from "../../backups/storage-core.ts";
import { prova, riepilogo } from "../helpers/prova";

// --- leggiEnv -----------------------------------------------------------------
await prova("toglie virgolette doppie e singole", () => {
  const env = leggiEnv(`A="uno"\nB='due'\nC=tre`);
  assert.deepEqual(env, { A: "uno", B: "due", C: "tre" });
});

await prova("lascia le virgolette che non fanno coppia", () => {
  const env = leggiEnv(`A="aperta\nB=chiusa"\nC="mista'`);
  assert.deepEqual(env, { A: '"aperta', B: 'chiusa"', C: `"mista'` });
});

await prova("conserva gli = dentro il valore", () => {
  assert.equal(leggiEnv(`CHIAVE="abc=="`)["CHIAVE"], "abc==");
});

await prova("ignora righe vuote, commenti e spazi ai bordi", () => {
  const env = leggiEnv(`# commento\n\n  A=1  \r\nnon una variabile\n`);
  assert.deepEqual(env, { A: "1" });
});

await prova("valore vuoto resta stringa vuota", () => {
  assert.deepEqual(leggiEnv(`A=\nB=""`), { A: "", B: "" });
});

// --- elencaFile ---------------------------------------------------------------
const cartella = (name: string): Voce => ({ name, id: null });
const file = (name: string): Voce => ({ name, id: `id-${name}` });

function bucketFinto(albero: Record<string, Voce[]>) {
  const chiesti: string[] = [];
  const lista = async (prefisso: string) => {
    chiesti.push(prefisso);
    return albero[prefisso] ?? [];
  };
  return { lista, chiesti };
}

await prova("scende nelle sottocartelle e restituisce percorsi completi", async () => {
  const { lista } = bucketFinto({
    "": [cartella("g1"), file("radice.jpg")],
    g1: [file("avatar.jpg"), cartella("doc")],
    "g1/doc": [file("fronte.png")],
  });
  assert.deepEqual(await elencaFile(lista), ["g1/avatar.jpg", "g1/doc/fronte.png", "radice.jpg"]);
});

await prova("interroga ogni cartella una volta sola", async () => {
  const { lista, chiesti } = bucketFinto({ "": [cartella("a"), cartella("b")], a: [file("x")] });
  await elencaFile(lista);
  assert.deepEqual(chiesti, ["", "a", "b"]);
});

await prova("bucket vuoto: nessun file", async () => {
  assert.deepEqual(await elencaFile(bucketFinto({}).lista), []);
});

await prova("un errore di elenco interrompe il backup invece di saltare file", async () => {
  const lista = async (prefisso: string) => {
    if (prefisso === "g1") throw new Error("rete giù");
    return [cartella("g1")];
  };
  await assert.rejects(elencaFile(lista), /rete giù/);
});

riepilogo("backup-storage");
