import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Voto anonimo da 1 a 10 dato a un compagno per una partita. */
export type VotoPagella = {
  match_id: string;
  votante_id: string;
  votato_id: string;
  voto: number;
};

export const PAGELLE_KEY = ["pagelle"] as const;

/** Poche righe per stagione: una lettura per sessione basta. */
export function usePagelle() {
  const query = useQuery({
    queryKey: PAGELLE_KEY,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<VotoPagella[]> => {
      const { data, error } = await supabase
        .from("pagelle_voti")
        .select("match_id, votante_id, votato_id, voto");
      if (error) throw error;
      return (data ?? []) as VotoPagella[];
    },
  });
  return { ...query, voti: query.data ?? [] };
}

export function useVotaPagella() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (voto: VotoPagella) => {
      const { error } = await supabase
        .from("pagelle_voti")
        .upsert(voto, { onConflict: "match_id,votante_id,votato_id" });
      if (error) throw error;
      return voto;
    },
    // Cache aggiornata localmente: nessuna rilettura.
    onSuccess: (voto) => {
      qc.setQueryData<VotoPagella[]>(PAGELLE_KEY, (prec) => {
        const altri = (prec ?? []).filter(
          (v) =>
            !(
              v.match_id === voto.match_id &&
              v.votante_id === voto.votante_id &&
              v.votato_id === voto.votato_id
            ),
        );
        return [...altri, voto];
      });
    },
  });
}

export type MediaPagella = { media: number; voti: number };

function arrotonda(n: number) {
  return Math.round(n * 10) / 10;
}

/** Media stagionale di ciascun giocatore: giocatoreId -> media e numero di voti. */
export function mediePagelle(voti: VotoPagella[]): Record<string, MediaPagella> {
  const somma: Record<string, { tot: number; n: number }> = {};
  for (const v of voti) {
    const cur = somma[v.votato_id] ?? { tot: 0, n: 0 };
    cur.tot += v.voto;
    cur.n += 1;
    somma[v.votato_id] = cur;
  }
  const out: Record<string, MediaPagella> = {};
  for (const [id, s] of Object.entries(somma)) {
    out[id] = { media: arrotonda(s.tot / s.n), voti: s.n };
  }
  return out;
}

/** Media della singola partita, giocatore per giocatore (voti anonimi). */
export function pagellePartita(voti: VotoPagella[], matchId: string): Record<string, MediaPagella> {
  return mediePagelle(voti.filter((v) => v.match_id === matchId));
}

/** I voti che ho già dato in questa partita: votatoId -> voto. */
export function mieiVoti(voti: VotoPagella[], matchId: string, votanteId: string) {
  const out: Record<string, number> = {};
  for (const v of voti) {
    if (v.match_id === matchId && v.votante_id === votanteId) out[v.votato_id] = v.voto;
  }
  return out;
}

/** Media pagelle di tutta la squadra su tutte le partite. */
export function mediaSquadra(voti: VotoPagella[]) {
  if (voti.length === 0) return 0;
  return arrotonda(voti.reduce((s, v) => s + v.voto, 0) / voti.length);
}
