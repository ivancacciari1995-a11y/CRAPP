import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { giocatori, type Giocatore } from "./crapp-data";

export type AzioneTipo = "attacco" | "ace" | "muro" | "errore" | "punto_avv" | "errore_avv";

export const azioniMeta: Record<
  AzioneTipo,
  { label: string; short: string; nostro: boolean; richiedeGiocatore: boolean; className: string }
> = {
  attacco: {
    label: "Punto attacco",
    short: "Punto",
    nostro: true,
    richiedeGiocatore: true,
    className: "bg-accent text-accent-foreground",
  },
  ace: {
    label: "Ace",
    short: "Ace",
    nostro: true,
    richiedeGiocatore: true,
    className: "bg-success text-success-foreground",
  },
  muro: {
    label: "Muro",
    short: "Muro",
    nostro: true,
    richiedeGiocatore: true,
    className: "bg-info text-info-foreground",
  },
  errore: {
    label: "Errore nostro",
    short: "Errore",
    nostro: false,
    richiedeGiocatore: true,
    className: "bg-destructive text-destructive-foreground",
  },
  punto_avv: {
    label: "Punto avversario",
    short: "Punto avv.",
    nostro: false,
    richiedeGiocatore: false,
    className: "bg-muted text-muted-foreground",
  },
  errore_avv: {
    label: "Errore avversario",
    short: "Err. avv.",
    nostro: true,
    richiedeGiocatore: false,
    className: "bg-secondary text-foreground",
  },
};

export type Azione = {
  id: string;
  tipo: AzioneTipo;
  giocatoreId?: string;
  set: number;
  ts: number;
};

/** I fondamentali valutabili con − / + durante lo scout (non toccano il punteggio). */
export type Fondamentale = "battuta" | "ricezione" | "attacco" | "muro";

export const fondamentali: Array<{ id: Fondamentale; label: string }> = [
  { id: "battuta", label: "Battuta" },
  { id: "ricezione", label: "Ricezione" },
  { id: "attacco", label: "Attacco" },
  { id: "muro", label: "Muro" },
];

export type Valutazione = {
  id: string;
  giocatoreId: string;
  fondamentale: Fondamentale;
  segno: "+" | "-";
  set: number;
  ts: number;
};

export type ConteggioValutazioni = Record<Fondamentale, { piu: number; meno: number }>;

/** Conta i + e i − di un giocatore per fondamentale, in un set (o in tutti se `set` manca). */
export function contaValutazioni(
  valutazioni: Valutazione[],
  giocatoreId: string,
  set?: number,
): ConteggioValutazioni {
  const out = {} as ConteggioValutazioni;
  for (const f of fondamentali) out[f.id] = { piu: 0, meno: 0 };
  for (const v of valutazioni) {
    if (v.giocatoreId !== giocatoreId || (set !== undefined && v.set !== set)) continue;
    out[v.fondamentale][v.segno === "+" ? "piu" : "meno"] += 1;
  }
  return out;
}

/**
 * Riepilogo delle valutazioni per la lettura nell'app: totali di squadra e per giocatore,
 * su tutta la partita o su un solo set. Chi non ha valutazioni nel periodo non compare.
 */
export function sintesiValutazioni(valutazioni: Valutazione[], set?: number) {
  const filtrate = set === undefined ? valutazioni : valutazioni.filter((v) => v.set === set);
  const squadra = contaValutazioni([], "", undefined);
  const perGiocatore = [...new Set(filtrate.map((v) => v.giocatoreId))].map((giocatoreId) => {
    const c = contaValutazioni(filtrate, giocatoreId);
    for (const f of fondamentali) {
      squadra[f.id].piu += c[f.id].piu;
      squadra[f.id].meno += c[f.id].meno;
    }
    return { giocatoreId, conteggi: c };
  });
  return { squadra, perGiocatore };
}

/**
 * I + di un giocatore in un set, esclusa la ricezione (che qui non vale come punto messo a
 * terra): quello che compare nel suo riquadro dello scout.
 */
export function contaPiuSenzaRicezione(
  valutazioni: Valutazione[],
  giocatoreId: string,
  set: number,
): number {
  return valutazioni.filter(
    (v) =>
      v.giocatoreId === giocatoreId &&
      v.set === set &&
      v.segno === "+" &&
      v.fondamentale !== "ricezione",
  ).length;
}

/**
 * Parziali da archiviare: i set chiusi più il set in corso, se ha qualcosa dentro (punti o
 * valutazioni). Senza punteggio un set vale 0-0: serve solo a numerarlo.
 */
export function parzialiFinali(
  setChiusi: Array<[number, number]>,
  corrente: [number, number],
  haDati: boolean,
): Array<[number, number]> {
  return haDati ? [...setChiusi, corrente] : setChiusi;
}

export type ScoutMatch = {
  id: string;
  data: string;
  avversario: string;
  casa: boolean;
  setNostri: number;
  setLoro: number;
  parziali: Array<[number, number]>;
  azioni: Azione[];
  valutazioni: Valutazione[];
};

type RigaScoutPartita = {
  id: string;
  data: string;
  avversario: string;
  casa: boolean;
  set_nostri: number;
  set_loro: number;
  parziali: unknown;
  azioni: unknown;
  valutazioni: unknown;
};

function daRiga(r: RigaScoutPartita): ScoutMatch {
  return {
    id: r.id,
    data: r.data,
    avversario: r.avversario,
    casa: r.casa,
    setNostri: r.set_nostri,
    setLoro: r.set_loro,
    parziali: (r.parziali as Array<[number, number]> | null) ?? [],
    azioni: (r.azioni as Azione[] | null) ?? [],
    valutazioni: (r.valutazioni as Valutazione[] | null) ?? [],
  };
}

export const SCOUT_MATCHES_KEY = ["scout-partite"] as const;

async function fetchScoutMatches(): Promise<ScoutMatch[]> {
  const { data, error } = await supabase
    .from("scout_partite")
    .select("id, data, avversario, casa, set_nostri, set_loro, parziali, azioni, valutazioni")
    .order("creato_il", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(daRiga);
}

/** Partite scoutate condivise con tutta la squadra: chi scoutizza le vede da qualsiasi
 *  dispositivo, non solo da quello di chi ha chiuso la partita. */
export function useScoutMatches(): ScoutMatch[] {
  const { data } = useQuery({
    queryKey: SCOUT_MATCHES_KEY,
    staleTime: 60_000,
    queryFn: fetchScoutMatches,
  });
  return data ?? [];
}

export function useSalvaScoutMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventoId: string | null; match: ScoutMatch }) => {
      const { error } = await supabase.from("scout_partite").insert({
        id: input.match.id,
        evento_id: input.eventoId,
        data: input.match.data,
        avversario: input.match.avversario,
        casa: input.match.casa,
        set_nostri: input.match.setNostri,
        set_loro: input.match.setLoro,
        parziali: JSON.parse(JSON.stringify(input.match.parziali)),
        azioni: JSON.parse(JSON.stringify(input.match.azioni)),
        valutazioni: JSON.parse(JSON.stringify(input.match.valutazioni)),
      });
      if (error) throw error;
      return input.match;
    },
    // La query ordina per `creato_il` decrescente: la partita appena salvata è la più recente.
    onSuccess: (match) =>
      queryClient.setQueryData<ScoutMatch[]>(SCOUT_MATCHES_KEY, (prec) => [
        match,
        ...(prec ?? []).filter((m) => m.id !== match.id),
      ]),
  });
}

export function useEliminaScoutMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scout_partite").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) =>
      queryClient.setQueryData<ScoutMatch[]>(SCOUT_MATCHES_KEY, (prec) =>
        (prec ?? []).filter((m) => m.id !== id),
      ),
  });
}

/**
 * Una partita scoutata ha un risultato solo se ha registrato punti: quelle fatte di sole
 * valutazioni − / + hanno parziali 0-0 e non devono sostituire il referto ufficiale né
 * comparire come risultato in Home e Classifica.
 */
export function haPunteggio(match: Pick<ScoutMatch, "parziali">): boolean {
  return match.parziali.some(([n, l]) => n + l > 0);
}

/** Somma delle azioni di un match per giocatore. */
export function totaliPerGiocatore(azioni: Azione[]) {
  const out = new Map<string, { punti: number; ace: number; muri: number; errori: number }>();
  for (const a of azioni) {
    if (!a.giocatoreId) continue;
    const cur = out.get(a.giocatoreId) ?? { punti: 0, ace: 0, muri: 0, errori: 0 };
    if (a.tipo === "attacco") cur.punti += 1;
    if (a.tipo === "ace") {
      cur.ace += 1;
      cur.punti += 1;
    }
    if (a.tipo === "muro") {
      cur.muri += 1;
      cur.punti += 1;
    }
    if (a.tipo === "errore") cur.errori += 1;
    out.set(a.giocatoreId, cur);
  }
  return out;
}

/** Totali di squadra ricavati dallo scout (dato tecnico, non personale). */
export function totaliSquadra(matches: ScoutMatch[]) {
  const out = { punti: 0, ace: 0, muri: 0, errori: 0 };
  for (const m of matches) {
    for (const t of totaliPerGiocatore(m.azioni).values()) {
      out.punti += t.punti;
      out.ace += t.ace;
      out.muri += t.muri;
      out.errori += t.errori;
    }
  }
  return out;
}

export type TotaliTecnici = { punti: number; ace: number; attacchi: number; muri: number };

/**
 * Somma, su tutte le partite scoutate, delle sole valutazioni **+** (battuta → ace, attacco →
 * attacchi, muro → muri; punti = ace + attacchi + muri, non la ricezione). Con `giocatoreId`
 * conta solo quel giocatore, altrimenti tutta la squadra. Una partita senza valutazioni (metodo
 * precedente) conta con le sue azioni; se ha entrambe valgono solo le valutazioni, per non
 * contare due volte.
 */
export function totaliTecnici(matches: ScoutMatch[], giocatoreId?: string): TotaliTecnici {
  const out = { punti: 0, ace: 0, attacchi: 0, muri: 0 };
  for (const m of matches) {
    if (m.valutazioni.length === 0) {
      for (const [id, t] of totaliPerGiocatore(m.azioni)) {
        if (giocatoreId !== undefined && id !== giocatoreId) continue;
        out.ace += t.ace;
        out.muri += t.muri;
        out.attacchi += t.punti - t.ace - t.muri;
        out.punti += t.punti;
      }
      continue;
    }
    for (const v of m.valutazioni) {
      if (v.segno !== "+" || v.fondamentale === "ricezione") continue;
      if (giocatoreId !== undefined && v.giocatoreId !== giocatoreId) continue;
      if (v.fondamentale === "battuta") out.ace += 1;
      if (v.fondamentale === "attacco") out.attacchi += 1;
      if (v.fondamentale === "muro") out.muri += 1;
      out.punti += 1;
    }
  }
  return out;
}

/** Punti, ace e muri di squadra per la tab Stats di `/squadra` (vedi `totaliTecnici`). */
export function totaliSquadraValutazioni(matches: ScoutMatch[]) {
  const { punti, ace, muri } = totaliTecnici(matches);
  return { punti, ace, muri };
}

/**
 * MVP ricavati dalle partite scoutate (mappa matchId → nome vincitore).
 * Le presenze personali restano su `risposte_presenze`, non sullo scout.
 */
export function giocatoriConScout(
  matches: ScoutMatch[],
  mvpPerMatch: Record<string, string> = {},
): Giocatore[] {
  return giocatori.map((g) => {
    let mvp = 0;
    for (const m of matches) {
      if (mvpPerMatch[m.id] === g.nome) mvp += 1;
    }
    return {
      ...g,
      mvp,
    };
  });
}
