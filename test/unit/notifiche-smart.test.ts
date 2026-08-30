/** Check delle notifiche smart: `bun test/unit/notifiche-smart.test.ts`. */
import assert from "node:assert/strict";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import type { VotoSocial } from "@/lib/badge-social";
import type { ObiettivoSquadra } from "@/lib/obiettivi";
import { calcolaNotifiche } from "@/lib/notifiche-smart";

function g(valori: Partial<Giocatore> = {}): Giocatore {
  return {
    ...giocatori[0]!,
    presenze: 0,
    mvp: 0,
    mediaVoto: 0,
    palloni: 0,
    cacche: 0,
    cacchePartita: 0,
    infortuni: 0,
    ritardi: 0,
    streak: 0,
    serieAllenamenti: 0,
    seriePartite: 0,
    serieConferme: 0,
    ...valori,
  };
}

const ids = (g: Giocatore, voti: VotoSocial[] = [], ob: ObiettivoSquadra[] = []) =>
  calcolaNotifiche(g, voti, ob).map((n) => n.id);

// --- niente rumore: a zero solo l'invito al primo traguardo ------------------
assert.deepEqual(ids(g()), ["quasi:mvp:1"], "nessun badge sbloccato, nessuna serie");

// --- badge sbloccati ---------------------------------------------------------
const conMvp = ids(g({ mvp: 1 }));
assert.ok(conMvp.includes("badge:mvp:bronzo"), "il badge appena preso viene annunciato");
assert.ok(
  ids(g({ mvp: 3 })).includes("badge:mvp:argento"),
  "annuncia il grado corrente, non quelli precedenti",
);
assert.ok(!ids(g({ mvp: 3 })).includes("badge:mvp:bronzo"));

// --- badge segreti -----------------------------------------------------------
assert.ok(ids(g({ infortuni: 3 })).includes("segreto:s-infermeria"));
assert.ok(!ids(g({ infortuni: 2 })).includes("segreto:s-infermeria"));
const segreta = calcolaNotifiche(g({ ritardi: 5 })).find((n) => n.id === "segreto:s-ritardi")!;
assert.equal(segreta.tono, "segreto");
assert.equal(segreta.emoji, "⏰");
assert.equal(segreta.testo, "Forse è il momento di puntare la sveglia 10 minuti prima! 😄");

// --- "sei a un passo": solo entro due unità dalla soglia ---------------------
assert.ok(ids(g({ presenze: 4 })).some((id) => id.startsWith("quasi:presenze")));
assert.ok(
  !ids(g({ mvp: 5, presenze: 2 })).some((id) => id.startsWith("quasi:presenze")),
  "a 3 di distanza non si notifica",
);

// --- serie: solo sul traguardo esatto ----------------------------------------
assert.ok(ids(g({ serieAllenamenti: 3 })).includes("serie:allenamenti:3"));
assert.ok(!ids(g({ serieAllenamenti: 4 })).includes("serie:allenamenti:4"), "4 non è un traguardo");
assert.ok(ids(g({ serieConferme: 8 })).includes("serie:conferme:8"));

// --- obiettivi di squadra: uno solo, tra il 90% e il 99% --------------------
const obiettivo = (id: string, valore: number): ObiettivoSquadra => ({
  id,
  titolo: `Obiettivo ${id}`,
  descrizione: "",
  valore,
  target: 100,
  unita: "%",
  emoji: "🎯",
  impatto: "",
});
assert.deepEqual(
  ids(g(), [], [obiettivo("o1", 95), obiettivo("o2", 92)]).filter((i) => i.startsWith("obiettivo")),
  ["obiettivo:o1:90"],
  "un solo obiettivo per non fare rumore",
);
assert.equal(
  ids(g(), [], [obiettivo("o1", 100)]).filter((i) => i.startsWith("obiettivo")).length,
  0,
  "obiettivo già centrato: niente notifica",
);
assert.equal(
  ids(g(), [], [obiettivo("o1", 50)]).filter((i) => i.startsWith("obiettivo")).length,
  0,
);

// --- voti social -------------------------------------------------------------
const io = g();
const votiSocial: VotoSocial[] = [
  { match_id: "m1", categoria: "meme", votante_id: "g2", votato_id: io.id, votato_nome: io.nome },
  { match_id: "m1", categoria: "meme", votante_id: "g3", votato_id: io.id, votato_nome: io.nome },
];
assert.ok(ids(io, votiSocial).includes("social:meme:1"));
assert.equal(
  calcolaNotifiche(io, votiSocial).find((n) => n.id === "social:meme:1")?.titolo,
  "Meme della partita x1",
);
assert.ok(!ids(g({ ...io, id: "g99" }), votiSocial).some((i) => i.startsWith("social:")));

// --- forma delle notifiche ---------------------------------------------------
const tutte = calcolaNotifiche(g({ mvp: 5, infortuni: 3, serieAllenamenti: 3 }), votiSocial);
assert.equal(new Set(tutte.map((n) => n.id)).size, tutte.length, "id univoci: niente doppioni");
for (const n of tutte) assert.ok(n.titolo && n.testo && n.emoji && n.tono, `${n.id} completa`);

console.log("notifiche-smart: ok");
