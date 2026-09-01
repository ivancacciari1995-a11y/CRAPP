/** Check dei badge social: `bun test/unit/badge-social.test.ts`. */
import assert from "node:assert/strict";
import {
  badgeSocialVinti,
  categorieSocial,
  conteggioCategoria,
  mioVotoSocial,
  vincitoreCategoria,
  type VotoSocial,
} from "@/lib/badge-social";

const v = (
  match_id: string,
  categoria: string,
  votante_id: string,
  votato_id: string,
  votato_nome: string,
): VotoSocial => ({ match_id, categoria, votante_id, votato_id, votato_nome });

const voti: VotoSocial[] = [
  v("m1", "affidabile", "g1", "g2", "Bruno"),
  v("m1", "affidabile", "g3", "g2", "Bruno"),
  v("m1", "affidabile", "g4", "g5", "Anna"),
  v("m1", "meme", "g1", "g5", "Anna"),
  v("m2", "affidabile", "g1", "g2", "Bruno"),
];

// --- conteggioCategoria: match e categoria isolati ---------------------------
assert.deepEqual(conteggioCategoria(voti, "m1", "affidabile"), [
  { id: "g2", nome: "Bruno", voti: 2 },
  { id: "g5", nome: "Anna", voti: 1 },
]);
assert.deepEqual(conteggioCategoria(voti, "m1", "meme"), [{ id: "g5", nome: "Anna", voti: 1 }]);
assert.deepEqual(conteggioCategoria(voti, "m1", "cuore"), [], "categoria senza voti");
assert.deepEqual(conteggioCategoria(voti, "m9", "affidabile"), []);

// --- vincitoreCategoria: serve un vantaggio netto ----------------------------
assert.equal(vincitoreCategoria(voti, "m1", "affidabile")?.nome, "Bruno");
assert.equal(vincitoreCategoria(voti, "m1", "cuore"), null, "nessun voto, nessun vincitore");
const pari = [v("m3", "meme", "g1", "g2", "Bruno"), v("m3", "meme", "g2", "g5", "Anna")];
assert.equal(vincitoreCategoria(pari, "m3", "meme"), null, "parità: nessun vincitore");

// --- mioVotoSocial -----------------------------------------------------------
assert.equal(mioVotoSocial(voti, "m1", "affidabile", "g1")?.votato_id, "g2");
assert.equal(mioVotoSocial(voti, "m1", "meme", "g3"), null, "non ho votato questa categoria");

// --- badgeSocialVinti: quante volte ho vinto ciascuna categoria --------------
assert.deepEqual(badgeSocialVinti(voti, "g2"), { affidabile: 2 }, "vinta in m1 e m2");
assert.deepEqual(badgeSocialVinti(voti, "g5"), { meme: 1 });
assert.deepEqual(badgeSocialVinti(voti, "g9"), {}, "chi non vince non ha badge");
assert.deepEqual(badgeSocialVinti(pari, "g2"), {}, "una parità non assegna badge");
assert.deepEqual(badgeSocialVinti([], "g2"), {});

// --- invarianti sulle categorie ----------------------------------------------
assert.equal(
  new Set(categorieSocial.map((c) => c.id)).size,
  categorieSocial.length,
  "id categoria unici",
);
for (const c of categorieSocial) assert.ok(c.nome && c.descrizione && c.emoji);

console.log("badge-social: ok");
