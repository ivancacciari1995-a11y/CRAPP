/** Check dei profili giocatore: `bun test/unit/profili-core.test.ts`. */
import assert from "node:assert/strict";
import {
  aRigaProfilo,
  completamento,
  csvTesseramento,
  daRigaProfilo,
  sezioniComplete,
  statoScadenza,
  type Profilo,
} from "@/lib/profili-core";
import {
  dividiNome,
  numeroGiaUsato,
  rosaFallback,
  slotDi,
  validaDatiSquadra,
  type GiocatoreSquadra,
} from "@/lib/giocatori-squadra";

const vuoto: Profilo = {
  giocatoreId: "g1",
  dataNascita: null,
  luogoNascita: null,
  indirizzo: null,
  telefono: null,
  email: null,
  documentoTipo: null,
  documentoNumero: null,
  documentoRilasciatoDa: null,
  documentoEmissione: null,
  documentoScadenza: null,
  documentoFrontePath: null,
  documentoRetroPath: null,
  certificatoScadenza: null,
  certificatoPath: null,
  fotoPath: null,
};

const completo: Profilo = {
  ...vuoto,
  dataNascita: "1995-05-01",
  luogoNascita: "Bologna",
  indirizzo: "Via Roma 1",
  telefono: "3331234567",
  email: "ivan@example.com",
  documentoTipo: "Carta d'identità",
  documentoNumero: "CA12345",
  documentoRilasciatoDa: "Comune di Bologna",
  documentoEmissione: "2020-01-01",
  documentoScadenza: "2030-01-01",
  documentoFrontePath: "g1/documento-fronte.jpg",
  documentoRetroPath: "g1/documento-retro.jpg",
  certificatoScadenza: "2027-06-30",
  certificatoPath: "g1/certificato.pdf",
  fotoPath: "g1/foto.jpg",
};

// --- completamento -----------------------------------------------------------
assert.equal(completamento(null), 0, "profilo inesistente = 0%");
assert.equal(completamento(vuoto), 0);
assert.equal(completamento(completo), 100, "tutte le sezioni piene = 100%");
assert.equal(completamento({ ...completo, fotoPath: null }), 90, "la foto pesa 10");
assert.equal(completamento({ ...completo, certificatoPath: null }), 70, "il certificato pesa 30");
assert.equal(
  completamento({ ...completo, email: null }),
  70,
  "i dati personali sono completi solo tutti insieme",
);

// I metadati senza file (o viceversa) non contano come sezione completa.
assert.equal(sezioniComplete({ ...completo, certificatoScadenza: null }).certificato, false);
assert.equal(
  sezioniComplete({ ...completo, documentoRetroPath: null }).documento,
  false,
  "il documento vale solo con fronte e retro",
);
assert.equal(sezioniComplete({ ...completo, documentoFrontePath: null }).documento, false);

// --- aRigaProfilo ------------------------------------------------------------
const riga = aRigaProfilo({ ...completo, luogoNascita: "  ", telefono: " 333 " });
assert.equal(riga.luogo_nascita, null, "i campi solo-spazi tornano NULL, non stringa vuota");
assert.equal(riga.telefono, "333", "il resto viene ripulito ai bordi");
assert.equal(riga.documento_fronte_path, "g1/documento-fronte.jpg");
assert.deepEqual(
  daRigaProfilo(aRigaProfilo(completo)),
  completo,
  "modello -> riga -> modello non perde niente",
);

// --- statoScadenza -----------------------------------------------------------
const oggi = "2026-08-30";
assert.equal(statoScadenza(null, null, oggi), "mancante");
assert.equal(statoScadenza("2027-01-01", null, oggi), "mancante", "senza file non vale");
assert.equal(statoScadenza(null, "g1/cert.pdf", oggi), "mancante", "senza data non vale");
assert.equal(statoScadenza("2026-08-29", "g1/cert.pdf", oggi), "scaduto");
assert.equal(
  statoScadenza("2026-08-30", "g1/cert.pdf", oggi),
  "valido",
  "scade oggi = ancora valido",
);
assert.equal(statoScadenza("2026-12-31", "g1/cert.pdf", oggi), "valido");

// --- csvTesseramento ---------------------------------------------------------
const squadra: GiocatoreSquadra[] = [
  {
    id: "g1",
    nome: "Ivan",
    cognome: "Cacciari",
    numero: 23,
    ruolo: "Banda",
    authUserId: null,
    attivo: true,
    email: null,
  },
  {
    id: "g2",
    nome: "Anna",
    cognome: 'De "Rossi"',
    numero: 7,
    ruolo: "Libero",
    authUserId: "u2",
    attivo: true,
    email: null,
  },
];
const csv = csvTesseramento(squadra, { g1: completo });
const righe = csv.split("\n");
assert.equal(righe.length, 3, "intestazione + un giocatore per riga");
assert.equal(righe[0]?.split(";").length, 12, "i 12 campi richiesti dal CSI");
assert.match(righe[1] ?? "", /^Ivan;Cacciari;1995-05-01;Bologna/);
assert.match(
  righe[2] ?? "",
  /^Anna;"De ""Rossi""";;;/,
  "chi non ha profilo esce con i campi vuoti",
);

// --- anagrafica squadra ------------------------------------------------------
assert.deepEqual(dividiNome("Ivan Cacciari"), { nome: "Ivan", cognome: "Cacciari" });
assert.deepEqual(
  dividiNome("Carlo Di Castelnuovo"),
  { nome: "Carlo", cognome: "Di Castelnuovo" },
  "il cognome composto resta intero",
);
assert.deepEqual(dividiNome("Ivan"), { nome: "Ivan", cognome: "" });

assert.equal(slotDi(squadra, null), null, "senza sessione nessuno slot");
assert.equal(slotDi(squadra, "u2")?.id, "g2");
assert.equal(slotDi(squadra, "sconosciuto"), null);

// --- dati squadra modificabili dall'admin (DD-017) ---------------------------
const datiOk = { nome: "Ivan", cognome: "Cacciari", numero: 23, ruolo: "Banda", email: null };
assert.equal(validaDatiSquadra(datiOk), null);
assert.match(validaDatiSquadra({ ...datiOk, nome: "  " }) ?? "", /nome/i);
assert.match(validaDatiSquadra({ ...datiOk, cognome: "" }) ?? "", /cognome/i);
assert.match(validaDatiSquadra({ ...datiOk, ruolo: " " }) ?? "", /ruolo/i);
assert.match(
  validaDatiSquadra({ ...datiOk, numero: 0 }) ?? "",
  /numero/i,
  "il database rifiuta numero <= 0: meglio dirlo prima",
);
assert.match(validaDatiSquadra({ ...datiOk, numero: -3 }) ?? "", /numero/i);
assert.match(validaDatiSquadra({ ...datiOk, numero: 1.5 }) ?? "", /numero/i);

assert.equal(numeroGiaUsato(squadra, "g1", 7), true, "il 7 è di g2");
assert.equal(numeroGiaUsato(squadra, "g2", 7), false, "il proprio numero non è un conflitto");
assert.equal(numeroGiaUsato(squadra, "g1", 99), false);
assert.equal(
  numeroGiaUsato([{ ...squadra[1]!, attivo: false }], "g1", 7),
  false,
  "chi non è più in rosa non blocca il numero",
);

const fallback = rosaFallback();
assert.ok(fallback.length > 0, "il fallback da crapp-data non è mai vuoto");
assert.ok(
  fallback.every((g) => g.authUserId === null && g.attivo),
  "il fallback non può collegare account",
);

console.log("profili-core: ok");
