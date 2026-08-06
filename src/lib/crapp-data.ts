export type Stato = "presente" | "assente" | "forse" | "ritardo" | "infortunato";

export const statoMeta: Record<Stato, { label: string; emoji: string; className: string }> = {
  presente: { label: "Presente", emoji: "✅", className: "bg-success text-success-foreground" },
  assente: { label: "Assente", emoji: "❌", className: "bg-destructive text-destructive-foreground" },
  forse: { label: "Forse", emoji: "🤔", className: "bg-warning text-warning-foreground" },
  ritardo: { label: "In ritardo", emoji: "⏱️", className: "bg-info text-info-foreground" },
  infortunato: { label: "Infortunato", emoji: "🩹", className: "bg-primary text-primary-foreground" },
};

/**
 * Statistiche personali: solo dati equi per tutti i ruoli.
 * Punti, ace e muri restano nello Scout Live come dato tecnico di squadra.
 */
export type Giocatore = {
  id: string;
  nome: string;
  numero: number;
  ruolo: string;
  nascita: string;
  presenze: number;
  totaliEventi: number;
  streak: number;
  /** Serie consecutive per tipo: si azzerano in modo indipendente. */
  serieAllenamenti: number;
  seriePartite: number;
  serieConferme: number;
  /** MVP eletti dalla squadra. */
  mvp: number;
  /** Media delle pagelle ricevute dai compagni (1-10). */
  mediaVoto: number;
  /** Quante volte ha portato i palloni. */
  palloni: number;
  /** Partite di campionato con almeno 3 cacche dichiarate. */
  cacche: number;
  /** Media di cacche dichiarate per partita. */
  cacchePartita: number;
  /** Eventi (allenamenti o partite) saltati per infortunio. */
  infortuni: number;
  /** Eventi (allenamenti o partite) a cui sei arrivato in ritardo. */
  ritardi: number;
  iniziali: string;
};

type Rosa = { nome: string; nascita: string; ruolo: string; numero?: number };

/** Rosa reale CRAP Volley (tesseramento CSI Bologna 25/26). */
const rosaCSI: Rosa[] = [
  { nome: "Salvador Battistella", nascita: "1997-08-30", ruolo: "Libero", numero: 88 },
  { nome: "Mattias Bologna", nascita: "1996-12-07", ruolo: "Centrale", numero: 73 },
  { nome: "Alessandra Brunacci", nascita: "2000-04-28", ruolo: "Palleggiatore", numero: 8 },
  { nome: "Ivan Cacciari", nascita: "1995-05-01", ruolo: "Banda", numero: 23 },
  { nome: "Mattia Catalano", nascita: "1995-08-13", ruolo: "Palleggiatore", numero: 21 },
  { nome: "Silvia Chilese", nascita: "1996-02-01", ruolo: "Libero", numero: 11 },
  { nome: "Alessio Cocco", nascita: "1997-07-04", ruolo: "Centrale", numero: 77 },
  { nome: "Carlo Di Castelnuovo", nascita: "1994-05-28", ruolo: "Opposto", numero: 14 },
  { nome: "Camilla Esposito", nascita: "2003-04-04", ruolo: "Palleggiatore", numero: 7 },
  { nome: "Davide Grilli", nascita: "1998-11-30", ruolo: "Opposto", numero: 1 },
  { nome: "Antonella Loverre", nascita: "2000-02-02", ruolo: "Banda", numero: 22 },
  { nome: "Laura Passabì", nascita: "1999-10-03", ruolo: "Banda", numero: 5 },
  { nome: "Nicola Pezzoli", nascita: "2000-09-16", ruolo: "Centrale", numero: 4 },
  { nome: "Iacopo Ricci", nascita: "1996-12-13", ruolo: "Banda", numero: 2 },
  { nome: "Cristina Titone", nascita: "1993-03-24", ruolo: "Libero", numero: 3 },
  { nome: "Francesca Tucci", nascita: "2001-04-18", ruolo: "Centrale", numero: 18 },
  { nome: "Giada Valbonesi", nascita: "1994-05-20", ruolo: "Opposto", numero: 10 },
];

function inizialiDa(nome: string) {
  return nome
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type StatsDemo = Pick<Giocatore, "presenze" | "streak" | "mvp" | "mediaVoto">;

/** Statistiche demo: mix di badge bronzo / argento / oro già sbloccati. */
const statsDemo: Record<string, StatsDemo> = {
  "Ivan Cacciari": { presenze: 31, streak: 8, mvp: 5, mediaVoto: 8.7 },
  "Davide Grilli": { presenze: 27, streak: 5, mvp: 3, mediaVoto: 8.4 },
  "Nicola Pezzoli": { presenze: 24, streak: 4, mvp: 2, mediaVoto: 8.2 },
  "Laura Passabì": { presenze: 22, streak: 6, mvp: 3, mediaVoto: 8.1 },
  "Francesca Tucci": { presenze: 19, streak: 3, mvp: 1, mediaVoto: 7.9 },
  "Iacopo Ricci": { presenze: 21, streak: 2, mvp: 3, mediaVoto: 7.8 },
  "Alessandra Brunacci": { presenze: 14, streak: 3, mvp: 1, mediaVoto: 7.5 },
  "Mattias Bologna": { presenze: 12, streak: 2, mvp: 1, mediaVoto: 7.4 },
  "Giada Valbonesi": { presenze: 13, streak: 4, mvp: 1, mediaVoto: 7.6 },
  "Alessio Cocco": { presenze: 11, streak: 1, mvp: 0, mediaVoto: 7.2 },
  "Mattia Catalano": { presenze: 9, streak: 2, mvp: 0, mediaVoto: 7.0 },
  "Antonella Loverre": { presenze: 8, streak: 1, mvp: 0, mediaVoto: 6.9 },
  "Carlo Di Castelnuovo": { presenze: 7, streak: 1, mvp: 0, mediaVoto: 6.8 },
  "Camilla Esposito": { presenze: 6, streak: 2, mvp: 0, mediaVoto: 6.7 },
  "Salvador Battistella": { presenze: 20, streak: 5, mvp: 1, mediaVoto: 7.7 },
  "Silvia Chilese": { presenze: 16, streak: 3, mvp: 0, mediaVoto: 7.3 },
  "Cristina Titone": { presenze: 15, streak: 2, mvp: 0, mediaVoto: 7.1 },
};

/** Serie demo derivate dalle statistiche: ogni tipo ha il suo contatore. */
function serieDa(s?: StatsDemo) {
  const streak = s?.streak ?? 0;
  const presenze = s?.presenze ?? 0;
  return {
    serieAllenamenti: streak,
    seriePartite: Math.ceil(streak / 2),
    serieConferme: presenze >= 20 ? 12 : presenze >= 14 ? 8 : presenze >= 8 ? 4 : 1,
  };
}

export const giocatori: Giocatore[] = rosaCSI.map((r, i) => ({
  id: `g${i + 1}`,
  nome: r.nome,
  numero: r.numero ?? 0,
  ruolo: r.ruolo,
  nascita: r.nascita,
  iniziali: inizialiDa(r.nome),
  totaliEventi: 32,
  infortuni: 0,
  ritardi: 0,
  palloni: 0,
  cacche: 0,
  cacchePartita: 0,
  ...(statsDemo[r.nome] ?? { presenze: 0, streak: 0, mvp: 0, mediaVoto: 0 }),
  ...serieDa(statsDemo[r.nome]),
}));

export type Match = {
  id: string;
  data: string;
  avversario: string;
  casa: boolean;
  setNostri: number;
  setLoro: number;
  parziali: Array<[number, number]>;
  mvp: string;
};

export const storicoMatch: Match[] = [
  { id: "m1", data: "2026-07-25", avversario: "Pallavolo Sesto", casa: true, setNostri: 3, setLoro: 1, parziali: [[25, 19], [23, 25], [25, 21], [25, 18]], mvp: "Davide Grilli" },
  { id: "m2", data: "2026-07-18", avversario: "ASD Rondinella", casa: false, setNostri: 2, setLoro: 3, parziali: [[25, 22], [19, 25], [25, 23], [20, 25], [12, 15]], mvp: "Ivan Cacciari" },
  { id: "m3", data: "2026-07-11", avversario: "Virtus Cinisello", casa: true, setNostri: 3, setLoro: 0, parziali: [[25, 15], [25, 20], [25, 17]], mvp: "Laura Passabì" },
  { id: "m4", data: "2026-07-04", avversario: "Nuova Bovisa", casa: false, setNostri: 3, setLoro: 2, parziali: [[21, 25], [25, 23], [18, 25], [25, 20], [15, 11]], mvp: "Nicola Pezzoli" },
];

export type RigaClassifica = {
  pos: number;
  squadra: string;
  giocate: number;
  vinte: number;
  perse: number;
  setFatti: number;
  setSubiti: number;
  punti: number;
};

export const classifica: RigaClassifica[] = [
  { pos: 1, squadra: "ASD Rondinella", giocate: 12, vinte: 10, perse: 2, setFatti: 33, setSubiti: 12, punti: 29 },
  { pos: 2, squadra: "CRAP Volley", giocate: 12, vinte: 9, perse: 3, setFatti: 31, setSubiti: 16, punti: 26 },
  { pos: 3, squadra: "Pallavolo Sesto", giocate: 12, vinte: 8, perse: 4, setFatti: 29, setSubiti: 19, punti: 24 },
  { pos: 4, squadra: "Volley Bruzzano", giocate: 12, vinte: 7, perse: 5, setFatti: 26, setSubiti: 21, punti: 21 },
  { pos: 5, squadra: "Aurora Nera", giocate: 12, vinte: 5, perse: 7, setFatti: 22, setSubiti: 25, punti: 16 },
  { pos: 6, squadra: "Virtus Cinisello", giocate: 12, vinte: 3, perse: 9, setFatti: 15, setSubiti: 30, punti: 10 },
  { pos: 7, squadra: "Nuova Bovisa", giocate: 12, vinte: 2, perse: 10, setFatti: 13, setSubiti: 32, punti: 7 },
];

export function formatData(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "long" });
}

/** Referenti che possono gestire eventi e sollecitare le risposte. */
export const adminNomi = ["Ivan Cacciari", "Iacopo Ricci", "Cristina Titone"];

export function isAdmin(giocatoreId: string) {
  const g = giocatori.find((x) => x.id === giocatoreId);
  return Boolean(g && adminNomi.includes(g.nome));
}
