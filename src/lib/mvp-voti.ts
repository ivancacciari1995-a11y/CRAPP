import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VotoMvp = {
  match_id: string;
  votante_id: string;
  votato_id: string;
  votato_nome: string;
};

const CHIAVE = ["mvp-voti"] as const;

/** Tutti i voti MVP della squadra (poche righe, si carica tutto).
 *  Nessun polling: la lista si aggiorna dopo il proprio voto o al rientro sull'app. */
export function useVotiMvp() {
  return useQuery({
    queryKey: CHIAVE,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<VotoMvp[]> => {
      const { data, error } = await supabase
        .from("mvp_voti")
        .select("match_id, votante_id, votato_id, votato_nome");
      if (error) throw error;
      return (data ?? []) as VotoMvp[];
    },
  });
}

export function useVotaMvp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (voto: VotoMvp) => {
      const { error } = await supabase
        .from("mvp_voti")
        .upsert(voto, { onConflict: "match_id,votante_id" });
      if (error) throw error;
      return voto;
    },
    // Aggiorna la cache localmente: nessuna rilettura dal database.
    onSuccess: (voto) => {
      qc.setQueryData<VotoMvp[]>(CHIAVE, (prec) => {
        const altri = (prec ?? []).filter(
          (v) => !(v.match_id === voto.match_id && v.votante_id === voto.votante_id),
        );
        return [...altri, voto];
      });
    },
  });
}

export type ConteggioMvp = { id: string; nome: string; voti: number };

/** Conteggio voti di una partita, dal più votato. */
export function conteggioPartita(voti: VotoMvp[], matchId: string): ConteggioMvp[] {
  const map = new Map<string, ConteggioMvp>();
  for (const v of voti) {
    if (v.match_id !== matchId) continue;
    const cur = map.get(v.votato_id) ?? { id: v.votato_id, nome: v.votato_nome, voti: 0 };
    cur.voti += 1;
    map.set(v.votato_id, cur);
  }
  return [...map.values()].sort((a, b) => b.voti - a.voti || a.nome.localeCompare(b.nome));
}

/** Vincitore per ogni partita votata: matchId -> nome MVP. */
export function vincitoriMvp(voti: VotoMvp[]): Record<string, string> {
  const perMatch = new Map<string, VotoMvp[]>();
  for (const v of voti) {
    const arr = perMatch.get(v.match_id) ?? [];
    arr.push(v);
    perMatch.set(v.match_id, arr);
  }
  const out: Record<string, string> = {};
  for (const [matchId] of perMatch) {
    const top = conteggioPartita(voti, matchId);
    // In caso di parità nessun MVP assegnato finché il voto non si sblocca.
    if (top.length > 0 && (top.length === 1 || top[0]!.voti > top[1]!.voti)) {
      out[matchId] = top[0]!.nome;
    }
  }
  return out;
}

export function mioVoto(voti: VotoMvp[], matchId: string, votanteId: string) {
  return voti.find((v) => v.match_id === matchId && v.votante_id === votanteId) ?? null;
}

/** MVP vinti per giocatore, contando una vittoria per partita votata. */
export function mvpVintiPerGiocatore(voti: VotoMvp[]): Record<string, number> {
  const out: Record<string, number> = {};
  const matchIds = new Set(voti.map((v) => v.match_id));
  for (const matchId of matchIds) {
    const top = conteggioPartita(voti, matchId);
    if (top.length > 0 && (top.length === 1 || top[0]!.voti > top[1]!.voti)) {
      const id = top[0]!.id;
      out[id] = (out[id] ?? 0) + 1;
    }
  }
  return out;
}
