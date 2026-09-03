import { giocatori, type Giocatore } from "./crapp-data";
import type { Evento } from "./eventi";
import type { MappaPresenze } from "./presenze";
import { mediaSquadra, type VotoPagella } from "./pagelle";

export type ObiettivoSquadra = {
  id: string;
  titolo: string;
  descrizione: string;
  valore: number;
  target: number;
  unita: string;
  scadenza?: string;
  emoji: string;
  /** Frase breve che spiega come ogni giocatore può spostare l'ago. */
  impatto: string;
};

export type ContestoObiettivi = {
  eventi: Evento[];
  presenze: MappaPresenze;
  pagelle: VotoPagella[];
  /** Vittorie ufficiali in campionato (dato CSI). */
  vittorie?: number;
};

export const contestoVuoto: ContestoObiettivi = { eventi: [], presenze: {}, pagelle: [] };

const MESE = "2026-08";

function percentualePresenzeMese(ctx: ContestoObiettivi, rosaSize: number) {
  const delMese = ctx.eventi.filter(
    (e) => e.data.startsWith(MESE) && (e.tipo === "partita" || e.tipo === "allenamento"),
  );
  if (delMese.length === 0 || rosaSize === 0) return 0;
  const posti = delMese.length * rosaSize;
  const presenti = delMese.reduce((s, e) => {
    const risposte = ctx.presenze[e.id] ?? {};
    return s + Object.values(risposte).filter((x) => x === "presente" || x === "ritardo").length;
  }, 0);
  return Math.round((presenti / posti) * 100);
}

function percentualeRisposte(ctx: ContestoObiettivi, rosaSize: number) {
  const daRispondere = ctx.eventi.filter((e) => e.tipo !== "compleanno");
  if (daRispondere.length === 0 || rosaSize === 0) return 0;
  const posti = daRispondere.length * rosaSize;
  const risposte = daRispondere.reduce(
    (s, e) => s + Object.keys(ctx.presenze[e.id] ?? {}).length,
    0,
  );
  return Math.round((risposte / posti) * 100);
}

/** Obiettivi collaborativi: si muovono con il contributo di tutta la rosa. */
export function obiettiviSquadra(
  rosa: Giocatore[] = giocatori,
  ctx: ContestoObiettivi = contestoVuoto,
): ObiettivoSquadra[] {
  const somma = (f: (g: Giocatore) => number) => rosa.reduce((s, g) => s + f(g), 0);
  const continui = rosa.filter((g) => g.serieAllenamenti >= 3).length;
  const vittorie = ctx.vittorie ?? 0;
  return [
    {
      id: "o1",
      titolo: "90% di presenze ad agosto",
      descrizione: "Media presenze su partite e allenamenti del mese",
      valore: percentualePresenzeMese(ctx, rosa.length),
      target: 90,
      unita: "%",
      scadenza: "2026-08-31",
      emoji: "📣",
      impatto: "Ogni sì in più alza la media di tutta la squadra.",
    },
    {
      id: "o2",
      titolo: "Tutti rispondono alle convocazioni",
      descrizione: "Percentuale di risposte date sugli eventi in programma",
      valore: percentualeRisposte(ctx, rosa.length),
      target: 90,
      unita: "%",
      scadenza: "2026-09-30",
      emoji: "⚡",
      impatto: "Bastano pochi tap per far quadrare i conti a chi organizza.",
    },
    {
      id: "o7",
      titolo: "250 presenze complessive",
      descrizione: "Somma delle presenze di tutta la rosa in stagione",
      valore: somma((g) => g.presenze),
      target: 250,
      unita: "presenze",
      emoji: "🤝",
      impatto: "Ogni allenamento a cui vieni vale +1 per il gruppo.",
    },
    {
      id: "o12",
      titolo: "Media pagelle da 7.5",
      descrizione: "Media di tutti i voti che ci diamo dopo le partite",
      valore: mediaSquadra(ctx.pagelle),
      target: 7.5,
      unita: "di media",
      emoji: "📝",
      impatto: "Prestazioni di gruppo: la media sale se giochiamo da squadra.",
    },
    {
      id: "o13",
      titolo: "200 pagelle compilate",
      descrizione: "Quanti voti la squadra ha dato nel corso della stagione",
      valore: ctx.pagelle.length,
      target: 200,
      unita: "voti",
      emoji: "🗳️",
      impatto: "Vota i compagni a fine partita: bastano due minuti.",
    },
    {
      id: "o11",
      titolo: "Continuità di squadra",
      descrizione: "Giocatori con almeno 3 allenamenti consecutivi",
      valore: continui,
      target: 12,
      unita: "giocatori",
      emoji: "🔗",
      impatto: "Tieni viva la tua serie e sblocchi anche questo.",
    },
    {
      id: "o3",
      titolo: "Prima vittoria del campionato",
      descrizione: "Sbloccare la stagione con i primi 3 punti",
      valore: Math.min(vittorie, 1),
      target: 1,
      unita: "vittorie",
      emoji: "🎉",
      impatto: "Una prestazione di gruppo e il primo passo è fatto.",
    },
    {
      id: "o4",
      titolo: "5 vittorie in campionato",
      descrizione: "Metà strada verso la zona playoff",
      valore: Math.min(vittorie, 5),
      target: 5,
      unita: "vittorie",
      emoji: "🔥",
      impatto: "Ogni vittoria ci avvicina ai playoff.",
    },
    {
      id: "o5",
      titolo: "10 vittorie in campionato",
      descrizione: "Obiettivo stagionale per il podio",
      valore: vittorie,
      target: 10,
      unita: "vittorie",
      emoji: "🏆",
      impatto: "L'obiettivo grande: serve tutta la stagione insieme.",
    },
    {
      id: "o6",
      titolo: "1 evento di squadra al mese",
      descrizione: "Pizzate, cene e uscite fuori dal campo",
      valore: ctx.eventi.filter((e) => e.tipo === "evento" && e.data.startsWith(MESE)).length,
      target: 1,
      unita: "eventi",
      emoji: "🍕",
      impatto: "Il gruppo si costruisce anche fuori dal campo.",
    },
  ];
}

export function progressoObiettivo(o: ObiettivoSquadra) {
  return Math.min(100, Math.round((o.valore / o.target) * 100));
}

export function obiettiviOrdinati(rosa?: Giocatore[], ctx?: ContestoObiettivi) {
  return obiettiviSquadra(rosa, ctx).sort((a, b) => {
    const pa = progressoObiettivo(a);
    const pb = progressoObiettivo(b);
    const ca = pa >= 100 ? 1 : 0;
    const cb = pb >= 100 ? 1 : 0;
    if (ca !== cb) return ca - cb;
    return pb - pa;
  });
}

/** Microcopy motivazionale per un obiettivo di squadra. */
export function microcopyObiettivo(o: ObiettivoSquadra) {
  const pct = progressoObiettivo(o);
  const manca = Math.max(0, Math.round((o.target - o.valore) * 10) / 10);
  if (pct >= 100) return "Obiettivo centrato: grande squadra!";
  if (pct >= 90) return `Ci siamo quasi: mancano ${manca} ${o.unita}.`;
  if (pct >= 50) return `Oltre metà strada: ancora ${manca} ${o.unita}.`;
  if (pct > 0) return `Si parte: ${manca} ${o.unita} al traguardo.`;
  return "Tocca a noi far partire questo obiettivo.";
}
