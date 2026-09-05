/** Check della proiezione del momento: `bun test/unit/molla.test.ts`. */
import assert from "node:assert/strict";
import { molla, proietta } from "@/lib/molla";

// --- proietta: da fermo non si va da nessuna parte ----------------------------
assert.equal(proietta(0), 0, "velocità zero non proietta nulla");

// --- proietta: il segno segue la direzione del gesto --------------------------
assert.ok(proietta(500) > 0, "un gesto verso destra proietta a destra");
assert.ok(proietta(-500) < 0, "un gesto verso sinistra proietta a sinistra");
assert.equal(proietta(-500), -proietta(500), "la proiezione è simmetrica");

// --- proietta: più veloce vai, più lontano arrivi (proporzionale) -------------
assert.ok(proietta(1000) > proietta(500), "più velocità, più distanza");
assert.equal(proietta(1000), 2 * proietta(500), "la distanza è lineare nella velocità");

// --- proietta: i valori sono quelli della decelerazione esponenziale di iOS ----
// v/1000 * d / (1 - d) con d = 0.998 → 1000 px/s proietta 499 px.
assert.ok(
  Math.abs(proietta(1000) - 499) < 0.5,
  `1000 px/s deve proiettare ~499 px, non ${proietta(1000)}`,
);

// Una decelerazione più bassa frena prima: serve per gesti più "corti".
assert.ok(proietta(1000, 0.99) < proietta(1000, 0.998), "meno decelerazione, meno corsa");

// --- molla: i preset restano nel dominio utile di bounce/duration -------------
for (const [nome, preset] of Object.entries(molla)) {
  assert.equal(preset.type, "spring", `${nome} deve essere una molla`);
  assert.ok(preset.bounce >= 0 && preset.bounce < 1, `${nome}: bounce fuori scala`);
  assert.ok(preset.duration > 0 && preset.duration <= 1, `${nome}: duration fuori scala`);
}
assert.equal(molla.ui.bounce, 0, "il default non deve sorpassare il target");
assert.ok(molla.slancio.bounce > 0, "il preset da gesto ha un rimbalzo");

console.log("molla: ok");
