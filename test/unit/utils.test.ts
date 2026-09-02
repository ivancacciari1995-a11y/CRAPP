/** Check dell'helper di classi CSS: `bun test/unit/utils.test.ts`. */
import assert from "node:assert/strict";
import { cn } from "@/lib/utils";

// --- cn: unisce classi statiche e condizionali --------------------------------
assert.equal(cn("a", "b"), "a b");
const escluso = false as boolean;
assert.equal(cn("a", escluso && "b", null, undefined, "c"), "a c", "scarta i valori falsy");
assert.equal(cn("p-2", ["m-1", "text-sm"]), "p-2 m-1 text-sm", "accetta anche gli array");

// --- cn: tailwind-merge risolve i conflitti tenendo l'ultima classe -----------
assert.equal(cn("p-2", "p-4"), "p-4", "l'ultima utility vince su quella in conflitto");
assert.equal(
  cn("text-red-500", "text-lg"),
  "text-red-500 text-lg",
  "classi non in conflitto convivono",
);

console.log("utils: ok");
