/**
 * Check dei vincoli sui file del Profilo Giocatore: `bun test/unit/profili.test.ts`.
 * `caricaFile` valida tipo e dimensione prima di qualunque upload: qui verifichiamo
 * solo questi due rifiuti, che non richiedono rete né storage.
 */
import assert from "node:assert/strict";
import { caricaFile } from "@/lib/profili";

// --- formato non ammesso: rifiutato prima di toccare lo storage --------------
const testoNonAmmesso = new File(["contenuto"], "documento.txt", { type: "text/plain" });
await assert.rejects(
  () => caricaFile("g1", "documento-fronte", testoNonAmmesso),
  /Formato non ammesso: usa JPG, PNG, WEBP o PDF\./,
);

// --- file troppo grande: rifiutato anche con un formato valido ---------------
const troppoGrande = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "foto.jpg", {
  type: "image/jpeg",
});
await assert.rejects(
  () => caricaFile("g1", "foto", troppoGrande),
  /File troppo grande: massimo 8 MB\./,
);

console.log("profili: ok");
