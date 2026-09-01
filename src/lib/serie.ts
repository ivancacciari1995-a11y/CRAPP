import { Dumbbell, Swords, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Giocatore } from "./crapp-data";

export type SerieTipo = "allenamenti" | "partite" | "conferme";

export type SerieDef = {
  tipo: SerieTipo;
  label: string;
  descrizione: string;
  icon: LucideIcon;
  /** Traguardi progressivi della serie. */
  traguardi: number[];
  valore: (g: Giocatore) => number;
};

export const serieDefs: SerieDef[] = [
  {
    tipo: "allenamenti",
    label: "Allenamenti",
    descrizione: "Allenamenti consecutivi con presenza",
    icon: Dumbbell,
    traguardi: [3, 6, 10, 15],
    valore: (g) => g.serieAllenamenti,
  },
  {
    tipo: "partite",
    label: "Partite",
    descrizione: "Partite consecutive in cui c'eri",
    icon: Swords,
    traguardi: [2, 5, 8, 12],
    valore: (g) => g.seriePartite,
  },
  {
    tipo: "conferme",
    label: "Conferme 24h",
    descrizione: "Risposte date entro 24 ore dalla convocazione",
    icon: Zap,
    traguardi: [3, 8, 15, 20],
    valore: (g) => g.serieConferme,
  },
];

export type SerieStato = {
  def: SerieDef;
  valore: number;
  prossimo: number | null;
  manca: number;
  progresso: number;
  messaggio: string;
};

/** Regola di aggiornamento: +1 se l'impegno è stato onorato, altrimenti
 *  si azzera SOLO questa serie, lasciando intatte le altre. */
export function aggiornaSerie(valore: number, onorato: boolean) {
  return onorato ? valore + 1 : 0;
}

function messaggioSerie(valore: number, prossimo: number | null, label: string) {
  if (valore === 0) return `Serie ${label.toLowerCase()} azzerata: riparti dal prossimo.`;
  if (prossimo === null) return "Serie leggendaria: sei fuori scala!";
  const manca = prossimo - valore;
  if (manca === 1) return "Manca solo una volta al prossimo traguardo!";
  if (valore >= 5) return `Che continuità: ancora ${manca} e sali di livello.`;
  return `Bella partenza: ${manca} al prossimo traguardo.`;
}

export function statoSerie(def: SerieDef, g: Giocatore): SerieStato {
  const valore = def.valore(g);
  const prossimo = def.traguardi.find((t) => valore < t) ?? null;
  const manca = prossimo ? prossimo - valore : 0;
  const progresso = prossimo ? Math.min(100, Math.round((valore / prossimo) * 100)) : 100;
  return {
    def,
    valore,
    prossimo,
    manca,
    progresso,
    messaggio: messaggioSerie(valore, prossimo, def.label),
  };
}

export function serieGiocatore(g: Giocatore): SerieStato[] {
  return serieDefs.map((def) => statoSerie(def, g));
}

/** La serie migliore da mostrare in home. */
export function serieMigliore(g: Giocatore): SerieStato {
  return serieGiocatore(g).sort((a, b) => b.valore - a.valore)[0]!;
}
