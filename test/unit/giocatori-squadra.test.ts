/** Check dell'anagrafica squadra: `bun test/unit/giocatori-squadra.test.ts`. */
import assert from "node:assert/strict";
import {
  daRigaSquadra,
  inRosa,
  isAllenatore,
  nomeCompleto,
  numeroGiaUsato,
  prossimoIdGiocatore,
  rosaFallback,
  ruoloVisibile,
  slotDi,
  slotPerEmail,
  validaDatiSquadra,
  type GiocatoreSquadra,
} from "@/lib/giocatori-squadra";
import { dividiNome, giocatori } from "@/lib/crapp-data";

const riga = (parziale: Partial<GiocatoreSquadra> = {}): GiocatoreSquadra => ({
  id: "g1",
  nome: "Mario",
  cognome: "Rossi",
  numero: 7,
  ruolo: "schiacciatore",
  authUserId: null,
  attivo: true,
  email: null,
  numeroTessera: null,
  dataTessera: null,
  nascita: null,
  tipo: "giocatore",
  ...parziale,
});

// --- dividiNome ----------------------------------------------------------------
assert.deepEqual(dividiNome("Carlo Di Castelnuovo"), { nome: "Carlo", cognome: "Di Castelnuovo" });
assert.deepEqual(dividiNome("Mario Rossi"), { nome: "Mario", cognome: "Rossi" });
assert.deepEqual(
  dividiNome("Prince"),
  { nome: "Prince", cognome: "" },
  "senza spazio: cognome vuoto",
);

// --- rosaFallback ----------------------------------------------------------------
const fallback = rosaFallback();
assert.equal(fallback.length, giocatori.length, "un ingresso per ogni giocatore reale");
assert.ok(
  fallback.every((g) => g.attivo && g.authUserId === null),
  "nessuno slot risulta collegato prima che il database risponda",
);
assert.deepEqual(
  fallback.map((g) => g.id).sort(),
  giocatori.map((g) => g.id).sort(),
  "gli id combaciano con la rosa reale",
);
assert.deepEqual(
  Object.fromEntries(fallback.map((g) => [g.id, g.nascita])),
  Object.fromEntries(giocatori.map((g) => [g.id, g.nascita])),
  "la nascita del fallback combacia con quella del seed (M18)",
);

// --- nomeCompleto ----------------------------------------------------------------
assert.equal(nomeCompleto(riga()), "Mario Rossi");
assert.equal(
  nomeCompleto(riga({ cognome: "" })),
  "Mario",
  "senza cognome non resta uno spazio finale",
);

// --- slotDi ----------------------------------------------------------------
const righe: GiocatoreSquadra[] = [
  riga({ id: "g1", authUserId: "u1" }),
  riga({ id: "g2", authUserId: null }),
];
assert.equal(slotDi(righe, "u1")?.id, "g1");
assert.equal(slotDi(righe, "u9"), null, "nessuno slot per un account non collegato");
assert.equal(slotDi(righe, null), null, "senza sessione non c'è slot");

// --- slotPerEmail ----------------------------------------------------------------
const rosaEmail: GiocatoreSquadra[] = [
  riga({ id: "g1", email: "foo@bar.com", authUserId: null }),
  riga({ id: "g2", email: "baz@qux.com", authUserId: "u1" }),
  riga({ id: "g3", email: null, authUserId: null }),
];
assert.equal(slotPerEmail(rosaEmail, "foo@bar.com")?.id, "g1", "match esatto");
assert.equal(
  slotPerEmail(rosaEmail, "Foo@Bar.com")?.id,
  "g1",
  "il confronto ignora maiuscole/minuscole",
);
assert.equal(slotPerEmail(rosaEmail, null), null, "senza email non c'è match");
assert.equal(
  slotPerEmail(rosaEmail, "baz@qux.com"),
  null,
  "uno slot già collegato non risulta in match anche con email coincidente",
);
assert.equal(slotPerEmail(rosaEmail, ""), null, "stringa vuota trattata come nessuna email");

// --- validaDatiSquadra ----------------------------------------------------------------
const datiOk = {
  nome: "Mario",
  cognome: "Rossi",
  numero: 7,
  ruolo: "schiacciatore",
  email: null,
  tipo: "giocatore" as const,
};
assert.equal(validaDatiSquadra(datiOk), null, "dati validi: nessun errore");
assert.match(validaDatiSquadra({ ...datiOk, nome: "" })!, /nome/i);
assert.match(
  validaDatiSquadra({ ...datiOk, nome: "   " })!,
  /nome/i,
  "spazi soli contano come vuoto",
);
assert.match(validaDatiSquadra({ ...datiOk, cognome: "" })!, /cognome/i);
assert.match(validaDatiSquadra({ ...datiOk, ruolo: "" })!, /ruolo/i);
assert.match(
  validaDatiSquadra({ ...datiOk, numero: 0 })!,
  /numero/i,
  "zero non è un numero di maglia valido",
);
assert.match(validaDatiSquadra({ ...datiOk, numero: -3 })!, /numero/i);
assert.match(
  validaDatiSquadra({ ...datiOk, numero: 4.5 })!,
  /numero/i,
  "il numero deve essere intero",
);
assert.equal(
  validaDatiSquadra({ ...datiOk, email: "foo@bar.com" }),
  null,
  "email valida: nessun errore",
);
assert.equal(
  validaDatiSquadra({ ...datiOk, email: "" }),
  null,
  "email vuota è ammessa: non ancora nota",
);
assert.match(
  validaDatiSquadra({ ...datiOk, email: "non-e-una-email" })!,
  /email/i,
  "senza @ l'email non è valida",
);

// --- prossimoIdGiocatore ----------------------------------------------------------------
assert.equal(
  prossimoIdGiocatore([riga({ id: "g1" }), riga({ id: "g3" }), riga({ id: "g2" })]),
  "g4",
  "il prossimo id segue il numero più alto già in uso",
);
assert.equal(prossimoIdGiocatore([]), "g1", "rosa vuota: si parte da g1");

// --- numeroGiaUsato ----------------------------------------------------------------
const rosaNumeri: GiocatoreSquadra[] = [
  riga({ id: "g1", numero: 7, attivo: true }),
  riga({ id: "g2", numero: 9, attivo: true }),
  riga({ id: "g3", numero: 7, attivo: false }),
];
assert.equal(numeroGiaUsato(rosaNumeri, "g2", 7), true, "il 7 è già di g1");
assert.equal(
  numeroGiaUsato(rosaNumeri, "g1", 7),
  false,
  "il proprio numero attuale non è un conflitto",
);
assert.equal(
  numeroGiaUsato(rosaNumeri, "g4", 7),
  true,
  "conta solo il 7 attivo di g1, non serve escludere g3",
);
assert.equal(numeroGiaUsato(rosaNumeri, "g4", 11), false, "un numero libero non risulta usato");
assert.equal(
  numeroGiaUsato([riga({ id: "g5", numero: 0, tipo: "allenatore" })], "g4", 0),
  false,
  "l'allenatore non occupa numeri di maglia",
);

// --- allenatore (DD-034) ---------------------------------------------------------
const allenatore = riga({ id: "g20", numero: 0, ruolo: "", tipo: "allenatore" });
assert.equal(isAllenatore(allenatore), true);
assert.equal(isAllenatore(riga()), false);
assert.equal(isAllenatore(null), false, "senza slot non si è allenatori");
assert.equal(inRosa(riga()), true, "giocatore attivo: in rosa");
assert.equal(inRosa(riga({ attivo: false })), false, "giocatore disattivato: fuori");
assert.equal(inRosa(allenatore), false, "l'allenatore non è nella rosa di gioco");
assert.equal(ruoloVisibile(allenatore), "Allenatore", "dove c'è il ruolo in campo");
assert.equal(ruoloVisibile(riga({ ruolo: "Libero" })), "Libero");
assert.equal(
  validaDatiSquadra({ ...datiOk, tipo: "allenatore", numero: 0, ruolo: "" }),
  null,
  "l'allenatore non ha numero né ruolo",
);
assert.match(
  validaDatiSquadra({ ...datiOk, tipo: "allenatore", nome: " " })!,
  /nome/i,
  "il nome resta obbligatorio anche per l'allenatore",
);
assert.match(
  validaDatiSquadra({ ...datiOk, tipo: "allenatore", email: "senza-chiocciola" })!,
  /email/i,
);
const rigaDb = {
  id: "g20",
  nome: "Carla",
  cognome: "Neri",
  numero: null,
  ruolo: "",
  auth_user_id: null,
  attivo: true,
  email: "carla@gmail.com",
  numero_tessera: null,
  data_tessera: null,
  nascita: null,
  tipo: "allenatore" as const,
};
assert.equal(daRigaSquadra(rigaDb).numero, 0, "numero NULL a database diventa 0");
assert.equal(daRigaSquadra(rigaDb).tipo, "allenatore");
assert.equal(daRigaSquadra({ ...rigaDb, numero: 7, tipo: "giocatore" }).numero, 7);
assert.ok(
  rosaFallback().every((g) => g.tipo === "giocatore"),
  "il fallback contiene solo giocatori",
);

console.log("giocatori-squadra: ok");
