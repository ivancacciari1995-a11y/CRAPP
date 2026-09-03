export type Stato = "presente" | "assente" | "forse" | "ritardo" | "infortunato";

export const statoMeta: Record<Stato, { label: string; emoji: string; className: string }> = {
  presente: { label: "Presente", emoji: "✅", className: "bg-success text-success-foreground" },
  assente: {
    label: "Assente",
    emoji: "❌",
    className: "bg-destructive text-destructive-foreground",
  },
  forse: { label: "Forse", emoji: "🤔", className: "bg-warning text-warning-foreground" },
  ritardo: { label: "In ritardo", emoji: "⏱️", className: "bg-info text-info-foreground" },
  infortunato: {
    label: "Infortunato",
    emoji: "🩹",
    className: "bg-primary text-primary-foreground",
  },
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

export function dividiNome(completo: string): { nome: string; cognome: string } {
  const spazio = completo.indexOf(" ");
  if (spazio < 0) return { nome: completo, cognome: "" };
  return { nome: completo.slice(0, spazio), cognome: completo.slice(spazio + 1) };
}

export const giocatori: Giocatore[] = rosaCSI
  .map((r, i) => ({
    id: `g${i + 1}`,
    nome: r.nome,
    numero: r.numero ?? 0,
    ruolo: r.ruolo,
    nascita: r.nascita,
    iniziali: inizialiDa(r.nome),
    presenze: 0,
    totaliEventi: 0,
    streak: 0,
    serieAllenamenti: 0,
    seriePartite: 0,
    serieConferme: 0,
    mvp: 0,
    mediaVoto: 0,
    infortuni: 0,
    ritardi: 0,
    palloni: 0,
    cacche: 0,
    cacchePartita: 0,
  }))
  .sort((a, b) => dividiNome(a.nome).cognome.localeCompare(dividiNome(b.nome).cognome, "it"));

/**
 * Fallback per la data di nascita: `giocatori_squadra` non ha ancora questa colonna
 * (DD-015 follow-up). Un giocatore aggiunto dopo la migrazione non ha nascita nota.
 */
export const nascitaPerId: Record<string, string> = Object.fromEntries(
  giocatori.map((g) => [g.id, g.nascita]),
);

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

export function formatData(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "long" });
}

/* I permessi di amministrazione stanno in `user_roles` (DD-011), non in una lista di nomi:
   vedi `src/lib/ruoli.ts`. */
