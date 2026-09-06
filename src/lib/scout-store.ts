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

export type ScoutMatch = {
  id: string;
  data: string;
  avversario: string;
  casa: boolean;
  setNostri: number;
  setLoro: number;
  parziali: Array<[number, number]>;
  azioni: Azione[];
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
  };
}

export const SCOUT_MATCHES_KEY = ["scout-partite"] as const;

async function fetchScoutMatches(): Promise<ScoutMatch[]> {
  const { data, error } = await supabase
    .from("scout_partite")
    .select("id, data, avversario, casa, set_nostri, set_loro, parziali, azioni")
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
