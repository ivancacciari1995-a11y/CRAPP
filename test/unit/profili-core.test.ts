/** Check dei profili giocatore: `bun test/unit/profili-core.test.ts`. */
import assert from "node:assert/strict";
import {
  aRigaProfilo,
  avvisiCertificati,
  avvisiCertificatiUtente,
  GIORNI_AVVISO_CERTIFICATO_GIOCATORE,
  completamento,
  completamentoAllenatore,
  csvTesseramento,
  PESI,
  daRigaProfilo,
  formatDataBreve,
  giorniAllaScadenza,
  sezioniComplete,
  statoScadenza,
  testoScadenza,
  type Profilo,
} from "@/lib/profili-core";
import {
  numeroGiaUsato,
  rosaFallback,
  slotDi,
  validaDatiSquadra,
  type GiocatoreSquadra,
} from "@/lib/giocatori-squadra";
import { dividiNome } from "@/lib/crapp-data";

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
};

// --- completamento -----------------------------------------------------------
assert.equal(completamento(null), 0, "profilo inesistente = 0%");
assert.equal(completamento(vuoto), 0);
assert.equal(completamento(completo), 100, "tutte le sezioni piene = 100%");
assert.equal(
  Object.values(PESI).reduce((somma, peso) => somma + peso, 0),
  100,
  "senza foto tessera (DD-044) i pesi di dati, documento e certificato fanno 100",
);
assert.deepEqual(Object.keys(sezioniComplete(completo)), ["dati", "documento", "certificato"]);
assert.equal(completamento({ ...completo, certificatoPath: null }), 67, "il certificato pesa 33");
assert.equal(
  completamento({ ...completo, email: null }),
  66,
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
    numeroTessera: null,
    dataTessera: null,
    nascita: null,
    tipo: "giocatore",
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
    numeroTessera: null,
    dataTessera: null,
    nascita: null,
    tipo: "giocatore",
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
const datiOk = {
  nome: "Ivan",
  cognome: "Cacciari",
  numero: 23,
  ruolo: "Banda",
  email: null,
  tipo: "giocatore" as const,
};
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

// --- completamento dell'allenatore (DD-034) --------------------------------------
assert.equal(completamentoAllenatore(null), 0, "senza profilo: 0%");
assert.equal(
  completamentoAllenatore({ ...vuoto, dataNascita: "1980-01-01", telefono: "333" }),
  50,
  "due campi su quattro",
);
assert.equal(
  completamentoAllenatore({
    ...vuoto,
    dataNascita: "1980-01-01",
    luogoNascita: "Bologna",
    telefono: "333",
    email: "a@b.it",
  }),
  100,
  "bastano i quattro dati personali: niente indirizzo, documento, certificato",
);
assert.equal(completamentoAllenatore({ ...vuoto, telefono: "   " }), 0, "spazi soli non contano");

// --- avviso certificati (DD-035) ------------------------------------------------
assert.equal(giorniAllaScadenza("2026-09-27", "2026-09-20"), 7);
assert.equal(giorniAllaScadenza("2026-09-19", "2026-09-20"), -1, "scaduto ieri");
assert.equal(giorniAllaScadenza("2026-09-20", "2026-09-20"), 0, "scade oggi");
assert.equal(giorniAllaScadenza("2026-10-01", "2026-09-30"), 1, "cambio di mese");
assert.equal(giorniAllaScadenza("2027-01-01", "2026-12-31"), 1, "cambio di anno");

assert.equal(formatDataBreve("2026-09-12"), "12/09/2026");

assert.equal(testoScadenza(0), "scade oggi");
assert.equal(testoScadenza(1), "scade domani");
assert.equal(testoScadenza(5), "scade tra 5 giorni");

const rosaCertificati: GiocatoreSquadra[] = [
  { ...squadra[0]!, id: "g1", nome: "Ivan", cognome: "Cacciari", attivo: true, tipo: "giocatore" },
  { ...squadra[0]!, id: "g2", nome: "Anna", cognome: "Bruni", attivo: true, tipo: "giocatore" },
  { ...squadra[0]!, id: "g3", nome: "Marco", cognome: "Verdi", attivo: true, tipo: "giocatore" },
  { ...squadra[0]!, id: "g4", nome: "Sara", cognome: "Neri", attivo: false, tipo: "giocatore" },
  { ...squadra[0]!, id: "g5", nome: "Luca", cognome: "Bianchi", attivo: true, tipo: "allenatore" },
];
const oggiTest = "2026-09-20";
const profiliCertificati: Record<string, Profilo> = {
  g1: { ...vuoto, giocatoreId: "g1", certificatoScadenza: "2026-09-25", certificatoPath: "p1" }, // in scadenza, 5 giorni
  g2: { ...vuoto, giocatoreId: "g2", certificatoScadenza: "2026-09-10", certificatoPath: "p2" }, // scaduto da 10 giorni
  g3: { ...vuoto, giocatoreId: "g3", certificatoScadenza: "2026-10-31", certificatoPath: "p3" }, // valido, fuori soglia
  g4: { ...vuoto, giocatoreId: "g4", certificatoScadenza: "2026-09-21", certificatoPath: "p4" }, // disattivato: escluso
  g5: { ...vuoto, giocatoreId: "g5", certificatoScadenza: "2026-09-21", certificatoPath: "p5" }, // allenatore: escluso
};
const avvisi = avvisiCertificati(rosaCertificati, profiliCertificati, oggiTest);
assert.deepEqual(
  avvisi.scaduti.map((a) => a.giocatoreId),
  ["g2"],
);
assert.deepEqual(
  avvisi.inScadenza.map((a) => a.giocatoreId),
  ["g1"],
);

const senzaCertificato = avvisiCertificati(
  [{ ...squadra[0]!, id: "g6" }],
  { g6: { ...vuoto, giocatoreId: "g6", certificatoScadenza: null, certificatoPath: null } },
  oggiTest,
);
assert.equal(senzaCertificato.inScadenza.length + senzaCertificato.scaduti.length, 0);
assert.deepEqual(
  senzaCertificato.mancanti.map((m) => m.giocatoreId),
  ["g6"],
  "certificato mancante (DD-046): in `mancanti`, non tra scadenze",
);
// DD-046: profilo assente e scadenza senza file valgono come mancante; fuori rosa e allenatori no
const mancantiRosa = avvisiCertificati(
  [
    ...rosaCertificati,
    { ...squadra[0]!, id: "g7", nome: "Zeno", cognome: "Zeta", attivo: true, tipo: "giocatore" },
    { ...squadra[0]!, id: "g8", nome: "Aldo", cognome: "Alfa", attivo: true, tipo: "giocatore" },
  ],
  {
    ...profiliCertificati,
    g8: { ...vuoto, giocatoreId: "g8", certificatoScadenza: "2026-12-01", certificatoPath: null },
  },
  oggiTest,
).mancanti.map((m) => m.giocatoreId);
assert.deepEqual(mancantiRosa, ["g8", "g7"], "g7 senza profilo, g8 senza file; ordine per cognome");

const dueInScadenza: Record<string, Profilo> = {
  g1: { ...vuoto, giocatoreId: "g1", certificatoScadenza: "2026-09-27", certificatoPath: "p1" }, // 7 giorni, più lontano
  g2: { ...vuoto, giocatoreId: "g2", certificatoScadenza: "2026-09-21", certificatoPath: "p2" }, // 1 giorno, più vicino
};
const ordinati = avvisiCertificati(
  [
    { ...squadra[0]!, id: "g1", nome: "Ivan", cognome: "Cacciari" },
    { ...squadra[0]!, id: "g2", nome: "Anna", cognome: "Bruni" },
  ],
  dueInScadenza,
  oggiTest,
).inScadenza.map((a) => a.giocatoreId);
assert.deepEqual(ordinati, ["g2", "g1"], "la scadenza più vicina viene prima");

const pariGiorni: Record<string, Profilo> = {
  g1: { ...vuoto, giocatoreId: "g1", certificatoScadenza: "2026-09-25", certificatoPath: "p1" },
  g2: { ...vuoto, giocatoreId: "g2", certificatoScadenza: "2026-09-25", certificatoPath: "p2" },
};
const alfabetico = avvisiCertificati(
  [
    { ...squadra[0]!, id: "g1", nome: "Ivan", cognome: "Zeta" },
    { ...squadra[0]!, id: "g2", nome: "Anna", cognome: "Alfa" },
  ],
  pariGiorni,
  oggiTest,
).inScadenza.map((a) => a.giocatoreId);
assert.deepEqual(alfabetico, ["g2", "g1"], "a parità di data, ordine alfabetico per cognome");

// soglia esatta (DD-035): 8 giorni fuori, 7 e 0 dentro
const rosaSoglia: GiocatoreSquadra[] = [
  { ...squadra[0]!, id: "g1", nome: "Ivan", cognome: "Cacciari" },
  { ...squadra[0]!, id: "g2", nome: "Anna", cognome: "Bruni" },
  { ...squadra[0]!, id: "g3", nome: "Marco", cognome: "Verdi" },
];
const profiliSoglia: Record<string, Profilo> = {
  g1: { ...vuoto, giocatoreId: "g1", certificatoScadenza: "2026-09-28", certificatoPath: "p1" }, // 8 giorni: fuori
  g2: { ...vuoto, giocatoreId: "g2", certificatoScadenza: "2026-09-27", certificatoPath: "p2" }, // 7 giorni: dentro
  g3: { ...vuoto, giocatoreId: "g3", certificatoScadenza: "2026-09-20", certificatoPath: "p3" }, // 0 giorni: dentro
};
const soglia = avvisiCertificati(rosaSoglia, profiliSoglia, oggiTest);
assert.deepEqual(
  soglia.inScadenza.map((a) => a.giocatoreId),
  ["g3", "g2"],
  "8 giorni resta valido, 7 e 0 generano avviso",
);
assert.equal(soglia.scaduti.length, 0);

// ordinamento tra scaduti: il più vecchio prima, poi alfabetico a parità di data
const rosaScaduti: GiocatoreSquadra[] = [
  { ...squadra[0]!, id: "g1", nome: "Ivan", cognome: "Zeta" },
  { ...squadra[0]!, id: "g2", nome: "Anna", cognome: "Alfa" },
  { ...squadra[0]!, id: "g3", nome: "Marco", cognome: "Verdi" },
];
const profiliScaduti: Record<string, Profilo> = {
  g1: { ...vuoto, giocatoreId: "g1", certificatoScadenza: "2026-09-01", certificatoPath: "p1" }, // scaduto da 19 giorni
  g2: { ...vuoto, giocatoreId: "g2", certificatoScadenza: "2026-09-01", certificatoPath: "p2" }, // pari data di g1
  g3: { ...vuoto, giocatoreId: "g3", certificatoScadenza: "2026-09-19", certificatoPath: "p3" }, // scaduto da 1 giorno
};
const scadutiOrdinati = avvisiCertificati(rosaScaduti, profiliScaduti, oggiTest).scaduti.map(
  (a) => a.giocatoreId,
);
assert.deepEqual(
  scadutiOrdinati,
  ["g2", "g1", "g3"],
  "il più vecchio prima, poi alfabetico a parità di data (Alfa prima di Zeta)",
);

// soglia del giocatore (DD-041): 30 giorni di preavviso invece di 7
const rosaMese: GiocatoreSquadra[] = [
  { ...squadra[0]!, id: "g1", nome: "Ivan", cognome: "Cacciari" },
  { ...squadra[0]!, id: "g2", nome: "Anna", cognome: "Bruni" },
  { ...squadra[0]!, id: "g3", nome: "Marco", cognome: "Verdi" },
];
const profiliMese: Record<string, Profilo> = {
  g1: { ...vuoto, giocatoreId: "g1", certificatoScadenza: "2026-10-21", certificatoPath: "p1" }, // 31 giorni: fuori
  g2: { ...vuoto, giocatoreId: "g2", certificatoScadenza: "2026-10-20", certificatoPath: "p2" }, // 30 giorni: dentro
  g3: { ...vuoto, giocatoreId: "g3", certificatoScadenza: "2026-09-10", certificatoPath: "p3" }, // scaduto
};
assert.equal(GIORNI_AVVISO_CERTIFICATO_GIOCATORE, 30);
const mese = avvisiCertificati(
  rosaMese,
  profiliMese,
  oggiTest,
  GIORNI_AVVISO_CERTIFICATO_GIOCATORE,
);
assert.deepEqual(
  mese.inScadenza.map((a) => a.giocatoreId),
  ["g2"],
  "31 giorni resta valido, 30 genera l'avviso del giocatore",
);
assert.deepEqual(
  mese.scaduti.map((a) => a.giocatoreId),
  ["g3"],
);
const staffMese = avvisiCertificati(rosaMese, profiliMese, oggiTest);
assert.equal(staffMese.inScadenza.length, 0, "senza soglia esplicita resta 7 giorni (staff)");
assert.deepEqual(
  staffMese.scaduti.map((a) => a.giocatoreId),
  ["g3"],
);

// avvisi per utente (DD-041): admin giocatore, admin puro, giocatore semplice
const rosaUtente: GiocatoreSquadra[] = [
  { ...squadra[0]!, id: "g1", nome: "Ivan", cognome: "Cacciari" },
  { ...squadra[0]!, id: "g2", nome: "Anna", cognome: "Bruni" },
];
const profiliUtente: Record<string, Profilo> = {
  g1: { ...vuoto, giocatoreId: "g1", certificatoScadenza: "2026-10-10", certificatoPath: "p1" }, // 20 giorni
  g2: { ...vuoto, giocatoreId: "g2", certificatoScadenza: "2026-09-25", certificatoPath: "p2" }, // 5 giorni
};
const adminGiocatore = avvisiCertificatiUtente(rosaUtente, profiliUtente, oggiTest, {
  admin: true,
  base: rosaUtente[0]!,
});
assert.equal(
  adminGiocatore.personale?.giocatoreId,
  "g1",
  "admin giocatore: avviso personale a 30 giorni",
);
assert.deepEqual(
  adminGiocatore.staff?.inScadenza.map((a) => a.giocatoreId),
  ["g2"],
  "lo staff non ripete il suo nome",
);
const adminPuro = avvisiCertificatiUtente(rosaUtente, profiliUtente, oggiTest, {
  admin: true,
  base: null,
});
assert.equal(adminPuro.personale, undefined);
assert.deepEqual(
  adminPuro.staff?.inScadenza.map((a) => a.giocatoreId),
  ["g2"],
  "admin non giocatore: solo staff a 7 giorni (g1 a 20 giorni escluso)",
);
const soloGiocatore = avvisiCertificatiUtente(rosaUtente, profiliUtente, oggiTest, {
  admin: false,
  base: rosaUtente[0]!,
});
assert.equal(soloGiocatore.personale?.giocatoreId, "g1");
assert.equal(soloGiocatore.staff, null, "il giocatore semplice non vede lo staff");
assert.equal(soloGiocatore.personaleMancante, false);

// DD-046: chi non ha caricato il certificato lo vede nel personale; l'admin lo vede anche per gli altri
const adminSenzaFile = avvisiCertificatiUtente(rosaUtente, {}, oggiTest, {
  admin: true,
  base: rosaUtente[0]!,
});
assert.equal(adminSenzaFile.personaleMancante, true);
assert.equal(adminSenzaFile.personale, undefined);
assert.deepEqual(
  adminSenzaFile.staff?.mancanti.map((m) => m.giocatoreId),
  ["g2"],
  "lo staff non ripete il suo nome tra i mancanti",
);
assert.equal(
  avvisiCertificatiUtente(rosaUtente, {}, oggiTest, { admin: true, base: null }).personaleMancante,
  false,
  "admin non giocatore: nessun avviso personale",
);

console.log("profili-core: ok");
