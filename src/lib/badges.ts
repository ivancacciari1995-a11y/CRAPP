import {
  Trophy,
  Repeat,
  Lock,
  Ghost,
  Zap,
  Rocket,
  Anchor,
  Stethoscope,
  AlarmClock,
  ClipboardCheck,
  CircleDot,
  Toilet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Giocatore } from "./crapp-data";

export type Grado = "bronzo" | "argento" | "oro";

export const gradiOrdine: Grado[] = ["bronzo", "argento", "oro"];

/**
 * `text` usa i token `-testo` (varianti scurite): l'oro e l'argento chiari
 * stanno sotto 2.5:1 su bianco e come colore di testo sono illeggibili.
 * Le versioni chiare restano su sfondi e bordi, dove il contrasto non conta.
 */
export const gradoMeta: Record<Grado, { label: string; text: string; bg: string; ring: string }> = {
  bronzo: {
    label: "Bronzo",
    text: "text-bronzo-testo",
    bg: "bg-bronzo/15",
    ring: "ring-bronzo/40",
  },
  argento: {
    label: "Argento",
    text: "text-argento-testo",
    bg: "bg-argento/20",
    ring: "ring-argento/50",
  },
  oro: { label: "Oro", text: "text-oro-testo", bg: "bg-oro/20", ring: "ring-oro/50" },
};

export type BadgeDef = {
  id: string;
  nome: string;
  descrizione: string;
  unita: string;
  icon: LucideIcon;
  soglie: Record<Grado, number>;
  valore: (g: Giocatore) => number;
  /** Badge segreto: nome e requisiti restano nascosti finché non si sblocca. */
  segreto?: boolean;
  /** Frase celebrativa mostrata allo sblocco. */
  celebrazione?: string;
  /** Emoji usata nella celebrazione e nella notifica push. */
  emoji?: string;
  /** Testo della notifica push allo sblocco. */
  notificaPush?: string;
};

export const badgeDefs: BadgeDef[] = [
  {
    id: "mvp",
    nome: "MVP",
    descrizione:
      "Riconoscimento per il miglior giocatore della partita, scelto dai compagni a fine match.",
    unita: "MVP",
    icon: Trophy,
    soglie: { bronzo: 1, argento: 3, oro: 5 },
    valore: (g) => g.mvp,
  },
  {
    id: "pagella",
    nome: "Pagellone",
    descrizione:
      "Media dei voti che i compagni ti danno a fine partita: conta come giochi, non quanti punti fai.",
    unita: "di media voto",
    icon: ClipboardCheck,
    soglie: { bronzo: 6.5, argento: 7.5, oro: 8.5 },
    valore: (g) => g.mediaVoto,
  },
  {
    id: "palloni",
    nome: "Sherpa dei palloni",
    descrizione:
      "Quante volte ti sei caricato la sacca dei palloni: lavoro oscuro, badge luminoso.",
    unita: "turni palloni",
    icon: CircleDot,
    soglie: { bronzo: 3, argento: 6, oro: 10 },
    valore: (g) => g.palloni,
  },
  {
    id: "presenze",
    nome: "Presenza fissa",
    descrizione: "Per chi è sempre lì, partita dopo partita, senza tirarsi indietro.",
    unita: "presenze",
    icon: Repeat,
    soglie: { bronzo: 5, argento: 15, oro: 30 },
    valore: (g) => g.presenze,
  },
  {
    id: "serie-allenamenti",
    nome: "Sempre in palestra",
    descrizione:
      "Allenamenti consecutivi a cui sei stato presente: la costanza paga più del talento.",
    unita: "allenamenti di fila",
    icon: Rocket,
    soglie: { bronzo: 3, argento: 6, oro: 10 },
    valore: (g) => g.serieAllenamenti,
  },
  {
    id: "serie-conferme",
    nome: "Risposta lampo",
    descrizione: "Conferme rapide agli eventi: la squadra sa subito che ci sei.",
    unita: "conferme entro 24h",
    icon: Zap,
    soglie: { bronzo: 3, argento: 8, oro: 15 },
    valore: (g) => g.serieConferme,
  },
];

/** Badge segreti: non compaiono nella UI finché non vengono sbloccati. */
export const badgeSegreti: BadgeDef[] = [
  {
    id: "s-tiebreak",
    nome: "Uomo tie-break",
    descrizione:
      "Sbloccato da chi ha almeno 2 MVP e una media voto alta: nei momenti caldi ci sei sempre.",
    unita: "MVP con media alta",
    icon: Ghost,
    segreto: true,
    soglie: { bronzo: 1, argento: 1, oro: 1 },
    valore: (g) => (g.mvp >= 2 && g.mediaVoto >= 8 ? 1 : 0),
    celebrazione: "Nei momenti caldi ci sei sempre.",
  },
  {
    id: "s-mai-forfait",
    nome: "Mai un forfait",
    descrizione:
      "Sbloccato con 10 conferme rapide consecutive e 15 presenze: su di te la squadra può contare a occhi chiusi.",
    unita: "requisito nascosto",
    icon: Anchor,
    segreto: true,
    soglie: { bronzo: 1, argento: 1, oro: 1 },
    valore: (g) => (g.serieConferme >= 10 && g.presenze >= 15 ? 1 : 0),
    celebrazione: "Su di te la squadra può contare a occhi chiusi.",
  },
  {
    id: "s-infermeria",
    nome: "Cliente VIP dell'Infermeria",
    descrizione:
      "Hai saltato almeno 3 allenamenti o partite per infortunio. L'infermeria ormai ti aspetta con il caffè pronto ☕😂",
    unita: "eventi da infortunato",
    icon: Stethoscope,
    segreto: true,
    emoji: "🩺",
    soglie: { bronzo: 1, argento: 1, oro: 1 },
    valore: (g) => (g.infortuni >= 3 ? 1 : 0),
    celebrazione: "L'infermeria ormai ti aspetta con il caffè pronto ☕😂",
    notificaPush: "Speriamo che sia l'ultimo! 😅",
  },
  {
    id: "s-ritardi",
    nome: "Aspettate, arrivo!",
    descrizione:
      "Hai collezionato almeno 5 ritardi. Il tuo messaggio preferito è: 'Aspettate, arrivo!' 😅",
    unita: "eventi in ritardo",
    icon: AlarmClock,
    segreto: true,
    emoji: "⏰",
    soglie: { bronzo: 1, argento: 1, oro: 1 },
    valore: (g) => (g.ritardi >= 5 ? 1 : 0),
    celebrazione:
      "Hai collezionato almeno 5 ritardi. Il tuo messaggio preferito è: 'Aspettate, arrivo!' 😅",
    notificaPush: "Forse è il momento di puntare la sveglia 10 minuti prima! 😄",
  },
  {
    id: "s-cacche",
    nome: "Trono di ferro",
    descrizione:
      "Almeno 3 partite di campionato affrontate con 3 o più cacche pre-gara. Il bagno del PalaCRAP porta il tuo nome 🚽😂",
    unita: "partite da record",
    icon: Toilet,
    segreto: true,
    emoji: "🚽",
    soglie: { bronzo: 1, argento: 1, oro: 1 },
    valore: (g) => (g.cacche >= 3 ? 1 : 0),
    celebrazione: "Il bagno del PalaCRAP porta ufficialmente il tuo nome 🚽😂",
    notificaPush: "Scarico completo: badge segreto sbloccato! 😄",
  },
];

export const tuttiBadge: BadgeDef[] = [...badgeDefs, ...badgeSegreti];

export const iconaSegreto = Lock;

export type BadgeStato = {
  def: BadgeDef;
  valore: number;
  grado: Grado | null;
  prossimo: Grado | null;
  prossimaSoglia: number | null;
  progresso: number;
};

export function gradoRaggiunto(def: BadgeDef, valore: number): Grado | null {
  let grado: Grado | null = null;
  for (const g of gradiOrdine) if (valore >= def.soglie[g]) grado = g;
  return grado;
}

export function statoBadge(def: BadgeDef, g: Giocatore): BadgeStato {
  const valore = def.valore(g);
  const grado = gradoRaggiunto(def, valore);
  const prossimo = gradiOrdine.find((x) => valore < def.soglie[x]) ?? null;
  const prossimaSoglia = prossimo ? def.soglie[prossimo] : null;
  const progresso = prossimaSoglia
    ? Math.min(100, Math.round((valore / prossimaSoglia) * 100))
    : 100;
  return { def, valore, grado, prossimo, prossimaSoglia, progresso };
}

export function badgeGiocatore(g: Giocatore): BadgeStato[] {
  return badgeDefs.map((def) => statoBadge(def, g));
}

/** Badge segreti già sbloccati dal giocatore. */
export function badgeSegretiSbloccati(g: Giocatore): BadgeStato[] {
  return badgeSegreti.map((def) => statoBadge(def, g)).filter((b) => b.grado !== null);
}

/** Quanti segreti restano da scoprire. */
export function segretiNascosti(g: Giocatore) {
  return badgeSegreti.length - badgeSegretiSbloccati(g).length;
}

export type Collezione = {
  sbloccati: BadgeStato[];
  inProgresso: BadgeStato[];
  segreti: BadgeStato[];
  nascosti: number;
  totali: number;
  ottenuti: number;
};

export function collezioneBadge(g: Giocatore): Collezione {
  const normali = badgeGiocatore(g);
  const segreti = badgeSegretiSbloccati(g);
  const sbloccati = normali.filter((b) => b.grado !== null);
  return {
    sbloccati,
    inProgresso: normali.filter((b) => b.grado === null),
    segreti,
    nascosti: badgeSegreti.length - segreti.length,
    totali: tuttiBadge.length,
    ottenuti: sbloccati.length + segreti.length,
  };
}

/** Il traguardo più vicino: il badge a cui manca meno, in proporzione. */
export function prossimoTraguardo(g: Giocatore): BadgeStato | null {
  const candidati = badgeGiocatore(g).filter((b) => b.prossimaSoglia !== null);
  if (candidati.length === 0) return null;
  return candidati.sort((a, b) => b.progresso - a.progresso)[0]!;
}

/** Riga "Ti mancano X per il prossimo livello". */
export function mancanoPer(b: BadgeStato) {
  if (!b.prossimaSoglia || !b.prossimo) return "Livello massimo raggiunto";
  const manca = b.prossimaSoglia - b.valore;
  return `Ti mancano ${manca} ${b.def.unita} per il ${gradoMeta[b.prossimo].label.toLowerCase()}`;
}

/** Microcopy motivazionale in base a quanto sei vicino. */
export function microcopyBadge(b: BadgeStato) {
  if (!b.prossimaSoglia) return "Hai fatto tutto: badge d'oro in bacheca.";
  if (b.progresso >= 90) return "Ci sei quasi: un ultimo sforzo!";
  if (b.progresso >= 60) return "Sei in piena corsa, continua così.";
  if (b.progresso >= 25) return "Buon ritmo, il prossimo livello si avvicina.";
  return "Ogni partita conta: si parte da qui.";
}

export function badgeSbloccati(g: Giocatore): BadgeStato[] {
  return badgeGiocatore(g).filter((b) => b.grado !== null);
}

export function descrizioneSoglie(def: BadgeDef) {
  return `${def.soglie.bronzo}/${def.soglie.argento}/${def.soglie.oro} ${def.unita}`;
}
