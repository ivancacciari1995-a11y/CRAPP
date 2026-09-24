/** Check delle notifiche in-app (M17): `bun test/unit/notifiche-utente.test.ts`. */
import assert from "node:assert/strict";
import {
  contatoreBadge,
  daRiga,
  pallinoNotifiche,
  type RigaNotifica,
} from "@/lib/notifiche-utente";

// --- daRiga: conversione database -> modello applicativo ---------------------
const riga: RigaNotifica = {
  id: "n1",
  tipo: "evento_promemoria_24h",
  titolo: "Promemoria: Allenamento",
  corpo: "10/09/2026 alle 20:30",
  evento_id: "e1",
  letta: false,
  creato_il: "2026-09-10T09:00:00Z",
};

assert.deepEqual(daRiga(riga), {
  id: "n1",
  tipo: "evento_promemoria_24h",
  titolo: "Promemoria: Allenamento",
  corpo: "10/09/2026 alle 20:30",
  eventoId: "e1",
  letta: false,
  creataIl: "2026-09-10T09:00:00Z",
});

assert.equal(
  daRiga({ ...riga, evento_id: null }).eventoId,
  null,
  "un messaggio admin non ha evento",
);

// --- contatoreBadge: il numero esatto fino a 9, poi "9+" ---------------------
assert.equal(contatoreBadge(0), "0");
assert.equal(contatoreBadge(1), "1");
assert.equal(contatoreBadge(9), "9");
assert.equal(contatoreBadge(10), "9+");
assert.equal(contatoreBadge(42), "9+");

// --- pallinoNotifiche: rosso con le non lette, neutro col totale, assente se vuoto ---
assert.equal(pallinoNotifiche(0, 0), null);
assert.deepEqual(pallinoNotifiche(5, 2), { testo: "2", daLeggere: true });
assert.deepEqual(pallinoNotifiche(30, 12), { testo: "9+", daLeggere: true });
// Tutte lette: il pallino resta per poterle ancora aprire ed eliminare.
assert.deepEqual(pallinoNotifiche(3, 0), { testo: "3", daLeggere: false });

console.log("notifiche-utente: ok");
