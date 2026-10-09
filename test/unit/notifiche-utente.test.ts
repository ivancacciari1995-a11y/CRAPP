/** Check delle notifiche in-app (M17): `bun test/unit/notifiche-utente.test.ts`. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  contatoreBadge,
  daRiga,
  pallinoNotifiche,
  type RigaNotifica,
  type TipoNotifica,
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

// --- i tipi automatici di DD-040 attraversano daRiga senza perdere le righe del testo -----
const tipiNuovi: TipoNotifica[] = [
  "turno_palloni_12h",
  "turno_palloni_6h",
  "turno_palloni_3h",
  "turno_palloni_revocato",
  "sollecita_presenze_24h",
  "sollecita_presenze_12h",
  "sollecita_presenze_6h",
  "compleanno",
  "compleanno_auguri",
  "presenza_modificata",
];
const corpoMultiriga = "Data: 01/10/2026\nOra: 21:00\nLuogo: PalaCRAP";
for (const tipo of tipiNuovi) {
  const n = daRiga({ ...riga, tipo, corpo: corpoMultiriga });
  assert.equal(n.tipo, tipo);
  assert.equal(n.corpo, corpoMultiriga, `${tipo}: il corpo a più righe arriva intatto`);
}

// Compleanno (DD-047): titolo e basta, il corpo è vuoto e resta vuoto (la riga non lo inventa).
for (const tipo of ["compleanno", "compleanno_auguri"] as const) {
  const n = daRiga({ ...riga, tipo, titolo: "Buon compleanno, Marco! 🎂", corpo: "" });
  assert.equal(n.tipo, tipo);
  assert.equal(n.corpo, "", `${tipo}: corpo vuoto`);
}

// Le righe del corpo vanno a capo solo se la riga della notifica lo chiede al CSS: senza
// `whitespace-pre-line` il testo a più righe diventerebbe un paragrafo unico.
const uiBits = readFileSync(
  new URL("../../src/components/crapp/ui-bits.tsx", import.meta.url),
  "utf8",
);
assert.match(
  uiBits,
  /whitespace-pre-line[^"]*"[^>]*>\s*\{notifica\.corpo\}/,
  "il corpo della notifica mantiene gli a capo",
);

console.log("notifiche-utente: ok");
